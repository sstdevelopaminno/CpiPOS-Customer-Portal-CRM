import { describe, expect, it } from "vitest";
import { canAssignBranchRole,canCancelOrderStatus,isPayableBillingStatus,isValidEmployeeCode,isValidStoreCode } from "../src/domain/policies";

describe("portal policy contracts",()=>{
  it("validates login code shapes",()=>{expect(isValidStoreCode("STORE_721206")).toBe(true);expect(isValidStoreCode("x")).toBe(false);expect(isValidEmployeeCode("EMP.18")).toBe(true);expect(isValidEmployeeCode("!")).toBe(false);});
  it("prevents manager privilege escalation",()=>{expect(canAssignBranchRole("manager","owner")).toBe(false);expect(canAssignBranchRole("manager","manager")).toBe(false);expect(canAssignBranchRole("manager","staff")).toBe(true);expect(canAssignBranchRole("owner","manager")).toBe(true);});
  it("keeps billing/order state guards",()=>{expect(isPayableBillingStatus("due")).toBe(true);expect(isPayableBillingStatus("paid")).toBe(false);expect(canCancelOrderStatus("completed")).toBe(true);expect(canCancelOrderStatus("cancelled")).toBe(false);});
});
