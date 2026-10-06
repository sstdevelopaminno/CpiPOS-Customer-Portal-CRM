import { supabase } from "../supabase";
import type { SettingsSnapshot } from "../../types/portal";

export async function loadSettingsSnapshot(tenantId: string, branchId: string | null): Promise<SettingsSnapshot> {
  const { data, error } = await supabase.rpc("customer_portal_settings_snapshot", {
    p_tenant_id: tenantId,
    p_branch_id: branchId
  });
  if (error) throw error;
  return data as unknown as SettingsSnapshot;
}

export async function saveSetting(
  tenantId:string,
  branchId:string|null,
  action:"update_store"|"save_branch"|"save_payment_account"|"save_tax"|"save_notifications",
  payload:Record<string,unknown>
){
  const {data,error}=await supabase.rpc("customer_portal_save_setting",{
    p_tenant_id:tenantId,
    p_branch_id:branchId,
    p_action:action,
    p_payload:payload
  });
  if(error){
    const message=String(error.message??"");
    if(message.includes("owner_required"))throw new Error("รายการนี้ต้องใช้สิทธิ์ Owner");
    if(message.includes("branch_limit_reached"))throw new Error("จำนวนสาขาถึงขีดจำกัดของแพ็กเกจแล้ว");
    if(message.includes("setting_conflict"))throw new Error("มีการตั้งค่าที่ใช้งานในขอบเขตนี้อยู่แล้ว");
    throw new Error("ไม่สามารถบันทึกการตั้งค่าได้");
  }
  return data;
}
