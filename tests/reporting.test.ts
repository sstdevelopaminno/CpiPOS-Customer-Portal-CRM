import { describe, expect, it } from "vitest";
import { getReportWindow, reportRangeLabel } from "../src/lib/reporting";

describe("reporting windows",()=>{
  it("creates an increasing day window",()=>{const w=getReportWindow("day","2026-10-06");expect(new Date(w.to).getTime()).toBeGreaterThan(new Date(w.from).getTime());});
  it("uses Buddhist year labels",()=>{expect(reportRangeLabel("year","2026-10-06")).toContain("2569");});
  it("creates a full month window",()=>{const w=getReportWindow("month","2026-10-06");expect(new Date(w.to).getTime()-new Date(w.from).getTime()).toBeGreaterThan(27*86400000);});
});
