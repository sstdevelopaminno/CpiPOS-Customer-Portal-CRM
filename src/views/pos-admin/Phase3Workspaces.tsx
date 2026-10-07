import { useCallback,useEffect,useMemo,useState,type FormEvent } from "react";
import { CircleAlert,FileText,LoaderCircle,RefreshCw,Save,Search,ShieldCheck } from "lucide-react";
import { Empty,ErrorPanel,Modal } from "../../components/common";
import { RemotePrintDialog } from "./RemotePrintDialog";
import { TaxProfileCreateModal } from "./TaxProfileCreateModal";
import { loadPosAdminSnapshot,mutatePosAdmin } from "../../lib/api/pos-admin";
import type { PortalContext } from "../../types/portal";
import type {
  ActivityAdminSnapshot,InetAdminSnapshot,OrderKitchenAdminSnapshot,ProductSalesAdminSnapshot,
  ReceiptAdmin,ReceiptsAdminSnapshot,TableQrAdmin,TableQrAdminSnapshot,
  TaxInvoicesAdminSnapshot,TaxReceiptAdmin
} from "../../types/pos-admin";

type BaseProps={context:PortalContext;branchId:string};
function todayBangkok(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Bangkok",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());}
function money(v:number){return new Intl.NumberFormat("th-TH",{style:"currency",currency:"THB",minimumFractionDigits:2}).format(Number(v||0));}
function dateTime(v:string|null|undefined){return v?new Intl.DateTimeFormat("th-TH",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Bangkok"}).format(new Date(v)):"—";}

export function ActivityWorkspace({context,branchId}:BaseProps){
  const [data,setData]=useState<ActivityAdminSnapshot|null>(null);
  const [error,setError]=useState(""); const [busy,setBusy]=useState(false);
  const [pin,setPin]=useState(""); const [period,setPeriod]=useState("day");
  const [date,setDate]=useState(todayBangkok()); const [search,setSearch]=useState(""); const [page,setPage]=useState(1);
  const load=useCallback(async(targetPage=page)=>{
    if(pin.trim().length<4){setError("กรุณากรอก PIN Owner/Manager เพื่อเปิด Audit Log");return;}
    setBusy(true);setError("");
    try{setData(await loadPosAdminSnapshot<ActivityAdminSnapshot>(context.tenantId,branchId,"activity",{manager_pin:pin,period,date,search,page:targetPage,page_size:20}));setPage(targetPage);}
    catch(e){setData(null);setError(e instanceof Error?e.message:"โหลด Audit Log ไม่สำเร็จ");}
    finally{setBusy(false);}
  },[context.tenantId,branchId,pin,period,date,search,page]);
  return <>
    {error?<ErrorPanel message={error}/>:null}
    <section className="panel phase3GatePanel">
      <div className="panelHeader"><div><p className="eyebrow">OWNER / MANAGER APPROVAL</p><h3>ตรวจสอบพฤติกรรมการใช้งาน</h3><small>เหมือนฝั่ง POS: ต้องยืนยัน PIN ก่อนอ่าน Audit Log</small></div></div>
      <div className="phase3FilterGrid">
        <label><span>PIN</span><input type="password" inputMode="numeric" value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,"").slice(0,12))} placeholder="••••••"/></label>
        <label><span>ช่วงเวลา</span><select value={period} onChange={e=>{setPeriod(e.target.value);setPage(1);}}><option value="day">รายวัน</option><option value="month">รายเดือน</option><option value="year">รายปี</option></select></label>
        <label><span>วันที่อ้างอิง</span><input type="date" value={date} onChange={e=>{setDate(e.target.value);setPage(1);}}/></label>
        <label><span>ค้นหา</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="action / module / table"/></label>
        <button className="primaryAction" disabled={busy} onClick={()=>void load(1)}>{busy?<LoaderCircle className="spin" size={16}/>:<ShieldCheck size={16}/>}ยืนยันและโหลด</button>
      </div>
    </section>
    {data?<section className="panel adminPanel">
      <div className="panelHeader"><div><p className="eyebrow">AUDIT LOG</p><h3>{data.pagination.total.toLocaleString("th-TH")} รายการ</h3></div><button className="ghostButton" disabled={busy} onClick={()=>void load(page)}><RefreshCw size={15}/>รีเฟรช</button></div>
      <div className="tableWrap boundedTable"><table><thead><tr><th>เวลา</th><th>ผู้ใช้งาน</th><th>บทบาท</th><th>โมดูล</th><th>การกระทำ</th><th>เป้าหมาย</th></tr></thead><tbody>
        {data.items.length?data.items.map(row=><tr key={row.id}><td>{dateTime(row.created_at)}</td><td><strong>{row.actor_name}</strong><br/><small>{row.actor_employee_code||row.actor_email||"—"}</small></td><td>{row.actor_role}</td><td>{row.module}</td><td><span className={row.is_delete_action?"phase3DangerText":row.is_pin_action?"phase3WarnText":""}>{row.action}</span></td><td>{row.target_table}<br/><small>{row.target_id||row.device_code||"—"}</small></td></tr>):<tr><td colSpan={6}><Empty>ไม่พบ Audit Log ในช่วงที่เลือก</Empty></td></tr>}
      </tbody></table></div>
      <div className="phase3Pager"><span>หน้า {data.pagination.page}/{data.pagination.total_pages}</span><div><button className="secondaryButton" disabled={page<=1||busy} onClick={()=>void load(page-1)}>ก่อนหน้า</button><button className="secondaryButton" disabled={page>=data.pagination.total_pages||busy} onClick={()=>void load(page+1)}>ถัดไป</button></div></div>
    </section>:null}
  </>;
}

export function InetWorkspace({context,branchId}:BaseProps){
  const [data,setData]=useState<InetAdminSnapshot|null>(null); const [error,setError]=useState(""); const [busy,setBusy]=useState(false);
  const [environment,setEnvironment]=useState<"uat"|"production">("uat"); const [merchant,setMerchant]=useState(""); const [active,setActive]=useState(false);
  const refresh=useCallback(async()=>{setBusy(true);setError("");try{const x=await loadPosAdminSnapshot<InetAdminSnapshot>(context.tenantId,branchId,"inet");setData(x);setEnvironment(x.settings.environment);setMerchant(x.settings.merchant_id);setActive(x.settings.is_active);}catch(e){setError(e instanceof Error?e.message:"โหลด INET QR ไม่สำเร็จ");}finally{setBusy(false);}},[context.tenantId,branchId]);
  useEffect(()=>{void refresh();},[refresh]);
  async function save(){setBusy(true);setError("");try{await mutatePosAdmin(context.tenantId,branchId,"inet.save",{environment,merchant_id:merchant,is_active:active});await refresh();}catch(e){setError(e instanceof Error?e.message:"บันทึก INET QR ไม่สำเร็จ");setBusy(false);}}
  return <>
    {error?<ErrorPanel message={error}/>:null}
    <div className="adminKpis"><div><span>Environment</span><strong>{data?.settings.environment.toUpperCase()??"—"}</strong></div><div><span>Connection</span><strong>{data?.settings.connection_status??"—"}</strong></div><div><span>สถานะ</span><strong>{data?.settings.is_active?"เปิด":"ปิด"}</strong></div></div>
    <section className="panel adminPanel"><div className="panelHeader"><div><p className="eyebrow">INET NOPS QR</p><h3>ตั้งค่า Dynamic QR</h3><small>Merchant Key และ Callback secret อยู่ฝั่ง POS server และไม่ส่งลง browser ของ CRM</small></div></div>
      <div className="phase3FormGrid">
        <label><span>Environment</span><select value={environment} onChange={e=>setEnvironment(e.target.value as "uat"|"production")}><option value="uat">UAT</option><option value="production">Production</option></select></label>
        <label><span>Merchant ID</span><input value={merchant} onChange={e=>setMerchant(e.target.value)} placeholder="Merchant ID"/></label>
        <label className="phase3Switch"><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)}/><span>เปิดใช้งาน INET QR</span></label>
      </div>
      {data?<div className="phase3InfoStrip"><CircleAlert size={18}/><div><strong>{data.provider_test_note}</strong><span>ตรวจล่าสุด: {dateTime(data.settings.last_connection_checked_at)}{data.settings.last_connection_error?" · "+data.settings.last_connection_error:""}</span></div></div>:null}
      <div className="phase3Actions"><button className="primaryAction" disabled={busy} onClick={()=>void save()}>{busy?<LoaderCircle className="spin" size={16}/>:<Save size={16}/>}บันทึกการตั้งค่า</button></div>
    </section>
  </>;
}

function OverrideBadge({value}:{value:string}){return <span className={"phase3Override "+(value==="inherit"?"":"forced")}>{value==="inherit"?"ตามร้าน":value==="force_on"?"IT บังคับเปิด":"IT บังคับปิด"}</span>;}
export function OrderKitchenWorkspace({context,branchId}:BaseProps){
  const [data,setData]=useState<OrderKitchenAdminSnapshot|null>(null); const [error,setError]=useState(""); const [busy,setBusy]=useState(false);
  const [popup,setPopup]=useState(true); const [send,setSend]=useState(true); const [print,setPrint]=useState(true);
  const refresh=useCallback(async()=>{setBusy(true);setError("");try{const x=await loadPosAdminSnapshot<OrderKitchenAdminSnapshot>(context.tenantId,branchId,"order_kitchen");setData(x);setPopup(x.policy.store.popup_enabled);setSend(x.policy.store.kitchen_auto_send_enabled);setPrint(x.policy.store.kitchen_auto_print_enabled);}catch(e){setError(e instanceof Error?e.message:"โหลดการตั้งค่าไม่สำเร็จ");}finally{setBusy(false);}},[context.tenantId,branchId]);
  useEffect(()=>{void refresh();},[refresh]);
  async function save(){setBusy(true);setError("");try{await mutatePosAdmin(context.tenantId,branchId,"order_kitchen.save",{popup_enabled:popup,kitchen_auto_send_enabled:send,kitchen_auto_print_enabled:print});await refresh();}catch(e){setError(e instanceof Error?e.message:"บันทึกการตั้งค่าไม่สำเร็จ");setBusy(false);}}
  return <>
    {error?<ErrorPanel message={error}/>:null}
    <section className="panel adminPanel"><div className="panelHeader"><div><p className="eyebrow">ORDER & KITCHEN</p><h3>การแจ้งเตือนออเดอร์และครัว</h3><small>Owner/Manager ตั้งค่าร้านได้ แต่ IT Override มีสิทธิ์เหนือกว่าเสมอ</small></div></div>
      <div className="phase3PolicyList">
        {data?<PolicyRow label="Popup ออเดอร์ QR" value={popup} setValue={setPopup} override={data.policy.override.popup} effective={data.policy.effective.popup_enabled}/>:null}
        {data?<PolicyRow label="ส่ง QR เข้าครัวอัตโนมัติ" value={send} setValue={setSend} override={data.policy.override.kitchen_auto_send} effective={data.policy.effective.kitchen_auto_send_enabled}/>:null}
        {data?<PolicyRow label="พิมพ์ใบครัวอัตโนมัติ" value={print} setValue={setPrint} override={data.policy.override.kitchen_auto_print} effective={data.policy.effective.kitchen_auto_print_enabled}/>:null}
      </div>
      <div className="phase3Actions"><button className="primaryAction" disabled={busy} onClick={()=>void save()}><Save size={16}/>บันทึก</button></div>
    </section>
  </>;
}
function PolicyRow({label,value,setValue,override,effective}:{label:string;value:boolean;setValue:(v:boolean)=>void;override:string;effective:boolean}){
  return <div><div><strong>{label}</strong><span>ผลใช้งานจริง: {effective?"เปิด":"ปิด"}</span></div><OverrideBadge value={override}/><label className="phase3Toggle"><input type="checkbox" checked={value} onChange={e=>setValue(e.target.checked)}/><span>{value?"เปิด":"ปิด"}</span></label></div>;
}

export function TableQrWorkspace({context,branchId}:BaseProps){
  const [data,setData]=useState<TableQrAdminSnapshot|null>(null); const [error,setError]=useState(""); const [busy,setBusy]=useState(false);
  const [selected,setSelected]=useState<TableQrAdmin|null>(null); const [mode,setMode]=useState<"time"|"bill">("time"); const [ttl,setTtl]=useState(1080);
  const refresh=useCallback(async()=>{setBusy(true);setError("");try{setData(await loadPosAdminSnapshot<TableQrAdminSnapshot>(context.tenantId,branchId,"table_qr"));}catch(e){setError(e instanceof Error?e.message:"โหลด QR โต๊ะไม่สำเร็จ");}finally{setBusy(false);}},[context.tenantId,branchId]);
  useEffect(()=>{void refresh();},[refresh]);
  function open(row:TableQrAdmin){setSelected(row);setMode(row.mode);setTtl(row.ttl_minutes??data?.limits.default_ttl_minutes??1080);}
  async function save(){if(!selected)return;setBusy(true);setError("");try{const result=await mutatePosAdmin<{revoked_active_sessions:number}>(context.tenantId,branchId,"table_qr.policy.save",{table_id:selected.id,mode,ttl_minutes:mode==="time"?ttl:null});setSelected(null);await refresh();if(result.revoked_active_sessions>0)window.alert("บันทึกแล้ว และยกเลิก QR เดิม "+result.revoked_active_sessions+" รายการ กรุณาออก QR ใหม่");}catch(e){setError(e instanceof Error?e.message:"บันทึก QR โต๊ะไม่สำเร็จ");setBusy(false);}}
  return <>
    {error?<ErrorPanel message={error}/>:null}
    <section className="panel adminPanel"><div className="panelHeader"><div><p className="eyebrow">TABLE QR POLICY</p><h3>ตั้งค่า QR โต๊ะ</h3><small>เปลี่ยน policy แล้ว QR active เดิมของโต๊ะนั้นจะถูก revoke เหมือน POS</small></div></div>
      <div className="tableWrap boundedTable"><table><thead><tr><th>โต๊ะ</th><th>รูปแบบ</th><th>อายุ QR</th><th>QR Active</th><th></th></tr></thead><tbody>
      {data?.tables.length?data.tables.map(row=><tr key={row.id}><td><strong>{row.table_code}</strong><br/><small>{row.table_name||"—"}</small></td><td>{row.mode==="bill"?"ตามบิล":"ตามเวลา"}</td><td>{row.mode==="bill"?"จนปิดบิล":String(row.ttl_minutes)+" นาที"}</td><td>{row.active_qr_sessions}</td><td><button className="tableAction" onClick={()=>open(row)}>ตั้งค่า</button></td></tr>):<tr><td colSpan={5}><Empty>ไม่พบโต๊ะที่ใช้งาน</Empty></td></tr>}
      </tbody></table></div>
    </section>
    {selected?<Modal title={"ตั้งค่า QR · "+selected.table_code} onClose={()=>setSelected(null)}><div className="entityForm"><div className="phase3RadioCards">
      <label className={mode==="time"?"active":""}><input type="radio" checked={mode==="time"} onChange={()=>setMode("time")}/><strong>ตามเวลา / ชั่วโมง</strong><span>กำหนดได้ 15 นาที ถึง 24 ชั่วโมง</span></label>
      <label className={mode==="bill"?"active":""}><input type="radio" checked={mode==="bill"} onChange={()=>setMode("bill")}/><strong>ตามบิล</strong><span>ใช้ได้จนปิดบิล มี safety cap 7 วัน</span></label>
    </div>{mode==="time"?<label><span>อายุ QR (นาที)</span><input type="number" min={data?.limits.min_ttl_minutes??15} max={data?.limits.max_ttl_minutes??1440} step={15} value={ttl} onChange={e=>setTtl(Number(e.target.value))}/></label>:null}
    <div className="modalActions"><button className="secondaryButton" onClick={()=>setSelected(null)}>ยกเลิก</button><button className="primaryAction" disabled={busy} onClick={()=>void save()}><Save size={16}/>บันทึก</button></div></div></Modal>:null}
  </>;
}

export function ReceiptsWorkspace({context,branchId}:BaseProps){
  const [data,setData]=useState<ReceiptsAdminSnapshot|null>(null); const [error,setError]=useState(""); const [busy,setBusy]=useState(false);
  const [period,setPeriod]=useState("day"); const [date,setDate]=useState(todayBangkok()); const [search,setSearch]=useState(""); const [status,setStatus]=useState("completed"); const [page,setPage]=useState(1);
  const [selected,setSelected]=useState<ReceiptAdmin|null>(null); const [printTarget,setPrintTarget]=useState<ReceiptAdmin|null>(null);
  const load=useCallback(async(targetPage=page)=>{setBusy(true);setError("");try{setData(await loadPosAdminSnapshot<ReceiptsAdminSnapshot>(context.tenantId,branchId,"receipts",{period,date,q:search,status,page:targetPage,page_size:20}));setPage(targetPage);}catch(e){setError(e instanceof Error?e.message:"โหลดใบเสร็จไม่สำเร็จ");}finally{setBusy(false);}},[context.tenantId,branchId,period,date,search,status,page]);
  useEffect(()=>{void load(1);},[context.tenantId,branchId]);
  return <>
    {error?<ErrorPanel message={error}/>:null}
    <section className="panel phase3GatePanel"><div className="phase3FilterGrid">
      <label><span>ช่วงเวลา</span><select value={period} onChange={e=>setPeriod(e.target.value)}><option value="day">รายวัน</option><option value="month">รายเดือน</option><option value="year">รายปี</option></select></label>
      <label><span>วันที่อ้างอิง</span><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
      <label><span>สถานะ</span><select value={status} onChange={e=>setStatus(e.target.value)}><option value="completed">ชำระแล้ว</option><option value="cancelled">ยกเลิก</option><option value="all">ทั้งหมด</option></select></label>
      <label><span>ค้นหา</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="เลขบิล / ลูกค้า"/></label>
      <button className="primaryAction" disabled={busy} onClick={()=>void load(1)}><Search size={16}/>ค้นหา</button>
    </div></section>
    <section className="panel adminPanel"><div className="panelHeader"><div><p className="eyebrow">RECEIPT HISTORY</p><h3>ใบเสร็จย้อนหลัง</h3><small>ข้อมูลชุดเดียวกับ POS · การพิมพ์ฮาร์ดแวร์ยังใช้ POS/Print Agent</small></div></div>
      <div className="tableWrap boundedTable"><table><thead><tr><th>เลขบิล</th><th>เวลา</th><th>โต๊ะ/ช่องทาง</th><th>ยอดสุทธิ</th><th>สถานะ</th><th>พนักงาน</th><th></th></tr></thead><tbody>
      {data?.records.length?data.records.map(row=><tr key={row.id}><td><strong>{row.order_no}</strong></td><td>{dateTime(row.created_at)}</td><td>{row.table_label}</td><td>{money(row.total_amount)}</td><td>{row.status}</td><td>{row.cashier_name}</td><td><button className="tableAction" onClick={()=>setSelected(row)}>ดูใบเสร็จ</button></td></tr>):<tr><td colSpan={7}><Empty>ไม่พบใบเสร็จ</Empty></td></tr>}
      </tbody></table></div>
      {data?<div className="phase3Pager"><span>ทั้งหมด {data.pagination.total} · หน้า {data.pagination.page}/{data.pagination.total_pages}</span><div><button className="secondaryButton" disabled={page<=1||busy} onClick={()=>void load(page-1)}>ก่อนหน้า</button><button className="secondaryButton" disabled={page>=data.pagination.total_pages||busy} onClick={()=>void load(page+1)}>ถัดไป</button></div></div>:null}
    </section>
    {selected?<Modal title={"ใบเสร็จ "+selected.order_no} onClose={()=>setSelected(null)} wide><div className="receiptDetail">
      <div className="receiptSummaryGrid"><div><span>ลูกค้า</span><strong>{selected.customer_name||"—"}</strong></div><div><span>ยอดสุทธิ</span><strong>{money(selected.total_amount)}</strong></div><div><span>ชำระแล้ว</span><strong>{money(selected.paid_total)}</strong></div><div><span>วันที่</span><strong>{dateTime(selected.created_at)}</strong></div></div>
      <div className="tableWrap"><table><thead><tr><th>สินค้า</th><th>SKU</th><th>จำนวน</th><th>ราคา</th><th>รวม</th></tr></thead><tbody>{selected.items.map(item=><tr key={item.id}><td>{item.name}</td><td>{item.sku||"—"}</td><td>{item.quantity}</td><td>{money(item.unit_price)}</td><td>{money(item.line_total)}</td></tr>)}</tbody></table></div>
      <div className="modalActions"><button className="secondaryButton" onClick={()=>setSelected(null)}>ปิด</button><button className="primaryAction" onClick={()=>setPrintTarget(selected)}>พิมพ์ผ่าน Print Agent</button></div>
    </div></Modal>:null}
    {printTarget?<RemotePrintDialog context={context} branchId={branchId} documentType="receipt" documentId={printTarget.id} documentLabel={printTarget.order_no} onClose={()=>setPrintTarget(null)}/>:null}
  </>;
}

export function TaxInvoicesWorkspace({context,branchId}:BaseProps){
  const [data,setData]=useState<TaxInvoicesAdminSnapshot|null>(null); const [error,setError]=useState(""); const [busy,setBusy]=useState(false);
  const [sellerOpen,setSellerOpen]=useState(false); const [taxProfileOpen,setTaxProfileOpen]=useState(false); const [issueTarget,setIssueTarget]=useState<TaxReceiptAdmin|null>(null); const [printTarget,setPrintTarget]=useState<TaxReceiptAdmin|null>(null); const [profileId,setProfileId]=useState(""); const [pin,setPin]=useState("");
  const refresh=useCallback(async()=>{setBusy(true);setError("");try{setData(await loadPosAdminSnapshot<TaxInvoicesAdminSnapshot>(context.tenantId,branchId,"tax_invoices"));}catch(e){setError(e instanceof Error?e.message:"โหลดใบกำกับภาษีไม่สำเร็จ");}finally{setBusy(false);}},[context.tenantId,branchId]);
  useEffect(()=>{void refresh();},[refresh]);
  async function saveSeller(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError("");const f=new FormData(e.currentTarget);try{await mutatePosAdmin(context.tenantId,branchId,"tax_invoice.seller.save",{seller_display_name:String(f.get("name")??""),seller_tax_id:String(f.get("tax_id")??""),seller_branch_no:String(f.get("branch_no")??""),seller_address:String(f.get("address")??"")});setSellerOpen(false);await refresh();}catch(err){setError(err instanceof Error?err.message:"บันทึกข้อมูลผู้ออกไม่สำเร็จ");setBusy(false);}}
  function openIssue(row:TaxReceiptAdmin){setIssueTarget(row);setProfileId(data?.profiles[0]?.id??"");setPin("");}
  async function issue(){if(!issueTarget)return;setBusy(true);setError("");try{const r=await mutatePosAdmin<{invoice_no:string;already_issued:boolean;print_required_in_pos:boolean}>(context.tenantId,branchId,"tax_invoice.issue",{order_id:issueTarget.id,profile_id:profileId,manager_pin:pin});setIssueTarget(null);await refresh();window.alert((r.already_issued?"มีเอกสารแล้ว: ":"ออกใบกำกับภาษีแล้ว: ")+r.invoice_no+"\\nหาก Print Agent พร้อม สามารถสั่งพิมพ์จากรายการนี้ได้ทันที");}catch(e){setError(e instanceof Error?e.message:"ออกใบกำกับภาษีไม่สำเร็จ");setBusy(false);}}
  return <>
    {error?<ErrorPanel message={error}/>:null}
    <div className="adminKpis"><div><span>ข้อมูลผู้ขาย</span><strong>{data?.seller.ready?"พร้อม":"ยังไม่ครบ"}</strong></div><div><span>ทะเบียนผู้เสียภาษี</span><strong>{data?.profiles.length??"—"}</strong></div><div><span>ใบกำกับที่ออกแล้ว</span><strong>{data?.invoices.length??"—"}</strong></div></div>
    <section className="panel adminPanel"><div className="panelHeader"><div><p className="eyebrow">TAX SELLER</p><h3>ข้อมูลผู้ออกใบกำกับภาษี</h3><small>{data?.seller.display_name||"ยังไม่ได้ตั้งค่า"} · {data?.seller.tax_id||"ไม่มีเลขผู้เสียภาษี"}</small></div><div className="inlineActions"><button className="secondaryButton" onClick={()=>setTaxProfileOpen(true)}>เพิ่มผู้เสียภาษี</button><button className="secondaryButton" onClick={()=>setSellerOpen(true)}>แก้ไขข้อมูลผู้ขาย</button></div></div></section>
    <section className="panel adminPanel"><div className="panelHeader"><div><p className="eyebrow">PAID RECEIPTS</p><h3>ออกใบกำกับภาษีจากบิลที่ชำระแล้ว</h3><small>ใช้ทะเบียนผู้เสียภาษีที่ผ่านการตรวจสอบจาก POS; เอกสารจาก CRM ใช้ snapshot ชุดเดียวกัน</small></div></div>
      <div className="tableWrap boundedTable"><table><thead><tr><th>บิล</th><th>วันที่</th><th>ลูกค้า</th><th>ยอด</th><th>ใบกำกับภาษี</th><th></th></tr></thead><tbody>
      {data?.receipts.length?data.receipts.map(row=><tr key={row.id}><td><strong>{row.order_no}</strong></td><td>{dateTime(row.created_at)}</td><td>{row.customer_name||"—"}</td><td>{money(row.total)}</td><td>{row.invoice_no||"ยังไม่ออก"}</td><td>{row.invoice_id?<div className="inlineActions"><span className="status status-success">ออกแล้ว</span><button className="tableAction" onClick={()=>setPrintTarget(row)}>พิมพ์</button></div>:<button className="tableAction" disabled={!data.seller.ready||!data.profiles.length} onClick={()=>openIssue(row)}>ออกเอกสาร</button>}</td></tr>):<tr><td colSpan={6}><Empty>ไม่พบบิลที่ชำระแล้ว</Empty></td></tr>}
      </tbody></table></div>
    </section>
    {taxProfileOpen?<TaxProfileCreateModal context={context} branchId={branchId} onClose={()=>setTaxProfileOpen(false)} onCreated={refresh}/>:null}
    {sellerOpen&&data?<Modal title="ข้อมูลผู้ออกใบกำกับภาษี" onClose={()=>setSellerOpen(false)}><form className="entityForm" onSubmit={saveSeller}><div className="formGrid">
      <label className="span2"><span>ชื่อร้าน/บริษัท</span><input name="name" defaultValue={data.seller.display_name} required/></label>
      <label><span>เลขผู้เสียภาษี 13 หลัก</span><input name="tax_id" inputMode="numeric" defaultValue={data.seller.tax_id} required/></label>
      <label><span>เลขสาขา</span><input name="branch_no" inputMode="numeric" defaultValue={data.seller.branch_no} placeholder="00000"/></label>
      <label className="span2"><span>ที่อยู่</span><textarea name="address" rows={3} defaultValue={data.seller.address} required/></label>
    </div><div className="modalActions"><button type="button" className="secondaryButton" onClick={()=>setSellerOpen(false)}>ยกเลิก</button><button className="primaryAction" disabled={busy}>บันทึก</button></div></form></Modal>:null}
    {printTarget?.invoice_id?<RemotePrintDialog context={context} branchId={branchId} documentType="tax_invoice" documentId={printTarget.invoice_id} documentLabel={printTarget.invoice_no||printTarget.order_no} onClose={()=>setPrintTarget(null)}/>:null}
    {issueTarget&&data?<Modal title={"ออกใบกำกับภาษี · "+issueTarget.order_no} onClose={()=>setIssueTarget(null)}><div className="entityForm"><label><span>ผู้รับใบกำกับภาษี</span><select value={profileId} onChange={e=>setProfileId(e.target.value)}>{data.profiles.map(p=><option key={p.id} value={p.id}>{p.display_name+" · "+p.tax_id}</option>)}</select></label><label><span>PIN Owner/Manager</span><input type="password" inputMode="numeric" value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,"").slice(0,12))}/></label><div className="phase3InfoStrip"><FileText size={18}/><div><strong>CRM จะออกทะเบียนเอกสารและ snapshot ให้ครบ</strong><span>การพิมพ์กระดาษจริงยัง route ผ่าน POS/Print Agent เพื่อรักษา device/session control</span></div></div><div className="modalActions"><button className="secondaryButton" onClick={()=>setIssueTarget(null)}>ยกเลิก</button><button className="primaryAction" disabled={busy||!profileId||pin.length<4} onClick={()=>void issue()}>ยืนยันออกเอกสาร</button></div></div></Modal>:null}
  </>;
}

export function ProductSalesWorkspace({context,branchId}:BaseProps){
  const [data,setData]=useState<ProductSalesAdminSnapshot|null>(null); const [error,setError]=useState(""); const [busy,setBusy]=useState(false);
  const [period,setPeriod]=useState("day"); const [date,setDate]=useState(todayBangkok()); const [search,setSearch]=useState("");
  const load=useCallback(async()=>{setBusy(true);setError("");try{setData(await loadPosAdminSnapshot<ProductSalesAdminSnapshot>(context.tenantId,branchId,"product_sales",{period,date,q:search}));}catch(e){setError(e instanceof Error?e.message:"โหลดรายการขายสินค้าไม่สำเร็จ");}finally{setBusy(false);}},[context.tenantId,branchId,period,date,search]);
  useEffect(()=>{void load();},[context.tenantId,branchId]);
  const max=useMemo(()=>Math.max(1,...(data?.rows.map(x=>x.sales_total)??[1])),[data]);
  return <>
    {error?<ErrorPanel message={error}/>:null}
    <section className="panel phase3GatePanel"><div className="phase3FilterGrid"><label><span>ช่วงเวลา</span><select value={period} onChange={e=>setPeriod(e.target.value)}><option value="day">รายวัน</option><option value="month">รายเดือน</option><option value="year">รายปี</option></select></label><label><span>วันที่อ้างอิง</span><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label className="span2"><span>ค้นหาสินค้า</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ชื่อ / SKU / หมวดหมู่"/></label><button className="primaryAction" disabled={busy} onClick={()=>void load()}><Search size={16}/>ค้นหา</button></div></section>
    <div className="adminKpis"><div><span>สินค้าที่ขาย</span><strong>{data?.summary.product_count??"—"}</strong></div><div><span>จำนวนรวม</span><strong>{Number(data?.summary.quantity??0).toLocaleString("th-TH")}</strong></div><div><span>ยอดขายสินค้า</span><strong>{money(Number(data?.summary.sales_total??0))}</strong></div></div>
    <section className="panel adminPanel"><div className="panelHeader"><div><p className="eyebrow">PRODUCT SALES</p><h3>รายการขายสินค้า</h3></div></div><div className="productSalesList">{data?.rows.length?data.rows.map((row,index)=><div key={row.product_id||row.name}><span className="productSalesRank">{index+1}</span><div><strong>{row.name}</strong><small>{(row.sku||"—")+" · "+(row.category||"ไม่ระบุหมวดหมู่")+" · "+row.order_count+" บิล"}</small><div className="productSalesBar"><i style={{width:String(Math.max(2,row.sales_total/max*100))+"%"}}/></div></div><div><strong>{money(row.sales_total)}</strong><small>{row.quantity.toLocaleString("th-TH")+" ชิ้น · เฉลี่ย "+money(row.average_unit_price)}</small></div></div>):<Empty>ไม่พบยอดขายสินค้า</Empty>}</div></section>
  </>;
}
