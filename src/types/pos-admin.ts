export type PosAdminModule = "tables" | "members" | "kitchen" | "buffet" | "devices" | "printers" | "display" | "activity" | "inet" | "order_kitchen" | "table_qr" | "receipts" | "tax_invoices" | "product_sales";

export interface TableZoneAdmin {
  id:string; branch_id:string; zone_name:string; color:string; display_order:number; is_active:boolean;
  metadata:Record<string,unknown>; created_at:string; updated_at:string;
}
export interface DiningTableAdmin {
  id:string; branch_id:string; zone_id:string|null; table_code:string; table_name:string|null; capacity:number;
  status:"available"|"occupied"|"ordering"|"pending_payment"|"reserved"|"disabled";
  shape:"square"|"rectangle"|"circle"; position_x:number; position_y:number; width:number; height:number;
  rotation:number; is_active:boolean; metadata:Record<string,unknown>; created_at:string; updated_at:string;
}
export type FloorObjectType="counter"|"cashier"|"partition"|"plant"|"entrance"|"service_station";
export interface FloorLayoutObjectAdmin {
  id:string; branch_id:string; zone_id:string|null; object_type:FloorObjectType; object_name:string|null; color:string;
  position_x:number; position_y:number; width:number; height:number; rotation:number; z_index:number; is_active:boolean;
  metadata:Record<string,unknown>; created_at:string; updated_at:string;
}
export interface TablesAdminSnapshot { module:"tables"; zones:TableZoneAdmin[]; tables:DiningTableAdmin[]; layout_objects:FloorLayoutObjectAdmin[]; }

export interface MemberAdmin {
  id:string; branch_id:string; name:string; phone:string; email:string|null; member_token:string|null;
  points_balance:number; stamp_balance:number; status:string; updated_at:string;
}
export interface MembersAdminSnapshot { module:"members"; members:MemberAdmin[]; }

export interface KitchenZoneAdmin {
  id:string; branch_id:string; zone_code:string; zone_name:string; display_order:number; is_active:boolean;
  default_printer_id:string|null; metadata:Record<string,unknown>; kds_enabled:boolean; access_code:string|null;
  created_at:string; updated_at:string;
}
export interface KitchenRouteAdmin {
  id:string; zone_id:string; product_id:string|null; category_name:string|null; priority:number; is_active:boolean;
  metadata:Record<string,unknown>; created_at:string; updated_at:string;
}
export interface KitchenPrinterAdmin {
  id:string; printer_name:string; printer_role:string; connection_type:string; ip_address:string|null; port:number|null;
  paper_width_mm:number; enabled:boolean; metadata:Record<string,unknown>;
}
export interface KitchenProductAdmin { id:string; sku:string|null; name:string; category:string|null; is_active:boolean; }
export interface KitchenAdminSnapshot {
  module:"kitchen"; zones:KitchenZoneAdmin[]; routing_rules:KitchenRouteAdmin[];
  printers:KitchenPrinterAdmin[]; categories:string[]; products:KitchenProductAdmin[];
}

export interface BuffetProductAdmin {
  id:string; sku:string|null; name:string; price:number; is_active:boolean; metadata:Record<string,unknown>|null;
  created_at:string; item_count:number;
}
export interface BuffetAdminSnapshot { module:"buffet"; plans:BuffetProductAdmin[]; }

export interface CashierDeviceAdmin {
  id:string; branch_id:string; device_code:string; device_name:string; device_type:string; status:string;
  is_locked:boolean; metadata:Record<string,unknown>; last_seen_at:string|null; is_active:boolean;
  created_at:string; updated_at:string;
}
export interface DevicesAdminSnapshot {
  module:"devices"; max_devices:number|null; contract_status:string|null; devices:CashierDeviceAdmin[];
  login_policy:Record<string,unknown>|null;
}

export type PrinterPurpose="receipt"|"kitchen"|"drink"|"bar"|"reprint"|"shift_report"|"payment_slip"|"cash_drawer";
export interface PrinterProfileAdmin {
  id:string; branch_id:string; printer_name:string; printer_role:"receipt"|"kitchen"|"report";
  connection_type:"NETWORK_ESC_POS"|"STAR_WEBPRNT"|"LOCAL_BRIDGE"|"BLUETOOTH_BRIDGE";
  ip_address:string|null; port:number|null; paper_width_mm:58|80; enabled:boolean;
  metadata:Record<string,unknown>; created_at:string; updated_at:string;
}
export interface PrinterAssignmentAdmin {
  id:string; purpose:PrinterPurpose; zone_key:string; is_enabled:boolean; is_default:boolean; copies:number;
  metadata:Record<string,unknown>;
}
export interface PrinterDeviceAdmin {
  id:string; printer_profile_id:string|null; display_name:string; brand:string|null; model:string|null;
  connection_mode:"lan"|"usb"|"bluetooth"; paper_width_mm:58|80; device_fingerprint:string|null;
  runtime_device_code:string|null; status:string; capabilities:Record<string,unknown>;
  last_seen_at:string|null; disconnected_at:string|null; is_active:boolean; metadata:Record<string,unknown>;
  created_at:string; updated_at:string; assignments:PrinterAssignmentAdmin[];
}
export interface PrinterKitchenZoneAdmin {
  id:string; zone_code:string; zone_name:string; display_order:number; is_active:boolean; default_printer_id:string|null;
}
export interface PrintersAdminSnapshot {
  module:"printers"; profiles:PrinterProfileAdmin[]; devices:PrinterDeviceAdmin[]; kitchen_zones:PrinterKitchenZoneAdmin[];
}

export interface DisplayPolicyAdmin {
  channel:string; max_active_devices:number; inactive_expire_hours:number; is_active:boolean; source:"default"|"it_policy";
}
export interface DisplayPairingAdmin {
  id:string; channel:string; pair_code_expires_at:string; pair_code_used_at:string|null; device_token_expires_at:string|null;
  device_name:string|null; is_active:boolean; last_seen_at:string|null; created_at:string; updated_at:string; paired:boolean;
}
export interface DisplayAdminSnapshot { module:"display"; policy:DisplayPolicyAdmin; pairings:DisplayPairingAdmin[]; }

export interface ActivityAuditAdmin {
  id:string; branch_id:string|null; branch_name:string|null; branch_code:string|null; actor_user_id:string|null;
  actor_name:string; actor_email:string; actor_employee_code:string; actor_role:string; target_user_id:string|null;
  target_user_name:string; action:string; module:string; target_table:string; target_id:string|null; device_code:string;
  pos_session_id:string|null; approver_name:string; metadata:Record<string,unknown>|null; created_at:string;
  is_delete_action:boolean; is_pin_action:boolean;
}
export interface ActivityAdminSnapshot {
  module:"activity"; items:ActivityAuditAdmin[];
  pagination:{page:number;page_size:number;total:number;total_pages:number};
  range:{period:string;from:string;to:string}; approved_by:string; approver_role:string;
}
export interface InetAdminSettings {
  id?:string; branch_id:string; environment:"uat"|"production"; merchant_id:string; is_active:boolean;
  connection_status:"not_configured"|"ready"|"error"|"disabled"; last_connection_checked_at:string|null;
  last_connection_error:string; last_test_order_id:string; callback_url:string|null; updated_at?:string|null;
}
export interface InetAdminSnapshot {
  module:"inet"; settings:InetAdminSettings; provider_test_available:boolean; provider_test_note:string;
}
export type PolicyOverride="inherit"|"force_on"|"force_off";
export interface OrderKitchenPolicyAdmin {
  branch_id:string;
  store:{popup_enabled:boolean;kitchen_auto_send_enabled:boolean;kitchen_auto_print_enabled:boolean};
  override:{popup:PolicyOverride;kitchen_auto_send:PolicyOverride;kitchen_auto_print:PolicyOverride};
  effective:{popup_enabled:boolean;kitchen_auto_send_enabled:boolean;kitchen_auto_print_enabled:boolean};
}
export interface OrderKitchenAdminSnapshot { module:"order_kitchen"; policy:OrderKitchenPolicyAdmin; }
export interface TableQrAdmin {
  id:string; table_code:string; table_name:string|null; zone_id:string|null; is_active:boolean;
  mode:"time"|"bill"; ttl_minutes:number|null; active_qr_sessions:number;
}
export interface TableQrAdminSnapshot {
  module:"table_qr"; tables:TableQrAdmin[];
  limits:{default_ttl_minutes:number;min_ttl_minutes:number;max_ttl_minutes:number;bill_safety_ttl_minutes:number};
}
export interface ReceiptItemAdmin {
  id:string;product_id:string|null;name:string;sku:string|null;category:string|null;
  quantity:number;unit_price:number;line_total:number;notes:string|null;
}
export interface ReceiptPaymentAdmin { method:string;amount:number;status:string|null;received_at:string|null; }
export interface ReceiptAdmin {
  id:string;order_no:string;order_type:string;channel:string|null;customer_name:string|null;external_order_code:string|null;
  subtotal:number;discount_amount:number;tax_total:number;total_amount:number;paid_total:number;status:string;
  created_at:string;paid_at:string|null;cashier_name:string;table_label:string;cash_received:number;change_amount:number;
  notes:string|null;items:ReceiptItemAdmin[];payments:ReceiptPaymentAdmin[];
}
export interface ReceiptsAdminSnapshot {
  module:"receipts";records:ReceiptAdmin[];
  pagination:{page:number;page_size:number;total:number;total_pages:number};
  range:{period:string;from:string;to:string};
}
export interface TaxSellerAdmin { display_name:string;tax_id:string;branch_no:string;address:string;phone:string;ready:boolean; }
export interface TaxProfileAdmin {
  id:string;entity_type:"company"|"limited_partnership"|"shop"|"individual";display_name:string;tax_id:string;
  address_line:string;subdistrict:string;district:string;province:string;postal_code:string;is_active:boolean;
  created_at:string;updated_at:string;invoice_count:number;last_issued_at:string|null;
}
export interface TaxReceiptAdmin {
  id:string;order_no:string;customer_name:string|null;total:number;tax_total:number;created_at:string;paid_at:string|null;
  invoice_id:string|null;invoice_no:string|null;profile_id:string|null;issued_at:string|null;print_count:number|null;last_printed_at:string|null;
}
export interface TaxInvoiceAdmin {
  id:string;order_id:string;profile_id:string;invoice_no:string;paper_width_mm:number;status:string;
  buyer_snapshot:Record<string,unknown>;seller_snapshot:Record<string,unknown>;order_snapshot:Record<string,unknown>;
  tax_snapshot:Record<string,unknown>;print_count:number;issued_at:string;last_printed_at:string|null;
}
export interface TaxInvoicesAdminSnapshot {
  module:"tax_invoices";seller:TaxSellerAdmin;profiles:TaxProfileAdmin[];receipts:TaxReceiptAdmin[];invoices:TaxInvoiceAdmin[];
}
export interface ProductSaleAdmin {
  product_id:string|null;sku:string;name:string;category:string;quantity:number;sales_total:number;
  average_unit_price:number;order_count:number;last_sold_at:string;
}
export interface ProductSalesAdminSnapshot {
  module:"product_sales";rows:ProductSaleAdmin[];
  range:{period:string;from:string;to:string};
  summary:{product_count:number;quantity:number;sales_total:number};
}

export type PosAdminSnapshot =
  | TablesAdminSnapshot | MembersAdminSnapshot | KitchenAdminSnapshot | BuffetAdminSnapshot
  | DevicesAdminSnapshot | PrintersAdminSnapshot | DisplayAdminSnapshot
  | ActivityAdminSnapshot | InetAdminSnapshot | OrderKitchenAdminSnapshot | TableQrAdminSnapshot
  | ReceiptsAdminSnapshot | TaxInvoicesAdminSnapshot | ProductSalesAdminSnapshot;
