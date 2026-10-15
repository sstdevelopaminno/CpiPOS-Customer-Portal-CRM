import type { FeatureState } from "../types/portal";

export type CustomInventoryMode = "legacy" | "optical" | "retail" | "mixed";

/**
 * CUSTOM is a contract type, NOT a stock workflow. The approved sales modes
 * select the stock presentation. A missing/ambiguous grant must never grant
 * Optical read/write access or silently hide restaurant inventory.
 */
export function resolveCustomInventoryMode(
  feature: Pick<FeatureState, "is_custom" | "is_internal_test_full" | "optical_retail_enabled" | "sales_modes">
): CustomInventoryMode {
  if (!(feature.is_custom || feature.is_internal_test_full)) return "legacy";
  const modes = feature.sales_modes ?? {};
  const optical = feature.optical_retail_enabled === true && modes.optical_retail === true;
  const food = ["takeaway", "dine_in", "delivery", "buffet_table"].some(mode => modes[mode] === true);
  const retail = modes.general_sale === true;

  // Older CUSTOM contracts without explicit modes retain their legacy stock UI.
  if (!optical && !food && retail) return "retail";
  if (!optical) return "legacy";
  if (food || retail) return "mixed";
  return "optical";
}
