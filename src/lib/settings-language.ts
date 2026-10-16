export type CrmSettingsLanguage = "th" | "en" | "lo";
export const CRM_SETTINGS_LANGUAGE_STORAGE = "cpipos-crm-settings-language-v1";
export const languageOptions: {code:CrmSettingsLanguage;label:string}[] = [
  {code:"th",label:"ไทย"},{code:"en",label:"English"},{code:"lo",label:"ລາວ"}
];
export function normalizeCrmSettingsLanguage(value:unknown):CrmSettingsLanguage {
 return value==="en"||value==="lo"?value:"th";
}
/** Settings page/menu and setting-editor text in three languages.
 * Currency, store data and POS staff language remain separate settings. */
const words:Record<string,[string,string]> = {
 "ตั้งค่า":["Settings","ຕັ້ງຄ່າ"],"เปลี่ยนภาษา":["Change language","ປ່ຽນພາສາ"],
 "เลือกระบบภาษา":["Select language","ເລືອກພາສາ"],"ภาษาไทย อังกฤษ หรือลาว":["Thai, English or Lao","ໄທ, ອັງກິດ ຫຼື ລາວ"],
 "รีเฟรช":["Refresh","ໂຫຼດໃໝ່"],"ร้าน":["Store","ຮ້ານ"],"สาขา":["Branches","ສາຂາ"],
 "อุปกรณ์":["Devices","ອຸປະກອນ"],"บัญชีรับเงิน":["Payment accounts","ບັນຊີຮັບເງິນ"],
 "หัวข้อ":["topics","ຫົວຂໍ້"],"เครื่อง":["devices","ເຄື່ອງ"],"เครื่องที่เชื่อม":["connected printers","ເຄື່ອງພິມທີ່ເຊື່ອມ"],
 "รายการ Audit":["audit entries","ລາຍການ Audit"],
 "สาขาเปิดภาษี":["branches with tax","ສາຂາທີ່ເປີດພາສີ"],"สาขามีการตั้งค่า":["configured branches","ສາຂາທີ່ຕັ້ງຄ່າ"],
 "การเชื่อมต่อ":["connections","ການເຊື່ອມຕໍ່"],"ใช้รูป QR เดียวกับที่ POS อ่านจากบัญชีรับชำระ":["Uses the same QR image as POS payment account","ໃຊ້ QR ຮູບດຽວກັບບັນຊີ POS"],
 "Popup QR โต๊ะ":["Table QR popup","ປັອບອັບ QR ໂຕະ"],
 "หมวดหมู่การตั้งค่า POS":["POS settings categories","ໝວດການຕັ້ງຄ່າ POS"],
 "ข้อมูลร้านและผู้ใช้งาน":["Store and users","ຂໍ້ມູນຮ້ານ ແລະ ຜູ້ໃຊ້"],
 "ข้อมูลบริษัท สาขา และสิทธิ์พนักงาน":["Company, branches, and staff permissions","ຂໍ້ມູນບໍລິສັດ ສາຂາ ແລະ ສິດພະນັກງານ"],
 "การชำระเงินและภาษี":["Payments and tax","ການຊຳລະເງິນ ແລະ ພາສີ"],
 "บัญชีรับเงิน INET QR ภาษีและการแจ้งเตือน":["Payment accounts, INET QR, tax and notifications","ບັນຊີຮັບເງິນ, INET QR, ພາສີ ແລະ ການແຈ້ງເຕືອນ"],
 "เครื่องและอุปกรณ์":["Terminals and devices","ເຄື່ອງ ແລະ ອຸປະກອນ"],
 "เครื่องแคชเชียร์ เครื่องพิมพ์ และจอลูกค้า":["Cashier terminals, printers and customer displays","ເຄື່ອງຂາຍ, ເຄື່ອງພິມ ແລະ ຈໍລູກຄ້າ"],
 "การดำเนินงานและการแสดงผล":["Operations and display","ການດຳເນີນງານ ແລະ ການສະແດງຜົນ"],
 "Audit ครัว QR โต๊ะ ภาษา และแถบเมนู":["Audit, kitchen, table QR, language and navigation","ກວດສອບ, ຫ້ອງຄົວ, QR ໂຕະ, ພາສາ ແລະ ເມນູ"],
 "ข้อมูลร้านที่เชื่อมอยู่":["Connected store data","ຂໍ້ມູນຮ້ານທີ່ເຊື່ອມຕໍ່"],
 "ดูสาขา เครื่อง และบัญชีรับเงินที่เชื่อมกับ POS":["Branches, devices and payment accounts connected to POS","ສາຂາ, ອຸປະກອນ ແລະ ບັນຊີຮັບເງິນທີ່ເຊື່ອມຕໍ່ POS"],
 "ข้อมูลที่เชื่อมอยู่":["Connected data","ຂໍ້ມູນທີ່ເຊື່ອມຕໍ່"],
 "ข้อมูลร้าน":["Store information","ຂໍ້ມູນຮ້ານ"],
 "บัญชีรับชำระของร้าน":["Store payment accounts","ບັນຊີຮັບເງິນຂອງຮ້ານ"],
 "ยังไม่ได้ระบุที่อยู่":["Address not set","ຍັງບໍ່ລະບຸທີ່ຢູ່"],
 "ใช้งาน":["Active","ໃຊ້ງານ"],"ปิด":["Disabled","ປິດ"],
 "กำลังโหลดข้อมูล...":["Loading data...","ກຳລັງໂຫຼດຂໍ້ມູນ..."],
 "กำลังตรวจสิทธิ์...":["Checking access...","ກຳລັງກວດສິດ..."],
 "ไม่ได้เปิดในแพ็กเกจ/ถูก IT ปิด":["Not enabled by package/IT","ແພັກເກດບໍ່ເປີດ ຫຼື IT ປິດ"],
 "จัดการเพิ่ม แก้ไข ลบจาก Customer Portal":["Manage within Customer Portal","ຈັດການໃນ Customer Portal"],
 "กดเพื่อจัดการ":["Select to manage","ເລືອກເພື່ອຈັດການ"],
 "เปิดใช้งานใน Customer Portal":["Open in Customer Portal","ເປີດໃນ Customer Portal"],
 "จัดการจากเมนูพนักงาน":["Manage in Staff menu","ຈັດການໃນເມນູພະນັກງານ"],
 "ค่าเฉพาะเครื่อง POS":["Local POS device setting","ຄ່າສະເພາະເຄື່ອງ POS"],
 "ตั้งค่าที่เครื่อง POS โดยต้องได้รับสิทธิ์จาก IT":["Set on POS with IT permission","ຕັ້ງຄ່າທີ່ POS ໂດຍຕ້ອງໄດ້ສິດຈາກ IT"],
 "เชื่อมการตั้งค่า INET QR":["Connected INET QR settings","ການຕັ້ງຄ່າ INET QR ທີ່ເຊື່ອມຕໍ່"],
 "เชื่อมกับการตั้งค่า POS":["Connected POS setting","ເຊື່ອມຕໍ່ການຕັ້ງຄ່າ POS"],
 "รายการและลำดับเมนูอ้างอิงจาก CpiPOS ฝั่ง POS รวมเมนู QR โต๊ะและออเดอร์/ครัวที่แสดงในหน้าตั้งค่าจริง":[
  "This settings menu follows the CpiPOS POS catalog, including table QR and kitchen/order controls.",
  "ເມນູນີ້ອ້າງອີງຈາກ CpiPOS POS ລວມທັງ QR ໂຕະ ແລະ ການຈັດການຫ້ອງຄົວ."
 ],
 "เครื่องแคชเชียร์ เครื่องพิมพ์ และ Customer Display pairing จัดการจาก Customer Portal ได้แล้ว; การค้นหา USB/Bluetooth จริงและค่า local เช่นภาษา/ตำแหน่งเมนูยังทำที่เครื่อง POS/Print Agent":[
  "Cashier terminals, printers and customer displays can be managed here. USB/Bluetooth discovery and POS-device settings remain local.",
  "ຈັດການເຄື່ອງຂາຍ ເຄື່ອງພິມ ແລະ ຈໍລູກຄ້າໄດ້ທີ່ນີ້. USB/Bluetooth ແລະຄ່າເຄື່ອງ POS ແມ່ນຕັ້ງຄ່າໃນເຄື່ອງ."
 ],
 "ธีมสี / โลโก้ / ชื่อระบบ (CUSTOM)":["Theme / Logo / System name (CUSTOM)","ສີທີມ / ໂລໂກ້ / ຊື່ລະບົບ (CUSTOM)"],
 "ชื่อระบบ โลโก้ สีไฮไลต์ และสีพื้นหลังเมนู · Powered by CpiPOS":["System name, logo, highlight and menu background · Powered by CpiPOS","ຊື່ລະບົບ ໂລໂກ້ ສີໄຮໄລທ໌ ແລະ ສີພື້ນຫຼັງເມນູ · Powered by CpiPOS"],
 "ธีมสี โลโก้ และชื่อระบบ (CUSTOM)":["Theme, logo and system name (CUSTOM)","ສີທີມ ໂລໂກ້ ແລະ ຊື່ລະບົບ (CUSTOM)"],
 "ใช้ข้อมูลร่วมกันระหว่าง CRM และ POS · Powered by CpiPOS":["Shared settings across CRM and POS · Powered by CpiPOS","ໃຊ້ການຕັ້ງຄ່າຮ່ວມກັນລະຫວ່າງ CRM ແລະ POS · Powered by CpiPOS"],
 "จัดการร่วมกับ POS":["Manage with POS","ຈັດການຮ່ວມກັບ POS"],
 "ตั้งค่า POS":["POS settings","ຕັ້ງຄ່າ POS"],
 "จัดการข้อมูลร่วมกับระบบ POS ภายใต้สิทธิ์ Owner/Manager":["Manage shared POS data with Owner/Manager permissions","ຈັດການຂໍ້ມູນ POS ດ້ວຍສິດ Owner/Manager"],
 "บันทึกการตั้งค่า":["Save settings","ບັນທຶກການຕັ້ງຄ່າ"],
 "ยกเลิก":["Cancel","ຍົກເລີກ"],
 "บันทึกลงข้อมูลกลาง CpiPOS-001 และ POS จะอ่านค่าชุดเดียวกัน":["Saved to shared CpiPOS-001 data, used by POS","ບັນທຶກເຂົ້າຂໍ້ມູນກາງ CpiPOS-001 ແລະ POS ໃຊ້ຄ່າດຽວກັນ"],
 "ไม่สามารถโหลดการตั้งค่าร้านได้":["Unable to load store settings","ບໍ່ສາມາດໂຫຼດການຕັ້ງຄ່າຮ້ານ"],
 "ชื่อร้าน/ชื่อแสดงผล":["Store / display name","ຊື່ຮ້ານ/ຊື່ສະແດງ"],
 "ที่อยู่":["Address","ທີ່ຢູ່"],"เบอร์ติดต่อ":["Phone","ເບີຕິດຕໍ່"],
 "เลือกสาขา":["Select branch","ເລືອກສາຂາ"],"+ เพิ่มสาขาใหม่":["+ Add branch","+ ເພີ່ມສາຂາ"],
 "รหัสสาขา":["Branch code","ລະຫັດສາຂາ"],"ชื่อสาขา":["Branch name","ຊື່ສາຂາ"],
 "ที่อยู่สาขา":["Branch address","ທີ່ຢູ່ສາຂາ"],"เปิดใช้งานสาขา":["Enable branch","ເປີດໃຊ້ສາຂາ"],
 "บัญชี":["Account","ບັນຊີ"],"+ เพิ่มบัญชีใหม่":["+ Add account","+ ເພີ່ມບັນຊີ"],
 "ธนาคาร":["Bank","ທະນາຄານ"],"ชื่อบัญชี":["Account name","ຊື່ບັນຊີ"],
 "เลขบัญชี":["Account number","ເລກບັນຊີ"],"ระบุหมายเลข PromptPay":["Enter PromptPay number","ປ້ອນເລກ PromptPay"],
 "รูปแบบ QR":["QR type","ປະເພດ QR"],"รูป QR":["QR image","ຮູບ QR"],
 "URL / พาธรูป QR":["QR image URL/path","ລິ້ງຮູບ QR"],
 "ใช้ทุกสาขา":["All branches","ທຸກສາຂາ"],"เปิดใช้งาน":["Enabled","ເປີດໃຊ້ງານ"],
 "วิธีคำนวณ":["Calculation method","ວິທີຄຳນວນ"],"ภาษีแยกจากราคา":["Tax exclusive","ບໍ່ລວມພາສີ"],
 "ราคารวมภาษี":["Tax inclusive","ລວມພາສີ"],"เปิดใช้ภาษี":["Enable tax","ເປີດໃຊ້ພາສີ"],
 "เสียงแจ้งเตือน":["Notification sound","ສຽງແຈ້ງເຕືອນ"],
 "ระดับเสียง 0–1":["Volume 0–1","ລະດັບສຽງ 0–1"],
 "แจ้งหน้าร้าน":["Store notification","ແຈ້ງທີ່ຮ້ານ"],
 "ส่งเข้าครัวอัตโนมัติ":["Auto-send to kitchen","ສົ່ງເຂົ້າຄົວອັດຕະໂນມັດ"],
 "พิมพ์ครัวอัตโนมัติ":["Auto-print kitchen","ພິມຄົວອັດຕະໂນມັດ"],
 "ข้อมูลร้านค้า/บริษัท":["Store / company","ຂໍ້ມູນຮ້ານ/ບໍລິສັດ"],
 "ตั้งค่าชำระเงิน":["Payment settings","ຕັ້ງຄ່າຊຳລະເງິນ"],
 "ตั้งค่าภาษี":["Tax settings","ຕັ້ງຄ່າພາສີ"],"การแจ้งเตือน":["Notifications","ການແຈ້ງເຕືອນ"],
 "เพิ่มเครื่องแคชเชียร์":["Add POS terminal","ເພີ່ມເຄື່ອງ POS"],"ตั้งค่าเครื่องพิมพ์":["Printer settings","ຕັ້ງຄ່າເຄື່ອງພິມ"],
 "ตรวจสอบพฤติกรรมการใช้งาน":["Activity audit","ກວດສອບການໃຊ້ງານ"],
 "ตั้งค่าการแจ้งเตือน":["Notification settings","ຕັ້ງຄ່າການແຈ້ງເຕືອນ"],
 "ผู้ใช้งาน":["Users","ຜູ້ໃຊ້ງານ"],"ตั้งค่าสกุลเงิน (CUSTOM)":["Currency (CUSTOM)","ຕັ້ງຄ່າສະກຸນເງິນ (CUSTOM)"],
 "สลับแถบเมนูหลัก":["Navigation placement","ຕຳແໜ່ງເມນູຫຼັກ"],
 "จอลูกค้า":["Customer display","ຈໍລູກຄ້າ"],
 "การแจ้งเตือนออเดอร์และครัว":["Orders and kitchen notifications","ການແຈ້ງເຕືອນອໍເດີ ແລະ ຄົວ"],
 "ตั้งค่า QR โต๊ะ":["Table QR settings","ຕັ້ງຄ່າ QR ໂຕະ"],
 "ไม่สามารถบันทึกการตั้งค่าได้":["Unable to save settings","ບໍ່ສາມາດບັນທຶກການຕັ້ງຄ່າ"]
};
export function settingsText(language:CrmSettingsLanguage,text:string):string {
 return language==="th"?text:words[text]?.[language==="en"?0:1]??text;
}


const menuDescriptions: Record<string,[[string,string],[string,string]]> = {
 branding:[["Theme / Logo / System name (CUSTOM)","ສີທີມ / ໂລໂກ້ / ຊື່ລະບົບ (CUSTOM)"],["System name, logo, highlight and menu background · Powered by CpiPOS","ຊື່ລະບົບ ໂລໂກ້ ສີໄຮໄລທ໌ ແລະ ສີພື້ນຫຼັງເມນູ · Powered by CpiPOS"]],
 store:[["Store / company","ຂໍ້ມູນຮ້ານ / ບໍລິສັດ"],["Store code, display name, logo, address and contact","ລະຫັດຮ້ານ ຊື່ ໂລໂກ້ ທີ່ຢູ່ ແລະຕິດຕໍ່"]],
 branches:[["Branches","ສາຂາ"],["Add and manage branches","ເພີ່ມ ແລະຈັດການສາຂາ"]],
 devices:[["Cashier terminals","ເຄື່ອງ POS"],["Link terminals, scope and shift","ຜູກເຄື່ອງ ສິດທິ ແລະກະຂາຍ"]],
 printers:[["Printers","ເຄື່ອງພິມ"],["Receipts, print agents and cash drawers","ໃບຮັບເງິນ ເຄື່ອງພິມ ແລະລິ້ນຊັກເງິນ"]],
 activity:[["Activity audit","ກວດສອບການໃຊ້ງານ"],["Users, actions, times and approvals","ຜູ້ໃຊ້ ການດຳເນີນງານ ເວລາ ແລະອະນຸມັດ"]],
 payments:[["Payment settings","ຕັ້ງຄ່າການຊຳລະ"],["Bank accounts, PromptPay and QR","ບັນຊີທະນາຄານ PromptPay ແລະ QR"]],
 inet:[["INET QR","INET QR"],["Dynamic QR configuration per branch","ຕັ້ງຄ່າ Dynamic QR ຕາມສາຂາ"]],
 taxes:[["Tax settings","ຕັ້ງຄ່າພາສີ"],["VAT and withholding tax rules","ກົດເກນ VAT ແລະຫັກພາສີ"]],
 notifications:[["Notification settings","ຕັ້ງຄ່າແຈ້ງເຕືອນ"],["Popup and sound for QR table calls","ປັອບອັບ ແລະສຽງຈາກ QR ໂຕະ"]],
 users:[["Users","ຜູ້ໃຊ້ງານ"],["Manage staff roles and PIN","ຈັດການສິດພະນັກງານ ແລະ PIN"]],
 language:[["Change language","ປ່ຽນພາສາ"],["Choose Thai, English or Lao for CRM settings","ເລືອກພາສາໄທ ອັງກິດ ຫຼື ລາວ ສຳລັບ CRM"]],
 currency:[["Currency (CUSTOM)","ສະກຸນເງິນ (CUSTOM)"],["THB/LAK, controlled by IT","THB/LAK ຄວບຄຸມໂດຍ IT"]],
 placement:[["Menu placement","ຕຳແໜ່ງເມນູ"],["Choose menu position on POS device","ເລືອກຕຳແໜ່ງເມນູໃນ POS"]],
 display:[["Customer display","ຈໍລູກຄ້າ"],["Configure the customer-facing screen","ຕັ້ງຄ່າຈໍລູກຄ້າ"]],
 orderKitchen:[["Order and kitchen notifications","ແຈ້ງເຕືອນອໍເດີ ແລະຄົວ"],["QR alerts, kitchen dispatch and printing","ແຈ້ງເຕືອນ QR ສົ່ງເຂົ້າຄົວ ແລະພິມ"]],
 tableQr:[["Table QR settings","ຕັ້ງຄ່າ QR ໂຕະ"],["Set QR expiry time or bill lifetime","ກຳນົດອາຍຸ QR ຕາມເວລາ ຫຼືບິນ"]]
};
export function settingsMenuLocale(language:CrmSettingsLanguage,kind:string,label:string,desc:string) {
 if(language==="th")return{label,desc};
 const entry=menuDescriptions[kind];
 const i=language==="en"?0:1;
 return entry?{label:entry[0][i],desc:entry[1][i]}:{label:settingsText(language,label),desc:settingsText(language,desc)};
}
