import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { formatCurrency, orderSalesCurrency, orderMoney } from "../src/lib/formatters";
import type { OrderRow } from "../src/types/portal";

const dummyOrder = (metadata: Record<string, unknown> | null) => ({
  metadata, grand_total: 20000, total_amount: 20000
} as OrderRow);

describe("CRM currency history and reporting", () => {
  it("preserves legacy THB and all ISO snapshots without conversion", () => {
    expect(orderSalesCurrency(dummyOrder(null))).toBe("THB");
    expect(orderSalesCurrency(dummyOrder({ currency_code: "LAK" }))).toBe("LAK");
    expect(orderSalesCurrency(dummyOrder({ currency_code: "USD" }))).toBe("USD");
    expect(orderMoney(20000,dummyOrder({ currency_code: "LAK" }))).toContain("20");
    expect(formatCurrency(25.5, "USD")).toMatch(/25/);
  });
  it("uses tenant-and-branch RLS currency RPC instead of mixed-currency dashboard totals", () => {
    const sales = readFileSync(new URL("../src/lib/api/sales.ts",import.meta.url),"utf8");
    const dashboard = readFileSync(new URL("../src/lib/api/dashboard.ts",import.meta.url),"utf8");
    const salesView = readFileSync(new URL("../src/views/SalesView.tsx",import.meta.url),"utf8");
    const dashboardView = readFileSync(new URL("../src/views/DashboardView.tsx",import.meta.url),"utf8");
    expect(sales).toContain('supabase.rpc("customer_portal_currency_summary_v1"');
    expect(dashboard).toContain('supabase.rpc("customer_portal_currency_summary_v1"');
    expect(salesView).toContain("currencyTotals");
    expect(salesView).toContain("orderMoney(amount(row),row)");
    expect(dashboardView).toContain("salesByCurrency");
    expect(dashboardView).not.toContain("money.format(summary?.sales_total");
  });
});
