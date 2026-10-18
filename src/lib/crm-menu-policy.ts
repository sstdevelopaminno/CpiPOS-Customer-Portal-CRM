import type {PortalView} from "../types/portal";

/** CRM-only IT switches. POS uses independent keys and is never changed here.
 * Absent switches remain enabled to preserve all existing customers until IT acts.
 * Package, IT POS, tenant, branch and role authorization remain separate checks.
 */
export const CRM_MAIN_MENU_KEYS:Record<PortalView,string>={
  dashboard:"main.crm_overview",sales:"main.crm_sales",products:"main.crm_products",
  stock:"main.crm_stock",staff:"main.crm_staff",package:"main.crm_package",
  more:"main.crm_more",optical:"main.crm_optical",work_orders:"main.crm_optical_orders",settings:"main.crm_settings"
};
export const CRM_MORE_MENU_KEYS:Readonly<Record<string,string>>={
  "more.receipts":"more.crm_receipts",
  "more.tax_invoices":"more.crm_tax_invoices",
  "more.product_sales":"more.crm_product_sales",
  "more.tables":"more.crm_tables",
  "more.kitchen_manage":"more.crm_kitchen_manage",
  "more.buffet":"more.crm_buffet",
  "more.members":"more.crm_members"
};
export const CRM_SETTINGS_MENU_KEYS:Readonly<Record<string,string>>={
  "settings.branding":"settings.crm_branding","settings.store":"settings.crm_store",
  "settings.branches":"settings.crm_branches","settings.devices":"settings.crm_devices",
  "settings.printers":"settings.crm_printers","settings.activity":"settings.crm_activity",
  "settings.payments":"settings.crm_payments","settings.inet_nops":"settings.crm_inet_nops",
  "settings.taxes":"settings.crm_taxes","settings.notifications":"settings.crm_notifications",
  "settings.language":"settings.crm_language","settings.currency":"settings.crm_currency",
  "settings.placement":"settings.crm_placement","settings.display":"settings.crm_display",
  "settings.order_kitchen":"settings.crm_order_kitchen","settings.table_qr":"settings.crm_table_qr"
};
export const CRM_OPTICAL_MENU_KEYS={
  customers:"main.crm_optical_customers",orders:"main.crm_optical_orders",
  stock:"main.crm_optical_stock",reports:"main.crm_optical_reports"
} as const;
const parent:Record<string,string>={};
for(const key of Object.values(CRM_MORE_MENU_KEYS))parent[key]="main.crm_more";
for(const key of Object.values(CRM_SETTINGS_MENU_KEYS))parent[key]="main.crm_settings";
for(const key of Object.values(CRM_OPTICAL_MENU_KEYS))parent[key]="main.crm_optical";
const known=new Set([...Object.values(CRM_MAIN_MENU_KEYS),...Object.keys(parent)]);
export function isCrmMenuEnabled(policy:Record<string,boolean>,key:string):boolean{
  // Unknown keys cannot accidentally become an enabled CRM screen.
  if(!known.has(key)||policy[key]===false)return false;
  return !parent[key]||isCrmMenuEnabled(policy,parent[key]);
}
