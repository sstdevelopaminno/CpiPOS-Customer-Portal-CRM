import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
const file=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
describe("Customer Portal standalone PWA desktop install icon",()=>{
 it("embeds the CpIPOS logo directly in install icons rather than external SVG images",()=>{
  for(const path of ["public/pwa-icon.svg","public/pwa-maskable.svg"]){
   const icon=file(path);
   expect(icon).toContain('href="data:image/png;base64,iVBOR');
   expect(icon).not.toContain('href="/cpipos-logo.png"');
  }
 });
 it("declares actual raster fallback size, and revalidates cached manifest",()=>{
  const manifest=JSON.parse(file("public/manifest.webmanifest"));
  expect(manifest.icons).toContainEqual({src:"/cpipos-logo.png",sizes:"128x128",type:"image/png",purpose:"any"});
  expect(manifest.icons.some((x:{purpose:string})=>x.purpose==="maskable")).toBe(true);
  expect(file("index.html")).toContain("/manifest.webmanifest?v=20261019-1");
  expect(file("public/sw.js")).toContain("cpipos-customer-portal-shell-v7");
 });
});
