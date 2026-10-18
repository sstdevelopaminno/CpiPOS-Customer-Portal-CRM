import {useCallback,useEffect,useRef,useState,type FormEvent} from "react";
import {supabase} from "../lib/supabase";
import type {PortalContext} from "../types/portal";
import {formatCurrency} from "../lib/formatters";
import {opticalText} from "../lib/optical-locale";
import {useCrmLanguage} from "../lib/use-crm-language";

type Draft={
  id:string;customer_id:string;eye_exam_id:string|null;seller_id:string|null;
  items:Array<{product_id:string;quantity:number}>;
  discount_lak:number;due_at:string|null;note:string;version:number;
  status:"draft"|"void"|"issued";issued_order_id:string|null;
};
type Customer={id:string;customer_code:string;full_name:string};
type Exam={id:string;examined_at:string;examiner_name:string|null};
type Bin={id:string;product_id:string;brand:string|null;model:string|null;
  currency_code:string;unit_price:number;on_hand:number;reserved:number};
const blank=():Draft=>({id:crypto.randomUUID(),customer_id:"",eye_exam_id:null,
  seller_id:null,items:[],discount_lak:0,due_at:null,note:"",version:0,
  status:"draft",issued_order_id:null});
const errorLabel=(language:string)=>language==="en"?"Draft save failed. Check Owner/IT permissions and stock.":language==="lo"?
  "ບັນທຶກໃບງານບໍ່ສຳເລັດ ກວດສິດ ແລະ ສະຕັອກ":"บันทึกใบงานไม่สำเร็จ กรุณาตรวจสิทธิ์ Owner/IT และสต๊อก";

/** Staged CRUD only. No direct payment or inventory writes from the browser. */
export function OpticalWorkOrderDrafts({context,branchId,onIssued}:{
  context:PortalContext;branchId:string;onIssued:()=>void
}){
  const language=useCrmLanguage();
  const T=(value:string)=>opticalText(language,value);
  const [rows,setRows]=useState<Draft[]>([]);
  const [customers,setCustomers]=useState<Customer[]>([]);
  const [bins,setBins]=useState<Bin[]>([]);
  const [exams,setExams]=useState<Exam[]>([]);
  const [draft,setDraft]=useState<Draft|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const requestId=useRef<string>(crypto.randomUUID());
  const allowed=import.meta.env.VITE_OPTICAL_WORK_ORDER_DRAFTS_V1_ENABLED==="true" &&
    context.role==="owner"&&context.salesCurrencyCode==="LAK";
  const reload=useCallback(async()=>{
    if(!allowed||!branchId)return;
    setLoading(true);setError("");
    try{
      const [jobs,people,stock]=await Promise.all([
        supabase.from("optical_work_order_drafts")
          .select("id,customer_id,eye_exam_id,seller_id,items,discount_lak,due_at,note,version,status,issued_order_id")
          .eq("tenant_id",context.tenantId).eq("branch_id",branchId)
          .order("created_at",{ascending:false}).limit(100),
        supabase.from("optical_customers").select("id,customer_code,full_name")
          .eq("tenant_id",context.tenantId).eq("branch_id",branchId).is("deleted_at",null)
          .order("full_name").limit(300),
        supabase.from("optical_stock_bins").select("id,product_id,brand,model,currency_code,unit_price,on_hand,reserved")
          .eq("tenant_id",context.tenantId).eq("branch_id",branchId).eq("currency_code","LAK").limit(200)
      ]);
      if(jobs.error||people.error||stock.error)throw new Error("optical_draft_lookup_failed");
      setRows((jobs.data??[]) as Draft[]);
      setCustomers((people.data??[]) as Customer[]);
      setBins((stock.data??[]) as Bin[]);
    }catch{setError(errorLabel(language));}
    finally{setLoading(false);}
  },[context.tenantId,branchId,allowed,language]);
  useEffect(()=>{void reload();},[reload]);
  useEffect(()=>{setDraft(null);setExams([]);},[context.tenantId,branchId]);
  useEffect(()=>{
    if(!draft?.customer_id){setExams([]);return;}
    let cancelled=false;
    void (async()=>{
      const {data,error}=await supabase.from("optical_eye_exams")
        .select("id,examined_at,examiner_name")
        .eq("tenant_id",context.tenantId).eq("branch_id",branchId)
        .eq("customer_id",draft.customer_id).order("examined_at",{ascending:false}).limit(40);
      if(!cancelled)setExams(error?[]:(data??[]) as Exam[]);
    })();
    return()=>{cancelled=true;};
  },[context.tenantId,branchId,draft?.customer_id]);
  function edit(patch:Partial<Draft>){
    setDraft(current=>current?{...current,...patch}:null);
    requestId.current=crypto.randomUUID();
    setError("");setNotice("");
  }
  function startNew(){setDraft(blank());requestId.current=crypto.randomUUID();setError("");setNotice("");}
  const amount=draft?.items.reduce((sum,row)=>{
    const bin=bins.find(b=>b.product_id===row.product_id);
    return sum+Number(bin?.unit_price??0)*row.quantity;
  },0)??0;
  async function save(event:FormEvent){
    event.preventDefault();
    if(!allowed||!draft||busy||!draft.customer_id||draft.items.length===0)return;
    if(!Number.isSafeInteger(draft.discount_lak)||draft.discount_lak<0||draft.discount_lak>=amount){
      setError(language==="en"?"Discount exceeds draft amount.":"ส่วนลดต้องต่ำกว่ายอดรวมและเป็นจำนวนเต็ม LAK");return;
    }
    setBusy(true);setError("");setNotice("");
    try{
      const {data,error}=await supabase.rpc("customer_portal_save_optical_draft_v1",{
        p_tenant_id:context.tenantId,p_branch_id:branchId,p_draft_id:draft.id,
        p_customer_id:draft.customer_id,p_eye_exam_id:draft.eye_exam_id,
        p_seller_id:draft.seller_id,p_items:draft.items,p_discount_lak:draft.discount_lak,
        p_due_at:draft.due_at?new Date(draft.due_at).toISOString():null,
        p_note:draft.note,p_expected_version:draft.version,p_request_id:requestId.current
      });
      if(error||!data||typeof data.version!=="number")throw new Error("draft_save_failed");
      setDraft(null);setNotice(language==="en"?"Draft saved.":"บันทึกฉบับร่างแล้ว");await reload();
    }catch{setError(errorLabel(language));}
    finally{setBusy(false);}
  }
  async function transition(row:Draft,action:"void"|"issue"){
    if(!allowed||busy||row.status!=="draft")return;
    if(!window.confirm(action==="issue"?"ยืนยันออกใบสั่งงานและจองสต๊อกสินค้าจริง?":"ยืนยันยกเลิกฉบับร่าง?"))return;
    setBusy(true);setError("");setNotice("");
    try{
      const {data,error}=await supabase.rpc("customer_portal_transition_optical_draft_v1",{
        p_tenant_id:context.tenantId,p_branch_id:branchId,p_draft_id:row.id,
        p_expected_version:row.version,p_request_id:crypto.randomUUID(),p_action:action
      });
      if(error||!data)throw new Error("transition_failed");
      setNotice(action==="issue"?"ออกใบงานแล้ว · เปิดรายการใบงานหลักเพื่อพิมพ์":"ยกเลิกฉบับร่างแล้ว");
      await reload();
      if(action==="issue")onIssued();
    }catch{setError(action==="issue"?"ยังออกใบงานไม่ได้ · ตรวจสต๊อก แพ็กเกจ และสิทธิ์ก่อน":"ยกเลิกฉบับร่างไม่สำเร็จ");}
    finally{setBusy(false);}
  }
  if(!allowed)return null;
  return <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
    <header className="flex flex-wrap items-center justify-between gap-2">
      <div><h3 className="font-bold">{T("ใบสั่งงานแว่นตา")} · Drafts</h3>
        <p className="text-xs text-slate-600">แบบร่างยังไม่จองสต๊อก · จองเมื่อยืนยันออกใบงานเท่านั้น</p></div>
      <button type="button" className="rounded-lg bg-emerald-700 px-4 py-2 font-bold text-white" onClick={startNew}
        disabled={busy}>+ {language==="en"?"New draft":"สร้างใบงาน"}</button>
    </header>
    {error?<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>:null}
    {notice?<p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>:null}
    {loading?<p role="status">กำลังโหลดฉบับร่าง...</p>:null}
    <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm">
      <thead className="bg-slate-50"><tr><th className="p-2">เลข Draft</th><th className="p-2">ลูกค้า</th>
        <th className="p-2">รายการ</th><th className="p-2">สถานะ</th><th className="p-2">จัดการ</th></tr></thead>
      <tbody>{rows.map(row=><tr key={row.id} className="border-t">
        <td className="p-2 font-mono">{row.id.slice(0,8)}</td>
        <td className="p-2">{customers.find(c=>c.id===row.customer_id)?.full_name??"—"}</td>
        <td className="p-2">{row.items.reduce((sum,item)=>sum+item.quantity,0)}</td>
        <td className="p-2">{row.status}</td>
        <td className="p-2"><div className="flex gap-2">
          {row.status==="draft"?<>
            <button type="button" className="rounded border px-2 py-1" onClick={()=>{setDraft(row);requestId.current=crypto.randomUUID();}}>แก้ไข</button>
            <button type="button" className="rounded border px-2 py-1" disabled={busy} onClick={()=>void transition(row,"issue")}>ออกใบงาน</button>
            <button type="button" className="rounded border border-rose-300 px-2 py-1 text-rose-700" disabled={busy} onClick={()=>void transition(row,"void")}>ยกเลิก</button>
          </>:row.issued_order_id?<span>ออกใบงานแล้ว · {row.issued_order_id.slice(0,8)}</span>:null}
        </div></td>
      </tr>)}</tbody>
    </table></div>
    {draft?<div role="dialog" aria-modal="true" aria-label="แก้ไขฉบับร่างใบสั่งงาน"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-3">
      <form onSubmit={event=>void save(event)} className="max-h-[92vh] w-full max-w-3xl space-y-3 overflow-y-auto rounded-2xl bg-white p-5">
        <h3 className="text-lg font-bold">{draft.version?"แก้ไขใบงานฉบับร่าง":"สร้างใบงานฉบับร่าง"}</h3>
        <label className="grid gap-1 text-sm font-semibold">ลูกค้า
          <select className="rounded-lg border p-3" required value={draft.customer_id} onChange={event=>edit({customer_id:event.target.value,eye_exam_id:null})}>
            <option value="">เลือกลูกค้า</option>{customers.map(c=><option key={c.id} value={c.id}>{c.customer_code} · {c.full_name}</option>)}
          </select></label>
        <label className="grid gap-1 text-sm">ผลตรวจสายตา
          <select className="rounded-lg border p-3" value={draft.eye_exam_id??""}
            onChange={event=>edit({eye_exam_id:event.target.value||null})}>
            <option value="">ไม่ระบุผลตรวจ</option>
            {exams.map(e=><option key={e.id} value={e.id}>{e.examined_at} · {e.examiner_name||"—"}</option>)}
          </select></label>
        <h4 className="font-semibold">สินค้าจาก Optical Stock</h4>
        <div className="max-h-56 space-y-2 overflow-y-auto">
          {bins.map(bin=>{
            const row=draft.items.find(item=>item.product_id===bin.product_id);
            const available=Math.max(0,bin.on_hand-bin.reserved);
            return <label key={bin.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-2 text-sm">
              <span>{bin.brand??"Optical"} · {bin.model??bin.product_id.slice(0,8)} · {formatCurrency(bin.unit_price,"LAK")} · ว่าง {available}</span>
              <input aria-label={`จำนวน ${bin.model??bin.product_id}`} type="number" min={0} max={available}
                className="w-20 rounded border p-2" value={row?.quantity??0}
                onChange={event=>{
                  const quantity=Math.max(0,Math.trunc(Number(event.target.value)||0));
                  edit({items:quantity?[
                    ...draft.items.filter(x=>x.product_id!==bin.product_id),
                    {product_id:bin.product_id,quantity}
                  ]:draft.items.filter(x=>x.product_id!==bin.product_id)});
                }}/>
            </label>;
          })}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">ส่วนลด LAK
            <input className="rounded border p-2" type="number" min={0} step={1} value={draft.discount_lak}
              onChange={event=>edit({discount_lak:Number(event.target.value)})}/></label>
          <label className="grid gap-1 text-sm">วันนัดรับ
            <input className="rounded border p-2" type="datetime-local" value={draft.due_at?.slice(0,16)??""}
              onChange={event=>edit({due_at:event.target.value||null})}/></label>
        </div>
        <label className="grid gap-1 text-sm">หมายเหตุ
          <textarea className="rounded border p-2" maxLength={1000} rows={2} value={draft.note}
            onChange={event=>edit({note:event.target.value})}/></label>
        <p className="font-bold">ยอดจากราคา LAK ปัจจุบัน: {formatCurrency(amount,"LAK")}</p>
        <p className="text-xs text-slate-600">ราคาสินค้าและสต๊อกตรวจซ้ำโดยฐานข้อมูลอีกครั้งเมื่อออกใบงาน · ยังไม่รับชำระเงิน</p>
        <div className="flex justify-end gap-2">
          <button type="button" className="rounded border px-4 py-2" disabled={busy} onClick={()=>setDraft(null)}>ปิด</button>
          <button type="submit" className="rounded bg-emerald-700 px-4 py-2 font-bold text-white"
            disabled={busy||!draft.customer_id||draft.items.length===0}>{busy?"กำลังบันทึก...":"บันทึกฉบับร่าง"}</button>
        </div>
      </form>
    </div>:null}
  </section>;
}
