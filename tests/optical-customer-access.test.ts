import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const source=(path:string)=>readFileSync(new URL(path,import.meta.url),"utf8");

describe("CRM Optical history controls",()=>{
  it("is hidden from general or unentitled CUSTOM stores",()=>{
    const app=source("../src/App.tsx");
    const state=source("../src/lib/api/billing.ts");
    expect(app).toContain("menuAccess?.optical_retail_enabled");
    expect(app).toContain('id==="optical" ? canSeeOptical');
    expect(state).toContain('contractCurrent && approvedSalesModes.optical_retail===true');
    expect(state).toContain('grants[mode]===true');
    expect(state).toContain('contract?.status==="active"||contract?.status==="trial"');
    expect(state).toContain('"tenant_subscription_contracts"');
  });
  it("queries the shared tenant-scoped Optical tables and softly archives",()=>{
    const view=source("../src/views/OpticalCustomersView.tsx");
    expect(view).toContain('"optical_customers"');
    expect(view).toContain('"optical_eye_exams"');
    expect(view).toContain('"optical_save_customer_exam"');
    expect(view).toContain('"tenant_id",context.tenantId');
    expect(view).toContain('"branch_id",activeBranch');
    expect(view).toContain('deleted_at:new Date().toISOString()');
  });
});
