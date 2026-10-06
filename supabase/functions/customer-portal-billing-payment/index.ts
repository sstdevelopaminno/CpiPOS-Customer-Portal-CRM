import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const MAX_SLIP=4*1024*1024;
const JSON_HEADERS={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FILE_EXT:Record<string,string>={"image/jpeg":"jpg","image/png":"png","image/webp":"webp"};

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
function validMagic(bytes:Uint8Array,mime:string){
  if(mime==="image/jpeg")return bytes.length>3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
  if(mime==="image/png")return bytes.length>8&&bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4e&&bytes[3]===0x47;
  if(mime==="image/webp")return bytes.length>12&&String.fromCharCode(...bytes.slice(0,4))==="RIFF"&&String.fromCharCode(...bytes.slice(8,12))==="WEBP";
  return false;
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS"){
    if(!allowedOrigin(req))return json(req,{error:"origin_not_allowed"},403);
    return new Response(null,{status:204,headers:headers(req)});
  }
  if(req.method!=="POST")return json(req,{error:"method_not_allowed"},405);
  if(!allowedOrigin(req))return json(req,{error:"origin_not_allowed"},403);

  const token=(req.headers.get("authorization")??"").replace(/^Bearer\s+/i,"").trim();
  if(!token)return json(req,{error:"unauthorized"},401);
  const length=Number(req.headers.get("content-length")||0);
  if(length>MAX_SLIP+32000)return json(req,{error:"upload_too_large"},413);

  const admin=createClient(Deno.env.get("SUPABASE_URL")??"",adminKey(),{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:userData,error:userError}=await admin.auth.getUser(token);
  const actor=userData.user;
  if(userError||!actor)return json(req,{error:"unauthorized"},401);

  try{
    const form=await req.formData().catch(()=>null);
    if(!form)return json(req,{error:"invalid_form"},422);
    const tenantId=String(form.get("tenant_id")??"");
    const requestedKey=String(form.get("request_key")??"");
    const packageId=String(form.get("package_id")??"");
    const billingCycleId=String(form.get("billing_cycle_id")??"")||null;
    const requestedBillingInterval=String(form.get("billing_interval")??"monthly");
    const slip=form.get("slip");

    if(!UUID.test(tenantId)||!UUID.test(requestedKey)||!UUID.test(packageId))return json(req,{error:"invalid_request"},422);
    if(billingCycleId&&!UUID.test(billingCycleId))return json(req,{error:"invalid_cycle"},422);
    if(!["monthly","yearly"].includes(requestedBillingInterval))return json(req,{error:"invalid_interval"},422);
    if(!(slip instanceof File)||slip.size<=0||slip.size>MAX_SLIP||!FILE_EXT[slip.type])return json(req,{error:"slip_required"},422);

    const bytes=new Uint8Array(await slip.arrayBuffer());
    if(!validMagic(bytes,slip.type))return json(req,{error:"slip_type_invalid"},422);

    const [{data:profile},{data:roles,error:roleError}]=await Promise.all([
      admin.from("users_profiles").select("is_active,archived_at").eq("id",actor.id).maybeSingle(),
      admin.from("user_branch_roles").select("role").eq("tenant_id",tenantId).eq("user_id",actor.id)
    ]);
    if(roleError||!profile?.is_active||profile.archived_at)return json(req,{error:"forbidden"},403);
    const isOwner=(roles??[]).some(row=>row.role==="owner");
    if(!isOwner)return json(req,{error:"owner_required"},403);

    const {data:contract,error:contractError}=await admin
      .from("tenant_subscription_contracts")
      .select("id,package_id,status,billing_interval,amount_per_cycle,currency,ended_at")
      .eq("tenant_id",tenantId).order("created_at",{ascending:false}).limit(1).maybeSingle();
    if(contractError||!contract)return json(req,{error:"contract_unavailable"},422);
    if(contract.package_id!==packageId)return json(req,{error:"package_mismatch"},409);
    const billingInterval=contract.billing_interval==="yearly"?"yearly":"monthly";
    if(requestedBillingInterval!==billingInterval)return json(req,{error:"billing_interval_mismatch"},409);

    const payableStatuses=new Set(["open","due","overdue","pending"]);
    let expected=Number(contract.amount_per_cycle??0);
    if(billingCycleId){
      const {data:cycle,error:cycleError}=await admin
        .from("tenant_billing_cycles")
        .select("id,package_id,amount_due,amount_paid,status")
        .eq("id",billingCycleId).eq("tenant_id",tenantId).maybeSingle();
      if(cycleError||!cycle)return json(req,{error:"cycle_not_found"},404);
      if(cycle.package_id&&cycle.package_id!==packageId)return json(req,{error:"cycle_package_mismatch"},409);
      expected=Math.max(0,Number(cycle.amount_due??0)-Number(cycle.amount_paid??0));
      if(!payableStatuses.has(String(cycle.status??""))){
        return json(req,{error:cycle.status==="paid"?"cycle_already_paid":"cycle_not_payable"},409);
      }
      if(expected<=0)return json(req,{error:"cycle_already_paid"},409);
    }else{
      const [{data:runtime,error:runtimeError},{data:cycles,error:cyclesError}]=await Promise.all([
        admin.from("tenant_subscription_runtime")
          .select("expires_at")
          .eq("tenant_id",tenantId)
          .maybeSingle(),
        admin.from("tenant_billing_cycles")
          .select("id,status,amount_due,amount_paid")
          .eq("tenant_id",tenantId)
          .in("status",Array.from(payableStatuses))
          .limit(50)
      ]);
      if(runtimeError||cyclesError)return json(req,{error:"renewal_check_failed"},503);

      const hasPayableCycle=(cycles??[]).some(row=>
        payableStatuses.has(String(row.status??""))
        && Number(row.amount_due??0)>Number(row.amount_paid??0)
      );
      if(hasPayableCycle)return json(req,{error:"payable_cycle_exists"},409);

      const expiryRaw=runtime?.expires_at??contract.ended_at;
      const expiryMs=expiryRaw?new Date(expiryRaw).getTime():Number.NaN;
      const daysRemaining=Number.isFinite(expiryMs)?Math.ceil((expiryMs-Date.now())/86400000):Number.POSITIVE_INFINITY;
      if(daysRemaining>7)return json(req,{error:"renewal_not_due"},409);
    }
    if(!Number.isFinite(expected)||expected<=0)return json(req,{error:"amount_unavailable"},422);

    const {data:issuer}=await admin.from("it_communication_settings")
      .select("billing_bank_account_number,billing_promptpay_id").eq("id","default").maybeSingle();
    if(!issuer?.billing_bank_account_number&&!issuer?.billing_promptpay_id)return json(req,{error:"receiving_account_not_configured"},422);

    const {data:openRows,error:openError}=await admin
      .from("tenant_subscription_payment_requests")
      .select("id,request_type,requested_package_id,status,evidence_url,metadata")
      .eq("tenant_id",tenantId)
      .in("status",["pending","under_review"])
      .order("created_at",{ascending:false})
      .limit(20);
    if(openError)return json(req,{error:"request_check_failed"},503);

    const openCandidates=openRows??[];
    const matching=openCandidates.filter(row=>{
      const metadata=(row.metadata??{}) as Record<string,unknown>;
      const metadataCycle=typeof metadata.billing_cycle_id==="string"?metadata.billing_cycle_id:null;
      return row.status==="pending"
        && row.request_type==="renewal"
        && row.requested_package_id===packageId
        && !row.evidence_url
        && metadataCycle===billingCycleId;
    });
    const open=openCandidates.length===1&&matching.length===1?matching[0]:null;
    if(openCandidates.length>0&&!open){
      return json(req,{error:"open_request_exists",request_id:openCandidates[0]?.id??null},409);
    }

    const requestId=open?.id??requestedKey;
    const filePath=`${tenantId}/${requestId}/slip.${FILE_EXT[slip.type]}`;
    const upload=await admin.storage.from("subscription-payment-evidence").upload(filePath,bytes,{
      contentType:slip.type,cacheControl:"0",upsert:false
    });
    if(upload.error)return json(req,{error:"slip_upload_failed"},503);

    const metadata={
      ...(open?.metadata??{}),
      kind:"payment_notice",
      billing_interval:billingInterval,
      expected_amount:expected,
      billing_cycle_id:billingCycleId,
      source:"customer_portal_crm",
      submitted_by:actor.id,
      note:"Customer Portal package payment"
    };

    const result=open
      ? await admin.from("tenant_subscription_payment_requests").update({
          amount_reported:null,evidence_url:filePath,metadata,updated_at:new Date().toISOString()
        })
        .eq("id",requestId)
        .eq("tenant_id",tenantId)
        .eq("request_type","renewal")
        .eq("requested_package_id",packageId)
        .eq("status","pending")
        .is("evidence_url",null)
        .select("id,status")
        .maybeSingle()
      : await admin.from("tenant_subscription_payment_requests").insert({
          id:requestId,tenant_id:tenantId,requested_package_id:packageId,
          request_type:"renewal",amount_reported:null,currency:String(contract.currency??"THB"),
          evidence_url:filePath,status:"pending",metadata
        }).select("id,status").maybeSingle();

    if(result.error||!result.data){
      await admin.storage.from("subscription-payment-evidence").remove([filePath]);
      if(result.error?.code==="23505")return json(req,{error:"open_request_exists"},409);
      return json(req,{error:"request_save_failed"},503);
    }

    return json(req,{ok:true,id:result.data.id,status:result.data.status,expected_amount:expected},201);
  }catch(error){
    console.error("[customer-portal-billing-payment]",error instanceof Error?error.message:"unknown");
    return json(req,{error:"billing_payment_unavailable"},503);
  }
});
