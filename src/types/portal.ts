export type PortalRole = "owner" | "manager";
export type PortalView = "dashboard" | "sales" | "products" | "stock" | "staff" | "package" | "more" | "settings";
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
  pin?: string;
}

export interface PackageInfo {
  runtime: {
    lifecycle_status: string | null;
    access_locked: boolean | null;
    lock_reason: string | null;
    expires_at: string | null;
    payment_review_status: string | null;
    updated_at?: string | null;
  } | null;
  contract: {
    id?: string | null;
    package_id?: string | null;
    package_code?: string | null;
    package_name?: string | null;
    contract_type: string | null;
    billing_interval: string | null;
    status: string | null;
    amount_per_cycle: number | null;
    currency: string | null;
    auto_renew: boolean | null;
    started_at: string | null;
    ended_at: string | null;
    max_branches?: number | null;
    max_devices?: number | null;
    max_users?: number | null;
  } | null;
  billingCycles: Array<{
    id: string;
    package_id: string | null;
    period_start: string;
    period_end: string;
    amount_due: number;
    amount_paid: number;
    status: string;
    created_at?: string;
  }>;
  requests: Array<{
    id: string;
    request_type: string;
    requested_package_id: string | null;
    package_name: string | null;
    status: string;
    amount_reported: number | null;
    currency: string | null;
    submitted_at: string;
    reviewed_at: string | null;
    review_note: string | null;
    has_evidence: boolean;
    metadata: Record<string, unknown> | null;
  }>;
  issuer: {
    billing_legal_name_th: string | null;
    billing_bank_name: string | null;
    billing_bank_account_name: string | null;
    billing_bank_account_number: string | null;
    billing_promptpay_id: string | null;
    billing_email: string | null;
    support_email: string | null;
    billing_vat_registered: boolean | null;
  } | null;
  actor_role?: string | null;
}

export interface FeatureState {
  package_id: string | null;
  package_features: Record<string, boolean>;
  feature_overrides: Record<string, boolean>;
  menu_policy: Record<string, boolean>;
}

export interface MoreSnapshot {
  tables_count:number;
  kitchen_zones_count:number;
  kitchen_rules_count:number;
  members_count:number;
  tax_invoices_count:number;
  ai_documents_count:number;
  printers_count:number;
  display_pairings_count:number;
  audit_count:number;
}

export interface SettingsSnapshot {
  store: {
    id: string;
    code: string | null;
    name: string | null;
    display_name: string | null;
    logo_url: string | null;
    company_address: string | null;
    contact_phone: string | null;
    owner_phone: string | null;
  } | null;
  branches: Array<{id:string;code:string|null;name:string;address:string|null;is_active:boolean}>;
  devices: Array<{id:string;branch_id:string;device_code:string|null;device_name:string|null;device_type:string|null;status:string|null;is_locked:boolean|null;last_seen_at:string|null;is_active:boolean|null}>;
  payment_accounts: Array<{id:string;branch_id:string|null;bank_name:string|null;account_name:string|null;account_number:string|null;promptpay_phone:string|null;qr_image_url:string|null;qr_mode:string|null;applies_to_all_branches:boolean|null;is_active:boolean|null}>;
  tax_settings: Array<{id:string;branch_id:string;is_enabled:boolean;calculation_base:string|null;settings:Record<string,unknown>|null;updated_at:string|null}>;
  notifications: Array<{tenant_id:string;branch_id:string;table_qr_popup_enabled:boolean|null;table_qr_sound_enabled:boolean|null;table_qr_sound_volume:number|null;table_qr_popup_store_enabled:boolean|null;table_qr_kitchen_auto_send_enabled:boolean|null;table_qr_kitchen_auto_print_enabled:boolean|null;updated_at:string|null}>;
  is_owner: boolean;
}
