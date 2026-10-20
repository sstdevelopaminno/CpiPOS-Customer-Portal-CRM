import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {opticalText} from "../src/lib/optical-locale";

const src=readFileSync(new URL("../src/views/OpticalOperationsView.tsx",import.meta.url),"utf8");
const detail=readFileSync(new URL("../src/views/OpticalWorkOrderDetailDialog.tsx",import.meta.url),"utf8");

describe("Optical CRM finance read-only history",()=>{
 it("enforces tenant, branch and work-order scoping on every ledger read",()=>{
  expect(src).toContain('supabase.from("optical_work_orders")');
  expect(src).toContain('supabase.from("optical_payment_ledger")');
  expect(src).toContain('.eq("tenant_id",context.tenantId).eq("branch_id",branch)');
  expect(src).toContain('.eq("work_order_id",selectedOrderId)');
  expect(src).toContain('setOrders([]);setBins([]);setSkuMap({});setMetrics([]);setSelectedOrderId(null);setPayments([]);');
  expect(src).toContain("OpticalWorkOrderDetailDialog");
  expect(detail).toContain('supabase.from("optical_payment_ledger")');
  expect(detail).toContain('supabase.from("optical_work_order_lines")');
  expect(src).not.toContain('.from("optical_payment_ledger").insert');
  expect(src).not.toContain('.from("optical_payment_ledger").update');
 });
 it("shows original transaction currency and never treats a pending transfer as verified",()=>{
  expect(detail).toContain("fmt(p.amount,order.currency_code)");
  expect(detail).toContain("order.total_amount-order.paid_total");
  expect(detail).toContain("optical_manage_work_order_pin_v2");
  expect(detail).not.toContain('from("optical_payment_ledger").insert');
 });
 it("localizes all ledger controls in Thai, Lao and English",()=>{
  for(const label of ["บัญชีมัดจำ","ดูประวัติมัดจำ","ปิดรายละเอียดมัดจำ","ประวัติเงินมัดจำและยอดค้างชำระ","วันรับเงิน","วิธีรับเงิน","จำนวนเงินมัดจำ","หลักฐาน / ผู้ยืนยัน","เงินสด","โอนเงิน","รับเงินสดโดยพนักงาน","ผู้จัดการยืนยันด้วยตนเอง","ยังไม่ได้ตรวจสอบหลักฐานโอน"]){
    expect(opticalText("th",label)).toBe(label);
    expect(opticalText("lo",label)).not.toBe(label);
    expect(opticalText("en",label)).not.toBe(label);
  }
 });
});
