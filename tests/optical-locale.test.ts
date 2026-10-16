import { describe, expect, it } from "vitest";
import { opticalDateLocale, opticalText } from "../src/lib/optical-locale";

describe("CUSTOM Optical CRM locale and accounting labels", () => {
  it("translates key order, stock and finance labels in Thai, English and Lao", () => {
    for (const key of ["ใบสั่งงานแว่นตา", "สต๊อกกรอบแว่น", "รายงานเจ้าของร้าน",
      "รับชำระ LAK", "ยอดขายที่ส่งมอบแล้ว LAK", "ค้างชำระ",
      "รายงาน Optical สำหรับ THB/USD ยังไม่เปิดใช้งาน เพื่อป้องกันการแสดงยอด LAK ผิดสกุลเงิน",
      "SKU / บาร์โค้ด", "ไม่พบสินค้าประเภทนี้", "ปิด"]) {
      expect(opticalText("th",key)).toBe(key);
      expect(opticalText("en",key)).not.toBe(key);
      expect(opticalText("lo",key)).not.toBe(key);
    }
  });
  it("uses the selected language for date labels, without changing stored currency", () => {
    expect(opticalDateLocale("th")).toBe("th-TH");
    expect(opticalDateLocale("en")).toBe("en-US");
    expect(opticalDateLocale("lo")).toBe("lo-LA");
  });
});
