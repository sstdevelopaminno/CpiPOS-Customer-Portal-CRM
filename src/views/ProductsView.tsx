import { useCallback, useEffect, useState } from "react";
import { Boxes, LoaderCircle, Pencil, Plus, Save, Search, Trash2 } from "lucide-react";
import { deleteProduct, loadProducts, saveProduct, type PortalContext, type ProductDraft, type ProductRow } from "../lib/portal";
import { Empty, ErrorPanel, Pagination, Modal } from "../components/common";
import { money, number, branchName } from "../lib/formatters";

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

export function ProductsView({ context, branchId }: { context: PortalContext; branchId: string | null }) {
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
  useEffect(()=>{if(page>=pageCount)setPage(Math.max(0,pageCount-1));},[page,pageCount]);
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
