import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import bcrypt from "npm:bcryptjs@2.4.3";

const JSON_HEADERS={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ONLINE_MS=5*60*1000;
type JsonRecord=Record<string,unknown>;
type AgentRow={id:string;device_id:string|null;device_code:string;agent_name:string;status:string;last_seen_at:string|null;last_claim_at:string|null;app_version:string|null;metadata:JsonRecord|null};
type PrinterRow={id:string;printer_name:string;printer_role:string;connection_type:string;paper_width_mm:number;enabled:boolean;ip_address:string|null;port:number|null;metadata:JsonRecord|null};
type JobRow={id:string;order_id:string|null;printer_id:string|null;printer_role:string;connection_type:string;status:string;retry_count:number;max_retry_count:number;last_error:string|null;printed_at:string|null;failed_at:string|null;created_at:string;updated_at:string;claimed_by_agent_id:string|null;claimed_at:string|null;claim_expires_at:string|null;agent_error_code:string|null;kitchen_ticket_id:string|null;metadata:JsonRecord|null;payload_json:JsonRecord|null};

function secretKey(){const set=Deno.env.get("SUPABASE_SECRET_KEYS");if(set){try{const p=JSON.parse(set) as Record<string,string>;if(p.default)return p.default;}catch{}}const legacy=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");if(legacy)return legacy;throw new Error("admin_key_missing");}
function publishableKey(){const set=Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");if(set){try{const p=JSON.parse(set) as Record<string,string>;if(p.default)return p.default;}catch{}}const legacy=Deno.env.get("SUPABASE_ANON_KEY");if(legacy)return legacy;throw new Error("publishable_key_missing");}
function allowedOrigin(req:Request){const o=req.headers.get("origin")??"";if(!o)return "";if(o==="http://localhost:5173"||o==="http://127.0.0.1:5173")return o;if(/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(o))return o;return "";}
function headers(req:Request){const o=allowedOrigin(req);return{...JSON_HEADERS,...(o?{"access-control-allow-origin":o,vary:"origin"}:{}),"access-control-allow-headers":"authorization, apikey, content-type, x-client-info","access-control-allow-methods":"POST, OPTIONS"};}
function json(req:Request,body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:headers(req)});}
function asRecord(value:unknown):JsonRecord{return value&&typeof value==="object"&&!Array.isArray(value)?value as JsonRecord:{};}
function readStringArray(value:unknown){if(typeof value==="string")return[value.trim()].filter(Boolean);if(!Array.isArray(value))return[];return value.map(v=>typeof v==="string"?v.trim():"").filter(Boolean);}
function isOnline(agent:AgentRow){if(agent.status!=="active"||!agent.last_seen_at)return false;const seen=new Date(agent.last_seen_at).getTime();return Number.isFinite(seen)&&Date.now()-seen<=ONLINE_MS;}
function matches(profile:PrinterRow,agent:AgentRow){
  const metadata=asRecord(profile.metadata);
  const ids=readStringArray(metadata.assigned_agent_id??metadata.assigned_agent_ids??metadata.agent_id??metadata.agent_ids);
  const devices=readStringArray(metadata.agent_device_code??metadata.agent_device_codes??metadata.device_code??metadata.device_codes).map(v=>v.toUpperCase());
  if(ids.length)return ids.includes(agent.id);
  if(devices.length)return devices.includes(agent.device_code.toUpperCase());
  return true;
}
function safeAgent(agent:AgentRow){
  const metadata=asRecord(agent.metadata);
  return {id:agent.id,device_id:agent.device_id,device_code:agent.device_code,agent_name:agent.agent_name,status:agent.status,last_seen_at:agent.last_seen_at,last_claim_at:agent.last_claim_at,app_version:agent.app_version,online:isOnline(agent),runtime:String(metadata.runtime??""),device_model:String(metadata.device_model??""),transports:Array.isArray(metadata.transports)?metadata.transports:[]};
}
function safeProfile(profile:PrinterRow,agents:AgentRow[],device:JsonRecord|null){
  const metadata=asRecord(profile.metadata);
  const matching=agents.filter(a=>matches(profile,a));
  const online=matching.filter(isOnline);
  const boundId=String(metadata.assigned_agent_id??metadata.agent_id??"").trim()||null;
  const boundDevice=String(metadata.agent_device_code??metadata.device_code??"").trim()||null;
  return {id:profile.id,printer_name:profile.printer_name,printer_role:profile.printer_role,connection_type:profile.connection_type,paper_width_mm:profile.paper_width_mm,enabled:profile.enabled,ip_address:profile.ip_address,port:profile.port,bound_agent_id:boundId,bound_device_code:boundDevice,binding_mode:boundId||boundDevice?"specific":"branch_any",matching_agent_count:matching.length,online_agent_count:online.length,ready:profile.enabled&&online.length>0,device};
}
function safeJob(job:JobRow,printerName:string|null,lastAttempt:JsonRecord|null){
  const metadata=asRecord(job.metadata);const payload=asRecord(job.payload_json);
  const command=String(metadata.command??"");
  const testPrint=metadata.test_print===true||metadata.request_source==="customer_portal_printer_test";
  const retryAllowed=job.status==="failed"&&!command&&!job.kitchen_ticket_id&&(job.printer_role!=="kitchen"||testPrint);
  return {id:job.id,order_id:job.order_id,printer_id:job.printer_id,printer_name:printerName,printer_role:job.printer_role,connection_type:job.connection_type,status:job.status,retry_count:job.retry_count,max_retry_count:job.max_retry_count,last_error:job.last_error,printed_at:job.printed_at,failed_at:job.failed_at,created_at:job.created_at,updated_at:job.updated_at,claimed_by_agent_id:job.claimed_by_agent_id,claimed_at:job.claimed_at,claim_expires_at:job.claim_expires_at,agent_error_code:job.agent_error_code,request_source:String(metadata.request_source??""),document_type:String(payload.document_type??metadata.document_type??(testPrint?"test_page":"")),document_id:String(payload.document_id??metadata.document_id??"")||null,test_print:testPrint,retry_allowed:retryAllowed,last_attempt:lastAttempt};
}
async function authorize(req:Request,tenantId:string,branchId:string){
  const authHeader=req.headers.get("authorization")??"";const token=authHeader.replace(/^Bearer\s+/i,"").trim();if(!token)throw new Error("unauthorized");
  const url=Deno.env.get("SUPABASE_URL")??"";const admin=createClient(url,secretKey(),{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:userData,error:userError}=await admin.auth.getUser(token);const actor=userData.user;if(userError||!actor)throw new Error("unauthorized");
  const [{data:profile,error:profileError},{data:roles,error:roleError},{data:branch,error:branchError}]=await Promise.all([
    admin.from("users_profiles").select("is_active,archived_at").eq("id",actor.id).maybeSingle(),
    admin.from("user_branch_roles").select("branch_id,role").eq("tenant_id",tenantId).eq("user_id",actor.id),
    admin.from("branches").select("id,is_active").eq("tenant_id",tenantId).eq("id",branchId).maybeSingle()
  ]);
  if(profileError||roleError||branchError)throw new Error("authorization_unavailable");
  if(!profile?.is_active||profile.archived_at||!branch?.is_active)throw new Error("forbidden");
  const owner=(roles??[]).some(r=>r.role==="owner");const manager=(roles??[]).some(r=>r.role==="manager"&&r.branch_id===branchId);if(!owner&&!manager)throw new Error("forbidden");
  const userClient=createClient(url,publishableKey(),{global:{headers:{Authorization:authHeader}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:featureState,error:featureError}=await userClient.rpc("customer_portal_feature_state",{p_tenant_id:tenantId,p_branch_id:branchId});if(featureError)throw new Error("feature_state_unavailable");
  const state=(featureState??{}) as JsonRecord;const pf=asRecord(state.package_features),fo=asRecord(state.feature_overrides),mp=asRecord(state.menu_policy);
  const base=Boolean(pf.core_pos_sales);const feature=Object.prototype.hasOwnProperty.call(fo,"core_pos_sales")?Boolean(fo.core_pos_sales):base;const menu=Object.prototype.hasOwnProperty.call(mp,"settings.printers")?Boolean(mp["settings.printers"]):true;
  if(!feature||!menu)throw new Error("feature_not_enabled");
  return {admin,actor,role:owner?"owner":"manager"};
}
async function getAgents(admin:ReturnType<typeof createClient>,tenantId:string,branchId:string){
  const {data,error}=await admin.from("print_agents").select("id,device_id,device_code,agent_name,status,last_seen_at,last_claim_at,app_version,metadata").eq("tenant_id",tenantId).eq("branch_id",branchId).order("agent_name");
  if(error)throw error;return(data??[]) as AgentRow[];
}
async function getPrinters(admin:ReturnType<typeof createClient>,tenantId:string,branchId:string){
  const {data,error}=await admin.from("printer_profiles").select("id,printer_name,printer_role,connection_type,paper_width_mm,enabled,ip_address,port,metadata").eq("tenant_id",tenantId).eq("branch_id",branchId).order("printer_name");
  if(error)throw error;return(data??[]) as PrinterRow[];
}
async function audit(admin:ReturnType<typeof createClient>,input:{tenantId:string;branchId:string;actorId:string;role:string;action:string;targetTable:string;targetId:string;metadata:JsonRecord;overrideId?:string|null}){
  const {error}=await admin.from("audit_logs").insert({tenant_id:input.tenantId,branch_id:input.branchId,actor_user_id:input.actorId,actor_role:input.role,action:input.action,target_table:input.targetTable,target_id:input.targetId,metadata:input.metadata,user_id:input.actorId,role:input.role,module:"customer_portal",entity_type:input.targetTable,entity_id:input.targetId,override_by_user_id:input.overrideId??null});
  if(error)throw error;
}
async function verifyPin(admin:ReturnType<typeof createClient>,tenantId:string,branchId:string,pin:string){
  if(!/^\d{4,12}$/.test(pin))return null;
  const {data:roles,error}=await admin.from("user_branch_roles").select("user_id,role").eq("tenant_id",tenantId).eq("branch_id",branchId).in("role",["owner","manager"]);
  if(error)throw error;const ids=(roles??[]).map(r=>r.user_id);if(!ids.length)return null;
  const {data:profiles,error:profilesError}=await admin.from("users_profiles").select("id,pin_hash,is_active,archived_at").in("id",ids).eq("is_active",true).is("archived_at",null);
  if(profilesError)throw profilesError;
  for(const p of profiles??[]){if(p.pin_hash&&await bcrypt.compare(pin,p.pin_hash)){const role=(roles??[]).find(r=>r.user_id===p.id)?.role??"manager";return{id:p.id,role};}}
  return null;
}
async function loadState(admin:ReturnType<typeof createClient>,tenantId:string,branchId:string){
  const [agents,printers,deviceResult,jobResult]=await Promise.all([
    getAgents(admin,tenantId,branchId),getPrinters(admin,tenantId,branchId),
    admin.from("printer_devices").select("id,printer_profile_id,display_name,status,runtime_device_code,last_seen_at,is_active,connection_mode,paper_width_mm").eq("tenant_id",tenantId).eq("branch_id",branchId),
    admin.from("print_jobs").select("id,order_id,printer_id,printer_role,connection_type,status,retry_count,max_retry_count,last_error,printed_at,failed_at,created_at,updated_at,claimed_by_agent_id,claimed_at,claim_expires_at,agent_error_code,kitchen_ticket_id,metadata,payload_json").eq("tenant_id",tenantId).eq("branch_id",branchId).order("created_at",{ascending:false}).limit(50)
  ]);
  if(deviceResult.error)throw deviceResult.error;if(jobResult.error)throw jobResult.error;
  const jobs=(jobResult.data??[]) as JobRow[];const ids=jobs.map(j=>j.id);let attempts:JsonRecord[]=[];
  if(ids.length){const r=await admin.from("print_job_attempts").select("id,print_job_id,agent_id,attempt_no,status,claimed_at,completed_at,error_code,error_message,provider_job_id,bytes_sent").eq("tenant_id",tenantId).eq("branch_id",branchId).in("print_job_id",ids).order("attempt_no",{ascending:false});if(r.error)throw r.error;attempts=(r.data??[]) as JsonRecord[];}
  const attemptByJob=new Map<string,JsonRecord>();for(const a of attempts){const id=String(a.print_job_id??"");if(id&&!attemptByJob.has(id))attemptByJob.set(id,a);}
  const deviceByPrinter=new Map((deviceResult.data??[]).filter(d=>d.printer_profile_id).map(d=>[String(d.printer_profile_id),d as JsonRecord]));
  const nameByPrinter=new Map(printers.map(p=>[p.id,p.printer_name]));
  const safeProfiles=printers.map(p=>safeProfile(p,agents,deviceByPrinter.get(p.id)??null));
  const safeJobs=jobs.map(j=>safeJob(j,j.printer_id?nameByPrinter.get(j.printer_id)??null:null,attemptByJob.get(j.id)??null));
  return {agents:agents.map(safeAgent),printers:safeProfiles,jobs:safeJobs,summary:{online_agents:agents.filter(isOnline).length,total_agents:agents.length,ready_printers:safeProfiles.filter(p=>p.ready).length,total_printers:printers.length,queued_jobs:safeJobs.filter(j=>["pending","printing","retrying"].includes(j.status)).length,failed_jobs:safeJobs.filter(j=>j.status==="failed").length}};
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS"){if(!allowedOrigin(req))return json(req,{error:"origin_not_allowed"},403);return new Response(null,{status:204,headers:headers(req)});}
  if(req.method!=="POST")return json(req,{error:"method_not_allowed"},405);
  if(!allowedOrigin(req))return json(req,{error:"origin_not_allowed"},403);
  try{
    const body=await req.json().catch(()=>({})) as JsonRecord;const action=String(body.action??"state");const tenantId=String(body.tenant_id??"");const branchId=String(body.branch_id??"");
    if(!UUID.test(tenantId)||!UUID.test(branchId))return json(req,{error:"invalid_scope"},422);
    const {admin,actor,role}=await authorize(req,tenantId,branchId);
    if(action==="state")return json(req,{ok:true,...await loadState(admin,tenantId,branchId)});

    const printerId=String(body.printer_id??"");if(!UUID.test(printerId))return json(req,{error:"printer_id_required"},422);
    const printers=await getPrinters(admin,tenantId,branchId);const printer=printers.find(p=>p.id===printerId);if(!printer)return json(req,{error:"printer_not_found"},404);

    if(action==="bind_agent"||action==="use_branch_agents"){
      const before=asRecord(printer.metadata);let metadata={...before};
      if(action==="bind_agent"){
        const agentId=String(body.agent_id??"");if(!UUID.test(agentId))return json(req,{error:"agent_id_required"},422);
        const agents=await getAgents(admin,tenantId,branchId);const agent=agents.find(a=>a.id===agentId);if(!agent)return json(req,{error:"agent_not_found"},404);
        metadata={...metadata,assigned_agent_id:agent.id,agent_device_code:agent.device_code,print_mode:"agent",processing_mode:"print_agent",queue_only:true};
      }else{
        for(const key of["assigned_agent_id","assigned_agent_ids","agent_id","agent_ids","agent_device_code","agent_device_codes","device_code","device_codes"])delete metadata[key];
      }
      const {error}=await admin.from("printer_profiles").update({metadata,updated_at:new Date().toISOString()}).eq("id",printerId).eq("tenant_id",tenantId).eq("branch_id",branchId);if(error)throw error;
      await audit(admin,{tenantId,branchId,actorId:actor.id,role,action:action==="bind_agent"?"printer_agent_bound":"printer_agent_scope_reset",targetTable:"printer_profiles",targetId:printerId,metadata:{source:"customer_portal",agent_id:action==="bind_agent"?String(body.agent_id??""):null}});
      return json(req,{ok:true,...await loadState(admin,tenantId,branchId)});
    }

    const agents=await getAgents(admin,tenantId,branchId);const online=agents.filter(a=>matches(printer,a)&&isOnline(a));
    if(!printer.enabled)return json(req,{error:"printer_disabled"},409);
    if(!online.length)return json(req,{error:"printer_agent_offline"},409);

    if(action==="test_print"){
      const requestId=String(body.request_id??"");if(!UUID.test(requestId))return json(req,{error:"request_id_required"},422);
      const now=new Date().toISOString();const width=printer.paper_width_mm===58?32:42;const line="-".repeat(width);
      const payload=["CpiPOS",line,"ทดสอบเครื่องพิมพ์ / TEST PRINT","Printer: "+printer.printer_name,"Role: "+printer.printer_role,"Connection: "+printer.connection_type,"Paper: "+printer.paper_width_mm+"mm","Agent: "+online[0].device_code,"Time: "+new Intl.DateTimeFormat("th-TH",{dateStyle:"short",timeStyle:"medium",timeZone:"Asia/Bangkok"}).format(new Date()),line,"Customer Portal Printer Health",""].join("\n");
      const idempotency=["crm","test_print",printer.id,requestId].join(":").slice(0,180);
      const {data:job,error}=await admin.from("print_jobs").insert({tenant_id:tenantId,branch_id:branchId,order_id:null,printer_id:printer.id,printer_role:printer.printer_role,connection_type:printer.connection_type,status:"pending",payload_text:payload,payload_json:{document_type:"test_page",printer_name:printer.printer_name,paper_width_mm:printer.paper_width_mm},retry_count:0,max_retry_count:3,created_by:actor.id,idempotency_key:idempotency,metadata:{request_source:"customer_portal_printer_test",test_print:true,paper_width_mm:printer.paper_width_mm,requested_by:actor.id,created_at:now}}).select("id,status,created_at").single();
      if(error)throw error;
      await audit(admin,{tenantId,branchId,actorId:actor.id,role,action:"printer_test_print_queued",targetTable:"print_jobs",targetId:job.id,metadata:{source:"customer_portal",printer_id:printer.id,printer_name:printer.printer_name}});
      return json(req,{ok:true,job,message:"ส่ง Test Print เข้าคิว Print Agent แล้ว"},201);
    }

    if(action==="retry_job"){
      const jobId=String(body.job_id??"");if(!UUID.test(jobId))return json(req,{error:"job_id_required"},422);
      const approver=await verifyPin(admin,tenantId,branchId,String(body.manager_pin??""));if(!approver)return json(req,{error:"pin_rejected"},403);
      const {data:job,error:jobError}=await admin.from("print_jobs").select("id,order_id,printer_id,printer_role,connection_type,status,retry_count,max_retry_count,last_error,printed_at,failed_at,created_at,updated_at,claimed_by_agent_id,claimed_at,claim_expires_at,agent_error_code,kitchen_ticket_id,metadata,payload_json").eq("id",jobId).eq("tenant_id",tenantId).eq("branch_id",branchId).maybeSingle();
      if(jobError)throw jobError;if(!job)return json(req,{error:"job_not_found"},404);
      const row=job as JobRow;const meta=asRecord(row.metadata);const testPrint=meta.test_print===true||meta.request_source==="customer_portal_printer_test";
      if(row.status!=="failed")return json(req,{error:"job_not_failed"},409);
      if(meta.command||row.kitchen_ticket_id||(row.printer_role==="kitchen"&&!testPrint))return json(req,{error:"job_retry_not_allowed"},409);
      if(row.printer_id!==printerId)return json(req,{error:"job_printer_mismatch"},409);
      const nextMeta={...meta,manual_retry_by:actor.id,manual_retry_approved_by:approver.id,manual_retry_at:new Date().toISOString(),retry_after_epoch_ms:null,retry_backoff_seconds:null};
      const {data:updated,error:updateError}=await admin.from("print_jobs").update({status:"pending",retry_count:0,last_error:null,failed_at:null,claimed_by_agent_id:null,claimed_at:null,claim_expires_at:null,agent_attempt_id:null,agent_error_code:null,metadata:nextMeta,updated_at:new Date().toISOString()}).eq("id",jobId).eq("tenant_id",tenantId).eq("branch_id",branchId).eq("status","failed").select("id,status").maybeSingle();
      if(updateError)throw updateError;if(!updated)return json(req,{error:"job_not_failed"},409);
      await audit(admin,{tenantId,branchId,actorId:actor.id,role,action:"printer_job_manual_retry",targetTable:"print_jobs",targetId:jobId,overrideId:approver.id,metadata:{source:"customer_portal",printer_id:printerId,previous_retry_count:row.retry_count}});
      return json(req,{ok:true,...await loadState(admin,tenantId,branchId)});
    }
    return json(req,{error:"invalid_action"},422);
  }catch(error){
    console.error("[customer-portal-printer-admin]",error instanceof Error?error.message:"unknown");
    const message=error instanceof Error?error.message:"";
    if(message==="unauthorized")return json(req,{error:"unauthorized"},401);
    if(message==="forbidden")return json(req,{error:"forbidden"},403);
    if(message==="feature_not_enabled")return json(req,{error:"feature_not_enabled"},403);
    if(message==="authorization_unavailable"||message==="feature_state_unavailable")return json(req,{error:message},503);
    return json(req,{error:"printer_admin_unavailable"},503);
  }
});
