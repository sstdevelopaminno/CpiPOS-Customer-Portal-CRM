import { supabase } from "../supabase";
import { getReportWindow } from "../reporting";
import { explainMutationError } from "../errors";
import { orderSelect } from "../order-fields";
import type { OrderItemRow, OrderRow, ReportRange } from "../../types/portal";

export async function loadSales(
  tenantId: string,
  branchId: string | null,
  range: ReportRange,
  anchor: string,
  page = 0,
  pageSize = 100
) {
  const { from, to } = getReportWindow(range, anchor);
  const safePage = Math.max(0, Math.trunc(page));
  const safePageSize = Math.min(200, Math.max(1, Math.trunc(pageSize)));
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
