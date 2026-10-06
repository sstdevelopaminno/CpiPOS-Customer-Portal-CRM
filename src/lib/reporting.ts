import type { ReportRange } from "../types/portal";

function localDateParts(anchor?: string) {
  const base = anchor ? new Date(`${anchor}T12:00:00`) : new Date();
  if (Number.isNaN(base.getTime())) return new Date();
  return base;
}

export function todayInputValue() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getReportWindow(range: ReportRange, anchor?: string) {
  const base = localDateParts(anchor);
  let start: Date;
  let end: Date;

  if (range === "year") {
    start = new Date(base.getFullYear(), 0, 1, 0, 0, 0, 0);
    end = new Date(base.getFullYear() + 1, 0, 1, 0, 0, 0, 0);
  } else if (range === "month") {
    start = new Date(base.getFullYear(), base.getMonth(), 1, 0, 0, 0, 0);
    end = new Date(base.getFullYear(), base.getMonth() + 1, 1, 0, 0, 0, 0);
  } else {
    start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, 0, 0, 0);
    end = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1, 0, 0, 0, 0);
  }

  return { from: start.toISOString(), to: end.toISOString() };
}

export function reportRangeLabel(range: ReportRange, anchor?: string) {
  const base = localDateParts(anchor);
  if (range === "year") return `ปี ${base.getFullYear() + 543}`;
  if (range === "month") return new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric" }).format(base);
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" }).format(base);
}
