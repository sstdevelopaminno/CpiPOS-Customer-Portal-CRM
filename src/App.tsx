import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Banknote, Boxes, ChevronRight, CircleAlert, Clock3, Download, Eye, LayoutDashboard,
  LoaderCircle, LogOut, PackageCheck, ReceiptText, RefreshCw, ShieldCheck, Store,
  TrendingUp, UserRoundCheck, UsersRound, Warehouse, WifiOff, X
} from "lucide-react";
import {
  getReportWindow, loadDashboard, loadOrderItems, loadPackage, loadPortalContext,
  loadProducts, loadSales, loadStaff, loadStock, loginWithStoreEmployeeCode,
  logoutPortal, reportRangeLabel, type DashboardSummary, type OrderItemRow, type OrderRow,
  type PackageInfo, type PortalContext, type PortalView, type ProductRow, type ReportRange,
  type StaffRow, type StockRow
} from "./lib/portal";
import { supabase } from "./lib/supabase";

const money = new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 2 });
const number = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 });
const dateTime = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" });
const dateOnly = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" });

function amount(order: OrderRow) {
  return Number(order.grand_total ?? order.total_amount ?? 0);
}

function statusLabel(status: string) {
  return ({ completed: "สำเร็จ", cancelled: "ยกเลิก", queued: "รอดำเนินการ", draft: "ฉบับร่าง" } as Record<string, string>)[status] ?? status;
}

function maskEmployeeCode(value: string | null) {
  if (!value) return "—";
  if (value.length <= 2) return "••";
  return `${"•".repeat(Math.max(2, value.length - 2))}${value.slice(-2)}`;
}

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function Login({
  onSuccess,
  canInstall,
  onInstall
}: {
  onSuccess: () => Promise<void>;
  canInstall: boolean;
  onInstall: () => Promise<void>;
}) {
  const [storeCode, setStoreCode] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await loginWithStoreEmployeeCode(storeCode, employeeCode);
      await onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
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
      {canInstall ? <button type="button" className="installButton" onClick={() => void onInstall()}><Download size={17}/>ติดตั้ง CpiPOS เป็นเว็บแอป</button> : null}
      <p className="securityCopy">สำหรับบัญชีเจ้าของร้านและผู้จัดการเท่านั้น</p>
    </section>
  </main>;
}

function MetricCard({ icon, label, value, helper }: { icon: React.ReactNode; label: string; value: string; helper: string }) {
  return <article className="metricCard"><div className="metricIcon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{helper}</small></div></article>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="emptyState">{children}</div>;
}

function ErrorPanel({ message }: { message: string }) {
  return <div className="errorPanel"><CircleAlert size={18}/><span>{message}</span></div>;
}

function FilterBar({
  context,
  branchId,
  onBranchChange,
  range,
  onRangeChange,
  showRange
}: {
  context: PortalContext;
  branchId: string;
  onBranchChange: (value: string) => void;
  range: ReportRange;
  onRangeChange: (value: ReportRange) => void;
  showRange: boolean;
}) {
  return <div className="portalFilters">
    <label className="branchFilter">
      <Store size={16}/>
      <span>สาขา</span>
      <select value={branchId} onChange={e=>onBranchChange(e.target.value)}>
        <option value="">ทุกสาขาที่เข้าถึงได้</option>
        {context.branches.map(branch=><option key={branch.id} value={branch.id}>{branch.name}</option>)}
      </select>
    </label>
    {showRange ? <div className="rangeTabs" aria-label="ช่วงเวลารายงาน">
      {(["today","7d","30d"] as ReportRange[]).map(item=><button key={item} className={range===item?"active":""} onClick={()=>onRangeChange(item)}>{reportRangeLabel(item)}</button>)}
    </div> : null}
  </div>;
}

function DashboardView({ context, branchId, range }: { context: PortalContext; branchId: string | null; range: ReportRange }) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await loadDashboard(context.tenantId, branchId, range);
      setSummary(data.summary);
      setOrders(data.recentOrders);
    } catch {
      setError("ไม่สามารถโหลดข้อมูลภาพรวมได้ กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  }, [context.tenantId, branchId, range]);

  useEffect(() => { void refresh(); }, [refresh]);

  const topProducts = summary?.top_products ?? [];
  const maxTopSale = Math.max(1, ...topProducts.map(item=>Number(item.sales_total || 0)));

  if (loading && !summary) return <div className="loadingPanel"><LoaderCircle className="spin"/>กำลังโหลด Dashboard...</div>;

  return <>
    <div className="pageHeading">
      <div><p className="eyebrow">SALES OVERVIEW</p><h2>ภาพรวม {reportRangeLabel(range)}</h2><p>ยอดขายและสถานะการดำเนินงานตามสาขาและช่วงเวลาที่เลือก</p></div>
      <button className="ghostButton" onClick={()=>void refresh()}><RefreshCw size={17}/>รีเฟรช</button>
    </div>
    {error ? <ErrorPanel message={error}/> : null}
    <section className="metricsGrid">
      <MetricCard icon={<Banknote/>} label={"ยอดขาย "+reportRangeLabel(range)} value={money.format(summary?.sales_total??0)} helper="เฉพาะบิลสำเร็จ"/>
      <MetricCard icon={<ReceiptText/>} label="จำนวนบิล" value={number.format(summary?.order_count??0)} helper="ตามช่วงเวลาที่เลือก"/>
      <MetricCard icon={<TrendingUp/>} label="ยอดเฉลี่ยต่อบิล" value={money.format(summary?.average_ticket??0)} helper="Average ticket"/>
      <MetricCard icon={<Clock3/>} label="กะที่เปิดอยู่" value={number.format(summary?.open_shifts??0)} helper="สถานะปัจจุบัน"/>
    </section>

    <section className="splitGrid">
      <article className="panel">
        <div className="panelHeader"><div><p className="eyebrow">RECENT SALES</p><h3>บิลล่าสุด</h3></div></div>
        {orders.length ? <div className="rows">{orders.map(order=><div className="dataRow" key={order.id}><div><strong>{order.order_no||"รายการขาย"}</strong><span>{dateTime.format(new Date(order.created_at))}</span></div><div className="rowAmount"><strong>{money.format(amount(order))}</strong><span>{order.order_type||order.channel||"POS"}</span></div></div>)}</div> : <Empty>ยังไม่มีรายการขายในช่วงเวลานี้</Empty>}
      </article>
      <article className="panel">
        <div className="panelHeader"><div><p className="eyebrow">STORE HEALTH</p><h3>สถานะร้าน</h3></div></div>
        <div className="healthList">
          <div><span><Store size={18}/>สาขาที่เปิดใช้งาน</span><strong>{summary?.active_branches??0}</strong></div>
          <div><span><Boxes size={18}/>สินค้าที่เปิดขาย</span><strong>{summary?.active_products??0}</strong></div>
          <div className={(summary?.low_stock_count??0)>0?"warn":""}><span><Warehouse size={18}/>วัตถุดิบถึงจุดสั่งซื้อ</span><strong>{summary?.low_stock_count??0}</strong></div>
        </div>
      </article>
    </section>

    <article className="panel topProductsPanel">
      <div className="panelHeader"><div><p className="eyebrow">TOP PRODUCTS</p><h3>สินค้าขายดี {reportRangeLabel(range)}</h3></div></div>
      {topProducts.length ? <div className="topProductsList">{topProducts.map((item,index)=>{
        const width=Math.max(8,(Number(item.sales_total||0)/maxTopSale)*100);
        return <div className="topProductRow" key={item.name+"-"+index}>
          <div className="topProductRank">{index+1}</div>
          <div className="topProductMain">
            <div className="topProductMeta"><strong>{item.name}</strong><span>{number.format(Number(item.quantity||0))} ชิ้น · {money.format(Number(item.sales_total||0))}</span></div>
            <div className="topProductTrack"><div className="topProductBar" style={{width:`${width}%`}}/></div>
          </div>
        </div>;
      })}</div> : <Empty>ยังไม่มีข้อมูลสินค้าขายดีในช่วงเวลานี้</Empty>}
    </article>
  </>;
}

function OrderDetailModal({ order, context, onClose }: { order: OrderRow; context: PortalContext; onClose: () => void }) {
  const [items, setItems] = useState<OrderItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const branchName = context.branches.find(branch=>branch.id===order.branch_id)?.name ?? "สาขา";

  useEffect(()=>{
    let active=true;
    loadOrderItems(order.id)
      .then(rows=>{if(active)setItems(rows);})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[order.id]);

  return <div className="modalBackdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}>
    <section className="billModal" role="dialog" aria-modal="true" aria-label="รายละเอียดบิล">
      <div className="modalHeader">
        <div><p className="eyebrow">BILL DETAIL</p><h3>{order.order_no||"รายละเอียดรายการขาย"}</h3><span>{branchName} · {dateTime.format(new Date(order.created_at))}</span></div>
        <button className="iconButton" aria-label="ปิด" onClick={onClose}><X size={18}/></button>
      </div>
      <div className="billSummary">
        <div><span>ประเภท</span><strong>{order.order_type||order.channel||"POS"}</strong></div>
        <div><span>สถานะ</span><strong>{statusLabel(order.status)}</strong></div>
        <div><span>ส่วนลด</span><strong>{money.format(Number(order.discount_amount??0))}</strong></div>
        <div><span>ยอดสุทธิ</span><strong>{money.format(amount(order))}</strong></div>
      </div>
      {order.customer_name ? <div className="billCustomer">ลูกค้า: <strong>{order.customer_name}</strong></div> : null}
      <div className="billItems">
        <div className="billItemsHead"><span>รายการ</span><span>จำนวน</span><span>รวม</span></div>
        {loading ? <div className="loadingPanel compact"><LoaderCircle className="spin"/>กำลังโหลดรายการ...</div> : items.length ? items.map(item=><div className="billItem" key={item.id}><div><strong>{item.name||"สินค้า"}</strong>{item.notes?<small>{item.notes}</small>:null}</div><span>{number.format(Number(item.quantity))}</span><strong>{money.format(Number(item.line_total))}</strong></div>) : <Empty>ไม่พบรายการสินค้าในบิลนี้</Empty>}
      </div>
      <div className="billTotal"><span>ยอดรวมสุทธิ</span><strong>{money.format(amount(order))}</strong></div>
    </section>
  </div>;
}

function SalesView({ context, branchId, range }: { context: PortalContext; branchId: string | null; range: ReportRange }) {
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);
  const [error, setError] = useState("");

  useEffect(()=>{
    let active=true;
    setLoading(true);
    setError("");
    loadSales(context.tenantId,branchId,range)
      .then(data=>{if(active)setRows(data);})
      .catch(()=>{if(active)setError("ไม่สามารถโหลดรายการขายได้");})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[context.tenantId,branchId,range]);

  const branchMap=useMemo(()=>new Map(context.branches.map(branch=>[branch.id,branch.name])),[context.branches]);

  return <>
    <div className="pageHeading"><div><p className="eyebrow">SALES</p><h2>รายการขาย {reportRangeLabel(range)}</h2><p>สูงสุด 200 รายการล่าสุดตามตัวกรองที่เลือก</p></div></div>
    {error?<ErrorPanel message={error}/>:null}
    <article className="panel tablePanel">
      {loading?<div className="loadingPanel"><LoaderCircle className="spin"/>กำลังโหลดรายการขาย...</div>:rows.length?
      <div className="tableWrap"><table><thead><tr><th>เลขที่บิล</th><th>เวลา</th><th>สาขา</th><th>สถานะ</th><th className="right">ยอดรวม</th><th></th></tr></thead><tbody>
        {rows.map(row=><tr key={row.id}><td><strong>{row.order_no||"—"}</strong></td><td>{dateTime.format(new Date(row.created_at))}</td><td>{branchMap.get(row.branch_id)||"—"}</td><td><span className={`status status-${row.status}`}>{statusLabel(row.status)}</span></td><td className="right"><strong>{money.format(amount(row))}</strong></td><td className="right"><button className="tableAction" onClick={()=>setSelectedOrder(row)}><Eye size={15}/>ดูบิล</button></td></tr>)}
      </tbody></table></div>:<Empty>ยังไม่มีข้อมูลรายการขายในช่วงเวลานี้</Empty>}
    </article>
    {selectedOrder?<OrderDetailModal order={selectedOrder} context={context} onClose={()=>setSelectedOrder(null)}/>:null}
  </>;
}

function ProductsView({ context, branchId }: { context: PortalContext; branchId: string | null }) {
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(()=>{
    let active=true;setLoading(true);
    loadProducts(context.tenantId,branchId).then(data=>{if(active)setRows(data);}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[context.tenantId,branchId]);

  return <>
    <div className="pageHeading"><div><p className="eyebrow">PRODUCTS</p><h2>สินค้า</h2><p>รายการสินค้าตามสาขาที่เลือก</p></div></div>
    <article className="panel tablePanel">{loading?<div className="loadingPanel"><LoaderCircle className="spin"/>กำลังโหลดสินค้า...</div>:rows.length?
      <div className="tableWrap"><table><thead><tr><th>SKU</th><th>ชื่อสินค้า</th><th>หมวดหมู่</th><th>สถานะ</th><th className="right">ราคา</th></tr></thead><tbody>
        {rows.map(row=><tr key={row.id}><td>{row.sku||"—"}</td><td><strong>{row.name}</strong></td><td>{row.category||"—"}</td><td><span className={row.is_active?"status status-completed":"status"}>{row.is_active?"เปิดขาย":"ปิด"}</span></td><td className="right">{money.format(Number(row.price??0))}</td></tr>)}
      </tbody></table></div>:<Empty>ยังไม่มีสินค้า</Empty>}</article>
  </>;
}

function StockView({ context, branchId }: { context: PortalContext; branchId: string | null }) {
  const [rows, setRows] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(()=>{
    let active=true;setLoading(true);
    loadStock(context.tenantId,branchId).then(data=>{if(active)setRows(data);}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[context.tenantId,branchId]);

  return <>
    <div className="pageHeading"><div><p className="eyebrow">INVENTORY</p><h2>วัตถุดิบและสต๊อก</h2><p>ตรวจสอบจำนวนคงเหลือและจุดสั่งซื้อของสาขาที่เลือก</p></div></div>
    <article className="panel tablePanel">{loading?<div className="loadingPanel"><LoaderCircle className="spin"/>กำลังโหลดสต๊อก...</div>:rows.length?
      <div className="tableWrap"><table><thead><tr><th>วัตถุดิบ</th><th>หน่วย</th><th className="right">คงเหลือ</th><th className="right">จุดสั่งซื้อ</th><th>สถานะ</th></tr></thead><tbody>
        {rows.map(row=>{const low=row.reorder_level!==null&&Number(row.quantity_on_hand)<=Number(row.reorder_level);return <tr key={row.id}><td><strong>{row.name}</strong></td><td>{row.base_unit}</td><td className="right">{number.format(Number(row.quantity_on_hand))}</td><td className="right">{row.reorder_level===null?"—":number.format(Number(row.reorder_level))}</td><td><span className={low?"status status-cancelled":"status status-completed"}>{low?"ควรสั่งเพิ่ม":"ปกติ"}</span></td></tr>;})}
      </tbody></table></div>:<Empty>ยังไม่มีข้อมูลวัตถุดิบ</Empty>}</article>
  </>;
}

function StaffView({ context, branchId }: { context: PortalContext; branchId: string | null }) {
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(()=>{
    let active=true;setLoading(true);setError("");
    loadStaff(context.tenantId,branchId)
      .then(data=>{if(active)setRows(data);})
      .catch(()=>{if(active)setError("ไม่สามารถโหลดข้อมูลพนักงานได้");})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[context.tenantId,branchId]);

  return <>
    <div className="pageHeading"><div><p className="eyebrow">TEAM</p><h2>พนักงาน</h2><p>ดูรายชื่อ ตำแหน่ง บทบาท และสถานะของทีมในสาขาที่เลือก</p></div></div>
    {error?<ErrorPanel message={error}/>:null}
    <article className="panel tablePanel">{loading?<div className="loadingPanel"><LoaderCircle className="spin"/>กำลังโหลดข้อมูลพนักงาน...</div>:rows.length?
      <div className="tableWrap"><table><thead><tr><th>ชื่อ</th><th>สาขา</th><th>ตำแหน่ง</th><th>บทบาท</th><th>รหัส</th><th>สถานะ</th></tr></thead><tbody>
        {rows.map((row,index)=><tr key={`${row.user_id}-${row.branch_id}-${index}`}><td><strong>{row.full_name}</strong></td><td>{row.branch_name}</td><td>{row.position_title||"—"}</td><td>{row.branch_role==="owner"?"Owner":row.branch_role==="manager"?"Manager":row.permission_role||row.branch_role}</td><td><span className="maskedCode">{maskEmployeeCode(row.employee_code)}</span></td><td><span className={row.is_active?"status status-completed":"status status-cancelled"}>{row.is_active?"ใช้งาน":"ปิดใช้งาน"}</span></td></tr>)}
      </tbody></table></div>:<Empty>ยังไม่มีข้อมูลพนักงานในสาขาที่เลือก</Empty>}</article>
  </>;
}

function PackageView({ context }: { context: PortalContext }) {
  const [info, setInfo] = useState<PackageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(()=>{loadPackage(context.tenantId,context.role).then(setInfo).finally(()=>setLoading(false));},[context.tenantId,context.role]);
  if(loading)return <div className="loadingPanel"><LoaderCircle className="spin"/>กำลังโหลดแพ็กเกจ...</div>;
  const expiry=info?.runtime?.expires_at||info?.contract?.ended_at;
  return <>
    <div className="pageHeading"><div><p className="eyebrow">PACKAGE & BILLING</p><h2>แพ็กเกจและสิทธิ์</h2><p>ตรวจสอบสถานะสิทธิ์การใช้งานของร้าน</p></div></div>
    <section className="packageHero">
      <div><span>สถานะปัจจุบัน</span><strong>{info?.runtime?.lifecycle_status||info?.contract?.status||"—"}</strong><small>{info?.runtime?.access_locked?"การใช้งานถูกจำกัด":"ระบบพร้อมใช้งาน"}</small></div>
      <div><span>รอบชำระ</span><strong>{info?.contract?.billing_interval||"—"}</strong><small>Auto renew: {info?.contract?.auto_renew?"เปิด":"ปิด"}</small></div>
      <div><span>หมดอายุ</span><strong>{expiry?dateOnly.format(new Date(expiry)):"—"}</strong><small>{info?.runtime?.lock_reason||"ไม่มีข้อจำกัด"}</small></div>
      <div><span>ค่าบริการต่อรอบ</span><strong>{info?.contract?.amount_per_cycle==null?"—":money.format(Number(info.contract.amount_per_cycle))}</strong><small>{info?.contract?.currency||"THB"}</small></div>
    </section>
    {context.role==="owner"?<article className="panel tablePanel"><div className="panelHeader"><div><p className="eyebrow">BILLING HISTORY</p><h3>รอบบิลล่าสุด</h3></div></div>{info?.billingCycles.length?<div className="tableWrap"><table><thead><tr><th>ช่วงรอบบิล</th><th>สถานะ</th><th className="right">ยอดเรียกเก็บ</th><th className="right">ชำระแล้ว</th></tr></thead><tbody>{info.billingCycles.map((cycle,index)=><tr key={`${cycle.period_start}-${index}`}><td>{dateOnly.format(new Date(cycle.period_start))} – {dateOnly.format(new Date(cycle.period_end))}</td><td><span className={cycle.status==="paid"?"status status-completed":"status"}>{cycle.status}</span></td><td className="right">{money.format(Number(cycle.amount_due))}</td><td className="right">{money.format(Number(cycle.amount_paid))}</td></tr>)}</tbody></table></div>:<Empty>ยังไม่มีประวัติรอบบิลที่แสดงได้</Empty>}</article>:<div className="infoBox">ผู้จัดการสามารถดูสถานะแพ็กเกจได้ แต่ประวัติการชำระเงินสงวนสำหรับ Owner</div>}
  </>;
}

const nav: Array<{ id: PortalView; label: string; icon: React.ReactNode }> = [
  { id:"dashboard",label:"ภาพรวม",icon:<LayoutDashboard size={19}/> },
  { id:"sales",label:"ยอดขาย",icon:<ReceiptText size={19}/> },
  { id:"products",label:"สินค้า",icon:<Boxes size={19}/> },
  { id:"stock",label:"สต๊อก",icon:<Warehouse size={19}/> },
  { id:"staff",label:"พนักงาน",icon:<UsersRound size={19}/> },
  { id:"package",label:"แพ็กเกจ",icon:<PackageCheck size={19}/> }
];

export default function App() {
  const [context,setContext]=useState<PortalContext|null>(null);
  const [checking,setChecking]=useState(true);
  const [view,setView]=useState<PortalView>("dashboard");
  const [branchId,setBranchId]=useState(()=>localStorage.getItem("cpipos-customer-portal-branch")??"");
  const [range,setRange]=useState<ReportRange>("today");
  const [fatal,setFatal]=useState("");
  const [installPrompt,setInstallPrompt]=useState<InstallPromptEvent|null>(null);
  const [online,setOnline]=useState(()=>navigator.onLine);
  const [standalone,setStandalone]=useState(()=>window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));

  const restore=useCallback(async()=>{
    setFatal("");
    try{setContext(await loadPortalContext());}
    catch(err){const message=err instanceof Error?err.message:"";if(message!=="not_authenticated")setFatal("ไม่สามารถตรวจสอบสิทธิ์ Customer Portal ได้");setContext(null);}
    finally{setChecking(false);}
  },[]);

  useEffect(()=>{
    void restore();
    const{data}=supabase.auth.onAuthStateChange(event=>{if(event==="SIGNED_OUT")setContext(null);});
    return()=>data.subscription.unsubscribe();
  },[restore]);

  useEffect(()=>{
    if(!context)return;
    if(branchId && !context.branches.some(branch=>branch.id===branchId)){
      setBranchId("");
      localStorage.removeItem("cpipos-customer-portal-branch");
    }
  },[context,branchId]);

  useEffect(()=>{
    const beforeInstall=(event:Event)=>{const promptEvent=event as InstallPromptEvent;promptEvent.preventDefault();setInstallPrompt(promptEvent);};
    const installed=()=>{setInstallPrompt(null);setStandalone(true);};
    const goOnline=()=>setOnline(true);
    const goOffline=()=>setOnline(false);
    window.addEventListener("beforeinstallprompt",beforeInstall);
    window.addEventListener("appinstalled",installed);
    window.addEventListener("online",goOnline);
    window.addEventListener("offline",goOffline);
    return()=>{
      window.removeEventListener("beforeinstallprompt",beforeInstall);
      window.removeEventListener("appinstalled",installed);
      window.removeEventListener("online",goOnline);
      window.removeEventListener("offline",goOffline);
    };
  },[]);

  const installApp=useCallback(async()=>{
    if(!installPrompt)return;
    await installPrompt.prompt();
    const choice=await installPrompt.userChoice;
    if(choice.outcome==="accepted")setInstallPrompt(null);
  },[installPrompt]);

  const changeBranch=useCallback((value:string)=>{
    setBranchId(value);
    if(value)localStorage.setItem("cpipos-customer-portal-branch",value);
    else localStorage.removeItem("cpipos-customer-portal-branch");
  },[]);

  if(checking)return <div className="bootScreen"><img className="bootLogo" src="/cpipos-logo.png" alt="CpiPOS"/><LoaderCircle className="spin"/><span>กำลังเตรียมข้อมูลร้าน...</span></div>;
  if(!context)return <Login onSuccess={restore} canInstall={Boolean(installPrompt)&&!standalone} onInstall={installApp}/>;

  const filteredViews=view!=="package";
  const showRange=view==="dashboard"||view==="sales";

  return <div className="appShell">
    <aside className="sidebar">
      <div className="brandBlock"><img className="brandLogo" src="/cpipos-logo.png" alt="CpiPOS"/><div><strong>CpiPOS</strong><span>Customer Portal</span></div></div>
      <div className="storeCard"><div className="storeAvatar">{context.logoUrl?<img src={context.logoUrl} alt=""/>:<Store size={21}/>}</div><div><strong>{context.tenantName}</strong><span>ร้าน {context.tenantCode}</span></div></div>
      <nav>{nav.map(item=><button key={item.id} className={view===item.id?"active":""} onClick={()=>setView(item.id)}>{item.icon}<span>{item.label}</span><ChevronRight size={16}/></button>)}</nav>
      <div className="sidebarBottom">
        {installPrompt&&!standalone?<button className="sidebarInstallButton" onClick={()=>void installApp()}><Download size={16}/>ติดตั้งเว็บแอป</button>:null}
        <div className="roleBadge"><ShieldCheck size={16}/><span>{context.role==="owner"?"Owner":"Manager"}</span></div>
        <button className="logoutButton" onClick={()=>void logoutPortal()}><LogOut size={17}/>ออกจากระบบ</button>
      </div>
    </aside>

    <main className="content">
      <header className="mobileHeader">
        <div className="brandBlock"><img className="brandLogo" src="/cpipos-logo.png" alt="CpiPOS"/><div><strong>CpiPOS</strong><span>{context.tenantName}</span></div></div>
        <div className="mobileHeaderActions">{installPrompt&&!standalone?<button className="iconButton" aria-label="ติดตั้งเว็บแอป" onClick={()=>void installApp()}><Download size={18}/></button>:null}<button className="iconButton" aria-label="ออกจากระบบ" onClick={()=>void logoutPortal()}><LogOut size={18}/></button></div>
      </header>

      <div className="mobileNav">{nav.map(item=><button key={item.id} className={view===item.id?"active":""} onClick={()=>setView(item.id)}>{item.icon}<span>{item.label}</span></button>)}</div>

      {!online?<div className="offlineBanner"><WifiOff size={17}/><span>ออฟไลน์ — เปิดดูหน้าแอปได้ แต่ข้อมูลร้านจะอัปเดตเมื่อเชื่อมต่ออินเทอร์เน็ตอีกครั้ง</span></div>:null}
      {fatal?<div className="errorBox">{fatal}</div>:null}

      {filteredViews?<FilterBar context={context} branchId={branchId} onBranchChange={changeBranch} range={range} onRangeChange={setRange} showRange={showRange}/>:null}

      {view==="dashboard"?<DashboardView context={context} branchId={branchId||null} range={range}/>:null}
      {view==="sales"?<SalesView context={context} branchId={branchId||null} range={range}/>:null}
      {view==="products"?<ProductsView context={context} branchId={branchId||null}/>:null}
      {view==="stock"?<StockView context={context} branchId={branchId||null}/>:null}
      {view==="staff"?<StaffView context={context} branchId={branchId||null}/>:null}
      {view==="package"?<PackageView context={context}/>:null}

      <footer>ข้อมูลถูกจำกัดตามสิทธิ์ของ {context.role==="owner"?"เจ้าของร้าน":"ผู้จัดการ"} · {context.branches.length} สาขาที่เข้าถึงได้</footer>
    </main>
  </div>;
}
