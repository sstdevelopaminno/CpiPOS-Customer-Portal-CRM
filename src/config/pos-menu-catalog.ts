import type { MoreSnapshot, PortalView } from "../types/portal";
import type { PosAdminModule } from "../types/pos-admin";

export const POS_MENU_SOURCE = {
  repository: "sstdevelopaminno/CpIPOS",
  ref: "main",
  commit: "37aeb6dbb7f20486c073d782f6d5fb2f437a86e0"
} as const;

export type PosMenuIcon =
  | "summary" | "receipt" | "tables" | "kitchen" | "stock" | "buffet" | "members" | "tax" | "sales"
  | "store" | "branch" | "terminal" | "printer" | "activity" | "payment" | "bell" | "users"
  | "language" | "placement" | "display" | "qr";

export type PosSettingsEditorKind = "store" | "branches" | "payments" | "taxes" | "notifications";

export interface PosMoreMenuItem {
  key: string;
  posHref: string;
  label: string;
  desc: string;
  feature: string;
  icon: PosMenuIcon;
  target?: PortalView;
  countKey?: keyof MoreSnapshot;
  adminModule?: PosAdminModule;
}

export interface PosSettingsMenuItem {
  key: string;
  posHref: string;
  label: string;
  desc: string;
  feature: string;
  kind: string;
  icon: PosMenuIcon;
  target?: PortalView;
  editorKind?: PosSettingsEditorKind;
  adminModule?: PosAdminModule;
}

export const POS_MORE_MENU_ITEMS: readonly PosMoreMenuItem[] = [
  { key:"more.sales_summary", posHref:"/preview/pos/sales-summary", label:"สรุปยอดขาย", desc:"ดูยอดขาย ภาษี เงินสด/โอน และรายงานประจำกะ", feature:"advanced_sales_reports", icon:"summary", target:"dashboard" },
  { key:"more.receipts", posHref:"/preview/pos/receipts", label:"ใบเสร็จย้อนหลัง", desc:"ค้นหาใบเสร็จและสั่งพิมพ์ย้อนหลัง 58mm", feature:"receipt_reprint_history", icon:"receipt", adminModule:"receipts" },
  { key:"more.tables", posHref:"/preview/pos/tables", label:"จัดการโต๊ะ", desc:"จัดการโต๊ะ โซน และผังร้านสำหรับโหมดนั่งโต๊ะ", feature:"table_management", icon:"tables", countKey:"tables_count", adminModule:"tables" },
  { key:"more.kitchen_manage", posHref:"/preview/pos/kitchen/manage", label:"จัดการครัว", desc:"ตั้งค่าโซนครัว เส้นทางหมวดหมู่อาหาร และจอ KDS", feature:"kitchen_printing", icon:"kitchen", countKey:"kitchen_zones_count", adminModule:"kitchen" },
  { key:"more.stock", posHref:"/preview/pos/stock", label:"จัดการสินค้า", desc:"สินค้า สต็อก วัตถุดิบ ราคา และหมวดหมู่", feature:"stock_management", icon:"stock", target:"products" },
  { key:"more.buffet", posHref:"/preview/pos/buffet-pricing", label:"ตั้งค่าราคาบุฟเฟ่", desc:"กำหนดราคาบุฟเฟ่รายท่านและแบบชุดสำหรับหน้าขาย", feature:"table_management", icon:"buffet", adminModule:"buffet" },
  { key:"more.members", posHref:"/preview/pos/members", label:"สมาชิก", desc:"ค้นหาและจัดการข้อมูลสมาชิกหน้าร้าน", feature:"core_pos_sales", icon:"members", countKey:"members_count", adminModule:"members" },
  { key:"more.tax_invoices", posHref:"/preview/pos/tax-invoices", label:"ออกใบกำกับภาษี", desc:"ทะเบียนผู้เสียภาษี ค้นบิลย้อนหลัง และพิมพ์ใบกำกับภาษี 58/80mm", feature:"core_pos_sales", icon:"tax", countKey:"tax_invoices_count", adminModule:"tax_invoices" },
  { key:"more.product_sales", posHref:"/preview/pos/product-sales", label:"รายการขายสินค้า", desc:"ดูสินค้าที่ขาย วันที่ ราคา จำนวน และสถานะสินค้าขายดี", feature:"advanced_sales_reports", icon:"sales", adminModule:"product_sales" }
];

export const POS_SETTINGS_MENU_ITEMS: readonly PosSettingsMenuItem[] = [
  { key:"settings.store", posHref:"/preview/pos/settings", label:"ข้อมูลร้านค้า/บริษัท", desc:"รหัสร้าน ชื่อแสดงผล โลโก้ ที่อยู่ และเบอร์ติดต่อ", feature:"core_pos_sales", kind:"store", icon:"store", editorKind:"store" },
  { key:"settings.branches", posHref:"/preview/pos/settings", label:"สาขา", desc:"เปิดสาขา เพิ่ม แก้ไข และจัดการสถานะสาขา", feature:"branch_management", kind:"branches", icon:"branch", editorKind:"branches" },
  { key:"settings.devices", posHref:"/preview/pos/settings", label:"เพิ่มเครื่องแคชเชียร์", desc:"ผูกเครื่อง POS กับสาขา นโยบายล็อกอิน ขอบเขตผู้ใช้ และกะ", feature:"mobile_device_enrollment", kind:"devices", icon:"terminal", adminModule:"devices" },
  { key:"settings.printers", posHref:"/preview/pos/settings", label:"ตั้งค่าเครื่องพิมพ์", desc:"ใบเสร็จ Print Agent เครื่องพิมพ์ประจำสาขา และลิ้นชักเก็บเงิน", feature:"core_pos_sales", kind:"printers", icon:"printer", adminModule:"printers" },
  { key:"settings.activity", posHref:"/preview/pos/settings", label:"ตรวจสอบพฤติกรรมการใช้งาน", desc:"ติดตามผู้ใช้งาน เมนู เวลา PIN และรายการอนุมัติ", feature:"core_pos_sales", kind:"activity", icon:"activity", adminModule:"activity" },
  { key:"settings.payments", posHref:"/preview/pos/settings", label:"ตั้งค่าชำระเงิน", desc:"บัญชีธนาคาร PromptPay QR และสถานะการใช้งาน", feature:"core_pos_sales", kind:"payments", icon:"payment", editorKind:"payments" },
  { key:"settings.inet_nops", posHref:"/preview/pos/settings", label:"INET QR", desc:"Dynamic QR การเปิดใช้งานรายสาขา และการเชื่อมต่อ UAT", feature:"inet_nops_qr", kind:"inet", icon:"payment", adminModule:"inet" },
  { key:"settings.taxes", posHref:"/preview/pos/settings", label:"ตั้งค่าภาษี", desc:"กำหนด VAT และรายการภาษี/หัก ณ ที่จ่ายในสรุปการชำระเงิน", feature:"core_pos_sales", kind:"taxes", icon:"tax", editorKind:"taxes" },
  { key:"settings.notifications", posHref:"/preview/pos/settings", label:"ตั้งค่าการแจ้งเตือน", desc:"POP UP และเสียงแจ้งเตือนเมื่อลูกค้าเรียกจาก QR โต๊ะ", feature:"qr_table_ordering", kind:"notifications", icon:"bell", editorKind:"notifications" },
  { key:"settings.users", posHref:"/preview/pos/settings", label:"ผู้ใช้งาน", desc:"จัดการพนักงาน สิทธิ์ และ PIN", feature:"user_management", kind:"users", icon:"users", target:"staff" },
  { key:"settings.language", posHref:"/preview/pos/settings", label:"เปลี่ยนภาษา", desc:"สลับภาษาไทยหรืออังกฤษสำหรับหน้าขายและเมนูพนักงาน", feature:"core_pos_sales", kind:"language", icon:"language" },
  { key:"settings.placement", posHref:"/preview/pos/settings", label:"สลับแถบเมนูหลัก", desc:"ย้ายแถบเมนูหลักไปด้านซ้าย ด้านบน หรือด้านล่างของหน้าจอ", feature:"core_pos_sales", kind:"placement", icon:"placement" },
  { key:"settings.display", posHref:"/preview/pos/customer-display", label:"จอลูกค้า", desc:"ตั้งค่า Customer Display สำหรับหน้าจอที่หันเข้าหาลูกค้า", feature:"customer_facing_display", kind:"display", icon:"display", adminModule:"display" },
  { key:"settings.order_kitchen", posHref:"/preview/pos/settings/order-kitchen", label:"การแจ้งเตือนออเดอร์และครัว", desc:"เปิด/ปิดแจ้งเตือน QR ส่งเข้าครัว และพิมพ์ใบครัวอัตโนมัติ", feature:"kitchen_printing", kind:"orderKitchen", icon:"kitchen", adminModule:"order_kitchen" },
  { key:"settings.table_qr", posHref:"/preview/pos/settings/table-qr", label:"ตั้งค่า QR โต๊ะ", desc:"กำหนดหมดอายุตามเวลา/ชั่วโมง หรือใช้งานตามอายุบิล", feature:"qr_table_ordering", kind:"tableQr", icon:"qr", adminModule:"table_qr" }
];
