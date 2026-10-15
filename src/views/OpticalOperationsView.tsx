import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { PortalContext } from "../types/portal";
import { formatCurrency } from "../lib/formatters";

type Page = "orders" | "stock" | "reports";
type Order = {
  id:string;customer_id:string;seller_id:string;status:string;
  total_amount:number;paid_total:number;accepted_at:string;due_at:string|null
};
type Stock = {
  id:string;product_id:string;kind:string;brand:string|null;model:string|null;
  color:string|null;frame_size:string|null;lens_index:string|null;lens_type:string|null;
  lens_sph:number|null;lens_cyl:number|null;
  unit:string;unit_price:number;on_hand:number;reserved:number;reorder_level:number;
  image_url:string|null
};
type Metric = {metric:string;label:string;quantity:number;amount_lak:number};
type Range = "day" | "month" | "year";
type StockKind = "all" | "frame" | "lens" | "accessory";

function laoWindow(range:Range):{from:string;to:string} {
  const parts=new Intl.DateTimeFormat("en-US",{
    timeZone:"Asia/Vientiane",year:"numeric",month:"2-digit",day:"2-digit"
  }).formatToParts(new Date());
  const value=(key:string)=>Number(parts.find(part=>part.type===key)?.value||"0");
  const y=value("year"),m=value("month"),d=value("day");
  const start=range==="year"?new Date(Date.UTC(y,0,1)-7*3600_000)
    :range==="month"?new Date(Date.UTC(y,m-1,1)-7*3600_000)
    :new Date(Date.UTC(y,m-1,d)-7*3600_000);
  const end=range==="year"?new Date(Date.UTC(y+1,0,1)-7*3600_000)
    :range==="month"?new Date(Date.UTC(y,m,1)-7*3600_000)
    :new Date(Date.UTC(y,m-1,d+1)-7*3600_000);
  return {from:start.toISOString(),to:end.toISOString()};
}
const money=(amount:number)=>formatCurrency(Number(amount||0),"LAK");
const statusName:Record<string,string>={
  received:"รับงาน",lens_ordered:"สั่งเลนส์",edging:"เจียร",
  ready_for_pickup:"รอรับ",collected:"รับสินค้าแล้ว",cancelled:"ยกเลิก"
};

export function OpticalOperationsView({
  context,branchId,page
}:{context:PortalContext;branchId:string|null;page:Page}) {
  const branch=context.branches.find(x=>x.id===branchId)?.id??context.branches[0]?.id;
  const [orders,setOrders]=useState<Order[]>([]);
  const [bins,setBins]=useState<Stock[]>([]);
  const [metrics,setMetrics]=useState<Metric[]>([]);
  const [range,setRange]=useState<Range>("day");
  const [stockKind,setStockKind]=useState<StockKind>("all");
  const [stockSearch,setStockSearch]=useState("");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");

  useEffect(()=>{
    if(!branch)return;
    let cancelled=false;
    setLoading(true);setError("");
    const load=async()=>{
      try{
        if(page==="orders"){
          const {data,error:e}=await supabase.from("optical_work_orders")
            .select("id,customer_id,seller_id,status,total_amount,paid_total,accepted_at,due_at")
            .eq("tenant_id",context.tenantId).eq("branch_id",branch)
            .order("created_at",{ascending:false}).limit(100);
          if(e)throw e;
          if(!cancelled)setOrders((data??[]) as Order[]);
        }else if(page==="stock"){
          const {data,error:e}=await supabase.from("optical_stock_bins")
            .select("id,product_id,kind,brand,model,color,frame_size,lens_index,lens_type,lens_sph,lens_cyl,unit,unit_price,on_hand,reserved,reorder_level,image_url")
            .eq("tenant_id",context.tenantId).eq("branch_id",branch)
            .order("created_at",{ascending:false}).limit(200);
          if(e)throw e;
          if(!cancelled)setBins((data??[]) as Stock[]);
        }else{
          const window=laoWindow(range);
          const {data,error:e}=await supabase.rpc("optical_report_v1",{
            p_tenant_id:context.tenantId,p_branch_id:branch,
            p_from:window.from,p_to:window.to
          });
          if(e)throw e;
          if(!cancelled)setMetrics((data??[]) as Metric[]);
        }
      }catch{
        if(!cancelled)setError("ยังไม่สามารถโหลดข้อมูล Optical ได้ กรุณาตรวจสิทธิ์หรือรอการเปิดใช้งานโมดูลโดย IT");
      }finally{if(!cancelled)setLoading(false);}
    };
    void load();
    return()=>{cancelled=true;};
  },[context.tenantId,branch,page,range]);

  // Filtering only changes the view; the source remains the tenant/branch-
  // scoped Optical Stock Bin query. It never edits or reserves inventory.
  const filteredBins=bins.filter(bin=>{
    if(stockKind!=="all" && (bin.kind==="frame"?"frame":bin.kind==="lens"?"lens":"accessory")!==stockKind)return false;
    const term=stockSearch.trim().toLocaleLowerCase();
    if(!term)return true;
    return [bin.brand,bin.model,bin.color,bin.frame_size,bin.lens_type,
      bin.lens_index,bin.product_id].some(value=>String(value??"").toLocaleLowerCase().includes(term));
  });

  if(!branch)return <p className="rounded-xl bg-amber-50 p-4">กรุณาเลือกสาขาที่ได้รับสิทธิ์ก่อน</p>;
  return <section className="space-y-4 rounded-2xl border border-emerald-100 bg-emerald-50/30 p-4">
    <header>
      <p className="text-sm font-bold text-emerald-700">Optical CUSTOM · {context.tenantName}</p>
      <h2 className="text-xl font-bold text-slate-900">
        {page==="orders"?"ใบสั่งงานแว่นตา":page==="stock"?"สต๊อกกรอบแว่นและเลนส์":"รายงานเจ้าของร้าน"}
      </h2>
      <p className="text-xs text-slate-500">ข้อมูลเฉพาะร้านและสาขาปัจจุบัน · ไม่รวมยอด THB ของระบบอาหาร</p>
    </header>
    {loading?<p role="status">กำลังโหลดข้อมูล...</p>:null}
    {error?<p role="alert" className="rounded-lg bg-rose-50 p-3 text-rose-700">{error}</p>:null}
    {page==="orders"?<div className="overflow-x-auto rounded-xl bg-white shadow-sm">
      <table className="w-full text-left text-sm"><thead><tr className="bg-emerald-50">
        <th className="p-3">งาน / วันที่</th><th className="p-3">สถานะ</th>
        <th className="p-3">ยอดเต็ม</th><th className="p-3">รับแล้ว</th>
        <th className="p-3">ค้างชำระ</th><th className="p-3">นัดรับ</th>
      </tr></thead><tbody>{orders.map(o=><tr key={o.id} className="border-t border-slate-100">
        <td className="p-3"><code>{o.id.slice(0,8)}</code><div className="text-xs text-slate-500">{new Date(o.accepted_at).toLocaleDateString("th-TH")}</div></td>
        <td className="p-3">{statusName[o.status]??o.status}</td>
        <td className="p-3">{money(o.total_amount)}</td>
        <td className="p-3">{money(o.paid_total)}</td>
        <td className="p-3 font-semibold">{money(o.total_amount-o.paid_total)}</td>
        <td className="p-3">{o.due_at?new Date(o.due_at).toLocaleDateString("th-TH"):"—"}</td>
      </tr>)}</tbody></table>
      {orders.length===0&&!loading?<p className="p-4 text-sm text-slate-500">ยังไม่มีใบสั่งงานในสาขานี้</p>:null}
    </div>:null}
    {page==="stock"?<div className="overflow-x-auto rounded-xl bg-white shadow-sm">
      <div className="flex flex-wrap items-end gap-3 border-b border-emerald-100 p-3">
        <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-sm font-medium text-slate-700">
          ค้นหากรอบแว่นหรือเลนส์
          <input type="search" value={stockSearch} onChange={event=>setStockSearch(event.target.value)}
            placeholder="แบรนด์ / รุ่น / สี / ชนิดเลนส์" aria-label="ค้นหาสต๊อก Optical"
            className="min-h-11 rounded-lg border border-slate-300 px-3"/>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          ประเภทสินค้า
          <select value={stockKind} onChange={event=>setStockKind(event.target.value as StockKind)}
            aria-label="ประเภทสินค้า Optical" className="min-h-11 rounded-lg border border-slate-300 px-3">
            <option value="all">ทั้งหมด</option><option value="frame">กรอบแว่น</option>
            <option value="lens">เลนส์</option><option value="accessory">อุปกรณ์</option>
          </select>
        </label>
        <span className="pb-2 text-xs text-slate-500" role="status">แสดง {filteredBins.length} จาก {bins.length} รายการ</span>
      </div>
      <table className="w-full text-left text-sm"><thead><tr className="bg-emerald-50">
        <th className="p-3">สินค้า</th><th className="p-3">ราคา LAK</th>
        <th className="p-3">คงเหลือ</th><th className="p-3">จองแล้ว</th>
        <th className="p-3">พร้อมขาย</th>
      </tr></thead><tbody>{filteredBins.map(b=>{
        const available=b.on_hand-b.reserved;
        return <tr key={b.id} className="border-t border-slate-100">
          <td className="p-3">
            <div className="flex items-center gap-3">
              {b.image_url?.startsWith("https://")?<img src={b.image_url} alt={b.model??"สินค้า Optical"}
                className="h-12 w-12 rounded-md border object-cover"/>:null}
              <div>
                <strong>{b.kind==="frame"?"กรอบ":b.kind==="lens"?"เลนส์":"อุปกรณ์"}</strong>
                <div>{[b.brand,b.model].filter(Boolean).join(" · ")||b.product_id.slice(0,8)}</div>
                <p className="text-xs text-slate-500">
                  {[b.color,b.frame_size,b.lens_type,b.lens_index].filter(Boolean).join(" · ")}
                  {b.lens_sph!==null?` SPH ${b.lens_sph}`:""}
                  {b.lens_cyl!==null?` CYL ${b.lens_cyl}`:""}
                </p>
              </div>
            </div>
          </td>
          <td className="p-3">{money(b.unit_price)}</td>
          <td className="p-3">{b.on_hand} {b.unit}</td>
          <td className="p-3">{b.reserved}</td>
          <td className={`p-3 font-bold ${available===0?"text-rose-700":available<=b.reorder_level?"text-amber-700":"text-emerald-700"}`}>
            {available} {available===0?"· หมด":available<=b.reorder_level?"· ใกล้หมด":""}
          </td>
        </tr>;
      })}</tbody></table>
      {bins.length===0&&!loading?<p className="p-4 text-sm text-slate-500">ยังไม่มีรายการ Optical Inventory ที่ผ่านการตรวจสต๊อกตั้งต้น</p>:null}
      {bins.length>0&&filteredBins.length===0?<p className="p-4 text-sm text-slate-500">ไม่พบสินค้าตามตัวกรองที่เลือก</p>:null}
    </div>:null}
    {page==="reports"?<div className="space-y-3">
      <div className="flex flex-wrap gap-2">{(["day","month","year"] as const).map(k=><button key={k}
        type="button" onClick={()=>setRange(k)}
        className={`rounded-lg px-4 py-2 text-sm ${range===k?"bg-emerald-700 text-white":"bg-white text-emerald-800"}`}>
          {k==="day"?"รายวัน":k==="month"?"รายเดือน":"รายปี"}</button>)}</div>
      <div className="grid gap-3 md:grid-cols-3">
        {[
          {label:"รับชำระ LAK",key:"payment_received"},
          {label:"ยอดขายที่ส่งมอบแล้ว LAK",key:"fulfilled_sales"},
          {label:"จำนวนงานส่งมอบ",key:"fulfilled_sales",count:true}
        ].map((m,i)=>{
          const row=metrics.find(x=>x.metric===m.key&&x.label==="all");
          return <article key={i} className="rounded-xl border border-emerald-100 bg-white p-4 shadow-sm">
            <h3 className="text-sm text-slate-600">{m.label}</h3>
            <strong className="text-xl text-emerald-800">{m.count?Number(row?.quantity??0):money(Number(row?.amount_lak??0))}</strong>
          </article>;
        })}
      </div>
      <h3 className="font-bold">ยอดรับชำระตามพนักงาน</h3>
      <div className="rounded-xl bg-white p-3">
        {metrics.filter(x=>x.metric==="seller_received").map(x=><p key={x.label} className="border-b p-2 text-sm">
          {x.label.slice(0,8)} · {x.quantity} รายการ · <strong>{money(x.amount_lak)}</strong>
        </p>)}
      </div>
      <h3 className="font-bold">สินค้าขายดี (ส่งมอบแล้ว)</h3>
      <div className="rounded-xl bg-white p-3">
        {metrics.filter(x=>x.metric==="popular_product").map(x=><p key={x.label} className="border-b p-2 text-sm">
          {x.label} · {x.quantity} หน่วย
        </p>)}
      </div>
      <p className="text-xs text-slate-500">รายงานแยกยอดรับชำระมัดจำออกจากยอดขายที่ส่งมอบแล้ว ไม่บวกเป็นยอดขายซ้ำ</p>
    </div>:null}
  </section>;
}
