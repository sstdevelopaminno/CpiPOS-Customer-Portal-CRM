import { supabase, supabaseKey, supabaseUrl } from "../supabase";
import type { BranchSummary, PortalContext, PortalRole } from "../../types/portal";

export async function loginWithStoreEmployeeCode(storeCode: string, employeeCode: string) {
  const response = await fetch(`${supabaseUrl}/functions/v1/customer-portal-login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: supabaseKey,
      authorization: `Bearer ${supabaseKey}`
    },
    body: JSON.stringify({ store_code: storeCode.trim(), employee_code: employeeCode.trim() })
  });

  const payload = await response.json().catch(() => ({})) as {
    error?: string;
    token_hash?: string;
    tenant?: { id?: string; code?: string };
  };

  if (!response.ok || !payload.token_hash) {
    if (response.status === 429) throw new Error("ลองเข้าสู่ระบบหลายครั้งเกินไป กรุณารอประมาณ 15 นาที");
    if (response.status === 401) throw new Error("รหัสร้านหรือรหัสพนักงานไม่ถูกต้อง");
    throw new Error("ไม่สามารถเข้าสู่ระบบได้ในขณะนี้");
  }

  const { error } = await supabase.auth.verifyOtp({ token_hash: payload.token_hash, type: "email" });
  if (error) throw new Error("ไม่สามารถสร้างเซสชันเข้าสู่ระบบได้");

  if (payload.tenant?.id) localStorage.setItem("cpipos-customer-portal-tenant", payload.tenant.id);
  if (payload.tenant?.code) localStorage.setItem("cpipos-customer-portal-store-code", payload.tenant.code);
}

export async function logoutPortal() {
  localStorage.removeItem("cpipos-customer-portal-tenant");
  localStorage.removeItem("cpipos-customer-portal-branch");
  localStorage.removeItem("cpipos-customer-portal-store-code");
  await supabase.auth.signOut();
}

export async function loadPortalContext(): Promise<PortalContext> {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) throw new Error("not_authenticated");

  const { data: profile, error: profileError } = await supabase
    .from("users_profiles")
    .select("is_active,archived_at")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile?.is_active || profile.archived_at) {
    await logoutPortal();
    throw new Error("portal_account_inactive");
  }

  const { data: roles, error: rolesError } = await supabase
    .from("user_branch_roles")
    .select("tenant_id,branch_id,role,is_default")
    .eq("user_id", user.id)
    .in("role", ["owner", "manager"])
    .order("is_default", { ascending: false });
  if (rolesError) throw rolesError;
  if (!roles?.length) {
    await logoutPortal();
    throw new Error("portal_role_required");
  }

  const storedTenant = localStorage.getItem("cpipos-customer-portal-tenant");
  const tenantId = roles.some((row) => row.tenant_id === storedTenant) ? storedTenant! : roles[0].tenant_id;
  localStorage.setItem("cpipos-customer-portal-tenant", tenantId);

  const tenantRoles = roles.filter((row) => row.tenant_id === tenantId);
  const role: PortalRole = tenantRoles.some((row) => row.role === "owner") ? "owner" : "manager";
  const allowedBranchIds = [...new Set(tenantRoles.map((row) => row.branch_id).filter(Boolean))];

  const [{ data: tenant, error: tenantError }, { data: branches, error: branchError }] = await Promise.all([
    supabase.from("tenants").select("id,code,name,display_name,logo_url").eq("id", tenantId).single(),
    supabase.from("branches").select("id,code,name,is_active").eq("tenant_id", tenantId).eq("is_active", true).order("name")
  ]);
  if (tenantError) throw tenantError;
  if (branchError) throw branchError;

  const allBranches = (branches ?? []) as BranchSummary[];
  const visibleBranches = role === "owner" ? allBranches : allBranches.filter((branch) => allowedBranchIds.includes(branch.id));

  return {
    userId: user.id,
    tenantId,
    tenantCode: localStorage.getItem("cpipos-customer-portal-store-code") || tenant.code,
    tenantName: tenant.display_name || tenant.name,
    logoUrl: tenant.logo_url,
    role,
    branches: visibleBranches,
    allowedBranchIds
  };
}
