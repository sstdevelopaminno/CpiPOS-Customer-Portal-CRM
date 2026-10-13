import { describe, expect, it } from "vitest";
import { isCustomMenuVisible } from "../src/lib/custom-menu-access";

const custom = (policy: Record<string,boolean>) => ({ is_custom:true, menu_policy:policy });
const fixed = (policy: Record<string,boolean>) => ({ is_custom:false, menu_policy:policy });

describe("CUSTOM menu access parity with POS and IT", () => {
  it("does not expose a CUSTOM menu without explicit IT grant", () => {
    expect(isCustomMenuVisible(custom({}),"main.settings")).toBe(false);
    expect(isCustomMenuVisible(custom({"more.stock":true}),"more.stock")).toBe(false);
    expect(isCustomMenuVisible(custom({"main.more":true,"more.stock":true}),"more.stock")).toBe(true);
    expect(isCustomMenuVisible(custom({"main.more":true,"more.stock":false}),"more.stock")).toBe(false);
    expect(isCustomMenuVisible(custom({}),"main.shift")).toBe(true);
    expect(isCustomMenuVisible(custom({}),"not.registered")).toBe(false);
  });
  it("preserves legacy fixed-plan behavior", () => {
    expect(isCustomMenuVisible(fixed({}),"more.stock")).toBe(true);
    expect(isCustomMenuVisible(fixed({"more.stock":false}),"more.stock")).toBe(false);
  });
});
