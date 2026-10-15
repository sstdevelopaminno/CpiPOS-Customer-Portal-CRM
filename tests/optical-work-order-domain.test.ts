import { describe, expect, it } from "vitest";
import {
  canTransitionOpticalWorkOrder,
  opticalWorkOrderNeedsStockReservation,
  type OpticalWorkOrderScope
} from "../src/lib/optical-work-order-domain";

const scope: OpticalWorkOrderScope = {
  tenantId: "tenant-QA-900001", branchId: "branch-QA",
  customerId: "customer-QA", examinationId: null,
  frameProductId: "frame-QA", lensProductId: "lens-QA"
};

describe("CRM Optical work orders (not restaurant kitchen jobs)", () => {
  it("permits each customer-requested job stage in sequence", () => {
    expect(canTransitionOpticalWorkOrder({scope,current:"received",next:"lens_ordered",remainingBalance:500}).ok).toBe(true);
    expect(canTransitionOpticalWorkOrder({scope,current:"lens_ordered",next:"edging",remainingBalance:500}).ok).toBe(true);
    expect(canTransitionOpticalWorkOrder({scope,current:"edging",next:"ready_for_pickup",remainingBalance:500}).ok).toBe(true);
  });
  it("forbids collection until outstanding amount was settled", () => {
    expect(canTransitionOpticalWorkOrder({scope,current:"ready_for_pickup",next:"collected",remainingBalance:500}))
      .toEqual({ok:false,reason:"outstanding_balance"});
    expect(canTransitionOpticalWorkOrder({scope,current:"ready_for_pickup",next:"collected",remainingBalance:0}))
      .toEqual({ok:true,from:"ready_for_pickup",to:"collected"});
  });
  it("blocks terminal replay, skipping stages, missing scope, and invalid money", () => {
    expect(canTransitionOpticalWorkOrder({scope,current:"collected",next:"collected",remainingBalance:0}))
      .toEqual({ok:false,reason:"invalid_transition"});
    expect(canTransitionOpticalWorkOrder({scope,current:"cancelled",next:"received",remainingBalance:0}).ok).toBe(false);
    expect(canTransitionOpticalWorkOrder({scope,current:"received",next:"collected",remainingBalance:0}).ok).toBe(false);
    expect(canTransitionOpticalWorkOrder({scope:{...scope,tenantId:""},current:"received",next:"lens_ordered",remainingBalance:0}).ok).toBe(false);
    expect(canTransitionOpticalWorkOrder({scope,current:"received",next:"lens_ordered",remainingBalance:-1}).ok).toBe(false);
  });
  it("keeps reservation states distinct from physical stock deduction", () => {
    expect(opticalWorkOrderNeedsStockReservation("received")).toBe(true);
    expect(opticalWorkOrderNeedsStockReservation("ready_for_pickup")).toBe(true);
    expect(opticalWorkOrderNeedsStockReservation("collected")).toBe(false);
    expect(opticalWorkOrderNeedsStockReservation("cancelled")).toBe(false);
  });
});
