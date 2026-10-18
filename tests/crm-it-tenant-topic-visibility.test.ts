import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
import {visibleCrmMoreItems,visibleCrmSettingsItems} from "../src/lib/crm-topic-visibility";
import {isCrmMenuEnabled} from "../src/lib/crm-menu-policy";

const source=(name:string)=>readFileSync(new URL("../src/"+name,import.meta.url),"utf8");

// IT database rows confirmed for internal test store 900001 (Oct 18 2026).
// Use a synthetic policy, never mutate a real tenant in tests.
const disabled:Record<string,boolean>={
  "more.crm_tables":false,"more.crm_kitchen_manage":false,
  "more.crm_buffet":false,"more.crm_members":false,
  "settings.crm_display":false,"settings.crm_inet_nops":false,
  "settings.crm_order_kitchen":false,"settings.crm_table_qr":false
};
const testStore={is_custom:true,is_internal_test_full:true,menu_policy:{}};
const restaurant=["more.tables","more.kitchen_manage","more.buffet"];
const hardware=["devices","printers","display"];
const operations=["activity","orderKitchen","tableQr","language","currency","placement"];

describe("IT CRM menu control matches POS-style category visibility",()=>{
  it("hides restaurant and member categories when all child menus are off",()=>{
    expect(visibleCrmMoreItems(disabled,testStore,restaurant)).toHaveLength(0);
    expect(visibleCrmMoreItems(disabled,testStore,["more.members"])).toHaveLength(0);
    expect(visibleCrmMoreItems(disabled,testStore,["more.receipts","more.tax_invoices","more.product_sales"])).toHaveLength(3);
  });
  it("removes disabled settings cards, without hiding the rest of an authorized category",()=>{
    const hw=visibleCrmSettingsItems(disabled,testStore,hardware);
    expect(hw.map(x=>x.kind)).toEqual(["devices","printers"]);
    const ops=visibleCrmSettingsItems(disabled,testStore,operations);
    expect(ops.map(x=>x.kind)).not.toContain("orderKitchen");
    expect(ops.map(x=>x.kind)).not.toContain("tableQr");
    const billing=visibleCrmSettingsItems(disabled,testStore,["payments","inet","taxes","notifications"]);
    expect(billing.map(x=>x.kind)).not.toContain("inet");
  });
  it("hides all nested category cards if their CRM parent is disabled",()=>{
    expect(visibleCrmMoreItems({"main.crm_more":false},testStore,restaurant)).toEqual([]);
    expect(visibleCrmSettingsItems({"main.crm_settings":false},testStore,operations)).toEqual([]);
    expect(isCrmMenuEnabled({"main.crm_optical":false},"main.crm_optical_orders")).toBe(false);
  });
  it("fails closed while IT policy is unresolved and respects explicit CUSTOM POS parent controls",()=>{
    expect(visibleCrmMoreItems(disabled,null,restaurant)).toEqual([]);
    expect(visibleCrmSettingsItems(disabled,null,operations)).toEqual([]);
    const custom={is_custom:true,is_internal_test_full:false,menu_policy:{"main.more":false,"main.settings":false}};
    expect(visibleCrmMoreItems({},custom,["more.receipts"])).toHaveLength(0);
    expect(visibleCrmSettingsItems({},custom,["devices"])).toHaveLength(0);
  });
  it("filters category cards themselves, not just contents; connected snapshots respect submenus",()=>{
    const more=source("views/MoreView.tsx");
    const settings=source("views/SettingsView.tsx");
    const hook=source("lib/use-portal-menu-access.ts");
    expect(more).toContain("visibleGroup(group.keys).length>0");
    expect(settings).toContain("visibleSettingsGroup(group.kinds).length>0");
    expect(settings).toContain("canSeeSettingsKind(\"payments\")");
    expect(settings).toContain("visibleSettingsGroup(connectedKinds).length>0");
    expect(hook).toContain("window.setInterval(");
    expect(hook).toContain("document.visibilityState===\"visible\"");
    expect(hook).toContain("setMenuAccess(null);setMenuAccessError(true)");
  });
});
