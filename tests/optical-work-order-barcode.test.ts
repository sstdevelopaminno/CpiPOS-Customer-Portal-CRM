import {describe,expect,it} from "vitest";
import {code39Bars,opticalWorkOrderLocator} from "../src/components/OpticalWorkOrderBarcode";
describe("Optical work-order barcode locator",()=>{
  it("accepts only UUID work orders, never patient data or freeform payloads",()=>{
    const id="1a2b3c4d-1234-5678-9012-abcdeffedcba";
    expect(opticalWorkOrderLocator(id)).toBe("WO-"+id.toUpperCase());
    expect(opticalWorkOrderLocator("customer-name")).toBeNull();
    expect(opticalWorkOrderLocator("CPI-OPTICAL-RECALL:1:"+id)).toBeNull();
  });
  it("renders Code39 narrow/wide bars with safe start/stop patterns",()=>{
    const output=code39Bars("WO-1A2B3C4D");
    expect(output?.bars.length).toBeGreaterThan(50);
    expect(output?.width).toBeGreaterThan(150);
    expect(output?.bars[0]?.x).toBe(12);
    expect(code39Bars("WO:INVALID")).toBeNull();
  });
});
