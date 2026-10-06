import { describe,expect,it } from "vitest";
import { existsSync,readFileSync,readdirSync,statSync } from "node:fs";
import { join } from "node:path";
const root=process.cwd(); const read=(p:string)=>readFileSync(join(root,p),"utf8");
function collect(dir:string):string[]{return readdirSync(join(root,dir)).flatMap(name=>{const rel=join(dir,name),abs=join(root,rel);return statSync(abs).isDirectory()?collect(rel):/\.(ts|tsx)$/.test(name)?[rel]:[];});}
describe("architecture guardrails",()=>{
  it("keeps shell and barrel small",()=>{expect(read("src/App.tsx").split("\n").length).toBeLessThan(260);expect(read("src/lib/portal.ts").split("\n").length).toBeLessThan(40);for(const f of ["DashboardView","SalesView","ProductsView","StockView","StaffView","PackageView","MoreView","SettingsView"])expect(existsSync(join(root,"src/views/"+f+".tsx"))).toBe(true);});
  it("keeps privileged credentials out of browser source",()=>{expect(collect("src").map(read).join("\n")).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY|service[_-]?role/i);});
  it("preserves edge-function security guards",()=>{const l=read("supabase/functions/customer-portal-login/index.ts"),s=read("supabase/functions/customer-portal-staff-admin/index.ts"),b=read("supabase/functions/customer-portal-billing-payment/index.ts");expect(l).toContain("customer_portal_authenticate_employee");expect(l).toContain("portal_rate_limited");expect(s).toContain("manager_cannot_grant_privileged_role");expect(s).toContain("bcrypt.hash");expect(b).toContain("validMagic");expect(b).toContain("owner_required");});
});
