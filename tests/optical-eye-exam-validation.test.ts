import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {validateOpticalExamNumbers} from "../src/lib/optical-eye-exam-validation";

describe("CRM Optical examination numeric validation",()=>{
 it("reports left AX 388 and right AX over 180 without writing",()=>{
  expect(validateOpticalExamNumbers({left_axis:"388"})?.message)
    .toContain("L — AX ต้องเป็นจำนวนเต็มตั้งแต่ 0 ถึง 180");
  expect(validateOpticalExamNumbers({right_axis:"181"})?.field).toBe("right_axis");
  expect(validateOpticalExamNumbers({left_axis:"180.5"})?.field).toBe("left_axis");
 });
 it("accepts 0 and 180, enforces age, PD and leaves unrelated optional values untouched",()=>{
  expect(validateOpticalExamNumbers({left_axis:"0",right_axis:"180",age:"35",pd_mm:"56"})).toBeNull();
  expect(validateOpticalExamNumbers({left_axis:"",right_axis:null})).toBeNull();
  expect(validateOpticalExamNumbers({age:"131"})?.field).toBe("age");
  expect(validateOpticalExamNumbers({pd_mm:"29.5"})?.field).toBe("pd_mm");
 });
 it("checks the field before CRM calls its existing authorized RPC",()=>{
  const view=readFileSync(new URL("../src/views/OpticalCustomersView.tsx",import.meta.url),"utf8");
  expect(view).toContain("validateOpticalExamNumbers(form)");
  expect(view).toContain('aria-invalid={fieldError===k}');
  expect(view).toContain('rpc("optical_save_customer_exam"');
 });
});
