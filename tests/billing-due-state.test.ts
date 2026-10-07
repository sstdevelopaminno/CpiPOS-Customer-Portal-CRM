import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe,expect,it } from "vitest";
const src=(path:string)=>readFileSync(resolve(process.cwd(),path),"utf8");
describe("CRM canonical package due state",()=>{
  const migration=src("supabase/sql/customer_portal_billing_due_state.sql");
  const view=src("src/views/PackageView.tsx");
  const api=src("src/lib/api/billing.ts");
  it("separates current due from settlement history",()=>{
    expect(migration).toContain("subscription_billing_due_state");
    expect(api).toContain("currentDue");
    expect(view).toContain("รอบที่ต้องชำระปัจจุบัน");
    expect(view).toContain("ชำระแล้ว (ประวัติ)");
    expect(view).toContain("ประวัติรอบบิลจาก Settlement");
  });
  it("uses payable-now state",()=>{
    expect(view).toContain("currentDue?.payable_now");
    expect(view).toContain("คำนวณจากวันสิ้นสุดสิทธิ์ปัจจุบัน");
  });
});
