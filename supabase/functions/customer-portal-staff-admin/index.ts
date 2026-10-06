import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import bcrypt from "npm:bcryptjs@2.4.3";

const JSON_HEADERS={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};

function adminKey(){
  const set=Deno.env.get("SUPABASE_SECRET_KEYS");
  if(set){try{const parsed=JSON.parse(set) as Record<string,string>;if(parsed.default)return parsed.default;}catch{}}
  const legacy=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(legacy)return legacy;
  throw new Error("admin_key_missing");
}
function allowedOrigin(req:Request){
  const origin=req.headers.get("origin")??"";
  if(!origin)return "";
  if(origin==="http://localhost:5173"||origin==="http://127.0.0.1:5173")return origin;
  if(/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin))return origin;
  return "";
}
function headers(req:Request){
  const origin=allowedOrigin(req);
  return {
    ...JSON_HEADERS,
    ...(origin?{"access-control-allow-origin":origin,vary:"origin"}:{}),
    "access-control-allow-headers":"authorization, apikey, content-type, x-client-info",
    "access-control-allow-methods":"POST, OPTIONS"
  };
}
function json(req:Request,body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:headers(req)});}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS"){
    if(!allowedOrigin(req))return json(req,{error:"origin_not_allowed"},403);
    return new Response(null,{status:204,headers:headers(req)});
  }
  if(req.method!=="POST")return json(req,{error:"method_not_allowed"},405);
  if(!allowedOrigin(req))return json(req,{error:"origin_not_allowed"},403);

  const authHeader=req.headers.get("authorization")??"";
  const token=authHeader.replace(/^Bearer\s+/i,"").trim();
  if(!token)return json(req,{error:"unauthorized"},401);

  const admin=createClient(Deno.env.get("SUPABASE_URL")??"",adminKey(),{
    auth:{persistSession:false,autoRefreshToken:false}
  });

  const {data:userData,error:userError}=await admin.auth.getUser(token);
  const actor=userData.user;
  if(userError||!actor)return json(req,{error:"unauthorized"},401);

  try{
    const body=await req.json().catch(()=>({})) as Record<string,unknown>;
    const action=String(body.action??"create");
    const tenantId=String(body.tenant_id??"");
    const branchId=String(body.branch_id??"");
    const employeeCode=String(body.employee_code??"").trim();
    const fullName=String(body.full_name??"").trim();
    const positionTitle=String(body.position_title??"").trim().slice(0,120);
    const branchRole=String(body.branch_role??"staff");
    const permissionRole=String(body.permission_role??"pos_user").trim().slice(0,80)||"pos_user";

    if(!/^[0-9a-f-]{36}$/i.test(tenantId)||!/^[0-9a-f-]{36}$/i.test(branchId))return json(req,{error:"invalid_scope"},400);

    const {data:actorRoles,error:roleError}=await admin.from("user_branch_roles").select("branch_id,role").eq("tenant_id",tenantId).eq("user_id",actor.id);
    if(roleError)return json(req,{error:"authorization_unavailable"},503);

    const isOwner=(actorRoles??[]).some((row)=>row.role==="owner");
    const isBranchManager=(actorRoles??[]).some((row)=>row.role==="manager"&&row.branch_id===branchId);
    if(!isOwner&&!isBranchManager)return json(req,{error:"forbidden"},403);
    if(!isOwner&&["owner","manager"].includes(branchRole))return json(req,{error:"manager_cannot_grant_privileged_role"},403);

    const {data:branch,error:branchError}=await admin.from("branches").select("id,is_active").eq("id",branchId).eq("tenant_id",tenantId).maybeSingle();
    if(branchError||!branch?.is_active)return json(req,{error:"branch_not_found"},404);

    if(action==="set_pin"){
      const userId=String(body.user_id??"");
      const pin=String(body.pin??"").trim();
      if(!/^[0-9a-f-]{36}$/i.test(userId))return json(req,{error:"invalid_user"},400);
      if(!/^\d{4,12}$/.test(pin))return json(req,{error:"invalid_pin"},422);

      const {data:targetRole,error:targetError}=await admin
        .from("user_branch_roles")
        .select("role")
        .eq("tenant_id",tenantId)
        .eq("branch_id",branchId)
        .eq("user_id",userId)
        .maybeSingle();
      if(targetError||!targetRole)return json(req,{error:"staff_not_found"},404);
      if(!isOwner&&["owner","manager"].includes(String(targetRole.role)))return json(req,{error:"manager_cannot_edit_privileged_staff"},403);

      const pinHash=await bcrypt.hash(pin,10);
      const {data:updated,error:updateError}=await admin
        .from("users_profiles")
        .update({pin_hash:pinHash,updated_at:new Date().toISOString()})
        .eq("id",userId)
        .select("id")
        .maybeSingle();
      if(updateError||!updated)return json(req,{error:"pin_update_failed"},503);
      return json(req,{ok:true,user_id:userId,action:"set_pin"});
    }

    if(action!=="create")return json(req,{error:"invalid_action"},400);
    if(!/^[A-Za-z0-9._-]{2,32}$/.test(employeeCode))return json(req,{error:"invalid_employee_code"},400);
    if(!fullName||fullName.length>180)return json(req,{error:"invalid_full_name"},400);
    if(!["owner","manager","staff","kitchen"].includes(branchRole))return json(req,{error:"invalid_branch_role"},400);
    const createPin=String(body.pin??"").trim();
    if(createPin&&!/^\d{4,12}$/.test(createPin))return json(req,{error:"invalid_pin"},422);

    const {data:existing}=await admin.from("pos_user_profiles").select("user_id").eq("tenant_id",tenantId).eq("employee_code",employeeCode).maybeSingle();
    if(existing)return json(req,{error:"duplicate_employee_code"},409);

    const syntheticEmail=`portal-${tenantId.slice(0,8)}-${employeeCode}-${crypto.randomUUID().slice(0,8)}@users.cpipos.app`;
    const generatedPassword=`${crypto.randomUUID()}Aa1!`;

    const {data:createData,error:createError}=await admin.auth.admin.createUser({
      email:syntheticEmail,password:generatedPassword,email_confirm:true,
      user_metadata:{source:"customer_portal",tenant_id:tenantId,employee_code:employeeCode}
    });
    const created=createData.user;
    if(createError||!created){
      console.error("[customer-portal-staff-admin] auth create failed",createError?.message??"missing_user");
      return json(req,{error:"staff_create_failed"},503);
    }

    try{
      const pinHash=createPin?await bcrypt.hash(createPin,10):null;
      const {error:profileError}=await admin.from("users_profiles").insert({
        id:created.id,email:syntheticEmail,full_name:fullName,platform_role:"tenant_user",is_active:true,
        ...(pinHash?{pin_hash:pinHash}:{})
      });
      if(profileError)throw profileError;

      const {error:posError}=await admin.from("pos_user_profiles").insert({
        tenant_id:tenantId,user_id:created.id,employee_code:employeeCode,
        position_title:positionTitle,permission_role:permissionRole
      });
      if(posError)throw posError;

      const {error:branchRoleError}=await admin.from("user_branch_roles").insert({
        user_id:created.id,tenant_id:tenantId,branch_id:branchId,role:branchRole,is_default:true
      });
      if(branchRoleError)throw branchRoleError;
    }catch(dbError){
      const cleanupErrors:string[]=[];

      for(const table of ["user_branch_roles","pos_user_profiles","users_profiles"]){
        const query=admin
          .from(table)
          .delete()
          .eq(table==="users_profiles"?"id":"user_id",created.id);
        const scoped=table==="users_profiles"?query:query.eq("tenant_id",tenantId);
        const {error:cleanupError}=await scoped;
        if(cleanupError)cleanupErrors.push(table+":"+cleanupError.message);
      }

      let {error:authDeleteError}=await admin.auth.admin.deleteUser(created.id);
      if(authDeleteError){
        await new Promise(resolve=>setTimeout(resolve,200));
        ({error:authDeleteError}=await admin.auth.admin.deleteUser(created.id));
      }
      if(authDeleteError)cleanupErrors.push("auth:"+authDeleteError.message);

      console.error(
        "[customer-portal-staff-admin] profile create failed",
        dbError instanceof Error?dbError.message:"db_error",
        cleanupErrors.length?{cleanup_errors:cleanupErrors}:undefined
      );
      return json(req,{error:cleanupErrors.length?"staff_profile_create_failed_cleanup_pending":"staff_profile_create_failed"},503);
    }

    return json(req,{ok:true,user_id:created.id},201);
  }catch(error){
    console.error("[customer-portal-staff-admin] unexpected",error instanceof Error?error.message:"unknown");
    return json(req,{error:"staff_admin_unavailable"},503);
  }
});
