import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Banknote, Bell, Boxes, Building2, CalendarDays, ChefHat, ChevronLeft, ChevronRight,
  CircleAlert, Clock3, CreditCard, Download, Eye, FileText, History, LayoutDashboard,
  LoaderCircle, LogOut, Menu, MonitorSmartphone, MoreHorizontal, PackageCheck,
  PanelLeftClose, PanelLeftOpen, Pencil, Plus, Printer, ReceiptText, RefreshCw, Save,
  Search, Settings, ShieldCheck, Store, Table2, Trash2, TrendingUp, UserRoundCheck,
  UsersRound, Warehouse, WifiOff, X
} from "lucide-react";
import {
  cancelOrder, createStaff, deleteProduct, deleteStock, loadDashboard, loadFeatureState,
  loadOrderItems, loadPackage, loadPortalContext, loadProducts, loadSales, loadSettingsSnapshot,
  loadStaff, loadStock, loginWithStoreEmployeeCode, logoutPortal, reportRangeLabel, saveProduct,
  saveStock, submitPackagePayment, todayInputValue, updateOrder, updateStaff,
  type DashboardSummary, type FeatureState, type OrderItemRow, type OrderRow, type PackageInfo,
  type PortalContext, type PortalView, type ProductDraft, type ProductRow, type ReportRange,
  type SettingsSnapshot, type StaffDraft, type StaffRow, type StockDraft, type StockRow
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
  return ({ completed: "สำเร็จ", cancelled: "ยกเลิก", queued: "รอดำเนินการ", preparing: "กำลังเตรียม", draft: "ฉบับร่าง" } as Record<string, string>)[status] ?? status;
}

function maskEmployeeCode(value: string | null) {
  if (!value) return "—";
  if (value.length <= 2) return "••";
  return `${"•".repeat(Math.max(2, value.length - 2))}${value.slice(-2)}`;
}

function branchName(context: PortalContext, branchId: string) {
  return context.branches.find((branch) => branch.id === branchId)?.name ?? "สาขา";
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
        <span><ShieldCheck size={19}/> สำหรับเจ้าของร้านและผู้จัดการ</span>
        <span><UserRoundCheck size={19}/> ใช้งานพร้อมกันได้หลายเครื่อง</span>
        <span><TrendingUp size={19}/> ติดตามข้อมูลร้านได้ทุกที่ทุกเวลา</span>
      </div>
    </section>
    <section className="loginCard">
      <div className="loginLogoWrap"><img className="loginLogo" src="/cpipos-logo.png" alt="CpiPOS" /></div>
      <div><p className="eyebrow">WELCOME BACK</p><h2>เข้าสู่ระบบร้านค้า</h2><p className="muted">ใช้รหัสร้าน และรหัสพนักงานของเจ้าของร้านหรือผู้จัดการ</p></div>
      <form onSubmit={submit}>
        <label><span>รหัสร้าน</span><input autoComplete="username" value={storeCode} onChange={e=>setStoreCode(e.target.value)} placeholder="เช่น 900001" maxLength={32} required/></label>
        <label><span>รหัสพนักงาน</span><input autoComplete="off" inputMode="text" type="text" value={employeeCode} onChange={e=>setEmployeeCode(e.target.value.replace(/[^A-Za-z0-9._-]/g,"").slice(0,32))} placeholder="เช่น 182536" minLength={2} maxLength={32} required/></label>
        {error ? <div className="errorBox"><CircleAlert size={18}/>{error}</div> : null}
        <button className="primaryButton" disabled={busy}>{busy?<LoaderCircle className="spin" size={19}/>:null}{busy?"กำลังตรวจสอบ...":"เข้าสู่ระบบ"}</button>
      </form>
      {canInstall ? <button type="button" className="installButton" onClick={() => void onInstall()}><Download size={18}/>ติดตั้ง CpiPOS เป็นเว็บแอป</button> : null}
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
  return <div className="errorPanel"><CircleAlert size={19}/><span>{message}</span></div>;
}

function Pagination({page,pageCount,onPageChange,disabled=false}:{page:number;pageCount:number;onPageChange:(page:number)=>void;disabled?:boolean}) {
  if(pageCount<=1)return null;
  const current=page+1;
  const pages:Array<number|string>=[];
  const add=(value:number|string)=>{if(pages[pages.length-1]!==value)pages.push(value);};
  const candidates=new Set([1,pageCount,current-2,current-1,current,current+1,current+2].filter(value=>typeof value==="number"&&value>=1&&value<=pageCount) as number[]);
  let last=0;
  [...candidates].sort((a,b)=>a-b).forEach(value=>{if(last&&value-last>1)add("…");add(value);last=value;});
  return <div className="paginationBar">
    <button className="secondaryButton" disabled={page<=0||disabled} onClick={()=>onPageChange(Math.max(0,page-1))}><ChevronLeft size={17}/>ก่อนหน้า</button>
    <div className="pageNumbers">{pages.map((item,index)=>item==="…"?<span key={"ellipsis-"+index}>…</span>:<button key={item} disabled={disabled} className={Number(item)===current?"active":""} onClick={()=>onPageChange(Number(item)-1)}>{item}</button>)}</div>
    <button className="secondaryButton" disabled={page+1>=pageCount||disabled} onClick={()=>onPageChange(Math.min(pageCount-1,page+1))}>ถัดไป<ChevronRight size={17}/></button>
  </div>;
}

function Modal({
  title,
  subtitle,
  onClose,
  children,
  wide=false
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return <div className="modalBackdrop" role="presentation" onMouseDown={(event)=>{if(event.target===event.currentTarget)onClose();}}>
    <section className={`formModal ${wide?"wide":""}`} role="dialog" aria-modal="true">
      <div className="modalHeader">
        <div><h3>{title}</h3>{subtitle?<span>{subtitle}</span>:null}</div>
        <button className="iconButton" aria-label="ปิด" onClick={onClose}><X size={20}/></button>
      </div>
      {children}
    </section>
  </div>;
}

function FilterBar({
  context,
  branchId,
  onBranchChange,
  range,
  onRangeChange,
  anchor,
  onAnchorChange,
  showPeriod
}: {
  context: PortalContext;
  branchId: string;
  onBranchChange: (value: string) => void;
  range: ReportRange;
  onRangeChange: (value: ReportRange) => void;
  anchor: string;
  onAnchorChange: (value: string) => void;
  showPeriod: boolean;
}) {
  return <div className="portalFilters">
    <label className="branchFilter">
      <Store size={18}/>
      <span>สาขา</span>
      <select value={branchId} onChange={e=>onBranchChange(e.target.value)}>
        <option value="">ทุกสาขาที่เข้าถึงได้</option>
        {context.branches.map(branch=><option key={branch.id} value={branch.id}>{branch.name}</option>)}
      </select>
    </label>
    {showPeriod ? <div className="reportControls">
      <label className="anchorPicker"><CalendarDays size={17}/><input type="date" value={anchor} onChange={e=>onAnchorChange(e.target.value)}/></label>
      <div className="rangeTabs" aria-label="ช่วงเวลารายงาน">
        {(["day","month","year"] as ReportRange[]).map(item=><button key={item} className={range===item?"active":""} onClick={()=>onRangeChange(item)}>{item==="day"?"รายวัน":item==="month"?"รายเดือน":"รายปี"}</button>)}
      </div>
    </div> : null}
  </div>;
}

function DashboardView({ context, branchId, range, anchor }: { context: PortalContext; branchId: string | null; range: ReportRange; anchor: string }) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await loadDashboard(context.tenantId, branchId, range, anchor);
      setSummary(data.summary);
      setOrders(data.recentOrders);
    } catch {
      setError("ไม่สามารถโหลดข้อมูลภาพรวมได้ กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  }, [context.tenantId, branchId, range, anchor]);

  useEffect(() => { void refresh(); }, [refresh]);

  const topProducts = summary?.top_products ?? [];
  const maxTopSale = Math.max(1, ...topProducts.map(item=>Number(item.sales_total || 0)));
  const periodLabel = reportRangeLabel(range, anchor);

  if (loading && !summary) return <div className="loadingPanel"><LoaderCircle className="spin"/>กำลังโหลด Dashboard...</div>;

  return <>
    <div className="pageHeading">
      <div><p className="eyebrow">SALES OVERVIEW</p><h2>ภาพรวม</h2><p>ยอดขายและสถานะการดำเนินงานตามสาขาและช่วงเวลาที่เลือก</p></div>
      <button className="ghostButton" onClick={()=>void refresh()}><RefreshCw size={18}/>รีเฟรช</button>
    </div>
    {error ? <ErrorPanel message={error}/> : null}
    <section className="metricsGrid">
      <MetricCard icon={<Banknote/>} label="ยอดขาย" value={money.format(summary?.sales_total??0)} helper={periodLabel}/>
      <MetricCard icon={<ReceiptText/>} label="จำนวนบิล" value={number.format(summary?.order_count??0)} helper="เฉพาะรายการในช่วงที่เลือก"/>
      <MetricCard icon={<TrendingUp/>} label="ยอดเฉลี่ยต่อบิล" value={money.format(summary?.average_ticket??0)} helper="Average ticket"/>
      <MetricCard icon={<Clock3/>} label="กะที่เปิดอยู่" value={number.format(summary?.open_shifts??0)} helper="สถานะปัจจุบัน"/>
    </section>

    <section className="splitGrid">
      <article className="panel">
        <div className="panelHeader"><div><p className="eyebrow">RECENT SALES</p><h3>บิลล่าสุด</h3></div></div>
        {orders.length ? <div className="rows dashboardScroll">{orders.map(order=><div className="dataRow" key={order.id}><div><strong>{order.order_no||"รายการขาย"}</strong><span>{dateTime.format(new Date(order.created_at))}</span></div><div className="rowAmount"><strong>{money.format(amount(order))}</strong><span>{order.order_type||order.channel||"POS"}</span></div></div>)}</div> : <Empty>ยังไม่มีรายการขายในช่วงเวลานี้</Empty>}
      </article>
      <article className="panel">
        <div className="panelHeader"><div><p className="eyebrow">STORE HEALTH</p><h3>สถานะร้าน</h3></div></div>
        <div className="healthList">
          <div><span><Store size={19}/>สาขาที่เปิดใช้งาน</span><strong>{summary?.active_branches??0}</strong></div>
          <div><span><Boxes size={19}/>สินค้าที่เปิดขาย</span><strong>{summary?.active_products??0}</strong></div>
          <div className={(summary?.low_stock_count??0)>0?"warn":""}><span><Warehouse size={19}/>วัตถุดิบถึงจุดสั่งซื้อ</span><strong>{summary?.low_stock_count??0}</strong></div>
        </div>
      </article>
    </section>

    <article className="panel topProductsPanel">
      <div className="panelHeader"><div><p className="eyebrow">TOP PRODUCTS</p><h3>สินค้าขายดี</h3></div></div>
      {topProducts.length ? <div className="topProductsList dashboardScroll">{topProducts.map((item,index)=>{
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

function OrderDetailModal({
  order,
  context,
  onClose,
  onChanged
}: {
  order: OrderRow;
  context: PortalContext;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [items, setItems] = useState<OrderItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing,setEditing]=useState(false);
  const [customerName,setCustomerName]=useState(order.customer_name??"");
  const [notes,setNotes]=useState(order.notes??"");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");

  useEffect(()=>{
    let active=true;
    loadOrderItems(order.id)
      .then(rows=>{if(active)setItems(rows);})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[order.id]);

  async function save(){
    setBusy(true);setError("");
    try{
      await updateOrder(context.tenantId,order,customerName,notes);
      await onChanged();
      setEditing(false);
    }catch(err){setError(err instanceof Error?err.message:"บันทึกไม่สำเร็จ");}
    finally{setBusy(false);}
  }

  async function cancel(){
    if(order.status==="cancelled")return;
    const reason=window.prompt("ระบุเหตุผลการยกเลิกบิล","ยกเลิกจาก Customer Portal");
    if(reason===null)return;
    if(!window.confirm("ยืนยันยกเลิกบิลนี้? ระบบจะคืนสต๊อกตาม transaction ของ POS"))return;
    setBusy(true);setError("");
    try{
      await cancelOrder(context.tenantId,order,reason);
      await onChanged();
      onClose();
    }catch(err){setError(err instanceof Error?err.message:"ยกเลิกบิลไม่สำเร็จ");}
    finally{setBusy(false);}
  }

  return <Modal title={order.order_no||"รายละเอียดรายการขาย"} subtitle={`${branchName(context,order.branch_id)} · ${dateTime.format(new Date(order.created_at))}`} onClose={onClose} wide>
    <div className="modalBody">
      {error?<ErrorPanel message={error}/>:null}
      <div className="billSummary">
        <div><span>ประเภท</span><strong>{order.order_type||order.channel||"POS"}</strong></div>
        <div><span>สถานะ</span><strong>{statusLabel(order.status)}</strong></div>
        <div><span>ส่วนลด</span><strong>{money.format(Number(order.discount_amount??0))}</strong></div>
        <div><span>ยอดสุทธิ</span><strong>{money.format(amount(order))}</strong></div>
      </div>

      <div className="editableBillMeta">
        <label><span>ชื่อลูกค้า</span><input disabled={!editing} maxLength={180} value={customerName} onChange={e=>setCustomerName(e.target.value)} placeholder="ไม่ระบุ"/></label>
        <label><span>หมายเหตุ</span><textarea disabled={!editing} maxLength={1000} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="หมายเหตุรายการขาย"/></label>
      </div>

      <div className="billItems">
        <div className="billItemsHead"><span>รายการ</span><span>จำนวน</span><span>รวม</span></div>
        {loading ? <div className="loadingPanel compact"><LoaderCircle className="spin"/>กำลังโหลดรายการ...</div> : items.length ? items.map(item=><div className="billItem" key={item.id}><div><strong>{item.name||"สินค้า"}</strong>{item.notes?<small>{item.notes}</small>:null}</div><span>{number.format(Number(item.quantity))}</span><strong>{money.format(Number(item.line_total))}</strong></div>) : <Empty>ไม่พบรายการสินค้าในบิลนี้</Empty>}
      </div>
      <div className="billTotal"><span>ยอดรวมสุทธิ</span><strong>{money.format(amount(order))}</strong></div>
    </div>
    <div className="modalActions">
      {editing?<button className="secondaryButton" onClick={()=>setEditing(false)} disabled={busy}>ยกเลิกการแก้ไข</button>:<button className="secondaryButton" onClick={()=>setEditing(true)}><Pencil size={17}/>แก้ไขข้อมูล</button>}
      {editing?<button className="primaryAction" onClick={()=>void save()} disabled={busy}><Save size={17}/>{busy?"กำลังบันทึก...":"บันทึก"}</button>:null}
      {order.status!=="cancelled"?<button className="dangerButton" onClick={()=>void cancel()} disabled={busy}><Trash2 size={17}/>ยกเลิกบิล</button>:null}
    </div>
  </Modal>;
}

function SalesView({ context, branchId, range, anchor }: { context: PortalContext; branchId: string | null; range: ReportRange; anchor: string }) {
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);
  const [error, setError] = useState("");
  const [query,setQuery]=useState("");
  const [page,setPage]=useState(0);
  const [totalCount,setTotalCount]=useState(0);
  const [salesTotal,setSalesTotal]=useState(0);
  const pageSize=20;
  const requestIdRef=useRef(0);

  useEffect(()=>{setPage(0);},[context.tenantId,branchId,range,anchor]);

  const refresh=useCallback(async()=>{
    const requestId=++requestIdRef.current;
    setLoading(true);setError("");
    try{
      const result=await loadSales(context.tenantId,branchId,range,anchor,page,pageSize);
      if(requestId!==requestIdRef.current)return;
      setRows(result.rows);
      setTotalCount(result.total);
      setSalesTotal(result.salesTotal);
    }
    catch{
      if(requestId===requestIdRef.current)setError("ไม่สามารถโหลดรายการขายได้");
    }
    finally{
      if(requestId===requestIdRef.current)setLoading(false);
    }
  },[context.tenantId,branchId,range,anchor,page]);

  useEffect(()=>{void refresh();},[refresh]);

  const branchMap=useMemo(()=>new Map(context.branches.map(branch=>[branch.id,branch.name])),[context.branches]);
  const filtered=rows.filter(row=>{
    const q=query.trim().toLowerCase();
    if(!q)return true;
    return [row.order_no,row.customer_name,row.channel,row.order_type,branchMap.get(row.branch_id)].some(value=>String(value??"").toLowerCase().includes(q));
  });
  const pageCount=Math.max(1,Math.ceil(totalCount/pageSize));
  const pageLabel=totalCount
    ? String(page*pageSize+1)+"–"+String(Math.min((page+1)*pageSize,totalCount))+" จาก "+number.format(totalCount)
    : "0 รายการ";

  return <>
    <div className="pageHeading">
      <div><p className="eyebrow">SALES</p><h2>รายการขาย</h2><p>ดูรายวัน รายเดือน หรือรายปี พร้อมแก้ข้อมูลประกอบและยกเลิกบิลแบบคืนสต๊อก</p></div>
      <div className="headingStat"><span>ยอดขายรวมช่วงนี้</span><strong>{money.format(salesTotal)}</strong></div>
    </div>
    <div className="toolbar"><label className="searchBox"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="ค้นหาในหน้าปัจจุบัน..."/></label><span className="toolbarCount">{pageLabel}</span></div>
    {error?<ErrorPanel message={error}/>:null}
    <article className="panel tablePanel">
      {loading?<div className="loadingPanel"><LoaderCircle className="spin"/>กำลังโหลดรายการขาย...</div>:filtered.length?
      <div className="tableWrap"><table><thead><tr><th>เลขที่บิล</th><th>เวลา</th><th>สาขา</th><th>สถานะ</th><th className="right">ยอดรวม</th><th></th></tr></thead><tbody>
        {filtered.map(row=><tr key={row.id}><td><strong>{row.order_no||"—"}</strong></td><td>{dateTime.format(new Date(row.created_at))}</td><td>{branchMap.get(row.branch_id)||"—"}</td><td><span className={`status status-${row.status}`}>{statusLabel(row.status)}</span></td><td className="right"><strong>{money.format(amount(row))}</strong></td><td className="right"><button className="tableAction" onClick={()=>setSelectedOrder(row)}><Eye size={16}/>ดู/จัดการ</button></td></tr>)}
      </tbody></table></div>:<Empty>ยังไม่มีข้อมูลรายการขายในช่วงเวลานี้</Empty>}
      <Pagination page={page} pageCount={pageCount} onPageChange={setPage} disabled={loading}/>
    </article>
    <div className="auditNote">รายการขายใหม่สร้างจาก POS เพื่อรักษา payment/shift/stock transaction ให้ถูกต้อง; Customer Portal รองรับแก้ไขข้อมูลประกอบและยกเลิกบิลอย่างปลอดภัย</div>
    {selectedOrder?<OrderDetailModal order={selectedOrder} context={context} onClose={()=>setSelectedOrder(null)} onChanged={refresh}/>:null}
  </>;
}

function ProductForm({
  context,
  initial,
  defaultBranch,
  onClose,
  onSaved
}:{
  context:PortalContext;
  initial:ProductRow|null;
  defaultBranch:string;
  onClose:()=>void;
  onSaved:()=>Promise<void>;
}){
  const [draft,setDraft]=useState<ProductDraft>(()=>({
    id:initial?.id??null,
    branch_id:initial?.branch_id||defaultBranch||context.branches[0]?.id||"",
    sku:initial?.sku??"",
    name:initial?.name??"",
    category:initial?.category??"",
    price:Number(initial?.price??0),
    is_active:initial?.is_active??true,
    sell_unit:initial?.sell_unit??"unit",
    stock_deduction_mode:initial?.stock_deduction_mode??"unit_only"
  }));
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");

  async function submit(event:React.FormEvent){
    event.preventDefault();setBusy(true);setError("");
    try{await saveProduct(context.tenantId,draft);await onSaved();onClose();}
    catch(err){setError(err instanceof Error?err.message:"บันทึกสินค้าไม่สำเร็จ");}
    finally{setBusy(false);}
  }

  return <Modal title={initial?"แก้ไขสินค้า":"เพิ่มสินค้า"} subtitle="ข้อมูลจะใช้ร่วมกับฝั่ง POS" onClose={onClose}>
    <form className="entityForm" onSubmit={submit}>
      {error?<ErrorPanel message={error}/>:null}
      <div className="formGrid">
        <label className="span2"><span>สาขา</span><select value={draft.branch_id} onChange={e=>setDraft({...draft,branch_id:e.target.value})} disabled={Boolean(initial)} required>{context.branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
        <label><span>รหัสสินค้า (SKU)</span><input value={draft.sku} onChange={e=>setDraft({...draft,sku:e.target.value})} required/></label>
        <label><span>ราคา</span><input type="number" min="0" step="0.01" value={draft.price} onChange={e=>setDraft({...draft,price:Number(e.target.value)})} required/></label>
        <label className="span2"><span>ชื่อสินค้า</span><input value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})} required/></label>
        <label><span>หมวดหมู่</span><input value={draft.category} onChange={e=>setDraft({...draft,category:e.target.value})} required/></label>
        <label><span>หน่วยขาย</span><input value={draft.sell_unit} onChange={e=>setDraft({...draft,sell_unit:e.target.value})}/></label>
        <label className="span2"><span>การตัดสต๊อก</span><select value={draft.stock_deduction_mode} onChange={e=>setDraft({...draft,stock_deduction_mode:e.target.value})}><option value="unit_only">ตามหน่วยสินค้า</option><option value="recipe_deduction">ตามสูตรวัตถุดิบ</option></select></label>
        <label className="switchField span2"><input type="checkbox" checked={draft.is_active} onChange={e=>setDraft({...draft,is_active:e.target.checked})}/><span>เปิดขายสินค้า</span></label>
      </div>
      <div className="modalActions"><button type="button" className="secondaryButton" onClick={onClose}>ยกเลิก</button><button className="primaryAction" disabled={busy}><Save size={17}/>{busy?"กำลังบันทึก...":"บันทึกสินค้า"}</button></div>
    </form>
  </Modal>;
}

function ProductsView({ context, branchId }: { context: PortalContext; branchId: string | null }) {
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query,setQuery]=useState("");
  const [editing,setEditing]=useState<ProductRow|null|undefined>(undefined);
  const [error,setError]=useState("");

  const refresh=useCallback(async()=>{
    setLoading(true);setError("");
    try{setRows(await loadProducts(context.tenantId,branchId));}
    catch{setError("ไม่สามารถโหลดสินค้าได้");}
    finally{setLoading(false);}
  },[context.tenantId,branchId]);

  useEffect(()=>{void refresh();},[refresh]);

  const filtered=rows.filter(row=>{
    const q=query.trim().toLowerCase();
    return !q||[row.sku,row.name,row.category].some(value=>String(value??"").toLowerCase().includes(q));
  });

  async function remove(row:ProductRow){
    if(!window.confirm(`ลบสินค้า “${row.name}” ? สินค้าจะถูก soft-delete และเก็บประวัติไว้`))return;
    try{await deleteProduct(context.tenantId,row);await refresh();}
    catch(err){setError(err instanceof Error?err.message:"ลบสินค้าไม่สำเร็จ");}
  }

  return <>
    <div className="pageHeading"><div><p className="eyebrow">PRODUCTS</p><h2>สินค้า</h2><p>รูปสินค้า รหัสสินค้า ราคา สถานะ และจำนวนพร้อมขายจากสูตรวัตถุดิบ</p></div><button className="primaryAction" onClick={()=>setEditing(null)}><Plus size={18}/>เพิ่มสินค้า</button></div>
    <div className="toolbar"><label className="searchBox"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="ค้นหา SKU ชื่อสินค้า หมวดหมู่..."/></label><span className="toolbarCount">{filtered.length} รายการ</span></div>
    {error?<ErrorPanel message={error}/>:null}
    <article className="panel productPanel">{loading?<div className="loadingPanel"><LoaderCircle className="spin"/>กำลังโหลดสินค้า...</div>:filtered.length?
      <div className="productGrid">{filtered.map(row=><article className="productCard" key={row.id}>
        <div className="productImage">{row.image_url?<img src={row.image_url} alt={row.name} loading="lazy"/>:<Boxes size={30}/>}<span className={row.is_active?"activeDot":"inactiveDot"}/></div>
        <div className="productBody">
          <div className="productCode">{row.sku}</div>
          <h3>{row.name}</h3>
          <p>{row.category}</p>
          <div className="productStats"><div><span>ราคา</span><strong>{money.format(Number(row.price))}</strong></div><div><span>จำนวน</span><strong>{row.available_quantity==null?"—":number.format(Number(row.available_quantity))}</strong></div></div>
          <div className="productMeta"><span>{branchName(context,row.branch_id)}</span><span>{row.recipe_count>0?`สูตร ${row.recipe_count}`:"ไม่มีสูตร"}</span></div>
          <div className="cardActions"><button onClick={()=>setEditing(row)}><Pencil size={16}/>แก้ไข</button><button className="dangerText" onClick={()=>void remove(row)}><Trash2 size={16}/>ลบ</button></div>
        </div>
      </article>)}</div>:<Empty>ยังไม่มีสินค้า</Empty>}</article>
    {editing!==undefined?<ProductForm context={context} initial={editing} defaultBranch={branchId??""} onClose={()=>setEditing(undefined)} onSaved={refresh}/>:null}
  </>;
}

function StockForm({
  context,initial,defaultBranch,onClose,onSaved
}:{
  context:PortalContext;initial:StockRow|null;defaultBranch:string;onClose:()=>void;onSaved:()=>Promise<void>;
}){
  const [draft,setDraft]=useState<StockDraft>(()=>({
    id:initial?.id??null,
    branch_id:initial?.branch_id||defaultBranch||context.branches[0]?.id||"",
    name:initial?.name??"",
    base_unit:initial?.base_unit??"ชิ้น",
    quantity_on_hand:Number(initial?.quantity_on_hand??0),
    reorder_level:Number(initial?.reorder_level??0),
    avg_unit_cost:Number(initial?.avg_unit_cost??0),
    last_purchase_unit_cost:Number(initial?.last_purchase_unit_cost??0)
  }));
  const [busy,setBusy]=useState(false);const[error,setError]=useState("");
  async function submit(event:React.FormEvent){
    event.preventDefault();setBusy(true);setError("");
    try{await saveStock(context.tenantId,draft);await onSaved();onClose();}
    catch(err){setError(err instanceof Error?err.message:"บันทึกสต๊อกไม่สำเร็จ");}
    finally{setBusy(false);}
  }
  return <Modal title={initial?"แก้ไขวัตถุดิบ/สต๊อก":"เพิ่มวัตถุดิบ"} subtitle="การเปลี่ยนจำนวนจะบันทึก Stock Movement อัตโนมัติ" onClose={onClose}>
    <form className="entityForm" onSubmit={submit}>
      {error?<ErrorPanel message={error}/>:null}
      <div className="formGrid">
        <label className="span2"><span>สาขา</span><select value={draft.branch_id} onChange={e=>setDraft({...draft,branch_id:e.target.value})} disabled={Boolean(initial)} required>{context.branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
        <label className="span2"><span>ชื่อวัตถุดิบ</span><input value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})} required/></label>
        <label><span>หน่วย</span><input value={draft.base_unit} onChange={e=>setDraft({...draft,base_unit:e.target.value})} required/></label>
        <label><span>จำนวนคงเหลือ</span><input type="number" min="0" step="0.001" value={draft.quantity_on_hand} onChange={e=>setDraft({...draft,quantity_on_hand:Number(e.target.value)})}/></label>
        <label><span>จุดสั่งซื้อ</span><input type="number" min="0" step="0.001" value={draft.reorder_level} onChange={e=>setDraft({...draft,reorder_level:Number(e.target.value)})}/></label>
        <label><span>ต้นทุนเฉลี่ย</span><input type="number" min="0" step="0.01" value={draft.avg_unit_cost} onChange={e=>setDraft({...draft,avg_unit_cost:Number(e.target.value)})}/></label>
        <label className="span2"><span>ต้นทุนซื้อล่าสุด</span><input type="number" min="0" step="0.01" value={draft.last_purchase_unit_cost} onChange={e=>setDraft({...draft,last_purchase_unit_cost:Number(e.target.value)})}/></label>
      </div>
      <div className="modalActions"><button type="button" className="secondaryButton" onClick={onClose}>ยกเลิก</button><button className="primaryAction" disabled={busy}><Save size={17}/>{busy?"กำลังบันทึก...":"บันทึกสต๊อก"}</button></div>
    </form>
  </Modal>;
}

function StockView({ context, branchId }: { context: PortalContext; branchId: string | null }) {
  const [rows, setRows] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query,setQuery]=useState("");
  const [editing,setEditing]=useState<StockRow|null|undefined>(undefined);
  const [error,setError]=useState("");

  const refresh=useCallback(async()=>{
    setLoading(true);setError("");
    try{setRows(await loadStock(context.tenantId,branchId));}
    catch{setError("ไม่สามารถโหลดสต๊อกได้");}
    finally{setLoading(false);}
  },[context.tenantId,branchId]);
  useEffect(()=>{void refresh();},[refresh]);

  const filtered=rows.filter(row=>!query.trim()||row.name.toLowerCase().includes(query.trim().toLowerCase()));

  async function remove(row:StockRow){
    if(!window.confirm(`ลบวัตถุดิบ “${row.name}” ? หากมีสูตรหรือประวัติสต๊อก ระบบจะไม่อนุญาตให้ลบ`))return;
    try{await deleteStock(context.tenantId,row);await refresh();}
    catch(err){setError(err instanceof Error?err.message:"ลบวัตถุดิบไม่สำเร็จ");}
  }

  return <>
    <div className="pageHeading"><div><p className="eyebrow">INVENTORY</p><h2>วัตถุดิบและสต๊อก</h2><p>ดูจำนวนคงเหลือ จุดสั่งซื้อ ต้นทุน และปรับสต๊อกพร้อมบันทึก movement</p></div><button className="primaryAction" onClick={()=>setEditing(null)}><Plus size={18}/>เพิ่มวัตถุดิบ</button></div>
    <div className="toolbar"><label className="searchBox"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="ค้นหาวัตถุดิบ..."/></label><span className="toolbarCount">{filtered.length} รายการ</span></div>
    {error?<ErrorPanel message={error}/>:null}
    <article className="panel tablePanel">{loading?<div className="loadingPanel"><LoaderCircle className="spin"/>กำลังโหลดสต๊อก...</div>:filtered.length?
      <div className="tableWrap"><table><thead><tr><th>วัตถุดิบ</th><th>สาขา</th><th>หน่วย</th><th className="right">คงเหลือ</th><th className="right">จุดสั่งซื้อ</th><th className="right">ต้นทุนเฉลี่ย</th><th>สถานะ</th><th></th></tr></thead><tbody>
        {filtered.map(row=>{const low=Number(row.quantity_on_hand)<=Number(row.reorder_level);return <tr key={row.id}><td><strong>{row.name}</strong></td><td>{branchName(context,row.branch_id)}</td><td>{row.base_unit}</td><td className="right">{number.format(Number(row.quantity_on_hand))}</td><td className="right">{number.format(Number(row.reorder_level))}</td><td className="right">{money.format(Number(row.avg_unit_cost))}</td><td><span className={low?"status status-cancelled":"status status-completed"}>{low?"ควรสั่งเพิ่ม":"ปกติ"}</span></td><td className="right"><div className="inlineActions"><button className="tableAction" onClick={()=>setEditing(row)}><Pencil size={15}/>แก้ไข</button><button className="tableAction dangerText" onClick={()=>void remove(row)}><Trash2 size={15}/>ลบ</button></div></td></tr>;})}
      </tbody></table></div>:<Empty>ยังไม่มีข้อมูลวัตถุดิบ</Empty>}</article>
    {editing!==undefined?<StockForm context={context} initial={editing} defaultBranch={branchId??""} onClose={()=>setEditing(undefined)} onSaved={refresh}/>:null}
  </>;
}

function StaffForm({
  context,initial,defaultBranch,onClose,onSaved
}:{
  context:PortalContext;initial:StaffRow|null;defaultBranch:string;onClose:()=>void;onSaved:()=>Promise<void>;
}){
  const [draft,setDraft]=useState<StaffDraft>(()=>({
    user_id:initial?.user_id??null,
    branch_id:initial?.branch_id||defaultBranch||context.branches[0]?.id||"",
    full_name:initial?.full_name??"",
    employee_code:initial?.employee_code??"",
    position_title:initial?.position_title??"",
    permission_role:initial?.permission_role??"pos_user",
    branch_role:initial?.branch_role??"staff",
    is_active:initial?.is_active??true
  }));
  const [busy,setBusy]=useState(false);const[error,setError]=useState("");
  const roleOptions=context.role==="owner"?["owner","manager","staff","kitchen"]:["staff","kitchen"];

  async function submit(event:React.FormEvent){
    event.preventDefault();setBusy(true);setError("");
    try{
      if(initial)await updateStaff(context.tenantId,draft);
      else await createStaff(context.tenantId,draft);
      await onSaved();onClose();
    }catch(err){setError(err instanceof Error?err.message:"บันทึกพนักงานไม่สำเร็จ");}
    finally{setBusy(false);}
  }

  return <Modal title={initial?"แก้ไขพนักงาน":"เพิ่มพนักงาน"} subtitle="สิทธิ์ Owner/Manager จัดการตามขอบเขตสาขา" onClose={onClose}>
    <form className="entityForm" onSubmit={submit}>
      {error?<ErrorPanel message={error}/>:null}
      <div className="formGrid">
        <label className="span2"><span>สาขา</span><select value={draft.branch_id} onChange={e=>setDraft({...draft,branch_id:e.target.value})} disabled={Boolean(initial)} required>{context.branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
        <label className="span2"><span>ชื่อพนักงาน</span><input value={draft.full_name} onChange={e=>setDraft({...draft,full_name:e.target.value})} required/></label>
        <label><span>รหัสพนักงาน</span><input value={draft.employee_code} onChange={e=>setDraft({...draft,employee_code:e.target.value.replace(/[^A-Za-z0-9._-]/g,"")})} required/></label>
        <label><span>ตำแหน่ง</span><input value={draft.position_title} onChange={e=>setDraft({...draft,position_title:e.target.value})}/></label>
        <label><span>บทบาทสาขา</span><select value={draft.branch_role} onChange={e=>setDraft({...draft,branch_role:e.target.value})}>{roleOptions.map(role=><option key={role} value={role}>{role}</option>)}</select></label>
        <label><span>Permission profile</span><input value={draft.permission_role} onChange={e=>setDraft({...draft,permission_role:e.target.value})}/></label>
        {initial?<label className="switchField span2"><input type="checkbox" checked={draft.is_active} onChange={e=>setDraft({...draft,is_active:e.target.checked})}/><span>เปิดใช้งานบัญชี</span></label>:null}
      </div>
      <div className="modalActions"><button type="button" className="secondaryButton" onClick={onClose}>ยกเลิก</button><button className="primaryAction" disabled={busy}><Save size={17}/>{busy?"กำลังบันทึก...":"บันทึกพนักงาน"}</button></div>
    </form>
  </Modal>;
}

function StaffView({ context, branchId }: { context: PortalContext; branchId: string | null }) {
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query,setQuery]=useState("");
  const [editing,setEditing]=useState<StaffRow|null|undefined>(undefined);
  const [error,setError]=useState("");

  const refresh=useCallback(async()=>{
    setLoading(true);setError("");
    try{setRows(await loadStaff(context.tenantId,branchId));}
    catch{setError("ไม่สามารถโหลดข้อมูลพนักงานได้");}
    finally{setLoading(false);}
  },[context.tenantId,branchId]);
  useEffect(()=>{void refresh();},[refresh]);

  const filtered=rows.filter(row=>{
    const q=query.trim().toLowerCase();
    return !q||[row.full_name,row.position_title,row.branch_name,row.branch_role,row.employee_code].some(value=>String(value??"").toLowerCase().includes(q));
  });

  async function deactivate(row:StaffRow){
    if(!window.confirm(`ปิดใช้งาน “${row.full_name}” ? ประวัติรายการเดิมจะยังคงอยู่`))return;
    try{
      await updateStaff(context.tenantId,{
        user_id:row.user_id,branch_id:row.branch_id,full_name:row.full_name,
        employee_code:row.employee_code??"",position_title:row.position_title??"",
        permission_role:row.permission_role??"pos_user",branch_role:row.branch_role,is_active:false
      });
      await refresh();
    }catch(err){setError(err instanceof Error?err.message:"ปิดใช้งานพนักงานไม่สำเร็จ");}
  }

  return <>
    <div className="pageHeading"><div><p className="eyebrow">TEAM</p><h2>พนักงาน</h2><p>เพิ่ม แก้ไข ปิดใช้งาน และกำหนดบทบาทตามสิทธิ์ Owner/Manager</p></div><button className="primaryAction" onClick={()=>setEditing(null)}><Plus size={18}/>เพิ่มพนักงาน</button></div>
    <div className="toolbar"><label className="searchBox"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="ค้นหาชื่อ รหัสพนักงาน ตำแหน่ง..."/></label><span className="toolbarCount">{filtered.length} รายการ</span></div>
    {error?<ErrorPanel message={error}/>:null}
    <article className="panel tablePanel">{loading?<div className="loadingPanel"><LoaderCircle className="spin"/>กำลังโหลดข้อมูลพนักงาน...</div>:filtered.length?
      <div className="tableWrap"><table><thead><tr><th>ชื่อ</th><th>สาขา</th><th>ตำแหน่ง</th><th>บทบาท</th><th>รหัส</th><th>สถานะ</th><th></th></tr></thead><tbody>
        {filtered.map((row,index)=>{const canEdit=context.role==="owner"||!["owner","manager"].includes(row.branch_role);return <tr key={`${row.user_id}-${row.branch_id}-${index}`}><td><strong>{row.full_name}</strong></td><td>{row.branch_name}</td><td>{row.position_title||"—"}</td><td>{row.branch_role}</td><td><span className="maskedCode">{maskEmployeeCode(row.employee_code)}</span></td><td><span className={row.is_active?"status status-completed":"status status-cancelled"}>{row.is_active?"ใช้งาน":"ปิดใช้งาน"}</span></td><td className="right">{canEdit?<div className="inlineActions"><button className="tableAction" onClick={()=>setEditing(row)}><Pencil size={15}/>แก้ไข</button>{row.is_active?<button className="tableAction dangerText" onClick={()=>void deactivate(row)}><Trash2 size={15}/>ปิดใช้</button>:null}</div>:<span className="mutedSmall">Owner เท่านั้น</span>}</td></tr>;})}
      </tbody></table></div>:<Empty>ยังไม่มีข้อมูลพนักงานในสาขาที่เลือก</Empty>}</article>
    {editing!==undefined?<StaffForm context={context} initial={editing} defaultBranch={branchId??""} onClose={()=>setEditing(undefined)} onSaved={refresh}/>:null}
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
    <div className="auditNote">สิทธิ์แพ็กเกจและสัญญาเป็นข้อมูลการค้า จึงแก้ไขจาก Customer Portal ไม่ได้ และต้องจัดการจากฝ่าย IT/สัญญาเพื่อป้องกันการเปลี่ยนสิทธิ์โดยไม่ตั้งใจ</div>
  </>;
}

const nav: Array<{ id: PortalView; label: string; icon: React.ReactNode }> = [
  { id:"dashboard",label:"ภาพรวม",icon:<LayoutDashboard size={21}/> },
  { id:"sales",label:"ยอดขาย",icon:<ReceiptText size={21}/> },
  { id:"products",label:"สินค้า",icon:<Boxes size={21}/> },
  { id:"stock",label:"สต๊อก",icon:<Warehouse size={21}/> },
  { id:"staff",label:"พนักงาน",icon:<UsersRound size={21}/> },
  { id:"package",label:"แพ็กเกจ",icon:<PackageCheck size={21}/> }
];

export default function App() {
  const [context,setContext]=useState<PortalContext|null>(null);
  const [checking,setChecking]=useState(true);
  const [view,setView]=useState<PortalView>("dashboard");
  const [branchId,setBranchId]=useState(()=>localStorage.getItem("cpipos-customer-portal-branch")??"");
  const [range,setRange]=useState<ReportRange>("day");
  const [anchor,setAnchor]=useState(todayInputValue());
  const [fatal,setFatal]=useState("");
  const [installPrompt,setInstallPrompt]=useState<InstallPromptEvent|null>(null);
  const [online,setOnline]=useState(()=>navigator.onLine);
  const [standalone,setStandalone]=useState(()=>window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
  const [collapsed,setCollapsed]=useState(()=>localStorage.getItem("cpipos-sidebar-collapsed")==="1");
  const [mobileOpen,setMobileOpen]=useState(false);

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
    const beforeInstall=(event:Event)=>{
      if(standalone)return;
      const promptEvent=event as InstallPromptEvent;
      promptEvent.preventDefault();
      setInstallPrompt(promptEvent);
    };
    const appInstalled=()=>{
      setInstallPrompt(null);
      setStandalone(true);
    };
    const goOnline=()=>setOnline(true);
    const goOffline=()=>setOnline(false);
    window.addEventListener("beforeinstallprompt",beforeInstall);
    window.addEventListener("appinstalled",appInstalled);
    window.addEventListener("online",goOnline);
    window.addEventListener("offline",goOffline);
    return()=>{
      window.removeEventListener("beforeinstallprompt",beforeInstall);
      window.removeEventListener("appinstalled",appInstalled);
      window.removeEventListener("online",goOnline);
      window.removeEventListener("offline",goOffline);
    };
  },[standalone]);

  const installApp=useCallback(async()=>{
    if(!installPrompt)return;
    await installPrompt.prompt();
    const choice=await installPrompt.userChoice;
    if(choice.outcome==="accepted") setInstallPrompt(null);
  },[installPrompt]);

  const changeBranch=useCallback((value:string)=>{
    setBranchId(value);
    if(value)localStorage.setItem("cpipos-customer-portal-branch",value);
    else localStorage.removeItem("cpipos-customer-portal-branch");
  },[]);

  const toggleCollapsed=useCallback(()=>{
    setCollapsed(value=>{
      const next=!value;
      localStorage.setItem("cpipos-sidebar-collapsed",next?"1":"0");
      return next;
    });
  },[]);

  const chooseView=(next:PortalView)=>{setView(next);setMobileOpen(false);};

  if(checking)return <div className="bootScreen"><img className="bootLogo" src="/cpipos-logo.png" alt="CpiPOS"/><LoaderCircle className="spin"/><span>กำลังเตรียมข้อมูลร้าน...</span></div>;
  if(!context)return <Login onSuccess={restore} canInstall={Boolean(installPrompt)&&!standalone} onInstall={installApp}/>;

  const showFilters=view!=="package";
  const showPeriod=view==="dashboard"||view==="sales";
  const canInstall=Boolean(installPrompt)&&!standalone;

  return <div className={`appShell ${collapsed?"sidebarCollapsed":""}`}>
    {mobileOpen?<button className="drawerBackdrop" aria-label="ปิดเมนู" onClick={()=>setMobileOpen(false)}/>:null}
    <aside className={`sidebar ${mobileOpen?"mobileOpen":""}`}>
      <div className="sidebarTop">
        <div className="brandBlock"><img className="brandLogo" src="/cpipos-logo.png" alt="CpiPOS"/><div><strong>CpiPOS</strong><span>Customer Portal</span></div></div>
        <button className="collapseButton" aria-label={collapsed?"ขยายเมนู":"ย่อเมนู"} onClick={toggleCollapsed}>{collapsed?<PanelLeftOpen size={20}/>:<PanelLeftClose size={20}/>}</button>
      </div>
      <div className="storeCard"><div className="storeAvatar">{context.logoUrl?<img src={context.logoUrl} alt=""/>:<Store size={22}/>}</div><div><strong>{context.tenantName}</strong><span>ร้าน {context.tenantCode}</span></div></div>
      <nav>{nav.map(item=><button key={item.id} title={collapsed?item.label:undefined} className={view===item.id?"active":""} onClick={()=>chooseView(item.id)}>{item.icon}<span>{item.label}</span><ChevronRight size={17}/></button>)}</nav>
      <div className="sidebarBottom">
        {canInstall?<button className="sidebarInstallButton" onClick={()=>void installApp()}><Download size={17}/><span>ติดตั้งเว็บแอป</span></button>:null}
        <div className="roleBadge"><ShieldCheck size={17}/><span>{context.role==="owner"?"Owner":"Manager"}</span></div>
        <button className="logoutButton" onClick={()=>void logoutPortal()}><LogOut size={18}/><span>ออกจากระบบ</span></button>
      </div>
    </aside>

    <main className="content">
      <header className="mobileHeader">
        <button className="iconButton" aria-label="เปิดเมนู" onClick={()=>setMobileOpen(true)}><Menu size={21}/></button>
        <div className="brandBlock"><img className="brandLogo" src="/cpipos-logo.png" alt="CpiPOS"/><div><strong>CpiPOS</strong><span>{context.tenantName}</span></div></div>
        <div className="mobileHeaderActions">{canInstall?<button className="iconButton" aria-label="ติดตั้งเว็บแอป" onClick={()=>void installApp()}><Download size={19}/></button>:null}<button className="iconButton" aria-label="ออกจากระบบ" onClick={()=>void logoutPortal()}><LogOut size={19}/></button></div>
      </header>

      {!online?<div className="offlineBanner"><WifiOff size={18}/><span>ออฟไลน์ — หน้าแอปยังเปิดได้ แต่ข้อมูลร้านและการบันทึกจะทำงานอีกครั้งเมื่อเชื่อมต่ออินเทอร์เน็ต</span></div>:null}
      {fatal?<div className="errorBox">{fatal}</div>:null}

      {showFilters?<FilterBar context={context} branchId={branchId} onBranchChange={changeBranch} range={range} onRangeChange={setRange} anchor={anchor} onAnchorChange={setAnchor} showPeriod={showPeriod}/>:null}

      {view==="dashboard"?<DashboardView context={context} branchId={branchId||null} range={range} anchor={anchor}/>:null}
      {view==="sales"?<SalesView context={context} branchId={branchId||null} range={range} anchor={anchor}/>:null}
      {view==="products"?<ProductsView context={context} branchId={branchId||null}/>:null}
      {view==="stock"?<StockView context={context} branchId={branchId||null}/>:null}
      {view==="staff"?<StaffView context={context} branchId={branchId||null}/>:null}
      {view==="package"?<PackageView context={context}/>:null}

      <footer>ข้อมูลและสิทธิ์ถูกจำกัดตามบัญชี {context.role==="owner"?"Owner":"Manager"} · {context.branches.length} สาขาที่เข้าถึงได้</footer>
    </main>
  </div>;
}
