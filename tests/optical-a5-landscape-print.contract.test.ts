import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
const component=readFileSync(new URL("../src/components/OpticalJobSheet.tsx",import.meta.url),"utf8");
const barcode=readFileSync(new URL("../src/components/OpticalWorkOrderBarcode.tsx",import.meta.url),"utf8");
describe("Optical made-to-order print isolation",()=>{
  it("prints independent ISO A5 landscape job sheets",()=>{
    expect(component).toContain("@page { size: A5 landscape; margin: 7mm; }");
    expect(component).toContain("width: 196mm");
    expect(component).toContain("min-height: 134mm");
    expect(component).toContain('onClick={()=>window.print()}');
    expect(component).toContain("OpticalWorkOrderBarcode");
    expect(component).toContain("order.id");
  });
  it("treats barcode as locator rather than payment authorization",()=>{
    expect(barcode).toContain("NOT a payment token");
    expect(barcode).toContain('return "WO-"+id.toUpperCase()');
    expect(component).toContain("not a receipt or proof of payment");
    expect(component).not.toContain("optical_post_deposit_tx");
    expect(component).not.toContain("qr_payment");
  });
});
