import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {opticalText} from "../src/lib/optical-locale";
const src=readFileSync(new URL("../src/views/OpticalCustomerAddressEditor.tsx",import.meta.url),"utf8");

describe("Optical customer address CRM safety and locales",()=>{
 it("saves branch-scoped customer address with a reused idempotency UUID on retries",()=>{
  expect(src).toContain('p_tenant_id:context.tenantId,p_branch_id:branch,p_customer_id:selected');
  expect(src).toContain('p_request_id:requestId');
  expect(src).toContain('retry.current?.signature===signature');
  expect(src).toContain('retry.current={signature,id:requestId}');
  expect(src).toContain('retry.current=null;');
  expect(src).toContain('if(e)throw e;');
  expect(src).not.toContain('.from("optical_eye_exams").update');
 });
 it("translates every address editor label and outcome in Thai Lao English",()=>{
  for(const label of [
   "ข้อมูลที่อยู่ลูกค้า Optical",
   "ข้อมูลเดียวกับประวัติลูกค้าเดิม แยกประวัติแก้ไข ไม่ลบผลตรวจย้อนหลัง",
   "ยังไม่เปิดใช้งานข้อมูลที่อยู่ลูกค้าในสาขานี้",
   "ไม่สามารถบันทึกที่อยู่ได้ กรุณาตรวจสอบสิทธิ์หรือสถานะโมดูล Optical",
   "บันทึกที่อยู่พร้อมประวัติการแก้ไขแล้ว โดยไม่เขียนทับผลตรวจสายตา",
   "เลือกลูกค้า","ที่อยู่","บันทึกที่อยู่"
  ]){
   expect(opticalText("th",label)).toBe(label);
   expect(opticalText("lo",label)).not.toBe(label);
   expect(opticalText("en",label)).not.toBe(label);
  }
 });
});
