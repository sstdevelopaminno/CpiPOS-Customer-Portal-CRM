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
async function scanBridgeToken(){
  const raw=new TextEncoder().encode("cpipos:internal-subscription-slip-scan:v1|"+adminKey());
  const hash=new Uint8Array(await crypto.subtle.digest("SHA-256",raw));
  return Array.from(hash).map(value=>value.toString(16).padStart(2,"0")).join("");
}
async function scanSlip(input:{
  tenantId:string;requestId:string;storagePath:string;expectedAmount:number;
  payeeName:string;accountNumber:string;promptPayId:string;
}){
  const base=(Deno.env.get("CPIPOS_PRODUCTION_URL")??"https://cp-ipos-web.vercel.app").replace(/\/$/,"");
  const token=await scanBridgeToken();
  const response=await fetch(base+"/api/internal/subscription-slip-scan",{
    method:"POST",
    headers:{authorization:"Bearer "+token,"content-type":"application/json"},
    body:JSON.stringify({
      tenant_id:input.tenantId,request_id:input.requestId,storage_path:input.storagePath,
      expected_amount:input.expectedAmount,expected_payee_name:input.payeeName,
      expected_account_number:input.accountNumber,expected_promptpay_id:input.promptPayId
    }),
    signal:AbortSignal.timeout(35000)
  });
  const payload=await response.json().catch(()=>null) as {data?:{scan?:Record<string,unknown>};error?:{message?:string}}|null;
  if(!response.ok||!payload?.data?.scan){
    return {status:"error",parsed:{},checks:{passed:false,amount_match:null,payee_match:false,datetime_present:false,confidence_pass:false,issues:[payload?.error?.message??"scan_unavailable"]},model:"primary-cpipos-slip-scanner",error_message:payload?.error?.message??"scan_unavailable"} as Record<string,unknown>;
  }
  return payload.data.scan;
}
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

  const rawLength=req.headers.get("content-length");
  if(!rawLength)return json(req,{error:"content_length_required"},411);
  const length=Number(rawLength);
  if(!Number.isFinite(length)||length<=0)return json(req,{error:"invalid_content_length"},411);
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

    const ensured=await admin.rpc("ensure_tenant_subscription_billing_cycle",{p_tenant_id:tenantId});
    if(ensured.error)return json(req,{error:"billing_cycle_sync_failed"},503);

    const {data:contract,error:contractError}=await admin
      .from("tenant_subscription_contracts")
      .select("id,package_id,status,billing_interval,amount_per_cycle,currency,ended_at")
      .eq("tenant_id",tenantId).order("created_at",{ascending:false}).limit(1).maybeSingle();
    if(contractError||!contract)return json(req,{error:"contract_unavailable"},422);
    if(contract.package_id!==packageId)return json(req,{error:"package_mismatch"},409);
    const {data:dueState,error:dueError}=await admin.rpc("subscription_billing_due_state",{p_tenant_id:tenantId});
    if(dueError||!dueState)return json(req,{error:"billing_due_state_unavailable"},503);
    const due=(dueState??{}) as Record<string,unknown>;
    if(due.support_required===true||due.self_service_payment_allowed!==true){
      return json(req,{error:due.support_required===true?"payment_support_required":"renewal_not_due",status:String(due.status??"")},409);
    }
    const canonicalCycleId=typeof due.billing_cycle_id==="string"?due.billing_cycle_id:null;
    if(!canonicalCycleId)return json(req,{error:"billing_cycle_unavailable"},503);
    if(billingCycleId&&billingCycleId!==canonicalCycleId)return json(req,{error:"billing_cycle_mismatch"},409);
    const billingInterval=String(due.billing_interval??contract.billing_interval??"monthly")==="yearly"?"yearly":"monthly";
    if(requestedBillingInterval!==billingInterval)return json(req,{error:"billing_interval_mismatch"},409);
    if(typeof due.package_id==="string"&&due.package_id!==packageId)return json(req,{error:"package_mismatch"},409);

    const payableStatuses=new Set(["open","due","overdue"]);
    let expected=Number(due.outstanding??due.amount_due??contract.amount_per_cycle??0);
    const {data:cycle,error:cycleError}=await admin
      .from("tenant_billing_cycles")
      .select("id,package_id,amount_due,amount_paid,status")
      .eq("id",canonicalCycleId).eq("tenant_id",tenantId).maybeSingle();
    if(cycleError||!cycle)return json(req,{error:"cycle_not_found"},404);
    if(cycle.package_id&&cycle.package_id!==packageId)return json(req,{error:"cycle_package_mismatch"},409);
    expected=Math.max(0,Number(cycle.amount_due??0)-Number(cycle.amount_paid??0));
    if(!payableStatuses.has(String(cycle.status??"")))return json(req,{error:"cycle_not_payable",status:cycle.status},409);
    if(!Number.isFinite(expected)||expected<=0)return json(req,{error:"amount_unavailable"},422);

    const {data:issuer}=await admin.from("it_communication_settings")
      .select("billing_bank_account_name,billing_bank_account_number,billing_promptpay_id").eq("id","default").maybeSingle();
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
        && row.request_type===(String(due.kind??"")==="trial"?"trial_conversion":"renewal")
        && row.requested_package_id===packageId
        && !row.evidence_url
        && metadataCycle===canonicalCycleId;
    });
    const open=openCandidates.length===1&&matching.length===1?matching[0]:null;
    if(openCandidates.length>0&&!open){
      return json(req,{error:"open_request_exists",request_id:openCandidates[0]?.id??null},409);
    }

    const requestType=String(due.kind??"")==="trial"?"trial_conversion":"renewal";
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
      billing_cycle_id:canonicalCycleId,
      source:"customer_portal_crm",
      submitted_by:actor.id,
      due_at:typeof due.due_at==="string"?due.due_at:null,
      next_period_start:typeof due.next_period_start==="string"?due.next_period_start:null,
      next_period_end:typeof due.next_period_end==="string"?due.next_period_end:null,
      note:"Customer Portal package payment"
    };

    const result=open
      ? await admin.from("tenant_subscription_payment_requests").update({
          amount_reported:null,evidence_url:filePath,metadata,updated_at:new Date().toISOString()
        })
        .eq("id",requestId)
        .eq("tenant_id",tenantId)
        .eq("request_type",requestType)
        .eq("requested_package_id",packageId)
        .eq("status","pending")
        .is("evidence_url",null)
        .select("id,status")
        .maybeSingle()
      : await admin.from("tenant_subscription_payment_requests").insert({
          id:requestId,tenant_id:tenantId,requested_package_id:packageId,
          request_type:requestType,amount_reported:null,currency:String(contract.currency??"THB"),
          evidence_url:filePath,status:"pending",metadata
        }).select("id,status").maybeSingle();

    if(result.error||!result.data){
      await admin.storage.from("subscription-payment-evidence").remove([filePath]);
      if(result.error?.code==="23505")return json(req,{error:"open_request_exists"},409);
      return json(req,{error:"request_save_failed"},503);
    }

    const scan=await scanSlip({
      tenantId,requestId:result.data.id,storagePath:filePath,expectedAmount:expected,
      payeeName:String(issuer?.billing_bank_account_name??""),
      accountNumber:String(issuer?.billing_bank_account_number??""),
      promptPayId:String(issuer?.billing_promptpay_id??"")
    });
    const provisionalResult=await admin.rpc("grant_provisional_subscription_access",{
      p_request_id:result.data.id,p_scan:scan,p_actor_id:null
    });
    let provisional:Record<string,unknown>|null=null;
    if(!provisionalResult.error&&provisionalResult.data&&typeof provisionalResult.data==="object"){
      provisional=provisionalResult.data as Record<string,unknown>;
    }else if(provisionalResult.error){
      await admin.from("tenant_subscription_payment_requests").update({
        auto_check_status:"failed",
        auto_check_reason:("provisional_grant_failed:"+provisionalResult.error.message).slice(0,240),
        metadata:{...metadata,slip_ai:scan}
      }).eq("id",result.data.id);
    }
    return json(req,{
      ok:true,id:result.data.id,
      status:provisional?.granted===true?"under_review":result.data.status,
      expected_amount:expected,
      scan_status:String(scan.status??"error"),
      provisional_access:provisional?.granted===true,
      review_deadline:provisional?.review_deadline??provisional?.provisional_access_expires_at??null
    },201);
  }catch(error){
    console.error("[customer-portal-billing-payment]",error instanceof Error?error.message:"unknown");
    return json(req,{error:"billing_payment_unavailable"},503);
  }
});
