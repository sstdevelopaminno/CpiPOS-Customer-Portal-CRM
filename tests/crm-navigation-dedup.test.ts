import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
import {settingsText} from "../src/lib/settings-language";

const read=(path:string)=>readFileSync(new URL("../src/"+path,import.meta.url),"utf8");
describe("CRM three-language navigation without duplicate shortcuts",()=>{
  it("translates the primary CRM navigation and uses the settings language selection",()=>{
    for(const name of ["ภาพรวม","ยอดขาย","สินค้า","สต๊อกกรอบ/เลนส์","พนักงาน","แพ็กเกจ","เพิ่มเติม","ลูกค้าแว่นตา"]){
      expect(settingsText("en",name)).not.toBe(name);
      expect(settingsText("lo",name)).not.toBe(name);
    }
    expect(read("App.tsx")).toContain("useCrmLanguage()");
    expect(read("views/SettingsView.tsx")).toContain('cpipos-crm-language-changed');
  });
  it("keeps a single way to each repeated CRM route while preserving top-level screens",()=>{
    const more=read("views/MoreView.tsx");
    const settings=read("views/SettingsView.tsx");
    expect(more).not.toContain('renderMenuGroup(["more.sales_summary"');
    expect(more).not.toContain('renderMenuGroup(["more.stock"');
    expect(more).toContain('keys:["more.receipts","more.tax_invoices","more.product_sales"]');
    expect(more).toContain('keys:["more.members"]');
    expect(settings).not.toContain('renderSettingsGroup(["store","branches","users"])');
    expect(settings).toContain('kinds:["branding","store","branches"]');
    expect(settings).toContain('item.kind==="language"');
  });
  it("requires separate CUSTOM IT branding menu consent without altering store settings",()=>{
    const policy=read("lib/custom-menu-access.ts");
    const settings=read("views/SettingsView.tsx");
    expect(policy).toContain('"settings.branding"');
    expect(settings).toContain('isCustomMenuVisible(features,"settings.branding")');
    expect(settings).toContain('item.kind==="branding"');
    expect(read("lib/crm-topic-visibility.ts")).toContain('isCustomMenuVisible(state,item.key)');
  });
});
