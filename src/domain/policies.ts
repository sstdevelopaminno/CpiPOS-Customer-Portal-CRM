import type { PortalRole } from "../types/portal";

const PRIVILEGED_BRANCH_ROLES = new Set(["owner", "manager"]);
const PAYABLE_BILLING_STATUSES = new Set(["open", "due", "overdue", "pending"]);

export function isValidStoreCode(value: string) { return /^[A-Za-z0-9_-]{3,32}$/.test(value.trim()); }
export function isValidEmployeeCode(value: string) { return /^[A-Za-z0-9._-]{2,32}$/.test(value.trim()); }
export function canAssignBranchRole(actorRole: PortalRole, targetRole: string) { return actorRole === "owner" || !PRIVILEGED_BRANCH_ROLES.has(targetRole); }
export function isPayableBillingStatus(status: string) { return PAYABLE_BILLING_STATUSES.has(status); }
export function canCancelOrderStatus(status: string) { return status !== "cancelled"; }
