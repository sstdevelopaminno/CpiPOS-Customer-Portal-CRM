import { describe, expect, it } from "vitest";
import { POS_MENU_SOURCE, POS_MORE_MENU_ITEMS, POS_SETTINGS_MENU_ITEMS } from "../src/config/pos-menu-catalog";

describe("POS menu parity",()=>{
  it("pins the POS source revision used for the portal menu contract",()=>{
    expect(POS_MENU_SOURCE.ref).toBe("main");
    expect(POS_MENU_SOURCE.commit).toBe("37aeb6dbb7f20486c073d782f6d5fb2f437a86e0");
  });

  it("matches the More menu order from POS main",()=>{
    expect(POS_MORE_MENU_ITEMS.map(item=>item.posHref)).toEqual([
      "/preview/pos/sales-summary",
      "/preview/pos/receipts",
      "/preview/pos/tables",
      "/preview/pos/kitchen/manage",
      "/preview/pos/stock",
      "/preview/pos/buffet-pricing",
      "/preview/pos/members",
      "/preview/pos/tax-invoices",
      "/preview/pos/product-sales"
    ]);
    expect(POS_MORE_MENU_ITEMS.some(item=>item.key==="more.ai_documents")).toBe(false);
  });

  it("matches the Settings menu set from POS main including injected QR menus",()=>{
    expect(POS_SETTINGS_MENU_ITEMS.map(item=>item.kind)).toEqual([
      "store","branches","devices","printers","activity","payments","inet","taxes","notifications",
      "users","language","placement","display","orderKitchen","tableQr"
    ]);
    expect(POS_SETTINGS_MENU_ITEMS.some(item=>["support","push"].includes(item.kind))).toBe(false);
  });
});
