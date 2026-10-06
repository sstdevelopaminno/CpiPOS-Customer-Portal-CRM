import { supabase } from "../supabase";
import { explainMutationError } from "../errors";
import type { ProductDraft, ProductRow } from "../../types/portal";

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
