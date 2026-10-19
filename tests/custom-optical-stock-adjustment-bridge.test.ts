import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
const txt=(p:string)=>readFileSync(new URL("../src/"+p,import.meta.url),"utf8");
describe("CRM Optical receive/issue shared atomic balance",()=>{
 it("never calls legacy restaurant ingredient stock APIs",()=>{
  const view=txt("views/BusinessStockOverview.tsx");
  expect(view).toContain("OpticalStockAdjustPopup");
  expect(view).toContain("onAdjust=");
  expect(view).not.toContain("saveStock(");
  expect(view).not.toContain("deleteStock(");
  expect(view).toContain("optical_stock_bins");
 });
 it("barcode scanner selects SKU and opens confirm dialog",()=>{
  const view=txt("views/BusinessStockOverview.tsx");
  const modal=txt("views/OpticalStockAdjustPopup.tsx");
  expect(view).toContain('onClick={()=>openAdjust("",activeBranch!)}');
  expect(view).toContain('onClick={()=>setSummaryOpen(true)}');
  expect(view).not.toContain('barcodeError');
  expect(modal).toContain('autoFocus autoComplete="off"');
  expect(modal).toContain('p_source:"crm"');
  expect(modal).toContain('rpc("optical_adjust_stock_tx"');
  expect(modal).toContain("supabase.auth.getUser()");
  expect(modal).toContain("requestId.current");
  expect(modal).toContain('direction==="receive"?count:-count');
  expect(modal).toContain('type="number" min="1" max="100000" step="1"');
 });
 it("newly created products open quantity adjustment confirmation",()=>{
  const create=txt("views/OpticalCreateProduct.tsx");
  const view=txt("views/BusinessStockOverview.tsx");
  expect(create).toContain("initialQuantity");
  expect(create).toContain("onCreated(target,form.sku.trim(),initialQuantity)");
  expect(view).toContain("openAdjust(sku,nextBranch,initialQuantity)");
  expect(view).toContain("quantity:quantity,");
  expect(view).not.toContain("row.available_quantity??null");
 });
 it("supports identical product kinds and proposed quantity validation on single and batch CRM forms",()=>{
  const single=txt("views/OpticalCreateProduct.tsx");
  const bulk=txt("views/OpticalBulkCreateProduct.tsx");
  const view=txt("views/BusinessStockOverview.tsx");
  expect(single).toContain('<option value="accessory">อุปกรณ์เสริม</option>');
  expect(single).toContain("จำนวนรับเข้าเริ่มต้นต้องเป็นจำนวนเต็มบวก");
  expect(bulk).toContain("initial_quantity");
  expect(bulk).toContain('p_product:product,p_currency:currency');
  expect(bulk).toContain('onCreated(target,rows.filter');
  expect(bulk).toContain("setSaved([...already])");
  expect(view).toContain("<OpticalBulkCreateProduct");
  expect(view).toContain("pendingReceipts");
  expect(view).toContain("nextReceiptOrFinish");
  expect(view).toContain("queueLabel={receiptTotal>0?");
 });
 it("validates amount and reason separately; CRM/Optical summary stays out of the main view",()=>{
  const modal=txt("views/OpticalStockAdjustPopup.tsx");
  const view=txt("views/BusinessStockOverview.tsx");
  expect(modal).toContain("จำนวนต้องเป็นจำนวนเต็มบวกตั้งแต่ 1 ถึง 100,000 ชิ้น");
  expect(modal).toContain("กรุณาระบุเหตุผลในการปรับสต๊อก");
  expect(modal).toContain("เหตุผลในการปรับสต๊อกต้องมีอย่างน้อย 3 ตัวอักษร");
  expect(modal).toContain("noValidate");
  expect(modal).toContain("รับสินค้าตามใบส่งของ");
  expect(view).toContain("opticalSummary");
  expect(view).toContain("summaryOpen");
  expect(view).toContain("!optical?<div className=\"business-stock__metrics\">");
  expect(view).toContain("opticalEntries.filter(x=>x.remaining===null).length");
 });
});
