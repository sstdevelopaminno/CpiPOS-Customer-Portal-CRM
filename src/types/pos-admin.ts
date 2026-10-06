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
export interface TablesAdminSnapshot { module:"tables"; zones:TableZoneAdmin[]; tables:DiningTableAdmin[]; }

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
export interface KitchenAdminSnapshot {
  module:"kitchen"; zones:KitchenZoneAdmin[]; routing_rules:KitchenRouteAdmin[];
  printers:KitchenPrinterAdmin[]; categories:string[];
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

export interface PrintersAdminSnapshot { module:"printers"; profiles:unknown[]; devices:unknown[]; }
export interface DisplayAdminSnapshot { module:"display"; policy:Record<string,unknown>|null; pairings:unknown[]; }

export type PosAdminSnapshot =
  | TablesAdminSnapshot | MembersAdminSnapshot | KitchenAdminSnapshot | BuffetAdminSnapshot
  | DevicesAdminSnapshot | PrintersAdminSnapshot | DisplayAdminSnapshot;
