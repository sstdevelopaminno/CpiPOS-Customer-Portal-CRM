import { describe, expect, it } from "vitest";
import { languageOptions, normalizeCrmSettingsLanguage, settingsMenuLocale, settingsText } from "../src/lib/settings-language";

describe("CRM three-language POS settings",()=>{
 it("supports exactly Thai, English and Lao",()=>{
  expect(languageOptions.map(x=>x.code)).toEqual(["th","en","lo"]);
  expect(normalizeCrmSettingsLanguage("unknown")).toBe("th");
  expect(normalizeCrmSettingsLanguage("lo")).toBe("lo");
 });
 it("translates settings controls without changing user content",()=>{
  expect(settingsText("en","ตั้งค่า")).toBe("Settings");
  expect(settingsText("lo","ตั้งค่า")).toBe("ຕັ້ງຄ່າ");
  expect(settingsText("th","ตั้งค่า")).toBe("ตั้งค่า");
  expect(settingsText("en","ร้านทดสอบ A")).toBe("ร้านทดสอบ A");
 });
 it("translates the full POS Settings card catalog",()=>{
  for(const kind of ["store","branches","devices","printers","activity","payments","inet","taxes","notifications","users","language","currency","placement","display","orderKitchen","tableQr"]){
   const en=settingsMenuLocale("en",kind,"ภาษาไทย","ภาษาไทย");
   const lo=settingsMenuLocale("lo",kind,"ภาษาไทย","ภาษาไทย");
   expect(en.label).not.toBe("ภาษาไทย");
   expect(lo.label).not.toBe("ภาษาไทย");
   expect(en.desc).not.toBe("ภาษาไทย");
   expect(lo.desc).not.toBe("ภาษาไทย");
  }
 });
});
