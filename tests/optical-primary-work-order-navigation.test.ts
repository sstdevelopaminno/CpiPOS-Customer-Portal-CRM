import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
import {CRM_MAIN_MENU_KEYS,CRM_OPTICAL_MENU_KEYS,isCrmMenuEnabled} from "../src/lib/crm-menu-policy";
import {opticalText} from "../src/lib/optical-locale";
const read=(path:string)=>readFileSync(new URL("../src/"+path,import.meta.url),"utf8");
describe("CUSTOM Optical work orders appear as a separate main CRM menu",()=>{
  const app=read("App.tsx");
  const page=read("views/OpticalWorkOrdersPage.tsx");
  const workspace=read("views/OpticalWorkspace.tsx");
  it("puts an independent work-order button in the existing sidebar",()=>{
    expect(app).toContain('{ id:"work_orders",label:"ใบสั่งงาน",icon:<ClipboardList');
    expect(app).toContain('id==="work_orders"?canSeeWorkOrders');
    expect(app).toContain('activeView==="work_orders"&&canSeeWorkOrders?<OpticalWorkOrdersPage');
    expect(app).toContain('customerOpticalTabsAllowed=opticalTabsAllowed.filter(tab=>tab!=="orders")');
    expect(app).toContain('opticalTabsAllowed={customerOpticalTabsAllowed}');
    expect(CRM_MAIN_MENU_KEYS.work_orders).toBe(CRM_OPTICAL_MENU_KEYS.orders);
  });
  it("respects IT parent/child menu policies and Optical package before rendering",()=>{
    expect(isCrmMenuEnabled({},"main.crm_optical_orders")).toBe(true);
    expect(isCrmMenuEnabled({"main.crm_optical":false},"main.crm_optical_orders")).toBe(false);
    expect(isCrmMenuEnabled({"main.crm_optical_orders":false},"main.crm_optical_orders")).toBe(false);
    expect(app).toContain("customOpticalEnabled");
    expect(app).toContain("menuAccess?.optical_retail_enabled");
    expect(app).toContain("menuAccess.is_custom||menuAccess.is_internal_test_full");
    expect(app).toContain("isCrmMenuEnabled(crmPolicy,CRM_OPTICAL_MENU_KEYS.orders)");
    expect(app).toContain("isCrmMenuEnabled(crmPolicy,CRM_MAIN_MENU_KEYS[id])");
  });
  it("preserves existing Optical customer/stock UI and cashier workflow",()=>{
    expect(app).toContain('id:"optical",label:"ลูกค้าแว่นตา"');
    expect(workspace).toContain("<OpticalCustomersView");
    expect(page).toContain('useOpticalStaffRights');
    expect(page).toContain('VITE_OPTICAL_WORK_ORDER_DRAFTS_V1_ENABLED');
    expect(page).toContain('page="orders"');
    expect(page).toContain('<OpticalOperationsView');
    expect(page).toContain("staffEditAllowed={rights.ordersEdit}");
    expect(page).not.toContain("optical_post_deposit_tx");
    expect(page).not.toContain("handleCheckout");
  });
  it("renders translated main menu in Thai, English and Lao",()=>{
    expect(opticalText("th","ใบสั่งงาน")).toBe("ใบสั่งงาน");
    expect(opticalText("en","ใบสั่งงาน")).toBe("Work orders");
    expect(opticalText("lo","ใบสั่งงาน")).toBe("ໃບສັ່ງງານ");
    expect(app).toContain('opticalText(language,"ใบสั่งงาน")');
  });
});
