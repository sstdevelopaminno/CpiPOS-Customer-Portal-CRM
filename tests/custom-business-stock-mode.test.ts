import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolveCustomInventoryMode } from "../src/lib/custom-inventory-mode";
import type { FeatureState } from "../src/types/portal";

const state = (sales_modes:Record<string,boolean>,optical=false,custom=true):FeatureState=>({
  package_id:null,is_custom:custom,is_internal_test_full:false,
  optical_retail_enabled:optical,sales_modes,
  package_features:{},feature_overrides:{},menu_policy:{}
});
const source=(path:string)=>readFileSync(new URL("../src/"+path,import.meta.url),"utf8");
describe("CUSTOM stock differs by IT-approved sales mode",()=>{
  it("keeps fixed packages on the unchanged ingredient UI",()=>{
    expect(resolveCustomInventoryMode(state({optical_retail:true},true,false))).toBe("legacy");
    expect(source("views/CustomStockRouter.tsx")).toContain('if(mode==="legacy")return <StockView');
  });
  it("shows Optical only for an explicitly authorized Optical CUSTOM grant",()=>{
    expect(resolveCustomInventoryMode(state({optical_retail:true},true))).toBe("optical");
    expect(resolveCustomInventoryMode(state({optical_retail:true},false))).toBe("legacy");
    expect(resolveCustomInventoryMode(state({},true))).toBe("legacy");
    expect(resolveCustomInventoryMode(state({optical_retail:false,general_sale:true},true))).toBe("retail");
  });
  it("uses separate inventory views when Optical and restaurant modes are both authorized",()=>{
    expect(resolveCustomInventoryMode(state({optical_retail:true,dine_in:true},true))).toBe("mixed");
    expect(resolveCustomInventoryMode(state({optical_retail:true,general_sale:true},true))).toBe("mixed");
    expect(resolveCustomInventoryMode(state({takeaway:true},false))).toBe("legacy");
  });
  it("keeps Optical stock read-only before bank/payment/stock cutover is authorized",()=>{
    const component=source("views/BusinessStockOverview.tsx");
    const router=source("views/CustomStockRouter.tsx");
    expect(component).toContain("loadProducts(context.tenantId,activeBranch)");
    expect(component).toContain("row.branch_id===activeBranch");
    expect(component).toContain("row.stock_deduction_mode");
    expect(component).toContain("Optical Stock Bin");
    expect(component).not.toContain("saveStock(");
    expect(component).not.toContain("deleteStock(");
    expect(component).not.toContain(".update(");
    expect(router).toContain('VITE_OPTICAL_OPS_V1_ENABLED==="true"');
    expect(router).toContain("BusinessStockOverview");
    expect(router).toContain('strictOpticalCategory={mode==="mixed"}');
    expect(component).toContain('if(optical){');
    expect(component).toContain('optical_stock_bins');
    expect(component).toContain('OpticalStockTable rows={opticalEntries}');
    const table=source("views/OpticalStockTable.tsx");
    expect(table).toContain("สต๊อกกรอบแว่น");
    expect(table).toContain("สต๊อกเลนส์");
    expect(table).toContain("SKU / บาร์โค้ด");
    expect(table).toContain('role="dialog"');
    const workspace=source("views/OpticalWorkspace.tsx");
    expect(workspace).toContain('strictOpticalCategory={stockBusinessMode==="mixed"}');
  });
  it("supports assigned branch selection, custom catalog creation and completed-only ranking",()=>{
    const view=source("views/BusinessStockOverview.tsx");
    const best=source("views/OpticalBestSellers.tsx");
    const create=source("views/OpticalCreateProduct.tsx");
    expect(view).toContain('context.branches.map(b=><option');
    expect(view).toContain("setStockBranch");
    expect(view).toContain("OpticalBestSellers");
    expect(view).toContain("OpticalCreateProduct");
    expect(best).toContain('.eq("status","completed")');
    expect(best).toContain('order_items');
    expect(best).toContain('.eq("branch_id",branchId)');
    expect(create).toContain('customer_portal_optical_product_create_v1');
    expect(create).toContain("p_branch_id:target");
    expect(create).toContain("SKU / บาร์โค้ด");
  });
  it("does not bypass main.more / more.stock or expose special Optical inventory to food plans",()=>{
    const app=source("App.tsx");
    expect(app).toContain('canSeeView("stock")');
    expect(app).toContain('activeView==="stock"&&menuAccess');
    expect(app).toContain("resolveCustomInventoryMode(menuAccess)");
    expect(app).toContain("CustomStockRouter");
  });
});
