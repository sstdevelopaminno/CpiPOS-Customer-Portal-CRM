import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import type { PortalContext } from "../types/portal";

type Customer = {
  id:string;customer_code:string;full_name:string;phone:string|null;age:number|null;
  previous_prescription:string|null;last_exam_date:string|null;examiner_name:string|null;
  notes:string|null;branch_id:string;
};
type Exam = {
  id:string;examined_at:string;right_sph:number|null;right_cyl:number|null;
  right_axis:number|null;right_add:number|null;left_sph:number|null;left_cyl:number|null;
  left_axis:number|null;left_add:number|null;pd_mm:number|null;examiner_name:string|null;
};
type Form = {
  customer_code:string;full_name:string;phone:string;age:string;exam_date:string;
  previous_prescription:string;pd_mm:string;examiner_name:string;right_sph:string;
  right_cyl:string;right_axis:string;right_add:string;left_sph:string;left_cyl:string;
  left_axis:string;left_add:string;notes:string;
};
const blank=():Form=>({
  customer_code:"",full_name:"",phone:"",age:"",
  exam_date:new Date().toISOString().slice(0,10),
  previous_prescription:"",pd_mm:"",examiner_name:"",
  right_sph:"",right_cyl:"",right_axis:"",right_add:"",
  left_sph:"",left_cyl:"",left_axis:"",left_add:"",notes:""
});
const val=(s:string)=>s.trim()===""?null:Number(s);
const numericKeys: Array<keyof Form>=["age","pd_mm","right_sph","right_cyl","right_axis","right_add","left_sph","left_cyl","left_axis","left_add"];

export function OpticalCustomersView({context,branchId}:{context:PortalContext;branchId:string|null}) {
  const activeBranch=branchId && context.branches.some(x=>x.id===branchId) ? branchId : context.branches[0]?.id;
  const [customers,setCustomers]=useState<Customer[]>([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [search,setSearch]=useState("");
  const [editor,setEditor]=useState<Customer|null>(null);
  const [editing,setEditing]=useState(false);
  const [form,setForm]=useState<Form>(blank);
  const [saving,setSaving]=useState(false);
  const [exams,setExams]=useState<Exam[]>([]);
  const [historyFor,setHistoryFor]=useState("");
  const requestId=useRef(crypto.randomUUID());
  const load=useCallback(async()=>{
    if(!activeBranch) return;
    setLoading(true);setError("");
    const {data,error:queryError}=await supabase.from("optical_customers")
      .select("id,customer_code,full_name,phone,age,previous_prescription,last_exam_date,examiner_name,notes,branch_id")
      .eq("tenant_id",context.tenantId).eq("branch_id",activeBranch)
      .is("deleted_at",null).order("updated_at",{ascending:false}).limit(300);
    if(queryError)setError(queryError.message);
    else setCustomers((data??[]) as Customer[]);
    setLoading(false);
  },[activeBranch,context.tenantId]);
  useEffect(()=>{void load();},[load]);
  useEffect(()=>{setEditing(false);setEditor(null);setHistoryFor("");setExams([]);},[activeBranch]);
  const change=(k:keyof Form,v:string)=>{setForm(curr=>({...curr,[k]:v}));setError("");requestId.current=crypto.randomUUID();};
  const startNew=()=>{setEditor(null);setForm(blank());setEditing(true);setError("");setNotice("");requestId.current=crypto.randomUUID();};
  const startEdit=(row:Customer)=>{
    setEditor(row);
    setForm({...blank(),customer_code:row.customer_code,full_name:row.full_name,phone:row.phone??"",
      age:row.age===null?"":String(row.age),exam_date:row.last_exam_date??new Date().toISOString().slice(0,10),
      previous_prescription:row.previous_prescription??"",examiner_name:row.examiner_name??"",notes:row.notes??""});
    setEditing(true);setError("");setNotice("");requestId.current=crypto.randomUUID();
  };
  const save=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    if(!activeBranch||saving)return;
    const age=val(form.age),pd=val(form.pd_mm);
    if((age!==null&&(age<0||age>130))||(pd!==null&&(pd<30||pd>90))) {setError("อายุหรือ PD ไม่ถูกต้อง");return;}
    setSaving(true);setError("");setNotice("");
    const fields:Record<string,unknown>={
      p_tenant_id:context.tenantId,p_branch_id:activeBranch,
      p_customer_code:form.customer_code,p_full_name:form.full_name,p_phone:form.phone||null,
      p_exam_date:form.exam_date,p_previous_prescription:form.previous_prescription||null,
      p_examiner_name:form.examiner_name||null,p_notes:form.notes||null,
      p_request_id:requestId.current
    };
    for(const k of numericKeys) fields["p_"+k]=val(form[k]);
    const {error:saveError}=await supabase.rpc("optical_save_customer_exam",fields);
    setSaving(false);
    if(saveError){setError(saveError.message);return;}
    setEditing(false);setEditor(null);setNotice("บันทึกประวัติลูกค้าและผลตรวจเรียบร้อย");
    requestId.current=crypto.randomUUID();
    await load();
  };
  const archive=async(row:Customer)=>{
    if(!activeBranch||!window.confirm(`ยืนยันย้ายลูกค้า ${row.customer_code} ไปยังสถานะเก็บถาวร? ข้อมูลประวัติจะยังคงอยู่ในฐานข้อมูล`))return;
    setError("");setNotice("");
    const {error:archiveError}=await supabase.from("optical_customers")
      .update({deleted_at:new Date().toISOString(),updated_by:context.userId,updated_at:new Date().toISOString()})
      .eq("id",row.id).eq("tenant_id",context.tenantId).eq("branch_id",activeBranch);
    if(archiveError){setError(archiveError.message);return;}
    setNotice("เก็บถาวรแล้ว โดยไม่ลบประวัติการตรวจ");await load();
  };
  const openHistory=async(row:Customer)=>{
    if(!activeBranch)return;
    setHistoryFor(row.customer_code);setExams([]);
    const {data,error:examError}=await supabase.from("optical_eye_exams")
      .select("id,examined_at,right_sph,right_cyl,right_axis,right_add,left_sph,left_cyl,left_axis,left_add,pd_mm,examiner_name")
      .eq("tenant_id",context.tenantId).eq("branch_id",activeBranch).eq("customer_id",row.id)
      .order("examined_at",{ascending:false}).limit(40);
    if(examError)setError(examError.message);else setExams((data??[]) as Exam[]);
  };
  const field=(k:keyof Form,label:string,type="text")=>(
    <label key={k} className="flex flex-col gap-1"><span>{label}</span>
      <input type={type} step={type==="number"?"any":undefined} value={form[k]}
        disabled={saving||(k==="customer_code"&&Boolean(editor))} required={k==="customer_code"||k==="full_name"||k==="exam_date"}
        onChange={e=>change(k,e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm"/>
    </label>
  );
  const filtered=customers.filter(row=>(row.customer_code+" "+row.full_name+" "+(row.phone??"")).toLowerCase().includes(search.toLowerCase()));
  return <section className="space-y-4">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs font-bold text-emerald-700">IMDC OPTICAL</p><h2>ประวัติลูกค้าและค่าสายตา</h2>
        <p>เฉพาะร้านและสาขาที่ IT เปิดสิทธิ์ Optical · ข้อมูลการตรวจเก่าจะไม่ถูกเขียนทับ</p></div>
      <button className="rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white" disabled={!activeBranch} onClick={startNew}>+ เพิ่มลูกค้า</button>
    </header>
    {error?<div role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{error}</div>:null}
    {notice?<div role="status" className="rounded-lg bg-emerald-50 p-3 text-emerald-800">{notice}</div>:null}
    {!activeBranch?<p>กรุณาเลือกสาขาก่อนจัดการข้อมูลลูกค้า</p>:null}
    <input className="w-full rounded-xl border border-slate-300 p-3" value={search} onChange={e=>setSearch(e.target.value)}
      placeholder="ค้นหารหัสลูกค้า ชื่อ หรือเบอร์โทร" aria-label="ค้นหาลูกค้าแว่นตา"/>
    {loading?<p>กำลังโหลดข้อมูลลูกค้า...</p>:
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full text-left text-sm">
        <thead><tr className="bg-slate-50"><th className="p-3">รหัสลูกค้า</th><th className="p-3">ชื่อ–นามสกุล</th><th className="p-3">โทรศัพท์</th><th className="p-3">ตรวจล่าสุด</th><th className="p-3">จัดการ</th></tr></thead>
        <tbody>{filtered.map(row=><tr key={row.id} className="border-t border-slate-100">
          <td className="p-3 font-bold">{row.customer_code}</td><td className="p-3">{row.full_name}</td><td className="p-3">{row.phone||"-"}</td><td className="p-3">{row.last_exam_date||"-"}</td>
          <td className="flex flex-wrap gap-2 p-3"><button className="rounded border px-3 py-1" onClick={()=>void openHistory(row)}>ประวัติ</button>
            <button className="rounded border px-3 py-1" onClick={()=>startEdit(row)}>แก้ไข/ตรวจใหม่</button>
            <button className="rounded border border-rose-200 px-3 py-1 text-rose-700" onClick={()=>void archive(row)}>เก็บถาวร</button></td>
        </tr>)}</tbody>
      </table>{filtered.length===0?<p className="p-4 text-sm text-slate-500">ไม่พบลูกค้า</p>:null}</div>}
    {historyFor?<div className="rounded-xl border border-emerald-200 bg-white p-4"><h3>ประวัติค่าสายตา: {historyFor}</h3>
      {exams.length===0?<p>ยังไม่มีผลตรวจย้อนหลัง</p>:<div className="overflow-x-auto"><table className="w-full text-left text-xs">
        <thead><tr><th>วันที่</th><th>R SPH/CYL/AX/ADD</th><th>L SPH/CYL/AX/ADD</th><th>PD</th><th>ผู้ตรวจ</th></tr></thead>
        <tbody>{exams.map(e=><tr key={e.id} className="border-t"><td className="p-2">{e.examined_at}</td>
          <td>{[e.right_sph,e.right_cyl,e.right_axis,e.right_add].map(x=>x??"-").join(" / ")}</td>
          <td>{[e.left_sph,e.left_cyl,e.left_axis,e.left_add].map(x=>x??"-").join(" / ")}</td>
          <td>{e.pd_mm??"-"}</td><td>{e.examiner_name??"-"}</td></tr>)}</tbody>
      </table></div>}</div>:null}
    {editing?<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4" role="presentation" onClick={()=>{if(!saving)setEditing(false);}}>
      <div role="dialog" aria-modal="true" aria-label="ข้อมูลลูกค้า Optical" onClick={e=>e.stopPropagation()} className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="mb-3 text-xl font-bold">{editor?"แก้ไขข้อมูลและเพิ่มผลตรวจใหม่":"เพิ่มประวัติลูกค้า"}</h3>
        <form className="grid gap-4" onSubmit={e=>void save(e)}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{field("customer_code","รหัสลูกค้า")}{field("full_name","ชื่อ–นามสกุล")}{field("phone","เบอร์โทร","tel")}{field("age","อายุ","number")}{field("exam_date","วันที่ตรวจล่าสุด","date")}{field("examiner_name","ผู้ตรวจ")}</div>
          <h4 className="font-bold">ค่าสายตาใหม่ R / L</h4>
          <div className="grid gap-3 sm:grid-cols-4">{(["right_sph","right_cyl","right_axis","right_add","left_sph","left_cyl","left_axis","left_add","pd_mm"] as const).map(k=>field(k,k.replace("right_","R ").replace("left_","L "),"number"))}</div>
          {field("previous_prescription","ค่าสายตาเดิม")}
          <label className="grid gap-1">หมายเหตุ<textarea className="rounded-lg border p-3" rows={2} value={form.notes} onChange={e=>change("notes",e.target.value)}/></label>
          <div className="flex justify-end gap-3"><button className="rounded border px-5 py-3" type="button" onClick={()=>setEditing(false)} disabled={saving}>ยกเลิก</button><button className="rounded bg-emerald-700 px-5 py-3 font-bold text-white" type="submit" disabled={saving}>{saving?"กำลังบันทึก":"บันทึกข้อมูล"}</button></div>
        </form>
      </div>
    </div>:null}
  </section>;
}
