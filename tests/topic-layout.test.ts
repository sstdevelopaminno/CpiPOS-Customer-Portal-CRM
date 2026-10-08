import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("compact CRM topic navigation", () => {
  const views = [
    "DashboardView", "SalesView", "ProductsView", "StockView",
    "StaffView", "PackageView", "MoreView", "SettingsView"
  ];
  it("exposes topic dialogs in every main portal page", () => {
    for (const view of views) {
      const source = read(`src/views/${view}.tsx`);
      expect(source).toContain("<TopicHub");
    }
  });
  it("keeps details and mutations in real accessible dialog controls", () => {
    const topic = read("src/components/TopicHub.tsx");
    const modal = read("src/components/common.tsx");
    expect(topic).toContain('aria-haspopup={item.onSelect ? undefined : "dialog"}');
    expect(topic).toContain("onSelect()");
    expect(topic).toContain("<Modal");
    expect(modal).toContain('aria-modal="true"');
  });
  it("does not reopen locked or historic payment cycles", () => {
    const source = read("src/views/PackageView.tsx");
    expect(source).toContain("canUpcoming&&cycle.id===currentDue?.billing_cycle_id");
    expect(source).toContain("PAYABLE_BILLING_STATUSES.has(cycle.status)");
    expect(source).not.toContain('new Set(["open","due","overdue","pending"])');
  });
  it("limits cross-origin requests to CRM domains with an optional allowlist", () => {
    for (const name of ["customer-portal-login", "customer-portal-billing-payment"]) {
      const source = read(`supabase/functions/${name}/index.ts`);
      expect(source).toContain("CRM_ALLOWED_ORIGINS");
      expect(source).toContain("cpi-pos-crm");
      expect(source).not.toContain("[a-z0-9-]+\\.vercel\\.app$/");
    }
  });
});
