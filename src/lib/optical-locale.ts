import { CRM_SETTINGS_LANGUAGE_STORAGE, normalizeCrmSettingsLanguage, type CrmSettingsLanguage } from "./settings-language";

/** Optical-specific UI strings; does not change global CRM or restaurant labels. */
const dictionary: Record<string, readonly [string, string]> = {
  "ใบสั่งงานแว่นตา": ["Optical work orders", "ໃບສັ່ງງານແວ່ນຕາ"],
  "สต๊อกกรอบแว่นและเลนส์": ["Frames and lenses stock", "ສະຕັອກຂອບແວ່ນ ແລະ ເລນ"],
  "รายงานเจ้าของร้าน": ["Owner report", "ລາຍງານເຈົ້າຂອງຮ້ານ"],
  "ข้อมูลเฉพาะร้านและสาขาปัจจุบัน · ไม่รวมยอด THB ของระบบอาหาร": ["Current store and branch only · food-service THB totals excluded", "ຂໍ້ມູນສະເພາະຮ້ານ ແລະ ສາຂາປັດຈຸບັນ · ບໍ່ລວມຍອດ THB ຂອງຮ້ານອາຫານ"],
  "ยังไม่สามารถโหลดข้อมูล Optical ได้ กรุณาตรวจสิทธิ์หรือรอการเปิดใช้งานโมดูลโดย IT": ["Optical data unavailable. Check permissions or IT activation.", "ບໍ່ສາມາດໂຫຼດຂໍ້ມູນ Optical ໄດ້ ກະລຸນາກວດສິດ ຫຼື ລໍຖ້າ IT ເປີດໃຊ້ງານ"],
  "กรุณาเลือกสาขาที่ได้รับสิทธิ์ก่อน": ["Select an authorized branch first.", "ກະລຸນາເລືອກສາຂາທີ່ມີສິດກ່ອນ"],
  "กำลังโหลดข้อมูล...": ["Loading...", "ກຳລັງໂຫຼດຂໍ້ມູນ..."],
  "งาน / วันที่": ["Order / date", "ງານ / ວັນທີ"],
  "สถานะ": ["Status", "ສະຖານະ"],
  "ยอดเต็ม": ["Total", "ຍອດລວມ"],
  "รับแล้ว": ["Paid", "ຊຳລະແລ້ວ"],
  "ค้างชำระ": ["Outstanding", "ຍັງຄ້າງຊຳລະ"],
  "นัดรับ": ["Pickup date", "ວັນນັດຮັບ"],
  "รับงาน": ["Received", "ຮັບງານ"],
  "สั่งเลนส์": ["Lens ordered", "ສັ່ງເລນແລ້ວ"],
  "เจียร": ["Edging", "ກຳລັງເຈຍເລນ"],
  "รอรับ": ["Ready for pickup", "ພ້ອມໃຫ້ຮັບ"],
  "รับสินค้าแล้ว": ["Collected", "ຮັບສິນຄ້າແລ້ວ"],
  "ยกเลิก": ["Cancelled", "ຍົກເລີກ"],
  "ยังไม่มีใบสั่งงานในสาขานี้": ["No work orders in this branch.", "ຍັງບໍ່ມີໃບສັ່ງງານໃນສາຂານີ້"],
  "ยังไม่มี Optical Stock Bin ที่ผ่านการตรวจนับ": ["No verified Optical stock bins yet.", "ຍັງບໍ່ມີສະຕັອກ Optical ທີ່ກວດນັບແລ້ວ"],
  "รายวัน": ["Daily", "ລາຍວັນ"],
  "รายเดือน": ["Monthly", "ລາຍເດືອນ"],
  "รายปี": ["Yearly", "ລາຍປີ"],
  "รับชำระ LAK": ["Payments received (LAK)", "ຮັບຊຳລະ (LAK)"],
  "ยอดขายที่ส่งมอบแล้ว LAK": ["Fulfilled sales (LAK)", "ຍອດຂາຍທີ່ສົ່ງມອບແລ້ວ (LAK)"],
  "จำนวนงานส่งมอบ": ["Orders collected", "ຈຳນວນງານທີ່ສົ່ງມອບ"],
  "ยอดรับชำระตามพนักงาน": ["Payments by salesperson", "ຍອດຮັບຊຳລະຕາມພະນັກງານ"],
  "รายการ": ["items", "ລາຍການ"],
  "สินค้าขายดี (ส่งมอบแล้ว)": ["Top products (fulfilled)", "ສິນຄ້າຂາຍດີ (ສົ່ງມອບແລ້ວ)"],
  "หน่วย": ["units", "ຫົວໜ່ວຍ"],
  "รายงานแยกยอดรับชำระมัดจำออกจากยอดขายที่ส่งมอบแล้ว ไม่บวกเป็นยอดขายซ้ำ": ["Deposits received are reported separately from fulfilled sales; never double-counted.", "ເງິນມັດຈຳແຍກຈາກຍອດຂາຍທີ່ສົ່ງມອບແລ້ວ ແລະ ບໍ່ນັບຊ້ຳ"],
  "รายงาน Optical สำหรับ THB/USD ยังไม่เปิดใช้งาน เพื่อป้องกันการแสดงยอด LAK ผิดสกุลเงิน": ["Optical THB/USD reports are not enabled yet; LAK-only figures are never relabeled or converted.", "ລາຍງານ Optical ສຳລັບ THB/USD ຍັງບໍ່ເປີດໃຊ້ ເພື່ອບໍ່ໃຫ້ສະແດງຍອດ LAK ຜິດສະກຸນເງິນ"],
  "ตรวจสินค้า กรอบแว่น เลนส์ SKU และจำนวนพร้อมขาย": ["Inspect frames, lenses, SKU and available stock", "ກວດຂອບແວ່ນ ເລນ SKU ແລະ ສະຕັອກພ້ອມຂາຍ"],
  "เลือกสาขา": ["Select branch", "ເລືອກສາຂາ"],
  "+ เพิ่มสินค้า": ["+ Add product", "+ ເພີ່ມສິນຄ້າ"],
  "★ สินค้าขายดี": ["★ Best sellers", "★ ສິນຄ້າຂາຍດີ"],
  "กำลังโหลด...": ["Loading...", "ກຳລັງໂຫຼດ..."],
  "รีเฟรช": ["Refresh", "ໂຫຼດໃໝ່"],
  "สต๊อกที่มี Optical Stock Bin จะแสดงยอดคงเหลือหลังหักยอดจอง ส่วนสินค้าที่ยังไม่ตรวจนับจะแสดงรอยืนยัน": ["Verified Optical stock shows available quantity after reservations. Unverified products are marked pending.", "ສະຕັອກ Optical ທີ່ກວດແລ້ວສະແດງຈຳນວນຫຼັງຫັກຍອດຈອງ ສິນຄ້າທີ່ຍັງບໍ່ກວດນັບຈະສະແດງວ່າລໍຖ້າຢືນຢັນ"],
  "รายการสินค้า": ["Products", "ລາຍການສິນຄ້າ"],
  "เหลือ 1 หน่วย": ["1 unit left", "ເຫຼືອ 1 ຫົວໜ່ວຍ"],
  "หมดสต๊อก": ["Out of stock", "ສິນຄ້າໝົດ"],
  "ยังผูกสต๊อกสูตรเดิม": ["Legacy recipe-linked stock", "ສະຕັອກທີ່ຍັງຜູກສູດເກົ່າ"],
  "ค้นหาสินค้าจาก SKU หรือชื่อ": ["Search products by SKU or name", "ຄົ້ນຫາສິນຄ້າດ້ວຍ SKU ຫຼື ຊື່"],
  "ค้นหารหัสบาร์โค้ด / SKU / ชื่อสินค้า...": ["Search barcode / SKU / product name...", "ຄົ້ນຫາບາໂຄດ / SKU / ຊື່ສິນຄ້າ..."],
  "แสดงรายการ": ["Filter", "ກັ່ນຕອງ"],
  "ทั้งหมด": ["All", "ທັງໝົດ"],
  "กรอบแว่น": ["Frames", "ຂອບແວ່ນ"],
  "เลนส์": ["Lenses", "ເລນ"],
  "ใกล้หมด / หมด": ["Low / out", "ໃກ້ໝົດ / ໝົດ"],
  "ผูกสูตรสต๊อกเดิม": ["Legacy recipe stock", "ສະຕັອກຜູກສູດເກົ່າ"],
  "ไม่สามารถอ่านสต๊อกสินค้าในสาขานี้ได้ กรุณาตรวจสอบสิทธิ์": ["Unable to load branch stock. Check your permissions.", "ບໍ່ສາມາດໂຫຼດສະຕັອກສາຂານີ້ ກະລຸນາກວດສິດ"],
  "ไม่พบสาขาที่ได้รับอนุญาตให้เข้าถึง": ["No authorized branch available.", "ບໍ່ພົບສາຂາທີ່ມີສິດເຂົ້າເຖິງ"],
  "สลับประเภทสต๊อก Optical": ["Optical stock categories", "ສະຫຼັບປະເພດສະຕັອກ Optical"],
  "สต๊อกกรอบแว่น": ["Frame stock", "ສະຕັອກຂອບແວ່ນ"],
  "สต๊อกเลนส์": ["Lens stock", "ສະຕັອກເລນ"],
  "อุปกรณ์เสริม": ["Accessories", "ອຸປະກອນເສີມ"],
  "ค้นหาสินค้า / SKU / บาร์โค้ด": ["Search products / SKU / barcode", "ຄົ້ນຫາສິນຄ້າ / SKU / ບາໂຄດ"],
  "แบรนด์ / รุ่น / ชื่อเลนส์ / รหัส": ["Brand / model / lens name / code", "ຍີ່ຫໍ້ / ຮຸ່ນ / ຊື່ເລນ / ລະຫັດ"],
  "แสดง": ["Show", "ສະແດງ"],
  "รายการต่อหน้า": ["per page", "ລາຍການຕໍ່ໜ້າ"],
  "SKU / บาร์โค้ด": ["SKU / barcode", "SKU / ບາໂຄດ"],
  "รูปสินค้า": ["Image", "ຮູບສິນຄ້າ"],
  "แบรนด์": ["Brand", "ຍີ່ຫໍ້"],
  "รุ่น": ["Model", "ຮຸ່ນ"],
  "สี": ["Color", "ສີ"],
  "ขนาด": ["Size", "ຂະໜາດ"],
  "ยี่ห้อ": ["Brand", "ຍີ່ຫໍ້"],
  "ชื่อเลนส์": ["Lens name", "ຊື່ເລນ"],
  "ค่าสายตา": ["Prescription", "ຄ່າສາຍຕາ"],
  "ชื่อสินค้า": ["Product", "ຊື່ສິນຄ້າ"],
  "ประเภท": ["Type", "ປະເພດ"],
  "รายละเอียด": ["Details", "ລາຍລະອຽດ"],
  "ราคา": ["Price", "ລາຄາ"],
  "จำนวน": ["Quantity", "ຈຳນວນ"],
  "จำนวนคงเหลือ": ["Available", "ຈຳນວນຄົງເຫຼືອ"],
  "สินค้า": ["Product", "ສິນຄ້າ"],
  "ยังไม่มีรูปสินค้า": ["Product image unavailable", "ຍັງບໍ່ມີຮູບສິນຄ້າ"],
  "ไม่มีรูป": ["No image", "ບໍ່ມີຮູບ"],
  "ชิ้น": ["pcs", "ຊິ້ນ"],
  "ดูรหัส": ["View code", "ເບິ່ງລະຫັດ"],
  "รอยืนยัน": ["Unverified", "ລໍຖ້າຢືນຢັນ"],
  "ไม่พบสินค้าประเภทนี้": ["No products in this category.", "ບໍ່ພົບສິນຄ້າໃນປະເພດນີ້"],
  "แบ่งหน้าสต๊อก Optical": ["Optical stock pagination", "ແບ່ງໜ້າສະຕັອກ Optical"],
  "จาก": ["of", "ຈາກ"],
  "ก่อนหน้า": ["Previous", "ກ່ອນໜ້າ"],
  "หน้า": ["Page", "ໜ້າ"],
  "ถัดไป": ["Next", "ຖັດໄປ"],
  "ปิด": ["Close", "ປິດ"]
};

export function opticalText(language: CrmSettingsLanguage, text: string): string {
  if (language === "th") return text;
  const entry = dictionary[text];
  return entry ? entry[language === "en" ? 0 : 1] : text;
}

export function readOpticalLanguage(): CrmSettingsLanguage {
  try {
    if (typeof localStorage !== "undefined")
      return normalizeCrmSettingsLanguage(localStorage.getItem(CRM_SETTINGS_LANGUAGE_STORAGE));
  } catch { /* Browser storage may be unavailable. */ }
  return "th";
}

export function opticalDateLocale(language: CrmSettingsLanguage): string {
  return language === "lo" ? "lo-LA" : language === "en" ? "en-US" : "th-TH";
}
