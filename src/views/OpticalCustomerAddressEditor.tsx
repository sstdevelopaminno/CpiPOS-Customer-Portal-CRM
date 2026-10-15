import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { PortalContext } from "../types/portal";

type Customer={id:string;customer_code:string;full_name:string;address:string|null};
export function OpticalCustomerAddressEditor({context,branchId}:{
  context:PortalContext;branchId:string|null
}){
  const branch=context.branches.find(x=>x.id===branchId)?.id??context.branches[0]?.id;
  const [customers,setCustomers]=useState<Customer[]>([]);
  const [selected,setSelected]=useState("");
  const [address,setAddress]=useState("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [saving,setSaving]=useState(false);
  useEffect(()=>{
    if(!branch)return;
    let active=true;
    void supabase.from("optical_customers").select("id,customer_code,full_name,address")
      .eq("tenant_id",context.tenantId).eq("branch_id",branch)
      .is("deleted_at",null).order("full_name").limit(300)
      .then(({data,error:e})=>{
        if(!active)return;
        if(e)setError("ยังไม่เปิดใช้งานข้อมูลที่อยู่ลูกค้าในสาขานี้");
        else setCustomers((data??[]) as Customer[]);
      });
    return()=>{active=false;};
  },[branch,context.tenantId]);
  const save=async()=>{
    if(!branch||!selected||saving)return;
    setSaving(true);setError("");setNotice("");
    const {error:e}=await supabase.rpc("optical_save_customer_address_v1",{
      p_tenant_id:context.tenantId,p_branch_id:branch,p_customer_id:selected,
      p_address:address,p_request_id:crypto.randomUUID()
    });
    if(e)setError("ไม่สามารถบันทึกที่อยู่ได้ กรุณาตรวจสอบสิทธิ์หรือสถานะโมดูล Optical");
    else{
      setCustomers(rows=>rows.map(row=>row.id===selected?{...row,address}:row));
      setNotice("บันทึกที่อยู่พร้อมประวัติการแก้ไขแล้ว โดยไม่เขียนทับผลตรวจสายตา");
    }
    setSaving(false);
  };
  return <section className="rounded-xl border border-emerald-200 bg-white p-4">
    <h3 className="font-bold text-emerald-800">ข้อมูลที่อยู่ลูกค้า Optical</h3>
    <p className="text-xs text-slate-500">ข้อมูลเดียวกับประวัติลูกค้าเดิม แยกประวัติแก้ไข ไม่ลบผลตรวจย้อนหลัง</p>
    {error?<p role="alert" className="my-2 rounded bg-rose-50 p-2 text-rose-700">{error}</p>:null}
    {notice?<p role="status" className="my-2 rounded bg-emerald-50 p-2 text-emerald-700">{notice}</p>:null}
    <label className="mt-3 block text-sm">เลือกลูกค้า
      <select value={selected} onChange={e=>{
        const value=e.target.value;setSelected(value);
        setAddress(customers.find(row=>row.id===value)?.address??"");
      }} className="mt-1 w-full rounded-lg border p-2">
        <option value="">เลือกลูกค้า</option>
        {customers.map(row=><option key={row.id} value={row.id}>
          {row.customer_code} · {row.full_name}
        </option>)}
      </select>
    </label>
    <label className="mt-3 block text-sm">ที่อยู่
      <textarea value={address} onChange={e=>setAddress(e.target.value)}
        maxLength={1500} rows={3} disabled={!selected||saving}
        className="mt-1 w-full rounded-lg border p-2"/>
    </label>
    <button type="button" onClick={()=>void save()} disabled={!selected||saving}
      className="mt-3 rounded-lg bg-emerald-700 px-4 py-2 font-bold text-white disabled:opacity-40">
      บันทึกที่อยู่
    </button>
  </section>;
}
