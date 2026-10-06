import { supabase, supabaseKey, supabaseUrl } from "../supabase";
import { explainMutationError } from "../errors";
import type { StaffDraft, StaffRow } from "../../types/portal";

export async function loadStaff(tenantId: string, branchId: string | null) {
  const { data, error } = await supabase.rpc("customer_portal_staff", {
    p_tenant_id: tenantId,
    p_branch_id: branchId
  });
  if (error) throw error;
  return (data ?? []) as StaffRow[];
}

export async function createStaff(tenantId: string, draft: StaffDraft) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");

  const response = await fetch(`${supabaseUrl}/functions/v1/customer-portal-staff-admin`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: supabaseKey,
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      tenant_id: tenantId,
      branch_id: draft.branch_id,
      employee_code: draft.employee_code,
      full_name: draft.full_name,
      position_title: draft.position_title,
      branch_role: draft.branch_role,
      permission_role: draft.permission_role,
      pin: draft.pin || ""
    })
  });
  const payload = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) {
    if (payload.error === "duplicate_employee_code") throw new Error("รหัสพนักงานนี้มีอยู่แล้ว");
    if (payload.error === "manager_cannot_grant_privileged_role") throw new Error("Manager ไม่สามารถสร้าง Owner หรือ Manager ได้");
    throw new Error("ไม่สามารถสร้างพนักงานได้");
  }
}

export async function updateStaff(tenantId: string, draft: StaffDraft) {
  if (!draft.user_id) throw new Error("ไม่พบพนักงานที่ต้องการแก้ไข");
  const { error } = await supabase.rpc("customer_portal_update_staff_v2", {
    p_tenant_id: tenantId,
    p_branch_id: draft.branch_id,
    p_user_id: draft.user_id,
    p_full_name: draft.full_name,
    p_employee_code: draft.employee_code,
    p_position_title: draft.position_title,
    p_branch_role: draft.branch_role,
    p_permission_role: draft.permission_role,
    p_is_active: draft.is_active,
    p_pin: draft.pin?.trim() || null
  });
  if (error) throw new Error(explainMutationError(error.message));
}
