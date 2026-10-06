import { useCallback, useEffect, useState } from "react";
import {
  Banknote, Boxes, ChevronRight, CircleAlert, Clock3, LayoutDashboard, LoaderCircle,
  LogOut, PackageCheck, ReceiptText, RefreshCw, ShieldCheck, Store, TrendingUp,
  UserRoundCheck, Warehouse
} from "lucide-react";
import {
  loadDashboard, loadPackage, loadPortalContext, loadProducts, loadSales, loadStock,
  loginWithStoreEmployeeCode, logoutPortal, type DashboardSummary, type OrderRow, type PackageInfo,
  type PortalContext, type PortalView, type ProductRow, type StockRow
} from "./lib/portal";
import { supabase } from "./lib/supabase";

const money = new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 2 });
const number = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 });
const dateTime = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" });
const dateOnly = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" });

function amount(order: OrderRow) { return Number(order.grand_total ?? order.total_amount ?? 0); }
function statusLabel(status: string) {
  return ({ completed: "สำเร็จ", cancelled: "ยกเลิก", queued: "รอดำเนินการ", draft: "ฉบับร่าง" } as Record<string,string>)[status] ?? status;
}

function Login({ onSuccess }: { onSuccess: () => Promise<void> }) {
  const [storeCode, setStoreCode] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(""); setBusy(true);
    try { await loginWithStoreEmployeeCode(storeCode, employeeCode); await onSuccess(); }
    catch (err) { setError(err instanceof Error ? err.message : "เข้าสู่ระบบไม่สำเร็จ"); }
    finally { setBusy(false); }
  }
  return <main className="loginPage">
    <section className="loginBrand">
      <div className="brandPill">CpiPOS CUSTOMER PORTAL</div>
      <h1>บริหารร้านง่ายขึ้น<br/><span>ทุกที่ ทุกเวลา</span></h1>
      <p className="loginLead">ติดตามยอดขาย ตรวจสอบสินค้าและสต๊อก พร้อมดูภาพรวมการดำเนินงานของร้านได้สะดวกในที่เดียว</p>
      <div className="loginBenefits">
        <span><ShieldCheck size={18}/> สำหรับเจ้าของร้านและผู้จัดการ</span>
        <span><UserRoundCheck size={18}/> ใช้งานพร้อมกันได้หลายเครื่อง</span>
        <span><TrendingUp size={18}/> ติดตามข้อมูลร้านได้ทุกที่ทุกเวลา</span>
      </div>
    </section>
    <section className="loginCard">
      <div className="loginLogoWrap"><img className="loginLogo" src="/cpipos-logo.png" alt="CpiPOS" /></div>
      <div><p className="eyebrow">WELCOME BACK</p><h2>เข้าสู่ระบบร้านค้า</h2><p className="muted">ใช้รหัสร้าน และรหัสพนักงานของเจ้าของร้านหรือผู้จัดการ</p></div>
      <form onSubmit={submit}>
        <label><span>รหัสร้าน</span><input autoComplete="username" value={storeCode} onChange={e=>setStoreCode(e.target.value)} placeholder="เช่น 459605" maxLength={32} required/></label>
        <label><span>รหัสพนักงาน</span><input autoComplete="off" inputMode="text" type="text" value={employeeCode} onChange={e=>setEmployeeCode(e.target.value.replace(/[^A-Za-z0-9._-]/g,"").slice(0,32))} placeholder="เช่น 000001" minLength={2} maxLength={32} required/></label>
        {error ? <div className="errorBox"><CircleAlert size={18}/>{error}</div> : null}
        <button className="primaryButton" disabled={busy}>{busy?<LoaderCircle className="spin" size={19}/>:null}{busy?"กำลังตรวจสอบ...":"เข้าสู่ระบบ"}</button>
      </form>
      <p className="securityCopy">สำหรับบัญชีเจ้าของร้านและผู้จัดการเท่านั้น</p>
    </section>
  </main>;
}

function MetricCard({ icon,label,value,helper }: { icon:React.ReactNode;label:string;value:string;helper:string }) {
  return <article className="metricCard"><div className="metricIcon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{helper}</small></div></article>;
}
function Empty({children}:{children:React.ReactNode}) { return <div className="emptyState">{children}</div>; }

function DashboardView({context}:{context:PortalContext}) {
  const [summary,setSummary]=useState<DashboardSummary|null>(null);
  const [orders,setOrders]=useState<OrderRow[]>([]);
  const [loading,setLoading]=useState(true);
  const refresh=useCallback(async()=>{ setLoading(true); try{const d=await loadDashboard(context.tenantId);setSummary(d.summary);setOrders(d.recentOrders);}finally{setLoading(false);} },[context.tenantId]);
  useEffect(()=>{void refresh();},[refresh]);
  if(loading&&!summary) return <div className="loadingPanel"><LoaderCircle className="spin"/>กำลังโหลด Dashboard...</div>;
  return <>
    <div className="pageHeading"><div><p className="eyebrow">TODAY OVERVIEW</p><h2>ภาพรวมวันนี้</h2><p>ภาพรวมการดำเนินงานจากสาขาที่คุณมีสิทธิ์เข้าถึง</p></div><button className="ghostButton" onClick={()=>void refresh()}><RefreshCw size={17}/>รีเฟรช</button></div>
    <section className="metricsGrid">
      <MetricCard icon={<Banknote/>} label="ยอดขายวันนี้" value={money.format(summary?.sales_total??0)} helper="เฉพาะบิลสำเร็จ"/>
      <MetricCard icon={<ReceiptText/>} label="จำนวนบิล" value={number.format(summary?.order_count??0)} helper="รายการขายวันนี้"/>
      <MetricCard icon={<TrendingUp/>} label="ยอดเฉลี่ยต่อบิล" value={money.format(summary?.average_ticket??0)} helper="Average ticket"/>
      <MetricCard icon={<Clock3/>} label="กะที่เปิดอยู่" value={number.format(summary?.open_shifts??0)} helper="ตามสาขาที่เข้าถึงได้"/>
    </section>
    <section className="splitGrid">
      <article className="panel"><div className="panelHeader"><div><p className="eyebrow">RECENT SALES</p><h3>บิลล่าสุด</h3></div></div>
        {orders.length?<div className="rows">{orders.map(o=><div className="dataRow" key={o.id}><div><strong>{o.order_no||"รายการขาย"}</strong><span>{dateTime.format(new Date(o.created_at))}</span></div><div className="rowAmount"><strong>{money.format(amount(o))}</strong><span>{o.order_type||"POS"}</span></div></div>)}</div>:<Empty>ยังไม่มีรายการขายวันนี้</Empty>}
      </article>
      <article className="panel"><div className="panelHeader"><div><p className="eyebrow">STORE HEALTH</p><h3>สถานะร้าน</h3></div></div>
        <div className="healthList">
          <div><span><Store size={18}/>สาขาที่เปิดใช้งาน</span><strong>{summary?.active_branches??0}</strong></div>
          <div><span><Boxes size={18}/>สินค้าที่เปิดขาย</span><strong>{summary?.active_products??0}</strong></div>
          <div className={(summary?.low_stock_count??0)>0?"warn":""}><span><Warehouse size={18}/>วัตถุดิบถึงจุดสั่งซื้อ</span><strong>{summary?.low_stock_count??0}</strong></div>
        </div>
      </article>
    </section>
  </>;
}

function SalesView({context}:{context:PortalContext}) {
  const [rows,setRows]=useState<OrderRow[]>([]); const [loading,setLoading]=useState(true);
  useEffect(()=>{loadSales(context.tenantId).then(setRows).finally(()=>setLoading(false));},[context.tenantId]);
  return <><div className="pageHeading"><div><p className="eyebrow">SALES</p><h2>รายการขาย</h2><p>100 รายการล่าสุดจากสาขาที่คุณมีสิทธิ์</p></div></div>
    <article className="panel tablePanel">{loading?<div className="loadingPanel"><LoaderCircle className="spin"/>กำลังโหลดรายการขาย...</div>:rows.length?<div className="tableWrap"><table><thead><tr><th>เลขที่บิล</th><th>เวลา</th><th>ประเภท</th><th>สถานะ</th><th className="right">ยอดรวม</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td><strong>{r.order_no||"—"}</strong></td><td>{dateTime.format(new Date(r.created_at))}</td><td>{r.order_type||"POS"}</td><td><span className={`status status-${r.status}`}>{statusLabel(r.status)}</span></td><td className="right"><strong>{money.format(amount(r))}</strong></td></tr>)}</tbody></table></div>:<Empty>ยังไม่มีข้อมูลรายการขาย</Empty>}</article>
  </>;
}

function ProductsView({context}:{context:PortalContext}) {
  const [rows,setRows]=useState<ProductRow[]>([]); const [loading,setLoading]=useState(true);
  useEffect(()=>{loadProducts(context.tenantId).then(setRows).finally(()=>setLoading(false));},[context.tenantId]);
  return <><div className="pageHeading"><div><p className="eyebrow">PRODUCTS</p><h2>สินค้า</h2><p>รายการสินค้าที่ร้านกำหนดไว้ใน CpiPOS</p></div></div>
    <article className="panel tablePanel">{loading?<div className="loadingPanel"><LoaderCircle className="spin"/>กำลังโหลดสินค้า...</div>:rows.length?<div className="tableWrap"><table><thead><tr><th>SKU</th><th>ชื่อสินค้า</th><th>หมวดหมู่</th><th>สถานะ</th><th className="right">ราคา</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{r.sku||"—"}</td><td><strong>{r.name}</strong></td><td>{r.category||"—"}</td><td><span className={r.is_active?"status status-completed":"status"}>{r.is_active?"เปิดขาย":"ปิด"}</span></td><td className="right">{money.format(Number(r.price??0))}</td></tr>)}</tbody></table></div>:<Empty>ยังไม่มีสินค้า</Empty>}</article>
  </>;
}

function StockView({context}:{context:PortalContext}) {
  const [rows,setRows]=useState<StockRow[]>([]); const [loading,setLoading]=useState(true);
  useEffect(()=>{loadStock(context.tenantId).then(setRows).finally(()=>setLoading(false));},[context.tenantId]);
  return <><div className="pageHeading"><div><p className="eyebrow">INVENTORY</p><h2>วัตถุดิบและสต๊อก</h2><p>ดูจำนวนคงเหลือและจุดสั่งซื้อของแต่ละสาขา</p></div></div>
    <article className="panel tablePanel">{loading?<div className="loadingPanel"><LoaderCircle className="spin"/>กำลังโหลดสต๊อก...</div>:rows.length?<div className="tableWrap"><table><thead><tr><th>วัตถุดิบ</th><th>หน่วย</th><th className="right">คงเหลือ</th><th className="right">จุดสั่งซื้อ</th><th>สถานะ</th></tr></thead><tbody>{rows.map(r=>{const low=r.reorder_level!==null&&Number(r.quantity_on_hand)<=Number(r.reorder_level);return <tr key={r.id}><td><strong>{r.name}</strong></td><td>{r.base_unit}</td><td className="right">{number.format(Number(r.quantity_on_hand))}</td><td className="right">{r.reorder_level===null?"—":number.format(Number(r.reorder_level))}</td><td><span className={low?"status status-cancelled":"status status-completed"}>{low?"ควรสั่งเพิ่ม":"ปกติ"}</span></td></tr>;})}</tbody></table></div>:<Empty>ยังไม่มีข้อมูลวัตถุดิบ</Empty>}</article>
  </>;
}

function PackageView({context}:{context:PortalContext}) {
  const [info,setInfo]=useState<PackageInfo|null>(null); const [loading,setLoading]=useState(true);
  useEffect(()=>{loadPackage(context.tenantId,context.role).then(setInfo).finally(()=>setLoading(false));},[context.tenantId,context.role]);
  if(loading) return <div className="loadingPanel"><LoaderCircle className="spin"/>กำลังโหลดแพ็กเกจ...</div>;
  const expiry=info?.runtime?.expires_at||info?.contract?.ended_at;
  return <><div className="pageHeading"><div><p className="eyebrow">PACKAGE & BILLING</p><h2>แพ็กเกจและสิทธิ์</h2><p>ตรวจสอบสถานะสิทธิ์การใช้งานของร้าน</p></div></div>
    <section className="packageHero">
      <div><span>สถานะปัจจุบัน</span><strong>{info?.runtime?.lifecycle_status||info?.contract?.status||"—"}</strong><small>{info?.runtime?.access_locked?"การใช้งานถูกจำกัด":"ระบบพร้อมใช้งาน"}</small></div>
      <div><span>รอบชำระ</span><strong>{info?.contract?.billing_interval||"—"}</strong><small>Auto renew: {info?.contract?.auto_renew?"เปิด":"ปิด"}</small></div>
      <div><span>หมดอายุ</span><strong>{expiry?dateOnly.format(new Date(expiry)):"—"}</strong><small>{info?.runtime?.lock_reason||"ไม่มีข้อจำกัด"}</small></div>
      <div><span>ค่าบริการต่อรอบ</span><strong>{info?.contract?.amount_per_cycle==null?"—":money.format(Number(info.contract.amount_per_cycle))}</strong><small>{info?.contract?.currency||"THB"}</small></div>
    </section>
    {context.role==="owner"?<article className="panel tablePanel"><div className="panelHeader"><div><p className="eyebrow">BILLING HISTORY</p><h3>รอบบิลล่าสุด</h3></div></div>{info?.billingCycles.length?<div className="tableWrap"><table><thead><tr><th>ช่วงรอบบิล</th><th>สถานะ</th><th className="right">ยอดเรียกเก็บ</th><th className="right">ชำระแล้ว</th></tr></thead><tbody>{info.billingCycles.map((c,i)=><tr key={`${c.period_start}-${i}`}><td>{dateOnly.format(new Date(c.period_start))} – {dateOnly.format(new Date(c.period_end))}</td><td><span className={c.status==="paid"?"status status-completed":"status"}>{c.status}</span></td><td className="right">{money.format(Number(c.amount_due))}</td><td className="right">{money.format(Number(c.amount_paid))}</td></tr>)}</tbody></table></div>:<Empty>ยังไม่มีประวัติรอบบิลที่แสดงได้</Empty>}</article>:<div className="infoBox">ผู้จัดการดูสถานะแพ็กเกจได้ แต่ประวัติการชำระเงินสงวนสำหรับ Owner</div>}
  </>;
}

const nav:Array<{id:PortalView;label:string;icon:React.ReactNode}>=[
  {id:"dashboard",label:"ภาพรวม",icon:<LayoutDashboard size={19}/>},
  {id:"sales",label:"ยอดขาย",icon:<ReceiptText size={19}/>},
  {id:"products",label:"สินค้า",icon:<Boxes size={19}/>},
  {id:"stock",label:"สต๊อก",icon:<Warehouse size={19}/>},
  {id:"package",label:"แพ็กเกจ",icon:<PackageCheck size={19}/>}
];

export default function App(){
  const [context,setContext]=useState<PortalContext|null>(null);
  const [checking,setChecking]=useState(true);
  const [view,setView]=useState<PortalView>("dashboard");
  const [fatal,setFatal]=useState("");
  const restore=useCallback(async()=>{setFatal("");try{setContext(await loadPortalContext());}catch(err){const m=err instanceof Error?err.message:"";if(m!=="not_authenticated")setFatal("ไม่สามารถตรวจสอบสิทธิ์ Customer Portal ได้");setContext(null);}finally{setChecking(false);}},[]);
  useEffect(()=>{void restore();const{data}=supabase.auth.onAuthStateChange(event=>{if(event==="SIGNED_OUT")setContext(null);});return()=>data.subscription.unsubscribe();},[restore]);
  if(checking)return <div className="bootScreen"><img className="bootLogo" src="/cpipos-logo.png" alt="CpiPOS"/><LoaderCircle className="spin"/><span>กำลังเตรียมข้อมูลร้าน...</span></div>;
  if(!context)return <Login onSuccess={restore}/>;
  return <div className="appShell">
    <aside className="sidebar">
      <div className="brandBlock"><img className="brandLogo" src="/cpipos-logo.png" alt="CpiPOS"/><div><strong>CpiPOS</strong><span>Customer Portal</span></div></div>
      <div className="storeCard"><div className="storeAvatar">{context.logoUrl?<img src={context.logoUrl} alt=""/>:<Store size={21}/>}</div><div><strong>{context.tenantName}</strong><span>ร้าน {context.tenantCode}</span></div></div>
      <nav>{nav.map(i=><button key={i.id} className={view===i.id?"active":""} onClick={()=>setView(i.id)}>{i.icon}<span>{i.label}</span><ChevronRight size={16}/></button>)}</nav>
      <div className="sidebarBottom"><div className="roleBadge"><ShieldCheck size={16}/><span>{context.role==="owner"?"Owner":"Manager"}</span></div><button className="logoutButton" onClick={()=>void logoutPortal()}><LogOut size={17}/>ออกจากระบบ</button></div>
    </aside>
    <main className="content">
      <header className="mobileHeader"><div className="brandBlock"><img className="brandLogo" src="/cpipos-logo.png" alt="CpiPOS"/><div><strong>CpiPOS</strong><span>{context.tenantName}</span></div></div><button className="iconButton" onClick={()=>void logoutPortal()}><LogOut size={18}/></button></header>
      <div className="mobileNav">{nav.map(i=><button key={i.id} className={view===i.id?"active":""} onClick={()=>setView(i.id)}>{i.icon}<span>{i.label}</span></button>)}</div>
      {fatal?<div className="errorBox">{fatal}</div>:null}
      {view==="dashboard"?<DashboardView context={context}/>:null}
      {view==="sales"?<SalesView context={context}/>:null}
      {view==="products"?<ProductsView context={context}/>:null}
      {view==="stock"?<StockView context={context}/>:null}
      {view==="package"?<PackageView context={context}/>:null}
      <footer>ข้อมูลถูกจำกัดตามสิทธิ์ของ {context.role==="owner"?"เจ้าของร้าน":"ผู้จัดการ"} · {context.branches.length} สาขาที่เข้าถึงได้</footer>
    </main>
  </div>;
}
