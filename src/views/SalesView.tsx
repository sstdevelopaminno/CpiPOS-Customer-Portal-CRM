import { TopicHub } from "../components/TopicHub";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, LoaderCircle, Pencil, Save, Search, Trash2 } from "lucide-react";
import { cancelOrder, loadOrderItems, loadSales, updateOrder, type OrderItemRow, type OrderRow, type PortalContext, type ReportRange } from "../lib/portal";
import { Empty, ErrorPanel, Pagination, Modal } from "../components/common";
import { money, number, dateTime, amount, statusLabel, branchName } from "../lib/formatters";

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

export function SalesView({ context, branchId, range, anchor }: { context: PortalContext; branchId: string | null; range: ReportRange; anchor: string }) {
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
    <TopicHub label="หัวข้อรายการขาย" items={[
      {id:"bills",title:"ค้นหาและจัดการบิล",description:"รายการขายตามสาขาและวันที่ เลือกบิลเพื่อดู แก้ไข หรือยกเลิก",count:pageLabel,content:<>
        <div className="toolbar"><label className="searchBox"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="ค้นหาในหน้าปัจจุบัน..."/></label><span className="toolbarCount">{pageLabel}</span></div>
    {error?<ErrorPanel message={error}/>:null}
    <article className="panel tablePanel">
      {loading?<div className="loadingPanel"><LoaderCircle className="spin"/>กำลังโหลดรายการขาย...</div>:filtered.length?
      <div className="tableWrap"><table><thead><tr><th>เลขที่บิล</th><th>เวลา</th><th>สาขา</th><th>สถานะ</th><th className="right">ยอดรวม</th><th></th></tr></thead><tbody>
        {filtered.map(row=><tr key={row.id}><td><strong>{row.order_no||"—"}</strong></td><td>{dateTime.format(new Date(row.created_at))}</td><td>{branchMap.get(row.branch_id)||"—"}</td><td><span className={`status status-${row.status}`}>{statusLabel(row.status)}</span></td><td className="right"><strong>{money.format(amount(row))}</strong></td><td className="right"><button className="tableAction" onClick={()=>setSelectedOrder(row)}><Eye size={16}/>ดู/จัดการ</button></td></tr>)}
      </tbody></table></div>:<Empty>ยังไม่มีข้อมูลรายการขายในช่วงเวลานี้</Empty>}
      <Pagination page={page} pageCount={pageCount} onPageChange={setPage} disabled={loading}/>
    </article>
      </>},
      {id:"policy",title:"เงื่อนไขการจัดการรายการขาย",description:"ขอบเขตการแก้ไขและการคืนสต๊อก",content:<div className="auditNote">รายการขายใหม่สร้างจาก POS เพื่อรักษา payment/shift/stock transaction ให้ถูกต้อง; Customer Portal รองรับแก้ไขข้อมูลประกอบและยกเลิกบิลอย่างปลอดภัย</div>}
    ]}/>
    {selectedOrder?<OrderDetailModal order={selectedOrder} context={context} onClose={()=>setSelectedOrder(null)} onChanged={refresh}/>:null}
  </>;
}
