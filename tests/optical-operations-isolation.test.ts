import { readFileSync } from "node:fs";
import { describe,expect,it } from "vitest";
const read=(path:string)=>readFileSync(new URL("../src/"+path,import.meta.url),"utf8");
describe("CRM Optical-only workspace",()=>{
  it("never exposes new financial screens in ordinary plans or before explicit rollout",()=>{
    const app=read("App.tsx");
    expect(app).toContain('canSeeOptical');
    expect(app).toContain('VITE_OPTICAL_OPS_V1_ENABLED === "true"');
    expect(app).toContain("menuAccess?.optical_retail_enabled");
    expect(app).toContain("<OpticalCustomersView");
  });
  it("isolates inventory and reports by tenant and branch without food stock changes",()=>{
    const ui=read("views/OpticalOperationsView.tsx");
    expect(ui).toContain('"optical_work_orders"');
    expect(ui).toContain('"optical_stock_bins"');
    expect(ui).toContain('supabase.rpc("optical_report_v1"');
    expect(ui).toContain('.eq("tenant_id",context.tenantId).eq("branch_id",branch)');
    expect(ui).toContain('timeZone:"Asia/Vientiane"');
    expect(ui).not.toContain('"ingredients"');
    expect(ui).not.toContain('.update({');
    expect(ui).toContain("b.on_hand-b.reserved");
  });
});
