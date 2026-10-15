import { useCallback, useEffect, useMemo, useState } from "react";
import { Boxes, Glasses, Search, RefreshCw, ShieldAlert } from "lucide-react";
import { loadProducts, type PortalContext, type ProductRow } from "../lib/portal";
import { formatCurrency } from "../lib/formatters";
import "../styles/custom-inventory.css";
import {supabase} from "../lib/supabase";
import {OpticalStockTable,type OpticalTableEntry} from "./OpticalStockTable";
import {OpticalBestSellers} from "./OpticalBestSellers";
import {OpticalCreateProduct} from "./OpticalCreateProduct";

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
  const [stockBranch,setStockBranch]=useState<string|null>(branchId);
  const activeBranch=stockBranch && context.branches.some(b=>b.id===stockBranch)
    ? stockBranch : context.branches[0]?.id;
  const [rows,setRows]=useState<ProductRow[]>([]);
  const [opticalBins,setOpticalBins]=useState<Map<string,Record<string,unknown>>>(new Map());
  const [opticalDetails,setOpticalDetails]=useState<Map<string,Record<string,unknown>>>(new Map());
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [search,setSearch]=useState("");
  const [bestOpen,setBestOpen]=useState(false),[addOpen,setAddOpen]=useState(false);
  const [filter,setFilter]=useState<InventoryFilter>("all");
  const optical=business==="optical";

  const refresh=useCallback(async()=>{
    if(!activeBranch){setRows([]);return;}
    setRows([]);setOpticalBins(new Map());setOpticalDetails(new Map());
    setLoading(true);setError("");
    try{
      // This uses the existing RLS-scoped POS product catalog only.
      // Never calls ingredient mutations or optical stock writes.
      const result=await loadProducts(context.tenantId,activeBranch);
      // Optical-only filtering applies even in dedicated shops: legacy food
      // entries must not become optical stock merely because they share a tenant.
      const productRows=result.filter(row=>row.branch_id===activeBranch);
      if(optical){
        const allBins:Record<string,unknown>[]=[];
        for(let from=0;from<10000;from+=500){
          const {data,error:e}=await supabase.from("optical_stock_bins")
            .select("product_id,kind,brand,model,color,frame_size,lens_type,lens_index,lens_sph,lens_cyl,unit_price,on_hand,reserved,currency_code")
            .eq("tenant_id",context.tenantId).eq("branch_id",activeBranch)
            .order("product_id",{ascending:true}).range(from,from+499);
          if(e)throw e;
          allBins.push(...((data??[]) as Record<string,unknown>[]));
          if((data??[]).length<500)break;
        }
        const map=new Map(allBins.filter(bin=>bin.currency_code===(context.salesCurrencyCode??"LAK")).map(bin=>[String(bin.product_id),bin]));
        setOpticalBins(map);
        // The existing authenticated products SELECT policy restricts tenant
        // and branch. Metadata provides attributes for catalog-only items,
        // without treating their legacy quantities as verified Optical stock.
        const attributes:Record<string,unknown>[]=[];
        for(let from=0;from<10000;from+=500){
          const result=await supabase.from("products").select("id,metadata")
            .eq("tenant_id",context.tenantId).eq("branch_id",activeBranch)
            .is("deleted_at",null).order("id",{ascending:true}).range(from,from+499);
          if(result.error)break;
          attributes.push(...((result.data??[]) as Record<string,unknown>[]));
          if((result.data??[]).length<500)break;
        }
        const detailMap=new Map(attributes.map(x=>[String(x.id),
          (x.metadata && typeof x.metadata==="object" ? x.metadata : {}) as Record<string,unknown>]));
        setOpticalDetails(detailMap);
        setRows(productRows.filter(row=>map.has(row.id) || detailMap.get(row.id)?.business_mode==="optical_retail" ||
          /^(กรอบแว่น|แว่นตา|เลนส์|optical|frames?|lenses?|imdc optical qa)(\s|$)/i.test(String(row.category??"").trim())));
      }else setRows(productRows);
    }catch{setRows([]);setError("ไม่สามารถอ่านสต๊อกสินค้าในสาขานี้ได้ กรุณาตรวจสอบสิทธิ์");}
    finally{setLoading(false);}
  },[context.tenantId,activeBranch,optical]);

  useEffect(()=>{setStockBranch(branchId);},[branchId]);
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

  const opticalEntries:OpticalTableEntry[]=rows.map(row=>{
    const bin=opticalBins.get(row.id);
    const classLabel=classifyOpticalProduct(row);
    const meta=opticalDetails.get(row.id)??{};
    const stockKind=bin?.kind==="lens"?"lens":bin?.kind==="accessory"?"accessory":
      bin?.kind==="frame"?"frame":meta.optical_kind==="lens"?"lens":meta.optical_kind==="accessory"?"accessory":classLabel==="lenses"?"lens":"frame";
    const field=(key:string)=>{
      const raw=bin?.[key]??meta["optical_"+key];
      return raw===undefined||raw===null?null:String(raw);
    };
    const numeric=(key:string)=>{
      const raw=bin?.[key]??meta["optical_"+key];
      return raw===undefined||raw===null?null:Number(raw);
    };
    const quantity=numeric("on_hand");
    const reserved=numeric("reserved");
    return {id:row.id,sku:row.sku,kind:stockKind,
      brand:field("brand"),model:field("model")??row.name,
      color:field("color"),frameSize:field("frame_size"),
      lensName:field("lens_name")??field("model")??row.name,index:field("lens_index"),imageUrl:row.image_url,
      sph:numeric("lens_sph"),cyl:numeric("lens_cyl"),
      price:quantity!==null?Number(bin?.unit_price??row.price):Number(row.price),
      quantity:quantity??(row.available_quantity??null),
      remaining:quantity===null||reserved===null?null:Math.max(0,quantity-reserved)};
  });
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
      {optical?<div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
        <label className="business-stock__filterLabel">เลือกสาขา
          <select value={activeBranch??""} onChange={e=>setStockBranch(e.target.value)}>
            {context.branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
        {["owner","manager"].includes(context.role)?<button type="button" className="business-stock__refresh" onClick={()=>setAddOpen(true)}>+ เพิ่มสินค้า</button>:null}
        <button type="button" className="business-stock__refresh" onClick={()=>setBestOpen(true)}>★ สินค้าขายดี</button>
      </div>:null}
      <button type="button" onClick={()=>void refresh()} disabled={loading} className="business-stock__refresh"><RefreshCw size={16}/>{loading?"กำลังโหลด...":"รีเฟรช"}</button>
    </header>
    <p className="business-stock__notice" role="note"><ShieldAlert size={18}/>
      {optical
        ?"สต๊อกที่มี Optical Stock Bin จะแสดงยอดคงเหลือหลังหักยอดจอง ส่วนสินค้าที่ยังไม่ตรวจนับจะแสดงรอยืนยัน"
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
    {addOpen&&activeBranch?<OpticalCreateProduct tenantId={context.tenantId}
      branchId={activeBranch} currency={currency} branches={context.branches}
      onClose={()=>setAddOpen(false)} onCreated={nextBranch=>{
        setAddOpen(false);setStockBranch(nextBranch);
        if(nextBranch===activeBranch)void refresh();
      }}/>:null}
    {bestOpen&&activeBranch?<OpticalBestSellers tenantId={context.tenantId}
      branchId={activeBranch} branchName={context.branches.find(b=>b.id===activeBranch)?.name??"สาขา"}
      currency={currency} products={opticalEntries.map(r=>({id:r.id,name:r.lensName??r.model??r.id,sku:r.sku}))}
      onClose={()=>setBestOpen(false)}/>:null}
    {error?<p role="alert" className="business-stock__error">{error}</p>:null}
    {loading?<p role="status" className="business-stock__empty">กำลังโหลดข้อมูล...</p>:null}
    {!loading && !error && optical ? <OpticalStockTable rows={opticalEntries} currency={currency}/>:null}
    {!loading && !error && !optical ? <div className="business-stock__tableWrap">
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
