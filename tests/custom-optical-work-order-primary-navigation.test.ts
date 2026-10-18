import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
import {CRM_MAIN_MENU_KEYS,CRM_OPTICAL_MENU_KEYS,isCrmMenuEnabled} from "../src/lib/crm-menu-policy";
import {opticalText} from "../src/lib/optical-locale";
const app=readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");
describe("CUSTOM Optical work-orders primary navigation (UI-only safe release)",()=>{
  it("shows a dedicated sidebar item and read-only existing order list",()=>{
    expect(app).toContain('id:"work_orders",label:"ใบสั่งงาน"');
    expect(app).toContain('activeView==="work_orders"&&canSeeWorkOrders');
    expect(app).toContain('<OpticalOperationsView context={context} branchId={branchId||null} page="orders"/>');
    expect(app).toContain('const canSeeWorkOrders=Boolean(menuAccess?.optical_retail_enabled');
    expect(CRM_MAIN_MENU_KEYS.work_orders).toBe(CRM_OPTICAL_MENU_KEYS.orders);
    expect(app).not.toContain("customer_portal_save_optical_draft_v1");
    expect(app).not.toContain("optical_post_deposit_tx");
  });
  it("cannot bypass IT Optical parent and order toggles",()=>{
    expect(isCrmMenuEnabled({},"main.crm_optical_orders")).toBe(true);
    expect(isCrmMenuEnabled({"main.crm_optical":false},"main.crm_optical_orders")).toBe(false);
    expect(isCrmMenuEnabled({"main.crm_optical_orders":false},"main.crm_optical_orders")).toBe(false);
    expect(app).toContain("menuAccess.is_custom||menuAccess.is_internal_test_full");
    expect(app).toContain("isCrmMenuEnabled(crmPolicy,CRM_OPTICAL_MENU_KEYS.orders)");
    expect(app).toContain("isCrmMenuEnabled(crmPolicy,CRM_MAIN_MENU_KEYS[id])");
  });
  it("localizes menu label without changing POS cart or financial workflows",()=>{
    expect(opticalText("th","ใบสั่งงาน")).toBe("ใบสั่งงาน");
    expect(opticalText("en","ใบสั่งงาน")).toBe("Work orders");
    expect(opticalText("lo","ใบสั่งงาน")).toBe("ໃບສັ່ງງານ");
    expect(app).toContain('opticalText(language,"ใบสั่งงาน")');
  });
});
