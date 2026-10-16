import { readFileSync } from "node:fs";
import { describe,expect,it } from "vitest";
const read=(path:string)=>readFileSync(new URL("../src/"+path,import.meta.url),"utf8");
describe("CRM Optical-only workspace",()=>{
  it("never exposes new financial screens in ordinary plans or before explicit rollout",()=>{
    const app=read("App.tsx");
    expect(app).toContain('canSeeOptical');
    expect(app).toContain('id!=="reports"||context.role==="owner"');
    expect(app).toContain("OpticalCustomerAddressEditor");
    expect(app).toContain('className="custom-stock-shortcut"');
    expect(app).toContain('onClick={()=>chooseView("stock")}');
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
    expect(ui).toContain('context.salesCurrencyCode!=="LAK"');
    expect(ui).toContain('context.salesCurrencyCode==="LAK"');
    expect(ui).toContain('currency_code,total_amount,paid_total');
    expect(ui).toContain("money(o.total_amount,o.currency_code)");
    expect(ui).toContain('setOrders([]);setBins([]);setSkuMap({});setMetrics([]);');
    expect(ui).not.toContain('"ingredients"');
    expect(ui).not.toContain('.update({');
    expect(ui).toContain("bin.on_hand-bin.reserved");
    expect(ui).toContain("image_url:string|null");
    expect(ui).toContain("OpticalStockTable");
    expect(ui).toContain("opticalEntries:OpticalTableEntry[]");
    const table=read("views/OpticalStockTable.tsx");
    expect(table).toContain('aria-label={T("สลับประเภทสต๊อก Optical")}');
    expect(table).toContain("ค้นหาสินค้า / SKU / บาร์โค้ด");
    expect(table).toContain('role="dialog"');
    const address=read("views/OpticalCustomerAddressEditor.tsx");
    expect(address).toContain('supabase.rpc("optical_save_customer_address_v1"');
    expect(address).toContain('.eq("tenant_id",context.tenantId).eq("branch_id",branch)');

  });
});
