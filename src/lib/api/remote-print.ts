import { supabase } from "../supabase";

export type RemotePrintAgent={
  id:string;agent_name:string;device_code:string;status:string;last_seen_at:string|null;app_version:string|null;online:boolean;
};
export type RemotePrintPrinter={
  id:string;printer_name:string;printer_role:string;connection_type:string;paper_width_mm:58|80;enabled:boolean;
  online_agent_count:number;last_agent_seen_at:string|null;ready:boolean;
};
export type RemotePrintJob={
  id:string;order_id:string|null;printer_id:string|null;printer_name:string|null;status:string;document_type:string|null;
  retry_count:number;last_error:string|null;printed_at:string|null;failed_at:string|null;created_at:string;
  claimed_by_agent_id:string|null;claimed_at:string|null;claim_expires_at:string|null;
};
export type RemotePrintState={
  branch_id:string;receipt_print_allowed:boolean;tax_print_allowed:boolean;
  online_agents:RemotePrintAgent[];printers:RemotePrintPrinter[];recent_jobs:RemotePrintJob[];
};

function explain(message:string){
  if(message.includes("pin_rejected"))return "PIN Owner/Manager ไม่ถูกต้อง";
  if(message.includes("receipt_printer_not_configured"))return "ไม่พบเครื่องพิมพ์ใบเสร็จที่เปิดใช้งาน";
  if(message.includes("print_agent_offline"))return "Print Agent ของเครื่องพิมพ์นี้ออฟไลน์หรือไม่ได้ heartbeat ภายใน 5 นาที";
  if(message.includes("order_not_found"))return "ไม่พบบิลในสาขานี้";
  if(message.includes("tax_invoice_not_found"))return "ไม่พบใบกำกับภาษีในสาขานี้";
  if(message.includes("feature_not_enabled"))return "แพ็กเกจหรือฝ่าย IT ไม่อนุญาตเมนูพิมพ์นี้";
  return message||"ไม่สามารถส่งงานพิมพ์ได้";
}

export async function loadRemotePrintState(tenantId:string,branchId:string):Promise<RemotePrintState>{
  const {data,error}=await supabase.rpc("customer_portal_pos_admin_phase4_print_state",{p_tenant_id:tenantId,p_branch_id:branchId});
  if(error)throw new Error(explain(error.message));
  const value=(data??{}) as unknown as RemotePrintState;
  return {
    branch_id:value.branch_id??branchId,
    receipt_print_allowed:Boolean(value.receipt_print_allowed),
    tax_print_allowed:Boolean(value.tax_print_allowed),
    online_agents:Array.isArray(value.online_agents)?value.online_agents:[],
    printers:Array.isArray(value.printers)?value.printers:[],
    recent_jobs:Array.isArray(value.recent_jobs)?value.recent_jobs:[]
  };
}

export async function queueRemotePrint(input:{
  tenantId:string;branchId:string;documentType:"receipt"|"tax_invoice";documentId:string;printerId:string;managerPin:string;
}){
  const {data,error}=await supabase.rpc("customer_portal_pos_admin_phase4_queue_print",{
    p_tenant_id:input.tenantId,p_branch_id:input.branchId,p_document_type:input.documentType,
    p_document_id:input.documentId,p_printer_id:input.printerId,p_manager_pin:input.managerPin,
    p_request_id:crypto.randomUUID()
  });
  if(error)throw new Error(explain(error.message));
  return data as {job_id:string;status:string;printer_id:string;printer_name:string;document_type:string;queued_at:string};
}
