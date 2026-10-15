import { useCallback, useEffect, useMemo, useState } from "react";
import { Boxes, Glasses, Search, RefreshCw, ShieldAlert } from "lucide-react";
import { loadProducts, type PortalContext, type ProductRow } from "../lib/portal";
import { formatCurrency } from "../lib/formatters";
import "../styles/custom-inventory.css";

export type InventoryBusiness = "optical" | "retail";
export type InventoryFilter = "all" | "frames" | "lenses" | "low" | "legacy";

export function classifyOpticalProduct(product: Pick<ProductRow,"category"|"name">): "frames"|"lenses"|"other" {
  const label=`${product.category} ${product.name}`.toLowerCase();
  if(/กรอบแว่น|กรอบ|frame|eyewear/.test(label))return "frames";
  if(/เลนส์|lens|lenses|index/.test(label))return "lenses";
  return "other";
}

function stockState(product:ProductRow):"unverified"|"out"|"low"|"ok" {
  const count=product.available_quantity;
  if(count===null||count===undefined||!Number.isFinite(Number(count)))return "unverified";
  if(Number(count)<=0)return "out";
  if(Number(count)<=1)return "low";
  return "ok";
}

export function BusinessStockOverview({context,branchId,business,strictOpticalCategory=false}:{
  context:PortalContext;branchId:string|null;business:InventoryBusiness;
  strictOpticalCategory?:boolean;
}) {
  // Always use an assigned branch. Never silently aggregate Optical patient
  // or stock records across branches (even when CRM filter says "all").
  const activeBranch=branchId && context.branches.some(b=>b.id===branchId)
    ? branchId : context.branches[0]?.id;
  const [rows,setRows]=useState<ProductRow[]>([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [search,setSearch]=useState("");
  const [filter,setFilter]=useState<InventoryFilter>("all");
  const optical=business==="optical";

  const refresh=useCallback(async()=>{
    if(!activeBranch){setRows([]);return;}
    setLoading(true);setError("");
    try{
      // This uses the existing RLS-scoped POS product catalog only.
      // Never calls ingredient mutations or optical stock writes.
      const result=await loadProducts(context.tenantId,activeBranch);
      setRows(result.filter(row=>row.branch_id===activeBranch)
        // A mixed-mode CUSTOM store may sell food AND eyewear. Do not present
        // food products under Optical without explicit Optical classification.
        .filter(row=>!strictOpticalCategory || /^(กรอบแว่น|แว่นตา|เลนส์|optical|frames?|lenses?)$/i.test(String(row.category??"").trim()))
      );
    }catch{setRows([]);setError("ไม่สามารถอ่านสต๊อกสินค้าในสาขานี้ได้ กรุณาตรวจสอบสิทธิ์");}
    finally{setLoading(false);}
  },[context.tenantId,activeBranch,strictOpticalCategory]);

  useEffect(()=>{void refresh();},[refresh]);
  useEffect(()=>{setFilter("all");setSearch("");},[activeBranch,business]);

  const filtered=useMemo(()=>rows.filter(row=>{
    const term=search.trim().toLowerCase();
    if(term && ![row.name,row.sku,row.category].some(value=>String(value??"").toLowerCase().includes(term)))return false;
    if(filter==="frames"||filter==="lenses")return classifyOpticalProduct(row)===filter;
    if(filter==="low")return ["low","out"].includes(stockState(row));
    if(filter==="legacy")return row.recipe_count>0||row.stock_deduction_mode==="recipe_deduction";
    return true;
  }),[rows,search,filter]);
  const low=rows.filter(x=>stockState(x)==="low").length;
  const out=rows.filter(x=>stockState(x)==="out").length;
  const legacy=rows.filter(x=>x.recipe_count>0||x.stock_deduction_mode==="recipe_deduction").length;
  const currency=context.salesCurrencyCode??(optical?"LAK":"THB");

  if(!activeBranch)return <section className="business-stock" role="alert">ไม่พบสาขาที่ได้รับอนุญาตให้เข้าถึง</section>;
  return <section className={`business-stock ${optical?"business-stock--optical":"business-stock--retail"}`}>
    <header className="business-stock__heading">
      <div className="business-stock__identity">
        <span className="business-stock__symbol">{optical?<Glasses size={25}/>:<Boxes size={25}/>}</span>
        <div><span className="business-stock__eyebrow">{optical?"CUSTOM · OPTICAL INVENTORY":"CUSTOM · RETAIL INVENTORY"}</span>
          <h2>{optical?"สต๊อกกรอบแว่นและเลนส์":"สต๊อกสินค้าขายทั่วไป"}</h2>
          <p>{optical?"ตรวจสินค้า กรอบแว่น เลนส์ SKU และจำนวนพร้อมขาย":"ตรวจสินค้าตาม SKU บาร์โค้ด และจำนวนพร้อมขาย"}</p>
        </div>
      </div>
      <button type="button" onClick={()=>void refresh()} disabled={loading} className="business-stock__refresh"><RefreshCw size={16}/>{loading?"กำลังโหลด...":"รีเฟรช"}</button>
    </header>
    <p className="business-stock__notice" role="note"><ShieldAlert size={18}/>
      {optical
        ?"หน้านี้แสดงข้อมูลสินค้าจาก POS เดิมเพื่อประกอบการตรวจสอบเท่านั้น ยังไม่ใช่ยอดจอง/ยอดคงเหลือของ Optical Stock Bin และไม่อนุญาตให้ย้ายหรือตัดสต๊อกโดยตรง"
        :"จำนวนพร้อมขายมาจากระบบ POS เดิม การแก้ไขสต๊อกต้องใช้ขั้นตอนที่ได้รับอนุญาตตามโหมดธุรกิจ"}
    </p>
    <div className="business-stock__metrics">
      <article><span>รายการสินค้า</span><strong>{rows.length}</strong></article>
      <article><span>เหลือ 1 หน่วย</span><strong>{low}</strong></article>
      <article><span>หมดสต๊อก</span><strong>{out}</strong></article>
      <article><span>{optical?"ยังผูกสต๊อกสูตรเดิม":"สินค้าผูกสูตร"}</span><strong>{legacy}</strong></article>
    </div>
    <div className="business-stock__toolbar">
      <label className="business-stock__search"><Search size={18}/>
        <input aria-label="ค้นหาสินค้าจาก SKU หรือชื่อ" value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="ค้นหารหัสบาร์โค้ด / SKU / ชื่อสินค้า..."/>
      </label>
      <label className="business-stock__filterLabel">แสดงรายการ
        <select value={filter} onChange={e=>setFilter(e.target.value as InventoryFilter)}>
          <option value="all">ทั้งหมด</option>
          {optical?<><option value="frames">กรอบแว่น</option><option value="lenses">เลนส์</option></>:null}
          <option value="low">ใกล้หมด / หมด</option>
          <option value="legacy">ผูกสูตรสต๊อกเดิม</option>
        </select>
      </label>
    </div>
    {error?<p role="alert" className="business-stock__error">{error}</p>:null}
    {loading?<p role="status" className="business-stock__empty">กำลังโหลดข้อมูล...</p>:null}
    {!loading && !error ? <div className="business-stock__tableWrap">
      <table><thead><tr><th>สินค้า / รูปภาพ</th><th>SKU / บาร์โค้ด</th><th>ราคา ({currency})</th><th>หน่วย</th><th>จำนวนพร้อมขาย</th><th>สถานะ</th></tr></thead>
      <tbody>{filtered.map(item=>{
        const state=stockState(item);
        const legacyStock=item.recipe_count>0||item.stock_deduction_mode==="recipe_deduction";
        return <tr key={item.id}>
          <td><div className="business-stock__product">
            {item.image_url?<img src={item.image_url} alt={item.name} loading="lazy"/>:<span className="business-stock__imageFallback"><Boxes size={20}/></span>}
            <div><strong>{item.name}</strong><small>{item.category || "ยังไม่ระบุประเภท"}</small>
              {legacyStock?<small className="business-stock__legacy">ผูกสูตรสต๊อกเดิม · ยังไม่ผ่านการย้าย</small>:null}
            </div>
          </div></td>
          <td><code>{item.sku || "—"}</code></td>
          <td className="business-stock__right">{formatCurrency(Number(item.price),currency)}</td>
          <td>{item.sell_unit || "ชิ้น"}</td>
          <td className="business-stock__right">{state==="unverified"?"ยังไม่ตรวจ":Number(item.available_quantity)}</td>
          <td><span className={`business-stock__status business-stock__status--${state}`}>
            {state==="unverified"?"รอตรวจ":state==="out"?"หมด":state==="low"?"เหลือ 1": "มีสินค้า"}
          </span></td>
        </tr>;
      })}</tbody></table>
      {filtered.length===0?<p className="business-stock__empty">ไม่พบสินค้าที่ตรงกับเงื่อนไขค้นหา</p>:null}
    </div>:null}
    {strictOpticalCategory?<p className="business-stock__footnote">สำหรับ CUSTOM หลายโหมด ระบบแสดงเฉพาะสินค้าที่จัดหมวดหมู่เป็นกรอบแว่นหรือเลนส์ ป้องกันรายการร้านอาหารปะปนในสต๊อก Optical</p>:null}
    {optical?<p className="business-stock__footnote">รายละเอียดเฉพาะกรอบแว่น (สี/ขนาด) และเลนส์ (Index/SPH/CYL) จะใช้ข้อมูลจาก Optical Stock Bin หลังตรวจสอบการย้ายสต๊อกเดิมเสร็จแล้ว เพื่อไม่ให้จำนวนสินค้าแสดงซ้ำ</p>:null}
  </section>;
}
