export type PosAdminModule = "tables" | "members" | "kitchen" | "buffet" | "devices" | "printers" | "display";

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

export type PosAdminSnapshot =
  | TablesAdminSnapshot | MembersAdminSnapshot | KitchenAdminSnapshot | BuffetAdminSnapshot
  | DevicesAdminSnapshot | PrintersAdminSnapshot | DisplayAdminSnapshot;
