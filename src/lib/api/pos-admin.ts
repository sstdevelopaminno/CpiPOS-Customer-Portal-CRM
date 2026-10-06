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
  if(message.includes("printer_name_required"))return new Error("กรุณาระบุชื่อเครื่องพิมพ์");
  if(message.includes("printer_purpose_required"))return new Error("กรุณาเลือกหน้าที่ของเครื่องพิมพ์อย่างน้อย 1 รายการ");
  if(message.includes("lan_ip_required"))return new Error("เครื่องพิมพ์ LAN ต้องระบุ IP Address");
  if(message.includes("printer_zone_invalid"))return new Error("โซนครัวที่เลือกไม่ถูกต้องหรือถูกปิดใช้งาน");
  if(message.includes("customer_display_pairing_conflict"))return new Error("รหัส Pairing เกิดการชนกัน กรุณาสร้างรหัสใหม่อีกครั้ง");
  if(message.includes("pairing_not_found"))return new Error("ไม่พบการเชื่อมต่อ Customer Display");
  if(message.includes("layout_object_not_found"))return new Error("ไม่พบวัตถุในผังร้าน");
  return new Error(message||"ไม่สามารถดำเนินการกับข้อมูล POS ได้");
}

export async function loadPosAdminSnapshot<T extends PosAdminSnapshot>(
  tenantId:string, branchId:string, module:PosAdminModule
):Promise<T>{
  const rpc=["tables","kitchen","printers","display"].includes(module)
    ?"customer_portal_pos_admin_phase2_snapshot"
    :"customer_portal_pos_admin_snapshot";
  const {data,error}=await supabase.rpc(rpc,{
    p_tenant_id:tenantId,p_branch_id:branchId,p_module:module
  });
  if(error)throw explain(error);
  return data as unknown as T;
}

export async function mutatePosAdmin<T=Record<string,unknown>>(
  tenantId:string, branchId:string, action:string, payload:Record<string,unknown>
):Promise<T>{
  const phase2=action.startsWith("floor_plan.")||action.startsWith("layout_object.")||action.startsWith("printer.")||action.startsWith("display.");
  const {data,error}=await supabase.rpc(phase2?"customer_portal_pos_admin_phase2_mutate":"customer_portal_pos_admin_mutate",{
    p_tenant_id:tenantId,p_branch_id:branchId,p_action:action,p_payload:payload
  });
  if(error)throw explain(error);
  return data as unknown as T;
}
