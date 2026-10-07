import { supabase,supabaseKey,supabaseUrl } from "../supabase";

export type PrinterHealthAgent={
  id:string;device_id:string|null;device_code:string;agent_name:string;status:string;last_seen_at:string|null;last_claim_at:string|null;
  app_version:string|null;online:boolean;runtime:string;device_model:string;transports:unknown[];
};
export type PrinterHealthProfile={
  id:string;printer_name:string;printer_role:string;connection_type:string;paper_width_mm:number;enabled:boolean;ip_address:string|null;port:number|null;
  bound_agent_id:string|null;bound_device_code:string|null;binding_mode:"specific"|"branch_any";matching_agent_count:number;online_agent_count:number;ready:boolean;
  device:Record<string,unknown>|null;
};
export type PrinterDiscoveryCandidate={
  id:string;display_name:string;brand:string|null;model:string|null;connection_mode:"usb"|"bluetooth";paper_width_mm:58|80;
  runtime_device_code:string|null;status:string;last_seen_at:string|null;agent_id:string|null;agent_name:string|null;agent_online:boolean;
  verification_state:string;verification_attempts:number;verification_code:string|null;source:string;ready_for_setup:boolean;
  capabilities:Record<string,unknown>;
};
export type PrinterHealthJob={
  id:string;order_id:string|null;printer_id:string|null;printer_name:string|null;printer_role:string;connection_type:string;status:string;retry_count:number;max_retry_count:number;
  last_error:string|null;printed_at:string|null;failed_at:string|null;created_at:string;updated_at:string;claimed_by_agent_id:string|null;claimed_at:string|null;claim_expires_at:string|null;
  agent_error_code:string|null;request_source:string;document_type:string;document_id:string|null;test_print:boolean;retry_allowed:boolean;last_attempt:Record<string,unknown>|null;
};
export type PrinterHealthState={
  agents:PrinterHealthAgent[];printers:PrinterHealthProfile[];candidates:PrinterDiscoveryCandidate[];jobs:PrinterHealthJob[];
  summary:{online_agents:number;total_agents:number;ready_printers:number;total_printers:number;discovered_printers:number;setup_ready_printers:number;queued_jobs:number;failed_jobs:number};
};

function explain(code:string){
  if(code==="forbidden")return "บัญชีนี้ไม่มีสิทธิ์จัดการเครื่องพิมพ์ของสาขานี้";
  if(code==="feature_not_enabled")return "แพ็กเกจหรือฝ่าย IT ปิดเมนูเครื่องพิมพ์ไว้";
  if(code==="printer_not_found")return "ไม่พบเครื่องพิมพ์ในสาขานี้";
  if(code==="agent_not_found")return "ไม่พบ Print Agent ในสาขานี้";
  if(code==="printer_disabled")return "เครื่องพิมพ์ถูกปิดใช้งาน กรุณาเชื่อมใหม่ก่อน";
  if(code==="printer_agent_offline")return "ไม่มี Print Agent ที่ตรงกับเครื่องพิมพ์และ online ภายใน 5 นาที";
  if(code==="pin_rejected")return "PIN Owner/Manager ไม่ถูกต้อง";
  if(code==="job_not_failed")return "Retry ได้เฉพาะงานที่สถานะล้มเหลว";
  if(code==="job_retry_not_allowed")return "งานประเภทนี้ไม่อนุญาตให้ Retry จาก CRM เพื่อป้องกันการพิมพ์/คำสั่งซ้ำ";
  if(code==="job_printer_mismatch")return "งานพิมพ์ไม่ตรงกับเครื่องที่เลือก";
  return "ไม่สามารถดำเนินการ Printer Health ได้";
}
async function call<T>(payload:Record<string,unknown>):Promise<T>{
  const {data}=await supabase.auth.getSession();const token=data.session?.access_token;if(!token)throw new Error("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
  const response=await fetch(supabaseUrl+"/functions/v1/customer-portal-printer-admin",{method:"POST",headers:{apikey:supabaseKey,authorization:"Bearer "+token,"content-type":"application/json"},body:JSON.stringify(payload)});
  const body=await response.json().catch(()=>({})) as {error?:string}&T;if(!response.ok)throw new Error(explain(body.error??""));return body;
}
export async function loadPrinterHealth(tenantId:string,branchId:string){return call<PrinterHealthState>({action:"state",tenant_id:tenantId,branch_id:branchId});}
export async function bindPrinterAgent(tenantId:string,branchId:string,printerId:string,agentId:string|null){
  return call<PrinterHealthState>({action:agentId?"bind_agent":"use_branch_agents",tenant_id:tenantId,branch_id:branchId,printer_id:printerId,...(agentId?{agent_id:agentId}:{})});
}
export async function queuePrinterTest(tenantId:string,branchId:string,printerId:string){
  return call<{job:{id:string;status:string;created_at:string};message:string}>({action:"test_print",tenant_id:tenantId,branch_id:branchId,printer_id:printerId,request_id:crypto.randomUUID()});
}
export async function retryPrinterJob(tenantId:string,branchId:string,printerId:string,jobId:string,managerPin:string){
  return call<PrinterHealthState>({action:"retry_job",tenant_id:tenantId,branch_id:branchId,printer_id:printerId,job_id:jobId,manager_pin:managerPin});
}
