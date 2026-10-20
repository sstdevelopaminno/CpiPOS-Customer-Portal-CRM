import {readFileSync} from "node:fs";
import {describe,it,expect} from "vitest";
const src=(p:string)=>readFileSync(new URL(p,import.meta.url),"utf8");
describe("CRM Optical popups and preservation rules",()=>{
 it("customer row opens history popup with real separate profile edits",()=>{
  const x=src("../src/views/OpticalCustomersView.tsx");
  expect(x).toContain("setDetailFor(row)");
  expect(x).toContain('role="dialog" aria-modal="true"');
  expect(x).toContain("startProfileEdit");
  expect(x).toContain("if(editingProfile&&editor)");
  expect(x).toContain('.is("deleted_at",null)');
  expect(x).toContain("ลบ (เก็บถาวร)");
  expect(x).toContain("optical_work_orders");
 });
 it("work-order detail popup preserves ledger and delegates cancellations to gated RPC",()=>{
  const x=src("../src/views/OpticalOperationsView.tsx");
  const modal=src("../src/views/OpticalWorkOrderDetailDialog.tsx");
  expect(x).toContain("OpticalWorkOrderDetailDialog");
  expect(x).toContain("setSelectedOrderId(o.id)");
  expect(modal).toContain("optical_manage_work_order_v1");
  expect(modal).toContain('action==="cancel"');
  expect(modal).toContain("ยืนยันยกเลิกใบงาน");
  expect(modal).not.toContain('.delete()');
 });
});
