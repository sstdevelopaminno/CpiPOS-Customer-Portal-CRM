import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
const read=(x:string)=>readFileSync(new URL("../"+x,import.meta.url),"utf8");
describe("CpiPOS CRM Windows/browser PWA install icons",()=>{
 it("ships self-contained brand-logo vectors: no image refs, data URIs or network fetching",()=>{
  for(const name of ["public/pwa-icon.svg","public/pwa-maskable.svg"]){
   const source=read(name);
   expect(source).toContain('<path d="M329,48');
   expect(source).toContain('fill="url(#p1)"');
   expect(source).toContain('viewBox="0 0 512 512"');
   expect(source).not.toContain("<image");
   expect(source).not.toContain("data:image");
  }
 });
 it("declares and cache-busts correct SVG install assets and a raster fallback",()=>{
  const manifest=JSON.parse(read("public/manifest.webmanifest"));
  expect(manifest.icons[0].src).toBe("/pwa-icon.svg?v=20261019-2");
  expect(manifest.icons[1].purpose).toBe("maskable");
  expect(manifest.icons[2].sizes).toBe("128x128");
  expect(read("index.html")).toContain('href="/manifest.webmanifest?v=20261019-2"');
  expect(read("public/sw.js")).toContain("cpipos-customer-portal-shell-v8");
 });
});
