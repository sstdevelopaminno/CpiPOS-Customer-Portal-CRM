import {useEffect,useState} from "react";
import {supabase} from "../lib/supabase";
import type {PortalContext} from "../types/portal";
type Order={id:string;status:string;currency_code:string;total_amount:number;paid_total:number;accepted_at:string;due_at:string|null;note?:string|null};
type Line={id:string;description_snapshot:string|null;sku_snapshot:string|null;quantity:number;line_total:number};
type Payment={id:string;amount:number;method:string;received_at:string;reference_no:string|null};
const fmt=(n:number,c:string)=>Number(n||0).toLocaleString("en-US")+" "+c;
export function OpticalWorkOrderDetailDialog({order,context,branch,onClose,onChanged}:{
 order:Order;context:PortalContext;branch:string;onClose:()=>void;onChanged:(update:Partial<Order>)=>void
}){
 const [lines,setLines]=useState<Line[]>([]),[payments,setPayments]=useState<Payment[]>([]);
 const [loading,setLoading]=useState(true),[err,setErr]=useState("");
 const [edit,setEdit]=useState(false),[busy,setBusy]=useState(false);
 const [note,setNote]=useState(order.note??""),[due,setDue]=useState(order.due_at?.slice(0,10)??"");
 const [pin,setPin]=useState("");
 useEffect(()=>{
  let active=true;setLoading(true);setErr("");setLines([]);setPayments([]);
  void (async()=>{
   const [l,p]=await Promise.all([
    supabase.from("optical_work_order_lines")
      .select("id,description_snapshot,sku_snapshot,quantity,line_total")
      .eq("tenant_id",context.tenantId).eq("branch_id",branch).eq("work_order_id",order.id).limit(50),
    supabase.from("optical_payment_ledger")
      .select("id,amount,method,received_at,reference_no")
      .eq("tenant_id",context.tenantId).eq("branch_id",branch).eq("work_order_id",order.id)
      .order("received_at",{ascending:false}).limit(100)
   ]);
   if(!active)return;
   if(l.error||p.error)setErr("ไม่สามารถโหลดรายละเอียดใบงานหรือประวัติการเงินได้ กรุณาตรวจสิทธิ์ IT");
   else{setLines((l.data??[]) as Line[]);setPayments((p.data??[]) as Payment[]);}
   setLoading(false);
  })();
  return()=>{active=false;};
 },[context.tenantId,branch,order.id]);
 const permitted=["owner","manager","staff"].includes(context.role);
 const manage=async(action:"update"|"cancel")=>{
  if(busy||!permitted)return;
  if(pin.trim().length<4){setErr("กรุณาระบุ PIN ผู้จัดการหรือเจ้าของร้านก่อนดำเนินการ");return;}
  if(action==="cancel"&&order.paid_total>0){
    setErr("ใบงานรับมัดจำแล้ว ต้องทำรายการคืนเงินอย่างเป็นทางการก่อนจึงจะยกเลิกใบงานได้");return;
  }
  if(action==="cancel"&&!window.confirm("ยืนยันยกเลิกใบงาน? ไม่สามารถยกเลิกงานที่รับเงินแล้ว"))return;
  setBusy(true);setErr("");
  try{
   const dueAt=due?new Date(due+"T12:00:00+07:00").toISOString():null;
   const {error}=await supabase.rpc("optical_manage_work_order_pin_v2",{
    p_tenant_id:context.tenantId,p_branch_id:branch,p_work_order_id:order.id,
    p_actor:context.userId,p_action:action,p_request_id:crypto.randomUUID(),p_manager_pin:pin,
    p_note:note,p_due_at:dueAt
   });
   if(error)throw error;
   onChanged(action==="cancel"?{status:"cancelled"}:{note,due_at:dueAt});
   onClose();
  }catch(e){setErr(e instanceof Error?e.message:"ดำเนินการไม่สำเร็จ");}
  finally{setBusy(false);}
 };
 return <div role="presentation" className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-3"
  onClick={()=>{if(!busy)onClose();}}>
   <section role="dialog" aria-modal="true" aria-label="รายละเอียดใบสั่งงาน"
    className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl" onClick={e=>e.stopPropagation()}>
    <div className="flex items-center justify-between gap-2"><h3 className="text-xl font-bold">รายละเอียดใบสั่งงาน · {order.id.slice(0,8)}</h3>
      <button type="button" className="rounded-lg border px-3 py-2" onClick={onClose} disabled={busy}>ปิด</button>
    </div>
    <div className="mt-4 grid gap-2 sm:grid-cols-3">
      {([["สถานะ",order.status],["ยอดรวม",fmt(order.total_amount,order.currency_code)],
        ["รับชำระแล้ว",fmt(order.paid_total,order.currency_code)],
        ["ค้างชำระ",fmt(Math.max(0,order.total_amount-order.paid_total),order.currency_code)],
        ["วันที่รับงาน",new Date(order.accepted_at).toLocaleDateString("th-TH")],
        ["นัดรับ",order.due_at?.slice(0,10)??"—"]] as const).map(([key,value])=>
        <p key={key} className="rounded-lg bg-slate-50 p-3 text-sm"><span className="block text-xs text-slate-500">{key}</span>
          <strong>{value}</strong></p>)}
    </div>
    {loading?<p className="p-3 text-sm">กำลังโหลดรายละเอียด...</p>:null}
    <div className="mt-4 grid min-w-0 gap-3 md:grid-cols-2">
      <section className="min-w-0 rounded-xl border p-3">
    <h4 className="mb-2 font-bold">รายการสินค้า</h4>
    {lines.map(l=><p key={l.id} className="border-b p-2 text-sm">{l.description_snapshot||l.sku_snapshot||"สินค้า"} × {l.quantity} · {fmt(l.line_total,order.currency_code)}</p>)}
    {!loading&&!lines.length?<p className="text-sm text-slate-500">ไม่พบรายการสินค้า</p>:null}
    <p className="mt-2 text-xs text-amber-700">รายการสินค้าในใบงานที่รับเงินแล้วต้องแก้ผ่านเอกสารปรับปรุง ไม่ลบราคาหรือสต๊อกเดิม</p>
      </section>
      <section className="min-w-0 rounded-xl border p-3">
    <h4 className="mb-2 font-bold">ประวัติเงินมัดจำ / ชำระเงิน</h4>
    {payments.map(p=><p key={p.id} className="border-b p-2 text-sm">{new Date(p.received_at).toLocaleString("th-TH")} · {p.method} · {fmt(p.amount,order.currency_code)}</p>)}
    {!loading&&!payments.length?<p className="text-sm text-slate-500">ยังไม่มีรายการเงินมัดจำ</p>:null}
    <p className="mt-2 text-xs text-amber-700">การยกเลิกรายการเงินที่รับแล้วต้องทำบัญชีคืนเงินแยก ไม่ลบรายการรับเงินจริง</p>
      </section>
    </div>
    {edit?<div className="mt-4 grid gap-3 rounded-xl border p-3">
      <label className="grid gap-1 text-sm">วันนัดรับ<input type="date" value={due} className="rounded-lg border p-2" onChange={e=>setDue(e.target.value)}/></label>
      <label className="grid gap-1 text-sm">หมายเหตุ<textarea value={note} maxLength={1000}
       className="rounded-lg border p-3" onChange={e=>setNote(e.target.value)}/></label>
      <p className="text-xs text-slate-500">แก้ไขได้เฉพาะงานที่เพิ่งรับและยังไม่มีการรับเงิน ไม่แก้ยอดขายหรือรายการสินค้า</p>
    </div>:null}
    {permitted?<label className="mt-3 grid max-w-sm gap-1 text-sm font-semibold">
      PIN ผู้จัดการหรือเจ้าของร้าน
      <input type="password" inputMode="numeric" autoComplete="off" maxLength={32} value={pin}
        onChange={e=>setPin(e.target.value)} className="rounded-lg border px-3 py-2"/>
    </label>:null}
    {err?<p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-rose-700">{err}</p>:null}
    <div className="mt-4 flex flex-wrap gap-2">
      {permitted&&!["cancelled","collected"].includes(order.status)?
        <button type="button" disabled={busy||loading||Boolean(err)} className="rounded-lg border border-blue-300 px-4 py-2 text-blue-800"
         onClick={()=>edit?void manage("update"):setEdit(true)}>{edit?"บันทึกการแก้ไข":"แก้ไข"}</button>:null}
      {permitted&&!["collected","cancelled"].includes(order.status)&&order.paid_total===0?
        <button type="button" disabled={busy||loading||Boolean(err)} className="rounded-lg border border-rose-300 px-4 py-2 text-rose-800"
         onClick={()=>void manage("cancel")}>ลบ (ยกเลิกใบงาน)</button>:null}
      {order.paid_total>0?<p className="text-xs text-amber-700">รับเงินแล้ว การยกเลิกต้องคืนเงินผ่านขั้นตอนตรวจสอบก่อน ไม่ลบประวัติเงินรับ</p>:null}
      {!permitted?<p className="text-xs text-amber-800">ต้องได้รับสิทธิ์สาขา และใช้ PIN Owner/Manager ก่อนแก้ไข</p>:null}
    </div>
   </section>
 </div>;
}
