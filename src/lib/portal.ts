import { supabase, supabaseKey, supabaseUrl } from "./supabase";

export type PortalRole = "owner" | "manager";
export type PortalView = "dashboard" | "sales" | "products" | "stock" | "staff" | "package";
export type ReportRange = "today" | "7d" | "30d";

export interface BranchSummary {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
}

export interface PortalContext {
  userId: string;
  tenantId: string;
  tenantCode: string;
  tenantName: string;
  logoUrl: string | null;
  role: PortalRole;
  branches: BranchSummary[];
  allowedBranchIds: string[];
}

export interface TopProduct {
  name: string;
  quantity: number;
  sales_total: number;
}

export interface DashboardSummary {
  sales_total: number;
  order_count: number;
  average_ticket: number;
  active_products: number;
  active_branches: number;
  low_stock_count: number;
  open_shifts: number;
  top_products: TopProduct[];
  from: string;
  to: string;
  branch_id: string | null;
}

export interface OrderRow {
  id: string;
  branch_id: string;
  order_no: string | null;
  order_type: string | null;
  channel: string | null;
  customer_name: string | null;
  subtotal: number | null;
  discount_amount: number | null;
  total_amount: number | null;
  grand_total: number | null;
  tax_total: number | null;
  paid_total: number | null;
  status: string;
  created_at: string;
}

export interface OrderItemRow {
  id: string;
  name: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  notes: string | null;
}

export interface ProductRow {
  id: string;
  branch_id: string;
  sku: string | null;
  name: string;
  category: string | null;
  price: number;
  is_active: boolean;
}

export interface StockRow {
  id: string;
  branch_id: string;
  name: string;
  base_unit: string;
  quantity_on_hand: number;
  reorder_level: number | null;
}

export interface StaffRow {
  user_id: string;
  full_name: string;
  employee_code: string | null;
  position_title: string | null;
  permission_role: string | null;
  branch_id: string;
  branch_name: string;
  branch_role: string;
  is_active: boolean;
}

export interface PackageInfo {
  runtime: {
    lifecycle_status: string | null;
    access_locked: boolean | null;
    lock_reason: string | null;
    expires_at: string | null;
  } | null;
  contract: {
    contract_type: string | null;
    billing_interval: string | null;
    status: string | null;
    amount_per_cycle: number | null;
    currency: string | null;
    auto_renew: boolean | null;
    started_at: string | null;
    ended_at: string | null;
  } | null;
  billingCycles: Array<{
    period_start: string;
    period_end: string;
    amount_due: number;
    amount_paid: number;
    status: string;
  }>;
}

export function getReportWindow(range: ReportRange) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  if (range === "7d") start.setDate(start.getDate() - 6);
  if (range === "30d") start.setDate(start.getDate() - 29);
  return { from: start.toISOString(), to: now.toISOString() };
}

export function reportRangeLabel(range: ReportRange) {
  if (range === "7d") return "7 วัน";
  if (range === "30d") return "30 วัน";
  return "วันนี้";
}

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
    tenant?: { id?: string };
  };

  if (!response.ok || !payload.token_hash) {
    if (response.status === 429) throw new Error("ลองเข้าสู่ระบบหลายครั้งเกินไป กรุณารอประมาณ 15 นาที");
    if (response.status === 401) throw new Error("รหัสร้านหรือรหัสพนักงานไม่ถูกต้อง");
    throw new Error("ไม่สามารถเข้าสู่ระบบได้ในขณะนี้");
  }

  const { error } = await supabase.auth.verifyOtp({ token_hash: payload.token_hash, type: "email" });
  if (error) throw new Error("ไม่สามารถสร้างเซสชันเข้าสู่ระบบได้");

  if (payload.tenant?.id) localStorage.setItem("cpipos-customer-portal-tenant", payload.tenant.id);
}

export async function logoutPortal() {
  localStorage.removeItem("cpipos-customer-portal-tenant");
  localStorage.removeItem("cpipos-customer-portal-branch");
  await supabase.auth.signOut();
}

export async function loadPortalContext(): Promise<PortalContext> {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) throw new Error("not_authenticated");

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

  return {
    userId: user.id,
    tenantId,
    tenantCode: tenant.code,
    tenantName: tenant.display_name || tenant.name,
    logoUrl: tenant.logo_url,
    role,
    branches: (branches ?? []) as BranchSummary[],
    allowedBranchIds
  };
}

export async function loadDashboard(tenantId: string, branchId: string | null, range: ReportRange) {
  const { from, to } = getReportWindow(range);
  let recentQuery = supabase
    .from("orders")
    .select("id,branch_id,order_no,order_type,channel,customer_name,subtotal,discount_amount,total_amount,grand_total,tax_total,paid_total,status,created_at")
    .eq("tenant_id", tenantId)
    .eq("status", "completed")
    .gte("created_at", from)
    .lt("created_at", to)
    .order("created_at", { ascending: false })
    .limit(8);
  if (branchId) recentQuery = recentQuery.eq("branch_id", branchId);

  const [{ data: summary, error: summaryError }, { data: orders, error: ordersError }] = await Promise.all([
    supabase.rpc("customer_portal_dashboard_v2", {
      p_tenant_id: tenantId,
      p_branch_id: branchId,
      p_from: from,
      p_to: to
    }),
    recentQuery
  ]);
  if (summaryError) throw summaryError;
  if (ordersError) throw ordersError;
  return { summary: summary as DashboardSummary, recentOrders: (orders ?? []) as OrderRow[] };
}

export async function loadSales(tenantId: string, branchId: string | null, range: ReportRange) {
  const { from, to } = getReportWindow(range);
  let query = supabase
    .from("orders")
    .select("id,branch_id,order_no,order_type,channel,customer_name,subtotal,discount_amount,total_amount,grand_total,tax_total,paid_total,status,created_at")
    .eq("tenant_id", tenantId)
    .gte("created_at", from)
    .lt("created_at", to)
    .order("created_at", { ascending: false })
    .limit(200);
  if (branchId) query = query.eq("branch_id", branchId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as OrderRow[];
}

export async function loadOrderItems(orderId: string) {
  const { data, error } = await supabase
    .from("order_items")
    .select("id,name,quantity,unit_price,line_total,notes")
    .eq("order_id", orderId)
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as OrderItemRow[];
}

export async function loadProducts(tenantId: string, branchId: string | null) {
  let query = supabase
    .from("products")
    .select("id,branch_id,sku,name,category,price,is_active")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .order("name")
    .limit(300);
  if (branchId) query = query.eq("branch_id", branchId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ProductRow[];
}

export async function loadStock(tenantId: string, branchId: string | null) {
  let query = supabase
    .from("ingredients")
    .select("id,branch_id,name,base_unit,quantity_on_hand,reorder_level")
    .eq("tenant_id", tenantId)
    .order("name")
    .limit(300);
  if (branchId) query = query.eq("branch_id", branchId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as StockRow[];
}

export async function loadStaff(tenantId: string, branchId: string | null) {
  const { data, error } = await supabase.rpc("customer_portal_staff", {
    p_tenant_id: tenantId,
    p_branch_id: branchId
  });
  if (error) throw error;
  return (data ?? []) as StaffRow[];
}

export async function loadPackage(tenantId: string, role: PortalRole): Promise<PackageInfo> {
  const [{ data: runtime, error: runtimeError }, { data: contract, error: contractError }] = await Promise.all([
    supabase.from("tenant_subscription_runtime").select("lifecycle_status,access_locked,lock_reason,expires_at").eq("tenant_id", tenantId).maybeSingle(),
    supabase.from("tenant_subscription_contracts").select("contract_type,billing_interval,status,amount_per_cycle,currency,auto_renew,started_at,ended_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(1).maybeSingle()
  ]);
  if (runtimeError) throw runtimeError;
  if (contractError) throw contractError;

  let billingCycles: PackageInfo["billingCycles"] = [];
  if (role === "owner") {
    const { data, error } = await supabase
      .from("tenant_billing_cycles")
      .select("period_start,period_end,amount_due,amount_paid,status")
      .eq("tenant_id", tenantId)
      .order("period_end", { ascending: false })
      .limit(6);
    if (!error) billingCycles = (data ?? []) as PackageInfo["billingCycles"];
  }

  return {
    runtime: runtime as PackageInfo["runtime"],
    contract: contract as PackageInfo["contract"],
    billingCycles
  };
}
