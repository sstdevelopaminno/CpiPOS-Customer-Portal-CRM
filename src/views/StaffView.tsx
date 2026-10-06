import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, Pencil, Plus, Save, Search, Trash2 } from "lucide-react";
import { createStaff, loadStaff, updateStaff, type PortalContext, type StaffDraft, type StaffRow } from "../lib/portal";
import { Empty, ErrorPanel, Pagination, Modal } from "../components/common";
import { maskEmployeeCode } from "../lib/formatters";

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
      await onSaved();
      onClose();
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

export function StaffView({ context, branchId }: { context: PortalContext; branchId: string | null }) {
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
  useEffect(()=>{if(page>=pageCount)setPage(Math.max(0,pageCount-1));},[page,pageCount]);
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
