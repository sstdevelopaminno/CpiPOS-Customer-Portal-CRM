import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, Pencil, Plus, Save, Search, Trash2 } from "lucide-react";
import { deleteStock, loadStock, saveStock, type PortalContext, type StockDraft, type StockRow } from "../lib/portal";
import { Empty, ErrorPanel, Pagination, Modal } from "../components/common";
import { money, number, branchName } from "../lib/formatters";

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

export function StockView({ context, branchId }: { context: PortalContext; branchId: string | null }) {
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
  useEffect(()=>{if(page>=pageCount)setPage(Math.max(0,pageCount-1));},[page,pageCount]);
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
