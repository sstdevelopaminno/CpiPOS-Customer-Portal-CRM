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
    expect(component).toContain('!strictOpticalCategory || /^(กรอบแว่น');
    const app=source("App.tsx");
    expect(app).toContain('strictOpticalCategory={stockBusinessMode==="mixed"}');
  });
  it("does not bypass main.more / more.stock or expose special Optical inventory to food plans",()=>{
    const app=source("App.tsx");
    expect(app).toContain('canSeeView("stock")');
    expect(app).toContain('activeView==="stock"&&menuAccess');
    expect(app).toContain("resolveCustomInventoryMode(menuAccess)");
    expect(app).toContain("CustomStockRouter");
  });
});
