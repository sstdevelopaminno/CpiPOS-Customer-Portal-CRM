import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
const dialog=readFileSync(new URL("../src/views/OpticalWorkOrderDetailDialog.tsx",import.meta.url),"utf8");
describe("CRM Optical order manager PIN",()=>{
 it("shows side-by-side items / payment history and requires PIN before changes",()=>{
  expect(dialog).toContain("md:grid-cols-2");
  expect(dialog).toContain("รายการสินค้า");
  expect(dialog).toContain("ประวัติเงินมัดจำ");
  expect(dialog).toContain('type="password"');
  expect(dialog).toContain("p_manager_pin:pin");
  expect(dialog).toContain("optical_manage_work_order_pin_v2");
 });
 it("does not cancel existing posted payment without refund",()=>{
  expect(dialog).toContain('order.paid_total>0');
  expect(dialog).toContain("คืนเงินอย่างเป็นทางการ");
  expect(dialog).not.toContain('.delete()');
 });
});
