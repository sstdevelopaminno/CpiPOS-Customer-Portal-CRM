import type { OrderRow, PortalContext } from "../types/portal";

export const money = new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 2 });
export const number = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 });
export const dateTime = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" });
export const dateOnly = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" });

export function formatCurrency(value:number,currency:string|null|undefined){
  const code=String(currency||"THB").toUpperCase();
  try{return new Intl.NumberFormat(code==="LAK"?"lo-LA":"th-TH",{style:"currency",currency:code,minimumFractionDigits:code==="LAK"?0:2,maximumFractionDigits:code==="LAK"?0:2}).format(Number(value)||0);}
  catch{return `${number.format(Number(value)||0)} ${code}`;}
}

export function orderSalesCurrency(order: OrderRow): "THB" | "LAK" | "USD" {
  const code = order.metadata?.currency_code;
  // Transactions predating currency snapshots were THB.
  return code === "LAK" || code === "USD" ? code : "THB";
}

export function orderMoney(value: number, order: OrderRow): string {
  return formatCurrency(value, orderSalesCurrency(order));
}

export function amount(order: OrderRow) {
  return Number(order.grand_total ?? order.total_amount ?? 0);
}

export function statusLabel(status: string) {
  return ({ completed: "สำเร็จ", cancelled: "ยกเลิก", queued: "รอดำเนินการ", preparing: "กำลังเตรียม", draft: "ฉบับร่าง" } as Record<string, string>)[status] ?? status;
}

export function maskEmployeeCode(value: string | null) {
  if (!value) return "—";
  if (value.length <= 2) return "••";
  return `${"•".repeat(Math.max(2, value.length - 2))}${value.slice(-2)}`;
}

export function branchName(context: PortalContext, branchId: string) {
  return context.branches.find((branch) => branch.id === branchId)?.name ?? "สาขา";
}
