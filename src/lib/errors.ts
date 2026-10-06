export function explainMutationError(message?: string) {
  const value = String(message ?? "");
  if (value.includes("duplicate_product_sku")) return "รหัสสินค้า (SKU) นี้มีอยู่แล้วในสาขา";
  if (value.includes("duplicate_ingredient_name")) return "ชื่อวัตถุดิบนี้มีอยู่แล้วในสาขา";
  if (value.includes("duplicate_employee_code")) return "รหัสพนักงานนี้มีอยู่แล้ว";
  if (value.includes("ingredient_in_use_by_recipe")) return "ลบไม่ได้ เนื่องจากวัตถุดิบถูกใช้ในสูตรสินค้า";
  if (value.includes("ingredient_has_stock_history")) return "ลบไม่ได้ เนื่องจากวัตถุดิบมีประวัติการเคลื่อนไหวสต๊อก";
  if (value.includes("manager_cannot")) return "สิทธิ์ Manager ไม่สามารถแก้ไขหรือมอบสิทธิ์ระดับ Owner/Manager ได้";
  if (value.includes("cross_tenant_user_edit_forbidden")) return "ผู้ใช้นี้เชื่อมกับร้านอื่นอยู่ จึงไม่สามารถเปลี่ยนข้อมูลหรือ PIN จากร้านนี้ได้";
  if (value.includes("invalid_pin")) return "PIN ต้องเป็นตัวเลข 4–12 หลัก";
  if (value.includes("invalid_order_notes")) return "หมายเหตุรายการขายต้องไม่เกิน 1,000 ตัวอักษร";
  if (value.includes("invalid_customer_name")) return "ชื่อลูกค้าต้องไม่เกิน 180 ตัวอักษร";
  if (value.includes("setting_policy_forbidden")) return "แพ็กเกจหรือฝ่าย IT ไม่อนุญาตให้แก้ไขการตั้งค่านี้";
  if (value.includes("invalid_qr_mode")) return "รูปแบบ QR ไม่รองรับ กรุณาเลือก PromptPay หรือรูป QR";
  if (value.includes("customer_portal_forbidden")) return "บัญชีนี้ไม่มีสิทธิ์ดำเนินการในสาขาที่เลือก";
  return value || "ไม่สามารถบันทึกข้อมูลได้";
}
