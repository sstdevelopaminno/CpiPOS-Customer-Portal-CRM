import { supabase } from "../supabase";
import { explainMutationError } from "../errors";
import type { StockDraft, StockRow } from "../../types/portal";

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
