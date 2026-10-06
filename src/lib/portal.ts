import { supabase, supabaseKey, supabaseUrl } from "./supabase";

export type PortalRole = "owner" | "manager";
export type PortalView = "dashboard" | "sales" | "products" | "stock" | "staff" | "package";
export type ReportRange = "day" | "month" | "year";

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
  notes: string | null;
  subtotal: number | null;
  discount_amount: number | null;
  total_amount: number | null;
  grand_total: number | null;
  tax_total: number | null;
  paid_total: number | null;
  status: string;
  cancelled_reason: string | null;
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
  sku: string;
  name: string;
  category: string;
  price: number;
  is_combo: boolean;
  is_active: boolean;
  stock_deduction_mode: string;
  sell_unit: string;
  thumbnail_object_path: string | null;
  display_object_path: string | null;
  image_url: string | null;
  available_quantity: number | null;
  recipe_count: number;
}

export interface ProductDraft {
  id?: string | null;
  branch_id: string;
  sku: string;
  name: string;
  category: string;
  price: number;
  is_active: boolean;
  sell_unit: string;
  stock_deduction_mode: string;
}

export interface StockRow {
  id: string;
  branch_id: string;
  name: string;
  base_unit: string;
  quantity_on_hand: number;
  reorder_level: number;
  avg_unit_cost: number;
  last_purchase_unit_cost: number;
}

export interface StockDraft {
  id?: string | null;
  branch_id: string;
  name: string;
  base_unit: string;
  quantity_on_hand: number;
  reorder_level: number;
  avg_unit_cost: number;
  last_purchase_unit_cost: number;
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

export interface StaffDraft {
  user_id?: string | null;
  branch_id: string;
  full_name: string;
  employee_code: string;
  position_title: string;
  permission_role: string;
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

function localDateParts(anchor?: string) {
  const base = anchor ? new Date(`${anchor}T12:00:00`) : new Date();
  if (Number.isNaN(base.getTime())) return new Date();
  return base;
}

export function todayInputValue() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getReportWindow(range: ReportRange, anchor?: string) {
  const base = localDateParts(anchor);
  let start: Date;
  let end: Date;

  if (range === "year") {
    start = new Date(base.getFullYear(), 0, 1, 0, 0, 0, 0);
    end = new Date(base.getFullYear() + 1, 0, 1, 0, 0, 0, 0);
  } else if (range === "month") {
    start = new Date(base.getFullYear(), base.getMonth(), 1, 0, 0, 0, 0);
    end = new Date(base.getFullYear(), base.getMonth() + 1, 1, 0, 0, 0, 0);
  } else {
    start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, 0, 0, 0);
    end = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1, 0, 0, 0, 0);
  }

  return { from: start.toISOString(), to: end.toISOString() };
}

export function reportRangeLabel(range: ReportRange, anchor?: string) {
  const base = localDateParts(anchor);
  if (range === "year") return `ปี ${base.getFullYear() + 543}`;
  if (range === "month") return new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric" }).format(base);
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" }).format(base);
}

function explainMutationError(message?: string) {
  const value = String(message ?? "");
  if (value.includes("duplicate_product_sku")) return "รหัสสินค้า (SKU) นี้มีอยู่แล้วในสาขา";
  if (value.includes("duplicate_ingredient_name")) return "ชื่อวัตถุดิบนี้มีอยู่แล้วในสาขา";
  if (value.includes("duplicate_employee_code")) return "รหัสพนักงานนี้มีอยู่แล้ว";
  if (value.includes("ingredient_in_use_by_recipe")) return "ลบไม่ได้ เนื่องจากวัตถุดิบถูกใช้ในสูตรสินค้า";
  if (value.includes("ingredient_has_stock_history")) return "ลบไม่ได้ เนื่องจากวัตถุดิบมีประวัติการเคลื่อนไหวสต๊อก";
  if (value.includes("manager_cannot")) return "สิทธิ์ Manager ไม่สามารถแก้ไขหรือมอบสิทธิ์ระดับ Owner/Manager ได้";
  if (value.includes("invalid_order_notes")) return "หมายเหตุรายการขายต้องไม่เกิน 1,000 ตัวอักษร";
  if (value.includes("invalid_customer_name")) return "ชื่อลูกค้าต้องไม่เกิน 180 ตัวอักษร";
  if (value.includes("customer_portal_forbidden")) return "บัญชีนี้ไม่มีสิทธิ์ดำเนินการในสาขาที่เลือก";
  return value || "ไม่สามารถบันทึกข้อมูลได้";
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

const orderSelect = "id,branch_id,order_no,order_type,channel,customer_name,notes,subtotal,discount_amount,total_amount,grand_total,tax_total,paid_total,status,cancelled_reason,created_at";

export async function loadDashboard(tenantId: string, branchId: string | null, range: ReportRange, anchor: string) {
  const { from, to } = getReportWindow(range, anchor);
  let recentQuery = supabase
    .from("orders")
    .select(orderSelect)
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
  return { summary: summary as DashboardSummary, recentOrders: (orders ?? []) as unknown as OrderRow[] };
}

export async function loadSales(
  tenantId: string,
  branchId: string | null,
  range: ReportRange,
  anchor: string,
  page = 0,
  pageSize = 100
) {
  const { from, to } = getReportWindow(range, anchor);
  const safePage = Math.max(0, page);
  const safePageSize = Math.min(200, Math.max(25, pageSize));
  const offset = safePage * safePageSize;

  let salesQuery = supabase
    .from("orders")
    .select(orderSelect, { count: "exact" })
    .eq("tenant_id", tenantId)
    .gte("created_at", from)
    .lt("created_at", to)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (branchId) salesQuery = salesQuery.eq("branch_id", branchId);

  const [salesResult, summaryResult] = await Promise.all([
    salesQuery.range(offset, offset + safePageSize - 1),
    supabase.rpc("customer_portal_dashboard_v2", {
      p_tenant_id: tenantId,
      p_branch_id: branchId,
      p_from: from,
      p_to: to
    })
  ]);

  if (salesResult.error) throw salesResult.error;
  if (summaryResult.error) throw summaryResult.error;

  const summary = summaryResult.data as DashboardSummary;
  return {
    rows: (salesResult.data ?? []) as unknown as OrderRow[],
    total: salesResult.count ?? 0,
    salesTotal: Number(summary?.sales_total ?? 0)
  };
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

export async function updateOrder(tenantId: string, order: OrderRow, customerName: string, notes: string) {
  const { error } = await supabase.rpc("customer_portal_update_order", {
    p_tenant_id: tenantId,
    p_branch_id: order.branch_id,
    p_order_id: order.id,
    p_customer_name: customerName,
    p_notes: notes
  });
  if (error) throw new Error(explainMutationError(error.message));
}

export async function cancelOrder(tenantId: string, order: OrderRow, reason: string) {
  const { error } = await supabase.rpc("customer_portal_cancel_order", {
    p_tenant_id: tenantId,
    p_branch_id: order.branch_id,
    p_order_id: order.id,
    p_reason: reason
  });
  if (error) throw new Error(explainMutationError(error.message));
}

export async function loadProducts(tenantId: string, branchId: string | null) {
  const { data, error } = await supabase.rpc("customer_portal_products_v2", {
    p_tenant_id: tenantId,
    p_branch_id: branchId
  });
  if (error) throw error;

  return ((data ?? []) as Omit<ProductRow, "image_url">[]).map((row) => {
    const path = row.thumbnail_object_path || row.display_object_path;
    const image_url = path ? supabase.storage.from("product-media").getPublicUrl(path).data.publicUrl : null;
    return { ...row, image_url } as ProductRow;
  });
}

export async function saveProduct(tenantId: string, draft: ProductDraft) {
  const { data, error } = await supabase.rpc("customer_portal_upsert_product", {
    p_tenant_id: tenantId,
    p_branch_id: draft.branch_id,
    p_product_id: draft.id || null,
    p_sku: draft.sku,
    p_name: draft.name,
    p_category: draft.category,
    p_price: draft.price,
    p_is_active: draft.is_active,
    p_sell_unit: draft.sell_unit,
    p_stock_deduction_mode: draft.stock_deduction_mode
  });
  if (error) throw new Error(explainMutationError(error.message));
  return data as string;
}

export async function deleteProduct(tenantId: string, row: ProductRow) {
  const { error } = await supabase.rpc("customer_portal_delete_product", {
    p_tenant_id: tenantId,
    p_branch_id: row.branch_id,
    p_product_id: row.id,
    p_reason: "ลบจาก CpiPOS Customer Portal"
  });
  if (error) throw new Error(explainMutationError(error.message));
}

export async function loadStock(tenantId: string, branchId: string | null) {
  let query = supabase
    .from("ingredients")
    .select("id,branch_id,name,base_unit,quantity_on_hand,reorder_level,avg_unit_cost,last_purchase_unit_cost")
    .eq("tenant_id", tenantId)
    .order("name")
    .limit(500);
  if (branchId) query = query.eq("branch_id", branchId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as StockRow[];
}

export async function saveStock(tenantId: string, draft: StockDraft) {
  const { data, error } = await supabase.rpc("customer_portal_upsert_ingredient", {
    p_tenant_id: tenantId,
    p_branch_id: draft.branch_id,
    p_ingredient_id: draft.id || null,
    p_name: draft.name,
    p_base_unit: draft.base_unit,
    p_quantity_on_hand: draft.quantity_on_hand,
    p_reorder_level: draft.reorder_level,
    p_avg_unit_cost: draft.avg_unit_cost,
    p_last_purchase_unit_cost: draft.last_purchase_unit_cost,
    p_reason: "ปรับปรุงจาก CpiPOS Customer Portal"
  });
  if (error) throw new Error(explainMutationError(error.message));
  return data as string;
}

export async function deleteStock(tenantId: string, row: StockRow) {
  const { error } = await supabase.rpc("customer_portal_delete_ingredient", {
    p_tenant_id: tenantId,
    p_branch_id: row.branch_id,
    p_ingredient_id: row.id
  });
  if (error) throw new Error(explainMutationError(error.message));
}

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
      permission_role: draft.permission_role
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
  const { error } = await supabase.rpc("customer_portal_update_staff", {
    p_tenant_id: tenantId,
    p_branch_id: draft.branch_id,
    p_user_id: draft.user_id,
    p_full_name: draft.full_name,
    p_employee_code: draft.employee_code,
    p_position_title: draft.position_title,
    p_branch_role: draft.branch_role,
    p_permission_role: draft.permission_role,
    p_is_active: draft.is_active
  });
  if (error) throw new Error(explainMutationError(error.message));
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
      .limit(12);
    if (!error) billingCycles = (data ?? []) as PackageInfo["billingCycles"];
  }

  return {
    runtime: runtime as PackageInfo["runtime"],
    contract: contract as PackageInfo["contract"],
    billingCycles
  };
}
