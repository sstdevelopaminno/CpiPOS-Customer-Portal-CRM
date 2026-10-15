import { supabase } from "../supabase";
import { getReportWindow } from "../reporting";
import { orderSelect } from "../order-fields";
import type { DashboardSummary, OrderRow, ReportRange } from "../../types/portal";

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

  const [{ data: summary, error: summaryError }, { data: orders, error: ordersError }, { data: currencyTotals, error: currencyError }] = await Promise.all([
    supabase.rpc("customer_portal_dashboard_v2", {
      p_tenant_id: tenantId,
      p_branch_id: branchId,
      p_from: from,
      p_to: to
    }),
    recentQuery,
    supabase.rpc("customer_portal_currency_summary_v1", {
      p_tenant_id: tenantId,
      p_branch_id: branchId,
      p_from: from,
      p_to: to
    })
  ]);
  if (summaryError) throw summaryError;
  if (ordersError) throw ordersError;
  if (currencyError) throw currencyError;
  return {
    summary: summary as DashboardSummary,
    recentOrders: (orders ?? []) as unknown as OrderRow[],
    currencyTotals: (currencyTotals ?? []) as Array<{currency_code:"THB"|"LAK"|"USD";receipt_count:number;net_sales:number}>
  };
}
