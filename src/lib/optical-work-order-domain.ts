/**
 * Optical work-order state contract. This is a side-effect-free model for a
 * future additive, tenant/branch-scoped RPC. It does not change the existing
 * restaurant kitchen, orders, stock, payments or ordinary CRM screens.
 *
 * Financial/stock authorization MUST happen in a server-side DB transaction.
 */
export type OpticalWorkOrderStatus =
  | "received"
  | "lens_ordered"
  | "edging"
  | "ready_for_pickup"
  | "collected"
  | "cancelled";

export type OpticalWorkOrderScope = {
  tenantId: string;
  branchId: string;
  customerId: string;
  examinationId: string | null;
  frameProductId: string | null;
  lensProductId: string | null;
};

const nextStages: Record<OpticalWorkOrderStatus, readonly OpticalWorkOrderStatus[]> = {
  received: ["lens_ordered", "cancelled"],
  lens_ordered: ["edging", "cancelled"],
  edging: ["ready_for_pickup", "cancelled"],
  ready_for_pickup: ["collected", "cancelled"],
  collected: [],
  cancelled: []
};

export type WorkOrderTransitionResult =
  | { ok: true; from: OpticalWorkOrderStatus; to: OpticalWorkOrderStatus }
  | { ok: false; reason: "missing_scope" | "invalid_transition" | "outstanding_balance" | "invalid_balance" };

export function canTransitionOpticalWorkOrder(input: {
  scope: OpticalWorkOrderScope;
  current: OpticalWorkOrderStatus;
  next: OpticalWorkOrderStatus;
  remainingBalance: number;
}): WorkOrderTransitionResult {
  const { scope, current, next, remainingBalance } = input;
  if (!scope.tenantId || !scope.branchId || !scope.customerId) {
    return { ok: false, reason: "missing_scope" };
  }
  if (!Number.isFinite(remainingBalance) || remainingBalance < 0) {
    return { ok: false, reason: "invalid_balance" };
  }
  if (!nextStages[current]?.includes(next)) return { ok: false, reason: "invalid_transition" };
  if (next === "collected" && remainingBalance > 0) {
    return { ok: false, reason: "outstanding_balance" };
  }
  return { ok: true, from: current, to: next };
}

export function opticalWorkOrderNeedsStockReservation(status: OpticalWorkOrderStatus): boolean {
  return status === "received" || status === "lens_ordered" ||
    status === "edging" || status === "ready_for_pickup";
}
