import { supabase } from "../supabase";
import type { PosAdminModule, PosAdminSnapshot } from "../../types/pos-admin";

function explain(error: unknown) {
  const message=error instanceof Error?error.message:String((error as {message?:string}|null)?.message??error??"");
  if(message.includes("feature_not_enabled"))return new Error("ฟังก์ชันนี้ไม่ได้เปิดในแพ็กเกจ หรือถูกฝ่าย IT ปิดใช้งาน");
  if(message.includes("customer_portal_forbidden"))return new Error("บัญชีนี้ไม่มีสิทธิ์จัดการสาขาที่เลือก");
  if(message.includes("branch_required"))return new Error("กรุณาเลือกสาขาก่อนจัดการข้อมูล");
  if(message.includes("zone_in_use"))return new Error("ยังมีโต๊ะอยู่ในโซนนี้ กรุณาย้ายหรือลบโต๊ะก่อน");
  if(message.includes("device_quota_blocked"))return new Error("จำนวนเครื่องแคชเชียร์ถึงขีดจำกัดของแพ็กเกจแล้ว");
  if(message.includes("contract_suspended"))return new Error("สัญญาแพ็กเกจไม่ได้อยู่ในสถานะที่อนุญาตให้เพิ่มอุปกรณ์");
  if(message.includes("duplicate")||message.includes("23505"))return new Error("ข้อมูลซ้ำกับรายการที่มีอยู่แล้ว");
  if(message.includes("invalid_member_input"))return new Error("กรุณากรอกชื่อสมาชิกและเบอร์โทร 9–10 หลัก");
  if(message.includes("invalid_member_email"))return new Error("รูปแบบอีเมลสมาชิกไม่ถูกต้อง");
  if(message.includes("invalid_buffet_price"))return new Error("ราคาบุฟเฟ่ต้องมากกว่า 0 บาท");
  return new Error(message||"ไม่สามารถดำเนินการกับข้อมูล POS ได้");
}

export async function loadPosAdminSnapshot<T extends PosAdminSnapshot>(
  tenantId:string, branchId:string, module:PosAdminModule
):Promise<T>{
  const {data,error}=await supabase.rpc("customer_portal_pos_admin_snapshot",{
    p_tenant_id:tenantId,p_branch_id:branchId,p_module:module
  });
  if(error)throw explain(error);
  return data as unknown as T;
}

export async function mutatePosAdmin<T=Record<string,unknown>>(
  tenantId:string, branchId:string, action:string, payload:Record<string,unknown>
):Promise<T>{
  const {data,error}=await supabase.rpc("customer_portal_pos_admin_mutate",{
    p_tenant_id:tenantId,p_branch_id:branchId,p_action:action,p_payload:payload
  });
  if(error)throw explain(error);
  return data as unknown as T;
}
