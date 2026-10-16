import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
import {CRM_MAIN_MENU_KEYS,CRM_MORE_MENU_KEYS,CRM_SETTINGS_MENU_KEYS,CRM_OPTICAL_MENU_KEYS,isCrmMenuEnabled} from "../src/lib/crm-menu-policy";
const read=(path:string)=>readFileSync(new URL("../src/"+path,import.meta.url),"utf8");

describe("CRM independent IT menu control",()=>{
 it("keeps existing tenants visible unless IT explicitly closes a CRM key",()=>{
  const policy:Record<string,boolean>={};
  for(const key of [...Object.values(CRM_MAIN_MENU_KEYS),...Object.values(CRM_MORE_MENU_KEYS),
    ...Object.values(CRM_SETTINGS_MENU_KEYS),...Object.values(CRM_OPTICAL_MENU_KEYS)])
    expect(isCrmMenuEnabled(policy,key)).toBe(true);
  expect(isCrmMenuEnabled({"main.crm_more":false},"more.crm_receipts")).toBe(false);
  expect(isCrmMenuEnabled({"main.crm_more":true,"more.crm_receipts":false},"more.crm_receipts")).toBe(false);
  expect(isCrmMenuEnabled({"main.crm_more":false},"main.crm_sales")).toBe(true);
  expect(isCrmMenuEnabled({"settings.store":false},"settings.crm_store")).toBe(true);
  expect(isCrmMenuEnabled({},"settings.unrecognized")).toBe(false);
 });
 it("keeps CRM main and Optical tabs subject to existing package and branch access",()=>{
  const app=read("App.tsx");
  expect(app).toContain("isCrmMenuEnabled(crmPolicy,CRM_MAIN_MENU_KEYS[id])");
  expect(app).toContain("isCrmMenuEnabled(crmPolicy,CRM_OPTICAL_MENU_KEYS[tab])");
  expect(app).toContain("menuAccess.menu_policy[\"main.optical_customers\"]!==false");
  expect(app).toContain("isCustomMenuVisible(menuAccess,PORTAL_VIEW_MENU[id])");
  expect(app).toContain("activeOpticalTab");
 });
 it("does not let forbidden CRM submenu entries render in More or Settings",()=>{
  const more=read("views/MoreView.tsx");
  const settings=read("views/SettingsView.tsx");
  expect(more).toContain("isCrmMenuEnabled(menuPolicy,CRM_MORE_MENU_KEYS[item.key])");
  expect(settings).toContain("isCrmMenuEnabled(menuPolicy,CRM_SETTINGS_MENU_KEYS[item.key])");
  expect(settings).toContain('isCustomMenuVisible(features,"settings.branding")');
  expect(more).toContain("isCustomMenuVisible(state,item.key)");
  expect(settings).toContain("isCustomMenuVisible(features,item.key)");
 });
});
