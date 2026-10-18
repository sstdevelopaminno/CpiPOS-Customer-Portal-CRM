import {describe,expect,it,vi,beforeEach} from "vitest";
vi.mock("../src/lib/supabase",()=>({supabase:{from:vi.fn()}}));
import {supabase} from "../src/lib/supabase";
import {currencyFromITContract,readITApprovedSalesCurrency} from "../src/lib/it-approved-sales-currency";
import {readFileSync} from "node:fs";

const latest={status:"active",ended_at:null,metadata:{pos_currency_code:"LAK"}};
describe("IT-approved sales currency matches newest active tenant contract",()=>{
  beforeEach(()=>vi.clearAllMocks());
  it("returns LAK for active CUSTOM Optical even when historical receipts were THB",()=>{
    expect(currencyFromITContract(latest)).toBe("LAK");
    expect(currencyFromITContract({...latest,metadata:{pos_currency_code:"USD"}})).toBe("USD");
    expect(currencyFromITContract({...latest,metadata:{pos_currency_code:"THB"}})).toBe("THB");
  });
  it("only uses THB for a valid legacy contract explicitly missing currency metadata",()=>{
    expect(currencyFromITContract({...latest,metadata:{}})).toBe("THB");
    expect(currencyFromITContract({...latest,metadata:null})).toBe("THB");
    expect(currencyFromITContract({...latest,status:"cancelled"})).toBeNull();
    expect(currencyFromITContract({...latest,ended_at:"2020-01-01T00:00:00Z"})).toBeNull();
    expect(currencyFromITContract({...latest,metadata:{pos_currency_code:"BAD"}})).toBeNull();
    expect(currencyFromITContract(null)).toBeNull();
  });
  it("queries only the authenticated tenant and latest contract, never historical orders",async()=>{
    const row=vi.fn().mockResolvedValue({data:latest,error:null});
    const limit=vi.fn().mockReturnValue({maybeSingle:row});
    const order=vi.fn().mockReturnValue({limit});
    const eq=vi.fn().mockReturnValue({order});
    const select=vi.fn().mockReturnValue({eq});
    vi.mocked(supabase.from).mockReturnValue({select} as never);
    await expect(readITApprovedSalesCurrency("tenant-uuid")).resolves.toBe("LAK");
    expect(supabase.from).toHaveBeenCalledWith("tenant_subscription_contracts");
    expect(eq).toHaveBeenCalledWith("tenant_id","tenant-uuid");
    expect(order).toHaveBeenCalledWith("created_at",{ascending:false});
    expect(limit).toHaveBeenCalledWith(1);
  });
  it("does not silently report THB on RLS or connection failure",async()=>{
    const row=vi.fn().mockResolvedValue({data:null,error:new Error("permission denied")});
    const select=vi.fn().mockReturnValue({eq:()=>({order:()=>({limit:()=>({maybeSingle:row})})})});
    vi.mocked(supabase.from).mockReturnValue({select} as never);
    await expect(readITApprovedSalesCurrency("tenant-uuid")).rejects.toThrow("permission denied");
  });
  it("shows an active visible-tab status without modifying older transactions",()=>{
    const app=readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");
    const status=readFileSync(new URL("../src/components/CrmITCurrencyStatus.tsx",import.meta.url),"utf8");
    const auth=readFileSync(new URL("../src/lib/api/auth.ts",import.meta.url),"utf8");
    expect(app).toContain("<CrmITCurrencyStatus");
    expect(status).toContain("crm-current-currency-code");
    expect(status).toContain('window.setInterval(()=>{void check();},10_000)');
    expect(status).toContain("onITCurrencyChanged");
    expect(auth).toContain("await readITApprovedSalesCurrency(tenantId)");
    expect(status).not.toContain(".update(");
  });
});
