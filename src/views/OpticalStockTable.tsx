import {useMemo,useState} from "react";
import {formatCurrency} from "../lib/formatters";
import "../styles/custom-inventory.css";

export type OpticalTableEntry={
  id:string;sku:string|null;kind:"frame"|"lens"|"accessory";
  brand:string|null;model:string|null;color:string|null;frameSize:string|null;
  lensName:string|null;index:string|null;sph:number|null;cyl:number|null;
  price:number;quantity:number|null;remaining:number|null;
};
type Tab="frame"|"lens"|"accessory";
const show=(v:unknown)=>v===undefined||v===null||String(v).trim()===""?"—":String(v);

export function OpticalStockTable({rows,currency}:{rows:OpticalTableEntry[];currency:string}){
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
    <div className="optical-stock-tables__tabs" role="tablist" aria-label="สลับประเภทสต๊อก Optical">
      {tabs.map(x=><button key={x} type="button" role="tab" aria-selected={tab===x}
        onClick={()=>{setTab(x);setPage(1);}}>
        {x==="frame"?"สต๊อกกรอบแว่น":x==="lens"?"สต๊อกเลนส์":"อุปกรณ์เสริม"}
      </button>)}
    </div>
    <div className="optical-stock-tables__search">
      <label>ค้นหาสินค้า / SKU / บาร์โค้ด
        <input type="search" value={q} onChange={e=>{setQ(e.target.value);setPage(1);}}
          placeholder="แบรนด์ / รุ่น / ชื่อเลนส์ / รหัส"/>
      </label>
      <label>แสดง
        <select value={size} onChange={e=>{setSize(Number(e.target.value));setPage(1);}}>
          {[10,20,50,100].map(n=><option value={n} key={n}>{n} รายการ</option>)}
        </select>
      </label>
    </div>
    <div className="optical-stock-tables__scroll">
      <table><thead><tr>
        {["SKU / บาร์โค้ด",...(tab==="frame"
          ?["แบรนด์","รุ่น","สี","ขนาด"]:tab==="lens"
          ?["ยี่ห้อ","ชื่อเลนส์","Index","ค่าสายตา"]
          :["ชื่อสินค้า","ประเภท","รายละเอียด","หน่วย"]),
          "ราคา ("+currency+")","จำนวน","จำนวนคงเหลือ"].map(name=><th key={name}>{name}</th>)}
      </tr></thead>
      <tbody>{current.map(item=><tr key={item.id}>
        <td><button type="button" className="optical-stock-tables__sku"
          onClick={()=>setSku(item)}>ดูรหัส</button></td>
        {tab==="frame"?<>
          <td>{show(item.brand)}</td><td><strong>{show(item.model)}</strong></td>
          <td>{show(item.color)}</td><td>{show(item.frameSize)}</td>
        </>:tab==="lens"?<>
          <td>{show(item.brand)}</td><td><strong>{show(item.lensName)}</strong></td>
          <td>{show(item.index)}</td>
          <td>SPH {show(item.sph)} · CYL {show(item.cyl)}</td>
        </>:<>
          <td>{show(item.model)}</td><td>อุปกรณ์เสริม</td><td>{show(item.brand)}</td><td>ชิ้น</td>
        </>}
        <td className="optical-stock-tables__num">{formatCurrency(Number(item.price),currency)}</td>
        <td className="optical-stock-tables__num">{item.quantity??"—"}</td>
        <td className="optical-stock-tables__num">{item.remaining??"รอยืนยัน"}</td>
      </tr>)}</tbody></table>
      {current.length===0?<p className="business-stock__empty">ไม่พบสินค้าประเภทนี้</p>:null}
    </div>
    <nav className="optical-stock-tables__pager" aria-label="แบ่งหน้าสต๊อก Optical">
      <span>แสดง {filtered.length?(currentPage-1)*size+1:0}–{Math.min(currentPage*size,filtered.length)} จาก {filtered.length}</span>
      <div>
        <button disabled={currentPage===1} onClick={()=>setPage(currentPage-1)}>ก่อนหน้า</button>
        <strong>หน้า {currentPage} / {pages}</strong>
        <button disabled={currentPage===pages} onClick={()=>setPage(currentPage+1)}>ถัดไป</button>
      </div>
    </nav>
    {sku?<div className="optical-stock-tables__overlay">
      <section role="dialog" aria-modal="true" aria-labelledby="crm-stock-sku-title" className="optical-stock-tables__dialog">
        <h3 id="crm-stock-sku-title">SKU / บาร์โค้ด</h3>
        <p>{show(sku.kind==="lens"?sku.lensName:sku.model)}</p>
        <code>{show(sku.sku)}</code>
        <div><button type="button" onClick={()=>setSku(null)}>ปิด</button></div>
      </section>
    </div>:null}
  </div>;
}
