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
  loadMoreSnapshot, loadOrderItems, loadPackage, loadPortalContext, loadProducts, loadSales, loadSettingsSnapshot,
  loadStaff, loadStock, loginWithStoreEmployeeCode, logoutPortal, reportRangeLabel, saveProduct,
  saveSetting, saveStock, submitPackagePayment, todayInputValue, updateOrder, updateStaff,
  type DashboardSummary, type FeatureState, type MoreSnapshot, type OrderItemRow, type OrderRow, type PackageInfo,
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
  const [page,setPage]=useState(0);
  const pageSize=20;

  const refresh=useCallback(async()=>{
    setLoading(true);setError("");
    try{setRows(await loadProducts(context.tenantId,branchId));}
    catch{setError("ไม่สามารถโหลดสินค้าได้");}
    finally{setLoading(false);}
  },[context.tenantId,branchId]);

  useEffect(()=>{void refresh();},[refresh]);
  useEffect(()=>{setPage(0);},[branchId,query]);

  const filtered=rows.filter(row=>{
    const q=query.trim().toLowerCase();
    return !q||[row.sku,row.name,row.category].some(value=>String(value??"").toLowerCase().includes(q));
  });
  const pageCount=Math.max(1,Math.ceil(filtered.length/pageSize));
  const visible=filtered.slice(page*pageSize,(page+1)*pageSize);

  async function remove(row:ProductRow){
    if(!window.confirm(`ลบสินค้า “${row.name}” ? สินค้าจะถูก soft-delete และเก็บประวัติไว้`))return;
    try{await deleteProduct(context.tenantId,row);await refresh();}
    catch(err){setError(err instanceof Error?err.message:"ลบสินค้าไม่สำเร็จ");}
  }

  return <>
    <div className="pageHeading"><div><p className="eyebrow">PRODUCTS</p><h2>สินค้า</h2><p>ตรวจสอบรหัสสินค้า รูป ราคา จำนวนพร้อมขาย สาขา และสถานะในตารางเดียว</p></div><button className="primaryAction" onClick={()=>setEditing(null)}><Plus size={18}/>เพิ่มสินค้า</button></div>
    <div className="toolbar"><label className="searchBox"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="ค้นหา SKU ชื่อสินค้า หมวดหมู่..."/></label><span className="toolbarCount">{filtered.length} รายการ</span></div>
    {error?<ErrorPanel message={error}/>:null}
    <article className="panel tablePanel productTablePanel">{loading?<div className="loadingPanel"><LoaderCircle className="spin"/>กำลังโหลดสินค้า...</div>:visible.length?
      <div className="tableWrap boundedTable"><table className="productTable"><thead><tr><th>รูป</th><th>รหัสสินค้า</th><th>ชื่อสินค้า</th><th>หมวดหมู่</th><th>สาขา</th><th className="right">ราคา</th><th className="right">จำนวน</th><th>หน่วย</th><th>สถานะ</th><th></th></tr></thead><tbody>
        {visible.map(row=><tr key={row.id}>
          <td><div className="tableThumb">{row.image_url?<img src={row.image_url} alt={row.name} loading="lazy"/>:<Boxes size={19}/>}</div></td>
          <td><strong className="monoCode">{row.sku}</strong></td>
          <td><strong>{row.name}</strong></td>
          <td>{row.category||"—"}</td>
          <td>{branchName(context,row.branch_id)}</td>
          <td className="right"><strong>{money.format(Number(row.price))}</strong></td>
          <td className="right">{row.available_quantity==null?"—":number.format(Number(row.available_quantity))}</td>
          <td>{row.sell_unit||"unit"}</td>
          <td><span className={row.is_active?"status status-completed":"status status-cancelled"}>{row.is_active?"เปิดขาย":"ปิดขาย"}</span></td>
          <td className="right"><div className="inlineActions"><button className="tableAction" onClick={()=>setEditing(row)}><Pencil size={15}/>แก้ไข</button><button className="tableAction dangerText" onClick={()=>void remove(row)}><Trash2 size={15}/>ลบ</button></div></td>
        </tr>)}
      </tbody></table></div>:<Empty>ยังไม่มีสินค้า</Empty>}
      <Pagination page={page} pageCount={pageCount} onPageChange={setPage} disabled={loading}/>
    </article>
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

function stockDisplay(row:StockRow){
  const match=row.name.match(/^STOCK:([^:]+):(.+)$/i);
  return {
    code:match?.[1]??("ING-"+row.id.slice(0,8).toUpperCase()),
    name:match?.[2]??row.name
  };
}

function StockView({ context, branchId }: { context: PortalContext; branchId: string | null }) {
  const [rows, setRows] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query,setQuery]=useState("");
  const [editing,setEditing]=useState<StockRow|null|undefined>(undefined);
  const [error,setError]=useState("");
  const [page,setPage]=useState(0);
  const pageSize=20;

  const refresh=useCallback(async()=>{
    setLoading(true);setError("");
    try{setRows(await loadStock(context.tenantId,branchId));}
    catch{setError("ไม่สามารถโหลดข้อมูลวัตถุดิบได้");}
    finally{setLoading(false);}
  },[context.tenantId,branchId]);
  useEffect(()=>{void refresh();},[refresh]);
  useEffect(()=>{setPage(0);},[branchId,query]);

  const filtered=rows.filter(row=>{
    const q=query.trim().toLowerCase();
    const display=stockDisplay(row);
    return !q||display.name.toLowerCase().includes(q)||display.code.toLowerCase().includes(q);
  });
  const pageCount=Math.max(1,Math.ceil(filtered.length/pageSize));
  const visible=filtered.slice(page*pageSize,(page+1)*pageSize);

  async function remove(row:StockRow){
    const display=stockDisplay(row);
    if(!window.confirm(`ลบวัตถุดิบ “${display.name}” ? หากมีสูตรหรือประวัติสต๊อก ระบบจะไม่อนุญาตให้ลบ`))return;
    try{await deleteStock(context.tenantId,row);await refresh();}
    catch(err){setError(err instanceof Error?err.message:"ลบวัตถุดิบไม่สำเร็จ");}
  }

  return <>
    <div className="pageHeading"><div><p className="eyebrow">INVENTORY</p><h2>วัตถุดิบ</h2><p>ตรวจสอบรหัส ชื่อ สาขา หน่วย คงเหลือ จุดสั่งซื้อ ต้นทุนเฉลี่ย และสถานะ</p></div><button className="primaryAction" onClick={()=>setEditing(null)}><Plus size={18}/>เพิ่มวัตถุดิบ</button></div>
    <div className="toolbar"><label className="searchBox"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="ค้นหารหัสหรือชื่อวัตถุดิบ..."/></label><span className="toolbarCount">{filtered.length} รายการ</span></div>
    {error?<ErrorPanel message={error}/>:null}
    <article className="panel tablePanel">{loading?<div className="loadingPanel"><LoaderCircle className="spin"/>กำลังโหลดวัตถุดิบ...</div>:visible.length?
      <div className="tableWrap boundedTable"><table><thead><tr><th>รหัสสินค้า</th><th>ชื่อสินค้า</th><th>สาขา</th><th>หน่วย</th><th className="right">คงเหลือ</th><th className="right">จุดสั่งซื้อ</th><th className="right">ต้นทุนเฉลี่ย</th><th>สถานะ</th><th></th></tr></thead><tbody>
        {visible.map(row=>{const low=Number(row.quantity_on_hand)<=Number(row.reorder_level);const display=stockDisplay(row);return <tr key={row.id}>
          <td><strong className="monoCode">{display.code}</strong></td><td><strong>{display.name}</strong></td>
          <td>{branchName(context,row.branch_id)}</td><td>{row.base_unit}</td>
          <td className="right">{number.format(Number(row.quantity_on_hand))}</td>
          <td className="right">{number.format(Number(row.reorder_level))}</td>
          <td className="right">{money.format(Number(row.avg_unit_cost))}</td>
          <td><span className={low?"status status-cancelled":"status status-completed"}>{low?"ควรสั่งเพิ่ม":"ปกติ"}</span></td>
          <td className="right"><div className="inlineActions"><button className="tableAction" onClick={()=>setEditing(row)}><Pencil size={15}/>แก้ไข</button><button className="tableAction dangerText" onClick={()=>void remove(row)}><Trash2 size={15}/>ลบ</button></div></td>
        </tr>;})}
      </tbody></table></div>:<Empty>ยังไม่มีข้อมูลวัตถุดิบ</Empty>}
      <Pagination page={page} pageCount={pageCount} onPageChange={setPage} disabled={loading}/>
    </article>
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
    is_active:initial?.is_active??true,
    pin:""
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
        <label className="span2"><span>รหัส PIN</span><input type="password" inputMode="numeric" autoComplete="new-password" value={draft.pin??""} onChange={e=>setDraft({...draft,pin:e.target.value.replace(/\D/g,"").slice(0,12)})} minLength={draft.pin?4:undefined} maxLength={12} placeholder={initial?"4–12 หลัก · เว้นว่างหากไม่เปลี่ยน":"4–12 หลัก (ไม่บังคับ)"}/><small>PIN ถูกเข้ารหัสฝั่งระบบและไม่สามารถเปิดดูย้อนหลังได้</small></label>
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
  const [page,setPage]=useState(0);
  const pageSize=20;

  const refresh=useCallback(async()=>{
    setLoading(true);setError("");
    try{setRows(await loadStaff(context.tenantId,branchId));}
    catch{setError("ไม่สามารถโหลดข้อมูลพนักงานได้");}
    finally{setLoading(false);}
  },[context.tenantId,branchId]);
  useEffect(()=>{void refresh();},[refresh]);
  useEffect(()=>{setPage(0);},[branchId,query]);

  const filtered=rows.filter(row=>{
    const q=query.trim().toLowerCase();
    return !q||[row.full_name,row.position_title,row.branch_name,row.branch_role,row.employee_code].some(value=>String(value??"").toLowerCase().includes(q));
  });
  const pageCount=Math.max(1,Math.ceil(filtered.length/pageSize));
  const visible=filtered.slice(page*pageSize,(page+1)*pageSize);

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
    <div className="pageHeading"><div><p className="eyebrow">TEAM</p><h2>พนักงาน</h2><p>เพิ่ม แก้ไข PIN ปิดใช้งาน และกำหนดบทบาทตามสิทธิ์ Owner/Manager</p></div><button className="primaryAction" onClick={()=>setEditing(null)}><Plus size={18}/>เพิ่มพนักงาน</button></div>
    <div className="toolbar"><label className="searchBox"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="ค้นหาชื่อ รหัสพนักงาน ตำแหน่ง..."/></label><span className="toolbarCount">{filtered.length} รายการ</span></div>
    {error?<ErrorPanel message={error}/>:null}
    <article className="panel tablePanel">{loading?<div className="loadingPanel"><LoaderCircle className="spin"/>กำลังโหลดข้อมูลพนักงาน...</div>:visible.length?
      <div className="tableWrap boundedTable"><table><thead><tr><th>ชื่อ</th><th>สาขา</th><th>ตำแหน่ง</th><th>บทบาท</th><th>รหัสพนักงาน</th><th>สถานะ</th><th></th></tr></thead><tbody>
        {visible.map((row,index)=>{const canEdit=context.role==="owner"||!["owner","manager"].includes(row.branch_role);return <tr key={`${row.user_id}-${row.branch_id}-${index}`}><td><strong>{row.full_name}</strong></td><td>{row.branch_name}</td><td>{row.position_title||"—"}</td><td>{row.branch_role}</td><td><span className="maskedCode">{maskEmployeeCode(row.employee_code)}</span></td><td><span className={row.is_active?"status status-completed":"status status-cancelled"}>{row.is_active?"ใช้งาน":"ปิดใช้งาน"}</span></td><td className="right">{canEdit?<div className="inlineActions"><button className="tableAction" onClick={()=>setEditing(row)}><Pencil size={15}/>แก้ไข</button>{row.is_active?<button className="tableAction dangerText" onClick={()=>void deactivate(row)}><Trash2 size={15}/>ปิดใช้</button>:null}</div>:<span className="mutedSmall">Owner เท่านั้น</span>}</td></tr>;})}
      </tbody></table></div>:<Empty>ยังไม่มีข้อมูลพนักงานในสาขาที่เลือก</Empty>}
      <Pagination page={page} pageCount={pageCount} onPageChange={setPage} disabled={loading}/>
    </article>
    {editing!==undefined?<StaffForm context={context} initial={editing} defaultBranch={branchId??""} onClose={()=>setEditing(undefined)} onSaved={refresh}/>:null}
  </>;
}

function billingStatusLabel(status:string){
  return ({
    paid:"ชำระแล้ว",pending:"รอชำระ/ตรวจสอบ",under_review:"กำลังตรวจสอบ",
    open:"รอชำระ",due:"รอชำระ",overdue:"เกินกำหนด",cancelled:"ยกเลิก",
    active:"ใช้งาน",trial:"ทดลองใช้งาน",locked:"ระงับใช้งาน"
  } as Record<string,string>)[status]??status;
}

function PackagePaymentModal({
  tenantId,info,cycle,onClose,onSaved
}:{
  tenantId:string;
  info:PackageInfo;
  cycle:PackageInfo["billingCycles"][number]|null;
  onClose:()=>void;
  onSaved:()=>Promise<void>;
}){
  const [slip,setSlip]=useState<File|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const contract=info.contract;
  const expected=cycle?Math.max(0,Number(cycle.amount_due)-Number(cycle.amount_paid)):Number(contract?.amount_per_cycle??0);
  const packageId=contract?.package_id??"";

  async function submit(event:React.FormEvent){
    event.preventDefault();
    if(!slip||!packageId)return;
    setBusy(true);setError("");
    try{
      await submitPackagePayment({
        tenantId,
        billingCycleId:cycle?.id??null,
        packageId,
        billingInterval:contract?.billing_interval??"monthly",
        expectedAmount:expected,
        slip
      });
      await onSaved();
      onClose();
    }catch(err){setError(err instanceof Error?err.message:"ส่งหลักฐานการชำระไม่สำเร็จ");}
    finally{setBusy(false);}
  }

  return <Modal title="ชำระค่าบริการแพ็กเกจ" subtitle="ส่งหลักฐานให้ฝ่าย IT ตรวจสอบเงินเข้าก่อนอัปเดตสิทธิ์" onClose={onClose}>
    <form className="entityForm" onSubmit={submit}>
      {error?<ErrorPanel message={error}/>:null}
      <div className="paymentSummary">
        <div><span>แพ็กเกจ</span><strong>{contract?.package_name||contract?.package_code||"CpiPOS"}</strong></div>
        <div><span>ยอดที่ต้องชำระ</span><strong>{money.format(expected)}</strong></div>
        {cycle?<div><span>รอบบิล</span><strong>{dateOnly.format(new Date(cycle.period_start))} – {dateOnly.format(new Date(cycle.period_end))}</strong></div>:null}
      </div>
      <div className="issuerBox">
        <strong>{info.issuer?.billing_legal_name_th||"บัญชีรับชำระค่าบริการ CpiPOS"}</strong>
        <span>{info.issuer?.billing_bank_name||"ธนาคาร"} · {info.issuer?.billing_bank_account_name||"บัญชีบริษัท"}</span>
        <b>{info.issuer?.billing_bank_account_number||info.issuer?.billing_promptpay_id||"กรุณาติดต่อฝ่าย Support"}</b>
      </div>
      <div className="formGrid singleColumn">
        <label><span>แนบสลิปการโอน</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setSlip(e.target.files?.[0]??null)} required/><small>รองรับ JPG, PNG และ WebP ไม่เกิน 4 MB</small></label>
      </div>
      <div className="modalActions"><button type="button" className="secondaryButton" onClick={onClose}>ยกเลิก</button><button className="primaryAction" disabled={busy||!slip||expected<=0}>{busy?<LoaderCircle className="spin" size={17}/>:<CreditCard size={17}/>}ส่งหลักฐานชำระเงิน</button></div>
    </form>
  </Modal>;
}

function PackageView({ context }: { context: PortalContext }) {
  const [info,setInfo]=useState<PackageInfo|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [paying,setPaying]=useState<PackageInfo["billingCycles"][number]|null|undefined>(undefined);

  const refresh=useCallback(async()=>{
    setLoading(true);setError("");
    try{
      const data=await loadPackage(context.tenantId,context.role);
      setInfo(data);
    }catch{setError("ไม่สามารถโหลดข้อมูลแพ็กเกจได้");}
    finally{setLoading(false);}
  },[context.tenantId,context.role]);
  useEffect(()=>{void refresh();},[refresh]);
  if(loading&&!info)return <div className="loadingPanel"><LoaderCircle className="spin"/>กำลังโหลดแพ็กเกจ...</div>;

  const expiry=info?.runtime?.expires_at||info?.contract?.ended_at;
  const daysRemaining=expiry?Math.ceil((new Date(expiry).getTime()-Date.now())/86400000):null;
  const openRequest=info?.requests.find(row=>["pending","under_review"].includes(row.status));
  const dueCycles=(info?.billingCycles??[]).filter(cycle=>cycle.status!=="paid"&&Number(cycle.amount_due)>Number(cycle.amount_paid));
  const canUpcoming=Boolean(context.role==="owner"&&!openRequest&&!dueCycles.length&&info?.contract?.package_id&&Number(info.contract.amount_per_cycle)>0&&daysRemaining!==null&&daysRemaining<=7);
  const status=info?.runtime?.lifecycle_status||info?.contract?.status||"—";
  const interval=info?.contract?.billing_interval==="yearly"?"รายปี":info?.contract?.billing_interval==="monthly"?"รายเดือน":info?.contract?.billing_interval||"—";

  return <>
    <div className="pageHeading"><div><p className="eyebrow">PACKAGE & BILLING</p><h2>แพ็กเกจและการชำระเงิน</h2><p>สถานะสิทธิ์ รอบบิล และรายการชำระเชื่อมกับระบบ POS/IT ชุดเดียวกัน</p></div><button className="ghostButton" onClick={()=>void refresh()}><RefreshCw size={18}/>รีเฟรช</button></div>
    {error?<ErrorPanel message={error}/>:null}
    <section className="packageHero packageHeroFive">
      <div><span>แพ็กเกจ</span><strong>{info?.contract?.package_name||info?.contract?.package_code||"—"}</strong><small>{info?.contract?.package_code||"แพ็กเกจปัจจุบัน"}</small></div>
      <div><span>สถานะ</span><strong>{billingStatusLabel(status)}</strong><small>{info?.runtime?.access_locked?"การใช้งานถูกจำกัด":"ระบบพร้อมใช้งาน"}</small></div>
      <div><span>รอบชำระ</span><strong>{interval}</strong><small>Auto renew: {info?.contract?.auto_renew?"เปิด":"ปิด"}</small></div>
      <div><span>หมดอายุ</span><strong>{expiry?dateOnly.format(new Date(expiry)):"—"}</strong><small>{daysRemaining===null?"ไม่กำหนด":daysRemaining<0?`เกินกำหนด ${Math.abs(daysRemaining)} วัน`:`เหลือ ${daysRemaining} วัน`}</small></div>
      <div><span>ค่าบริการต่อรอบ</span><strong>{info?.contract?.amount_per_cycle==null?"—":money.format(Number(info.contract.amount_per_cycle))}</strong><small>{info?.contract?.currency||"THB"}</small></div>
    </section>

    {openRequest?<div className="billingAlert"><Clock3 size={20}/><div><strong>รายการกำลังรอตรวจสอบ</strong><span>{billingStatusLabel(openRequest.status)} · {openRequest.package_name||info?.contract?.package_name||"แพ็กเกจ"} · ส่งเมื่อ {dateTime.format(new Date(openRequest.submitted_at))}</span></div></div>:null}
    {canUpcoming?<div className="billingAlert warning"><CreditCard size={20}/><div><strong>ใกล้ถึงรอบชำระค่าบริการ</strong><span>ยอด {money.format(Number(info?.contract?.amount_per_cycle??0))} · กรุณาชำระและส่งสลิปเพื่อให้ IT ตรวจสอบ</span></div><button className="primaryAction" onClick={()=>setPaying(null)}>ชำระเงิน</button></div>:null}

    {context.role==="owner"?<article className="panel tablePanel"><div className="panelHeader"><div><p className="eyebrow">BILLING HISTORY</p><h3>รายการรอบบิล</h3></div></div>{info?.billingCycles.length?<div className="tableWrap boundedTable"><table><thead><tr><th>ช่วงรอบบิล</th><th>สถานะ</th><th className="right">ยอดเรียกเก็บ</th><th className="right">ชำระแล้ว</th><th className="right">คงค้าง</th><th></th></tr></thead><tbody>{info.billingCycles.map(cycle=>{const outstanding=Math.max(0,Number(cycle.amount_due)-Number(cycle.amount_paid));const payable=cycle.status!=="paid"&&outstanding>0&&!openRequest;return <tr key={cycle.id}><td>{dateOnly.format(new Date(cycle.period_start))} – {dateOnly.format(new Date(cycle.period_end))}</td><td><span className={cycle.status==="paid"?"status status-completed":"status status-pending"}>{billingStatusLabel(cycle.status)}</span></td><td className="right">{money.format(Number(cycle.amount_due))}</td><td className="right">{money.format(Number(cycle.amount_paid))}</td><td className="right"><strong>{money.format(outstanding)}</strong></td><td className="right">{payable?<button className="tableAction payAction" onClick={()=>setPaying(cycle)}><CreditCard size={15}/>ชำระเงิน</button>:null}</td></tr>;})}</tbody></table></div>:<Empty>ยังไม่มีประวัติรอบบิลที่แสดงได้</Empty>}</article>:<div className="infoBox">Manager ดูสถานะแพ็กเกจได้ ส่วนการชำระเงินและประวัติหลักฐานสงวนสำหรับ Owner</div>}

    {context.role==="owner"&&info?.requests.length?<article className="panel tablePanel"><div className="panelHeader"><div><p className="eyebrow">PAYMENT REQUESTS</p><h3>สถานะการชำระและคำขอ</h3></div></div><div className="tableWrap"><table><thead><tr><th>วันที่ส่ง</th><th>แพ็กเกจ</th><th>ประเภท</th><th>สถานะ</th><th>หลักฐาน</th></tr></thead><tbody>{info.requests.map(row=><tr key={row.id}><td>{dateTime.format(new Date(row.submitted_at))}</td><td>{row.package_name||"—"}</td><td>{row.request_type}</td><td><span className={["pending","under_review"].includes(row.status)?"status status-pending":"status"}>{billingStatusLabel(row.status)}</span></td><td>{row.has_evidence?"ส่งแล้ว":"—"}</td></tr>)}</tbody></table></div></article>:null}
    <div className="auditNote">CRM ส่งเฉพาะคำขอและหลักฐานไปยัง billing control plane เดิม การอนุมัติเงินจริง การออกใบเสร็จ และการเปลี่ยนสิทธิ์ยังดำเนินการโดย POS/IT ตามขั้นตอนเดิม</div>
    {paying!==undefined&&info?<PackagePaymentModal tenantId={context.tenantId} info={info} cycle={paying} onClose={()=>setPaying(undefined)} onSaved={refresh}/>:null}
  </>;
}

type MoreItem={key:string;label:string;desc:string;feature:string;target?:PortalView;icon:React.ReactNode};
const moreItems:MoreItem[]=[
  {key:"more.sales_summary",label:"สรุปยอดขาย",desc:"ยอดขาย ภาษี และภาพรวมการดำเนินงาน",feature:"advanced_sales_reports",target:"dashboard",icon:<TrendingUp/>},
  {key:"more.receipts",label:"ใบเสร็จย้อนหลัง",desc:"ค้นหาและตรวจสอบรายการขายย้อนหลัง",feature:"receipt_reprint_history",target:"sales",icon:<ReceiptText/>},
  {key:"more.tables",label:"จัดการโต๊ะ",desc:"โต๊ะ โซน และผังร้านสำหรับโหมดนั่งโต๊ะ",feature:"table_management",icon:<Table2/>},
  {key:"more.kitchen_manage",label:"จัดการครัว",desc:"โซนครัว เส้นทางอาหาร และสถานะ KDS",feature:"kitchen_printing",icon:<ChefHat/>},
  {key:"more.stock",label:"จัดการสินค้า",desc:"สินค้า วัตถุดิบ ราคา และสต๊อก",feature:"stock_management",target:"products",icon:<Boxes/>},
  {key:"more.buffet",label:"ตั้งค่าราคาบุฟเฟ่",desc:"ข้อมูลราคาบุฟเฟ่ที่ใช้ร่วมกับ POS",feature:"table_management",icon:<Banknote/>},
  {key:"more.members",label:"สมาชิก",desc:"ข้อมูลสมาชิกหน้าร้าน",feature:"core_pos_sales",icon:<UsersRound/>},
  {key:"more.tax_invoices",label:"ออกใบกำกับภาษี",desc:"ข้อมูลใบกำกับภาษีจากรายการขาย",feature:"core_pos_sales",target:"sales",icon:<FileText/>},
  {key:"more.product_sales",label:"รายการขายสินค้า",desc:"รายการสินค้าที่ขายและสินค้าขายดี",feature:"advanced_sales_reports",target:"sales",icon:<History/>},
  {key:"more.ai_documents",label:"เก็บไฟล์เอกสาร",desc:"เอกสารและรายงานจาก CpiPOS AI",feature:"cpipos_ai",icon:<FileText/>}
];

function MoreView({context,branchId,onNavigate}:{context:PortalContext;branchId:string|null;onNavigate:(view:PortalView)=>void}){
  const [state,setState]=useState<FeatureState|null>(null);
  const [snapshot,setSnapshot]=useState<MoreSnapshot|null>(null);
  const [error,setError]=useState("");
  useEffect(()=>{Promise.all([loadFeatureState(context.tenantId,branchId),loadMoreSnapshot(context.tenantId,branchId)]).then(([features,data])=>{setState(features);setSnapshot(data);}).catch(()=>setError("ไม่สามารถตรวจสอบสิทธิ์เมนูเพิ่มเติมได้"));},[context.tenantId,branchId]);
  const enabled=(item:MoreItem)=>{
    const menu=state?.menu_policy?.[item.key]!==false;
    const base=state?.package_features?.[item.feature]??false;
    const override=state?.feature_overrides?.[item.feature];
    return menu&&(override===undefined?base:override);
  };
  return <>
    <div className="pageHeading"><div><p className="eyebrow">MORE</p><h2>เพิ่มเติม</h2><p>เมนูชุดเดียวกับ POS โดยตรวจสิทธิ์แพ็กเกจและนโยบายจาก IT ก่อนแสดงการใช้งาน</p></div></div>
    {error?<ErrorPanel message={error}/>:null}
    <div className="moduleGrid">{moreItems.map(item=>{const allowed=state?enabled(item):false;const count=item.key==="more.tables"?snapshot?.tables_count:item.key==="more.kitchen_manage"?snapshot?.kitchen_zones_count:item.key==="more.members"?snapshot?.members_count:item.key==="more.tax_invoices"?snapshot?.tax_invoices_count:item.key==="more.ai_documents"?snapshot?.ai_documents_count:null;return <button key={item.key} className={`moduleCard ${allowed?"":"locked"}`} disabled={!allowed||!item.target} onClick={()=>item.target&&onNavigate(item.target)}><span className="moduleIcon">{item.icon}</span><div><strong>{item.label}</strong><span>{item.desc}</span><small>{!state?"กำลังตรวจสิทธิ์...":!allowed?"ไม่ได้เปิดในแพ็กเกจ/ถูก IT ปิด":item.target?"พร้อมใช้งานใน CRM":count==null?"เชื่อมข้อมูล POS แล้ว":`เชื่อมข้อมูล POS · ${number.format(Number(count))} รายการ`}</small></div><ChevronRight size={18}/></button>;})}</div>
    <div className="auditNote">เมนูที่ยังไม่มีหน้าจัดการเฉพาะใน CRM จะยังไม่เขียนข้อมูลลง POS โดยตรง เพื่อรักษา transaction และกติกาเดิมของ POS/IT</div>
  </>;
}

const settingsCatalog=[
  ["settings.store","ข้อมูลร้านค้า/บริษัท","ข้อมูลชื่อร้าน โลโก้ ที่อยู่ และการติดต่อ","core_pos_sales","store"],
  ["settings.branches","สาขา","สาขาและสถานะการเปิดใช้งาน","branch_management","branches"],
  ["settings.devices","เครื่องแคชเชียร์","อุปกรณ์ POS และสถานะออนไลน์","mobile_device_enrollment","devices"],
  ["settings.printers","เครื่องพิมพ์","การตั้งค่าเครื่องพิมพ์ของ POS","core_pos_sales","printers"],
  ["settings.activity","ตรวจสอบพฤติกรรมการใช้งาน","ประวัติการทำงานและ Audit","core_pos_sales","activity"],
  ["settings.payments","ตั้งค่าชำระเงิน","บัญชีธนาคารและ QR ของร้าน","core_pos_sales","payments"],
  ["settings.inet_nops","INET QR","การเชื่อมต่อช่องทางรับชำระ INET","inet_nops_qr","inet"],
  ["settings.taxes","ตั้งค่าภาษี","VAT และการคำนวณภาษี","core_pos_sales","taxes"],
  ["settings.notifications","การแจ้งเตือน","QR โต๊ะ เสียงแจ้งเตือน และครัว","qr_table_ordering","notifications"],
  ["settings.support","ศูนย์ช่วยเหลือ","Support และการติดต่อฝ่ายระบบ","core_pos_sales","support"],
  ["settings.push_notifications","การแจ้งเตือนอุปกรณ์","Push notification ของเครื่อง POS","core_pos_sales","push"],
  ["settings.users","ผู้ใช้งาน","พนักงาน สิทธิ์ และ PIN","user_management","users"],
  ["settings.language","เปลี่ยนภาษา","ภาษาแสดงผลของ POS","core_pos_sales","language"],
  ["settings.placement","สลับแถบเมนูหลัก","ตำแหน่งเมนูต่อเครื่อง POS","core_pos_sales","placement"],
  ["settings.display","จอลูกค้า","Customer Display","customer_facing_display","display"],
  ["settings.order_kitchen","ออเดอร์และครัว","การส่งออเดอร์และการแจ้งเตือนครัว","kitchen_printing","orderKitchen"],
  ["settings.table_qr","QR โต๊ะ","การรับออเดอร์ผ่าน QR โต๊ะ","qr_table_ordering","tableQr"]
] as const;

type EditableSettingKind="store"|"branches"|"payments"|"taxes"|"notifications";

function SettingEditorModal({
  kind,context,branchId,snapshot,onClose,onSaved
}:{
  kind:EditableSettingKind;
  context:PortalContext;
  branchId:string|null;
  snapshot:SettingsSnapshot;
  onClose:()=>void;
  onSaved:()=>Promise<void>;
}){
  const initialBranchId=branchId||snapshot.branches[0]?.id||"";
  const firstBranch=snapshot.branches.find(b=>b.id===initialBranchId)??snapshot.branches[0];
  const firstAccount=snapshot.payment_accounts.find(a=>a.branch_id===initialBranchId)||snapshot.payment_accounts.find(a=>a.applies_to_all_branches)||snapshot.payment_accounts[0];
  const firstTax=snapshot.tax_settings.find(x=>x.branch_id===initialBranchId);
  const firstNotify=snapshot.notifications.find(x=>x.branch_id===initialBranchId);

  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [storeDraft,setStoreDraft]=useState({
    display_name:snapshot.store?.display_name||snapshot.store?.name||"",
    company_address:snapshot.store?.company_address||"",
    contact_phone:snapshot.store?.contact_phone||snapshot.store?.owner_phone||""
  });
  const [branchChoice,setBranchChoice]=useState(firstBranch?.id||"__new__");
  const [branchDraft,setBranchDraft]=useState({
    id:firstBranch?.id||"",code:firstBranch?.code||"",name:firstBranch?.name||"",
    address:firstBranch?.address||"",is_active:firstBranch?.is_active??true
  });
  const [accountChoice,setAccountChoice]=useState(firstAccount?.id||"__new__");
  const [accountDraft,setAccountDraft]=useState({
    id:firstAccount?.id||"",bank_name:firstAccount?.bank_name||"",account_name:firstAccount?.account_name||"",
    account_number:firstAccount?.account_number||"",promptpay_phone:firstAccount?.promptpay_phone||"",
    qr_image_url:firstAccount?.qr_image_url||"",qr_mode:firstAccount?.qr_mode||"promptpay_link",
    applies_to_all_branches:firstAccount?.applies_to_all_branches??false,is_active:firstAccount?.is_active??true
  });
  const [scopeBranch,setScopeBranch]=useState(initialBranchId);
  const [taxDraft,setTaxDraft]=useState({
    is_enabled:firstTax?.is_enabled??false,
    calculation_base:firstTax?.calculation_base||"exclusive",
    settings:firstTax?.settings??{}
  });
  const [notificationDraft,setNotificationDraft]=useState({
    table_qr_popup_enabled:firstNotify?.table_qr_popup_enabled??true,
    table_qr_sound_enabled:firstNotify?.table_qr_sound_enabled??true,
    table_qr_sound_volume:Number(firstNotify?.table_qr_sound_volume??1),
    table_qr_popup_store_enabled:firstNotify?.table_qr_popup_store_enabled??true,
    table_qr_kitchen_auto_send_enabled:firstNotify?.table_qr_kitchen_auto_send_enabled??false,
    table_qr_kitchen_auto_print_enabled:firstNotify?.table_qr_kitchen_auto_print_enabled??false
  });

  function chooseBranch(value:string){
    setBranchChoice(value);
    if(value==="__new__"){setBranchDraft({id:"",code:"",name:"",address:"",is_active:true});return;}
    const row=snapshot.branches.find(b=>b.id===value);
    if(row)setBranchDraft({id:row.id,code:row.code||"",name:row.name,address:row.address||"",is_active:row.is_active});
  }
  function chooseAccount(value:string){
    setAccountChoice(value);
    if(value==="__new__"){setAccountDraft({id:"",bank_name:"",account_name:"",account_number:"",promptpay_phone:"",qr_image_url:"",qr_mode:"promptpay_link",applies_to_all_branches:false,is_active:true});return;}
    const row=snapshot.payment_accounts.find(a=>a.id===value);
    if(row)setAccountDraft({
      id:row.id,bank_name:row.bank_name||"",account_name:row.account_name||"",account_number:row.account_number||"",
      promptpay_phone:row.promptpay_phone||"",qr_image_url:row.qr_image_url||"",qr_mode:row.qr_mode||"promptpay_link",
      applies_to_all_branches:row.applies_to_all_branches??false,is_active:row.is_active??true
    });
  }
  function changeScope(value:string){
    setScopeBranch(value);
    const tax=snapshot.tax_settings.find(x=>x.branch_id===value);
    setTaxDraft({is_enabled:tax?.is_enabled??false,calculation_base:tax?.calculation_base||"exclusive",settings:tax?.settings??{}});
    const n=snapshot.notifications.find(x=>x.branch_id===value);
    setNotificationDraft({
      table_qr_popup_enabled:n?.table_qr_popup_enabled??true,
      table_qr_sound_enabled:n?.table_qr_sound_enabled??true,
      table_qr_sound_volume:Number(n?.table_qr_sound_volume??1),
      table_qr_popup_store_enabled:n?.table_qr_popup_store_enabled??true,
      table_qr_kitchen_auto_send_enabled:n?.table_qr_kitchen_auto_send_enabled??false,
      table_qr_kitchen_auto_print_enabled:n?.table_qr_kitchen_auto_print_enabled??false
    });
  }

  async function submit(event:React.FormEvent){
    event.preventDefault();setBusy(true);setError("");
    try{
      if(kind==="store")await saveSetting(context.tenantId,null,"update_store",storeDraft);
      if(kind==="branches")await saveSetting(context.tenantId,branchDraft.id||null,"save_branch",branchDraft);
      if(kind==="payments")await saveSetting(context.tenantId,scopeBranch||null,"save_payment_account",accountDraft);
      if(kind==="taxes")await saveSetting(context.tenantId,scopeBranch||null,"save_tax",taxDraft);
      if(kind==="notifications")await saveSetting(context.tenantId,scopeBranch||null,"save_notifications",notificationDraft);
      await onSaved();onClose();
    }catch(err){setError(err instanceof Error?err.message:"บันทึกการตั้งค่าไม่สำเร็จ");}
    finally{setBusy(false);}
  }

  const title=kind==="store"?"ข้อมูลร้านค้า/บริษัท":kind==="branches"?"สาขา":kind==="payments"?"ตั้งค่าชำระเงิน":kind==="taxes"?"ตั้งค่าภาษี":"การแจ้งเตือน";
  return <Modal title={title} subtitle="บันทึกลงข้อมูลกลาง CpiPOS-001 และ POS จะอ่านค่าชุดเดียวกัน" onClose={onClose} wide>
    <form className="entityForm" onSubmit={submit}>
      {error?<ErrorPanel message={error}/>:null}
      <div className="formGrid">
        {kind==="store"?<>
          <label className="span2"><span>ชื่อร้าน/ชื่อแสดงผล</span><input value={storeDraft.display_name} onChange={e=>setStoreDraft({...storeDraft,display_name:e.target.value})} required/></label>
          <label className="span2"><span>ที่อยู่</span><input value={storeDraft.company_address} onChange={e=>setStoreDraft({...storeDraft,company_address:e.target.value})}/></label>
          <label className="span2"><span>เบอร์ติดต่อ</span><input value={storeDraft.contact_phone} onChange={e=>setStoreDraft({...storeDraft,contact_phone:e.target.value})}/></label>
        </>:null}

        {kind==="branches"?<>
          <label className="span2"><span>เลือกสาขา</span><select value={branchChoice} onChange={e=>chooseBranch(e.target.value)}>{snapshot.branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}<option value="__new__">+ เพิ่มสาขาใหม่</option></select></label>
          <label><span>รหัสสาขา</span><input value={branchDraft.code} onChange={e=>setBranchDraft({...branchDraft,code:e.target.value})} required/></label>
          <label><span>ชื่อสาขา</span><input value={branchDraft.name} onChange={e=>setBranchDraft({...branchDraft,name:e.target.value})} required/></label>
          <label className="span2"><span>ที่อยู่สาขา</span><input value={branchDraft.address} onChange={e=>setBranchDraft({...branchDraft,address:e.target.value})}/></label>
          <label className="switchField span2"><input type="checkbox" checked={branchDraft.is_active} onChange={e=>setBranchDraft({...branchDraft,is_active:e.target.checked})}/><span>เปิดใช้งานสาขา</span></label>
        </>:null}

        {kind==="payments"?<>
          <label className="span2"><span>บัญชี</span><select value={accountChoice} onChange={e=>chooseAccount(e.target.value)}>{snapshot.payment_accounts.map(a=><option key={a.id} value={a.id}>{a.bank_name||"บัญชี"} · ••••{String(a.account_number||"").slice(-4)}</option>)}<option value="__new__">+ เพิ่มบัญชีใหม่</option></select></label>
          <label><span>สาขา</span><select value={scopeBranch} onChange={e=>setScopeBranch(e.target.value)} disabled={accountDraft.applies_to_all_branches}>{snapshot.branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
          <label><span>ธนาคาร</span><input value={accountDraft.bank_name} onChange={e=>setAccountDraft({...accountDraft,bank_name:e.target.value})} required/></label>
          <label><span>ชื่อบัญชี</span><input value={accountDraft.account_name} onChange={e=>setAccountDraft({...accountDraft,account_name:e.target.value})}/></label>
          <label><span>เลขบัญชี</span><input value={accountDraft.account_number} onChange={e=>setAccountDraft({...accountDraft,account_number:e.target.value})}/></label>
          <label><span>PromptPay</span><input value={accountDraft.promptpay_phone} onChange={e=>setAccountDraft({...accountDraft,promptpay_phone:e.target.value})}/></label>
          <label><span>รูปแบบ QR</span><select value={accountDraft.qr_mode} onChange={e=>setAccountDraft({...accountDraft,qr_mode:e.target.value})}><option value="promptpay_link">PromptPay</option><option value="qr_image">รูป QR</option></select></label>
          <label className="switchField"><input type="checkbox" checked={accountDraft.applies_to_all_branches} onChange={e=>setAccountDraft({...accountDraft,applies_to_all_branches:e.target.checked})}/><span>ใช้ทุกสาขา</span></label>
          <label className="switchField"><input type="checkbox" checked={accountDraft.is_active} onChange={e=>setAccountDraft({...accountDraft,is_active:e.target.checked})}/><span>เปิดใช้งาน</span></label>
        </>:null}

        {kind==="taxes"?<>
          <label className="span2"><span>สาขา</span><select value={scopeBranch} onChange={e=>changeScope(e.target.value)}>{snapshot.branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
          <label><span>วิธีคำนวณ</span><select value={taxDraft.calculation_base} onChange={e=>setTaxDraft({...taxDraft,calculation_base:e.target.value})}><option value="exclusive">ภาษีแยกจากราคา</option><option value="inclusive">ราคารวมภาษี</option></select></label>
          <label className="switchField"><input type="checkbox" checked={taxDraft.is_enabled} onChange={e=>setTaxDraft({...taxDraft,is_enabled:e.target.checked})}/><span>เปิดใช้ภาษี</span></label>
        </>:null}

        {kind==="notifications"?<>
          <label className="span2"><span>สาขา</span><select value={scopeBranch} onChange={e=>changeScope(e.target.value)}>{snapshot.branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
          <label className="switchField"><input type="checkbox" checked={notificationDraft.table_qr_popup_enabled} onChange={e=>setNotificationDraft({...notificationDraft,table_qr_popup_enabled:e.target.checked})}/><span>Popup QR โต๊ะ</span></label>
          <label className="switchField"><input type="checkbox" checked={notificationDraft.table_qr_sound_enabled} onChange={e=>setNotificationDraft({...notificationDraft,table_qr_sound_enabled:e.target.checked})}/><span>เสียงแจ้งเตือน</span></label>
          <label><span>ระดับเสียง 0–1</span><input type="number" min="0" max="1" step="0.1" value={notificationDraft.table_qr_sound_volume} onChange={e=>setNotificationDraft({...notificationDraft,table_qr_sound_volume:Number(e.target.value)})}/></label>
          <label className="switchField"><input type="checkbox" checked={notificationDraft.table_qr_popup_store_enabled} onChange={e=>setNotificationDraft({...notificationDraft,table_qr_popup_store_enabled:e.target.checked})}/><span>แจ้งหน้าร้าน</span></label>
          <label className="switchField"><input type="checkbox" checked={notificationDraft.table_qr_kitchen_auto_send_enabled} onChange={e=>setNotificationDraft({...notificationDraft,table_qr_kitchen_auto_send_enabled:e.target.checked})}/><span>ส่งเข้าครัวอัตโนมัติ</span></label>
          <label className="switchField"><input type="checkbox" checked={notificationDraft.table_qr_kitchen_auto_print_enabled} onChange={e=>setNotificationDraft({...notificationDraft,table_qr_kitchen_auto_print_enabled:e.target.checked})}/><span>พิมพ์ครัวอัตโนมัติ</span></label>
        </>:null}
      </div>
      <div className="modalActions"><button type="button" className="secondaryButton" onClick={onClose}>ยกเลิก</button><button className="primaryAction" disabled={busy}>{busy?<LoaderCircle className="spin" size={17}/>:<Save size={17}/>}บันทึกการตั้งค่า</button></div>
    </form>
  </Modal>;
}

function SettingsView({context,branchId,onNavigate}:{context:PortalContext;branchId:string|null;onNavigate:(view:PortalView)=>void}){
  const [snapshot,setSnapshot]=useState<SettingsSnapshot|null>(null);
  const [features,setFeatures]=useState<FeatureState|null>(null);
  const [error,setError]=useState("");
  const [editor,setEditor]=useState<EditableSettingKind|null>(null);

  const refresh=useCallback(async()=>{
    setError("");
    try{
      const [s,f]=await Promise.all([loadSettingsSnapshot(context.tenantId,branchId),loadFeatureState(context.tenantId,branchId)]);
      setSnapshot(s);setFeatures(f);
    }catch{setError("ไม่สามารถโหลดการตั้งค่าร้านได้");}
  },[context.tenantId,branchId]);
  useEffect(()=>{void refresh();},[refresh]);

  const allowed=(key:string,feature:string)=>{
    if(features?.menu_policy?.[key]===false)return false;
    const base=features?.package_features?.[feature]??false;
    const override=features?.feature_overrides?.[feature];
    return override===undefined?base:override;
  };
  const detail=(kind:string)=>{
    if(!snapshot)return "กำลังโหลดข้อมูล...";
    if(kind==="store")return snapshot.store?.display_name||snapshot.store?.name||"ร้านค้า";
    if(kind==="branches")return snapshot.branches.length+" สาขา";
    if(kind==="devices")return snapshot.devices.length+" เครื่อง";
    if(kind==="payments")return snapshot.payment_accounts.length+" บัญชี";
    if(kind==="taxes")return snapshot.tax_settings.filter(x=>x.is_enabled).length+" สาขาเปิดภาษี";
    if(kind==="notifications")return snapshot.notifications.length+" สาขา";
    if(kind==="users")return "จัดการจากเมนูพนักงาน";
    return "เชื่อมกับการตั้งค่า POS";
  };
  const editable=(kind:string):kind is EditableSettingKind=>["store","branches","payments","taxes","notifications"].includes(kind);
  const localOnly=["printers","activity","inet","support","push","language","placement","display","orderKitchen","tableQr"];

  return <>
    <div className="pageHeading"><div><p className="eyebrow">SETTINGS</p><h2>ตั้งค่า</h2><p>โครงเมนูตาม POS และใช้สิทธิ์จากแพ็กเกจ + นโยบาย IT ชุดเดียวกัน</p></div><button className="ghostButton" onClick={()=>void refresh()}><RefreshCw size={18}/>รีเฟรช</button></div>
    {error?<ErrorPanel message={error}/>:null}
    {snapshot?<section className="settingsOverview">
      <div><Store size={20}/><span>ร้าน</span><strong>{snapshot.store?.display_name||snapshot.store?.name||"—"}</strong></div>
      <div><Building2 size={20}/><span>สาขา</span><strong>{snapshot.branches.length}</strong></div>
      <div><MonitorSmartphone size={20}/><span>อุปกรณ์</span><strong>{snapshot.devices.length}</strong></div>
      <div><CreditCard size={20}/><span>บัญชีรับเงิน</span><strong>{snapshot.payment_accounts.length}</strong></div>
    </section>:null}
    <div className="moduleGrid settingsGrid">{settingsCatalog.map(([key,label,desc,feature,kind])=>{const isAllowed=features?allowed(key,feature):false;const target=kind==="users"?"staff" as PortalView:undefined;const canEdit=editable(kind)&&snapshot&&(context.role==="owner"||["taxes","notifications"].includes(kind));const disabled=!isAllowed||(!target&&!canEdit&&localOnly.includes(kind));return <button key={key} className={`moduleCard ${isAllowed?"":"locked"}`} disabled={disabled} onClick={()=>target?onNavigate(target):canEdit?setEditor(kind as EditableSettingKind):undefined}><span className="moduleIcon">{kind==="devices"?<MonitorSmartphone/>:kind==="payments"?<CreditCard/>:kind==="notifications"?<Bell/>:kind==="printers"?<Printer/>:kind==="branches"?<Building2/>:kind==="users"?<UsersRound/>:<Settings/>}</span><div><strong>{label}</strong><span>{desc}</span><small>{!features?"กำลังตรวจสิทธิ์...":!isAllowed?"ไม่ได้เปิดในแพ็กเกจ/ถูก IT ปิด":canEdit?"กดเพื่อจัดการ":detail(kind)}</small></div><ChevronRight size={18}/></button>;})}</div>
    {snapshot?<article className="panel settingsDataPanel"><div className="panelHeader"><div><p className="eyebrow">CONNECTED POS SETTINGS</p><h3>ข้อมูลที่เชื่อมอยู่</h3></div></div><div className="settingsDataGrid">
      <div><strong>ข้อมูลร้าน</strong><span>{snapshot.store?.company_address||"ยังไม่ได้ระบุที่อยู่"}</span><span>{snapshot.store?.contact_phone||snapshot.store?.owner_phone||"—"}</span></div>
      <div><strong>สาขา</strong>{snapshot.branches.slice(0,5).map(b=><span key={b.id}>{b.name} · {b.is_active?"ใช้งาน":"ปิด"}</span>)}</div>
      <div><strong>อุปกรณ์</strong>{snapshot.devices.slice(0,5).map(d=><span key={d.id}>{d.device_name||d.device_code||"POS"} · {d.status||"—"}</span>)}</div>
      <div><strong>บัญชีรับชำระของร้าน</strong>{snapshot.payment_accounts.slice(0,5).map(a=><span key={a.id}>{a.bank_name||"บัญชี"} · ••••{String(a.account_number||"").slice(-4)}</span>)}</div>
    </div></article>:null}
    <div className="auditNote">ค่าที่เป็น local ต่อเครื่อง เช่น ภาษา/ตำแหน่งแถบเมนู และฮาร์ดแวร์เครื่องพิมพ์ อ่านสถานะร่วมกันแต่ CRM จะไม่สั่งเปลี่ยนเครื่อง POS โดยตรง</div>
    {editor&&snapshot?<SettingEditorModal kind={editor} context={context} branchId={branchId} snapshot={snapshot} onClose={()=>setEditor(null)} onSaved={refresh}/>:null}
  </>;
}

const nav: Array<{ id: PortalView; label: string; icon: React.ReactNode }> = [
  { id:"dashboard",label:"ภาพรวม",icon:<LayoutDashboard size={21}/> },
  { id:"sales",label:"ยอดขาย",icon:<ReceiptText size={21}/> },
  { id:"products",label:"สินค้า",icon:<Boxes size={21}/> },
  { id:"stock",label:"วัตถุดิบ",icon:<Warehouse size={21}/> },
  { id:"staff",label:"พนักงาน",icon:<UsersRound size={21}/> },
  { id:"package",label:"แพ็กเกจ",icon:<PackageCheck size={21}/> },
  { id:"more",label:"เพิ่มเติม",icon:<MoreHorizontal size={21}/> },
  { id:"settings",label:"ตั้งค่า",icon:<Settings size={21}/> }
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

  const showFilters=!["package","more"].includes(view);
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
      {view==="more"?<MoreView context={context} branchId={branchId||null} onNavigate={chooseView}/>:null}
      {view==="settings"?<SettingsView context={context} branchId={branchId||null} onNavigate={chooseView}/>:null}

      <footer>ข้อมูลและสิทธิ์ถูกจำกัดตามบัญชี {context.role==="owner"?"Owner":"Manager"} · {context.branches.length} สาขาที่เข้าถึงได้</footer>
    </main>
  </div>;
}
