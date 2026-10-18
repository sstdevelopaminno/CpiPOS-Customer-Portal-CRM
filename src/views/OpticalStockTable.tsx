import {useMemo,useState} from "react";
import {formatCurrency} from "../lib/formatters";
import { opticalText } from "../lib/optical-locale";
import { useCrmLanguage } from "../lib/use-crm-language";
import "../styles/custom-inventory.css";

export type OpticalTableEntry={
  id:string;sku:string|null;kind:"frame"|"lens"|"accessory";
  brand:string|null;model:string|null;color:string|null;frameSize:string|null;
  lensName:string|null;index:string|null;sph:number|null;cyl:number|null;
  price:number;quantity:number|null;remaining:number|null;imageUrl?:string|null;
};
type Tab="frame"|"lens"|"accessory";
const show=(v:unknown)=>v===undefined||v===null||String(v).trim()===""?"—":String(v);

export function OpticalStockTable({rows,currency}:{rows:OpticalTableEntry[];currency:string}){
  const language=useCrmLanguage();
  const T=(value:string)=>opticalText(language,value);
  const [tab,setTab]=useState<Tab>("frame");
  const [q,setQ]=useState("");
  const [page,setPage]=useState(1);
  const [size,setSize]=useState(10);
  const [sku,setSku]=useState<OpticalTableEntry|null>(null);
  const tabs:Tab[]=rows.some(r=>r.kind==="accessory")
    ?["frame","lens","accessory"]:["frame","lens"];
  const filtered=useMemo(()=>rows.filter(row=>row.kind===tab &&
    (!q||[row.sku,row.brand,row.model,row.color,row.lensName,row.index]
      .some(v=>String(v??"").toLowerCase().includes(q.trim().toLowerCase())))),[rows,tab,q]);
  const pages=Math.max(1,Math.ceil(filtered.length/size)),currentPage=Math.min(page,pages);
  const current=filtered.slice((currentPage-1)*size,currentPage*size);
  return <div className="optical-stock-tables" data-testid="crm-optical-two-stock-tables">
    <div className="optical-stock-tables__tabs" role="tablist" aria-label={T("สลับประเภทสต๊อก Optical")}>
      {tabs.map(x=><button key={x} type="button" role="tab" aria-selected={tab===x}
        onClick={()=>{setTab(x);setPage(1);}}>
        {T(x==="frame"?"สต๊อกกรอบแว่น":x==="lens"?"สต๊อกเลนส์":"อุปกรณ์เสริม")}
      </button>)}
    </div>
    <div className="optical-stock-tables__search">
      <label>{T("ค้นหาสินค้า / SKU / บาร์โค้ด")}
        <input type="search" value={q} onChange={e=>{setQ(e.target.value);setPage(1);}}
          placeholder={T("แบรนด์ / รุ่น / ชื่อเลนส์ / รหัส")}/>
      </label>
      <label>{T("แสดง")}
        <select value={size} onChange={e=>{setSize(Number(e.target.value));setPage(1);}}>
          {[10,20,50,100].map(n=><option value={n} key={n}>{n} {T("รายการต่อหน้า")}</option>)}
        </select>
      </label>
    </div>
    <div className="optical-stock-tables__scroll">
      <table><thead><tr>
        {["SKU / บาร์โค้ด","รูปสินค้า",...(tab==="frame"
          ?["แบรนด์","รุ่น","สี","ขนาด"]:tab==="lens"
          ?["ยี่ห้อ","ชื่อเลนส์","Index","ค่าสายตา"]
          :["ชื่อสินค้า","ประเภท","รายละเอียด","หน่วย"]),
          "ราคา","จำนวน","จำนวนคงเหลือ"].map(name=><th key={name}>{T(name)}{name==="ราคา"?" ("+currency+")":""}</th>)}
      </tr></thead>
      <tbody>{current.map(item=><tr key={item.id}>
        <td><button type="button" className="optical-stock-tables__sku"
          onClick={()=>setSku(item)}>{T("ดูรหัส")}</button></td>
        <td>{item.imageUrl?<img src={item.imageUrl} alt={item.lensName??item.model??T("สินค้า")} loading="lazy"
          style={{height:44,width:44,borderRadius:8,objectFit:"cover"}}/>:
          <span aria-label={T("ยังไม่มีรูปสินค้า")} style={{color:"#94a3b8",fontSize:12}}>{T("ไม่มีรูป")}</span>}</td>
        {tab==="frame"?<>
          <td>{show(item.brand)}</td><td><strong>{show(item.model)}</strong></td>
          <td>{show(item.color)}</td><td>{show(item.frameSize)}</td>
        </>:tab==="lens"?<>
          <td>{show(item.brand)}</td><td><strong>{show(item.lensName)}</strong></td>
          <td>{show(item.index)}</td>
          <td>SPH {show(item.sph)} · CYL {show(item.cyl)}</td>
        </>:<>
          <td>{show(item.model)}</td><td>{T("อุปกรณ์เสริม")}</td><td>{show(item.brand)}</td><td>{T("ชิ้น")}</td>
        </>}
        <td className="optical-stock-tables__num">{formatCurrency(Number(item.price),currency)}</td>
        <td className="optical-stock-tables__num">{item.quantity??"—"}</td>
        <td className="optical-stock-tables__num">{item.remaining??T("รอยืนยัน")}</td>
      </tr>)}</tbody></table>
      {current.length===0?<p className="business-stock__empty">{T("ไม่พบสินค้าประเภทนี้")}</p>:null}
    </div>
    <nav className="optical-stock-tables__pager" aria-label={T("แบ่งหน้าสต๊อก Optical")}>
      <span>{T("แสดง")} {filtered.length?(currentPage-1)*size+1:0}–{Math.min(currentPage*size,filtered.length)} {T("จาก")} {filtered.length}</span>
      <div>
        <button disabled={currentPage===1} onClick={()=>setPage(currentPage-1)}>{T("ก่อนหน้า")}</button>
        <strong>{T("หน้า")} {currentPage} / {pages}</strong>
        <button disabled={currentPage===pages} onClick={()=>setPage(currentPage+1)}>{T("ถัดไป")}</button>
      </div>
    </nav>
    {sku?<div className="optical-stock-tables__overlay">
      <section role="dialog" aria-modal="true" aria-labelledby="crm-stock-sku-title" className="optical-stock-tables__dialog">
        <h3 id="crm-stock-sku-title">{T("SKU / บาร์โค้ด")}</h3>
        <p>{show(sku.kind==="lens"?sku.lensName:sku.model)}</p>
        <code>{show(sku.sku)}</code>
        <div><button type="button" onClick={()=>setSku(null)}>{T("ปิด")}</button></div>
      </section>
    </div>:null}
  </div>;
}
