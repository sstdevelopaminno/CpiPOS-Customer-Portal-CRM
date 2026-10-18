import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
const src=readFileSync(new URL("../src/views/OpticalOperationsView.tsx",import.meta.url),"utf8");

describe("Optical CRM reports + tablet display when finance data unavailable",()=>{
  it("does not show invented zero sales when report RPC fails or is loading",()=>{
    expect(src).toContain('if(e)throw e;');
    expect(src).toContain('setError(T("ยังไม่สามารถโหลดข้อมูล Optical ได้');
    expect(src).toContain('page==="reports"&&context.salesCurrencyCode==="LAK"&&!error&&!loading');
    expect(src).toContain('setMetrics([])');
    expect(src).not.toContain('.from("optical_payment_ledger").insert');
  });
  it("does not misrepresent permission errors as empty orders or empty stock",()=>{
    expect(src).toContain("orders.length===0&&!loading&&!error");
    expect(src).toContain("bins.length===0&&!loading&&!error");
  });
  it("keeps all financial columns horizontally reachable and confirms no shared storage write",()=>{
    expect(src).toContain('className="overflow-x-auto rounded-xl bg-white shadow-sm"');
    expect(src).toContain('className="w-full min-w-[820px] text-left text-sm"');
    expect(src).toContain("whitespace-nowrap");
    expect(src).toContain('money(o.total_amount-o.paid_total,o.currency_code)');
    expect(src).not.toContain(".update({");
    expect(src).not.toContain(".insert({");
  });
});
