import type { FeatureState } from "../types/portal";

/** Mirrors the POS and IT explicit-allow menu policy for CUSTOM customers.
 * Feature/package and Owner/Manager authorization are evaluated separately.
 */
const KNOWN_CUSTOM_MENU_KEYS = new Set<string>([
  "main.sales", "main.sales_list", "main.kitchen", "main.shift",
  "main.ai_assistant", "main.more", "main.package_payment", "main.settings",
  "more.sales_summary", "more.receipts", "more.tables", "more.kitchen_manage",
  "more.stock", "more.buffet", "more.members", "more.tax_invoices",
  "more.product_sales", "more.ai_documents",
  "settings.branding", "settings.store", "settings.branches", "settings.devices",
  "settings.printers", "settings.activity", "settings.payments",
  "settings.inet_nops", "settings.taxes", "settings.notifications",
  "settings.support", "settings.push_notifications", "settings.users",
  "settings.language", "settings.currency", "settings.placement", "settings.display",
  "settings.order_kitchen", "settings.table_qr"
]);

export function isCustomMenuVisible(
  state: Pick<FeatureState, "is_custom" | "is_internal_test_full" | "menu_policy">,
  key: string
): boolean {
  if (state.is_internal_test_full) {
    if (!KNOWN_CUSTOM_MENU_KEYS.has(key)) return false;
    if (key === "main.shift") return true;
    if (state.menu_policy[key] === false) return false;
    if (key.startsWith("more.")) return isCustomMenuVisible(state, "main.more");
    if (key.startsWith("settings.")) return isCustomMenuVisible(state, "main.settings");
    return true;
  }
  if (!state.is_custom) return state.menu_policy[key] !== false;
  if (key === "main.shift") return true;
  if (!KNOWN_CUSTOM_MENU_KEYS.has(key) || state.menu_policy[key] !== true) return false;
  if (key.startsWith("more.")) return isCustomMenuVisible(state, "main.more");
  if (key.startsWith("settings.")) return isCustomMenuVisible(state, "main.settings");
  return true;
}
