import {useEffect,useState} from "react";
import {supabase} from "../lib/supabase";
import type {PortalContext,StaffRow} from "../types/portal";
import {Modal} from "../components/common";

type MenuKey="main.crm_optical_customers"|"main.crm_optical_orders";
type Permission={menu_key:MenuKey;can_view:boolean;can_edit:boolean};
const menuKeys:readonly MenuKey[]=["main.crm_optical_customers","main.crm_optical_orders"];
const descriptions:Record<MenuKey,string>={
  "main.crm_optical_customers":"ประวัติลูกค้าแว่นตา",
  "main.crm_optical_orders":"ใบสั่งงานแว่นตา"
};

/** Only a tenant Owner can assign individual employee rights; an IT toggle is
 * package eligibility, not an employee permission grant. Staged schema required. */
export function StaffCrmPermissionsModal({context,staff,onClose}:{
  context:PortalContext;staff:StaffRow;onClose:()=>void
}){
  const [entries,setEntries]=useState<Permission[]>(menuKeys.map(menu_key=>({
    menu_key,can_view:false,can_edit:false
  })));
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  useEffect(()=>{
    let cancelled=false;
    setLoading(true);setError("");
    void (async()=>{
      try{
        const {data,error}=await supabase.rpc("customer_portal_staff_crm_permissions_v1",{
          p_tenant_id:context.tenantId,p_branch_id:staff.branch_id,p_user_id:staff.user_id
        });
        if(error)throw error;
        if(cancelled)return;
        const rows:Permission[]=Array.isArray(data)?data as Permission[]:[];
        const map=new Map<MenuKey,Permission>(rows.map((item):[MenuKey,Permission]=>[item.menu_key,item]));
        setEntries(menuKeys.map(menu_key=>({
          menu_key,can_view:map.get(menu_key)?.can_view===true,
          can_edit:map.get(menu_key)?.can_edit===true
        })));
      }catch{if(!cancelled)setError("ยังไม่สามารถอ่านสิทธิ์ CRM ของพนักงานได้ กรุณาตรวจการเปิดโมดูลและฐานข้อมูล");}
      finally{if(!cancelled)setLoading(false);}
    })();
    return()=>{cancelled=true;};
  },[context.tenantId,staff.branch_id,staff.user_id]);
  async function save(){
    if(context.role!=="owner"||saving||loading||error)return;
    setSaving(true);setNotice("");
    try{
      for(const permission of entries){
        const {error}=await supabase.rpc("customer_portal_set_staff_crm_permission_v1",{
          p_tenant_id:context.tenantId,p_branch_id:staff.branch_id,p_user_id:staff.user_id,
          p_menu_key:permission.menu_key,p_can_view:permission.can_view,p_can_edit:false
        });
        if(error)throw error;
      }
      setNotice("บันทึกสิทธิ์เข้าดูเมนู CRM แล้ว · ต้องให้ IT เปิดสิทธิ์ Staff ของแพ็กเกจร่วมด้วย");
    }catch{setError("บันทึกสิทธิ์ไม่สำเร็จ กรุณาตรวจสอบ SQL Migration และสิทธิ์ Owner");}
    finally{setSaving(false);}
  }
  return <Modal title={`สิทธิ์ CRM · ${staff.full_name}`}
    subtitle="เจ้าของร้านกำหนดสิทธิ์รายพนักงาน · IT เปิดเพียงสิทธิ์ระดับแพ็กเกจ" onClose={onClose}>
    <div className="space-y-4">
      <p className="text-sm text-slate-600">สาขา: {staff.branch_name}. การแก้ไขข้อมูลลูกค้าและออกใบงานยังรอการทดสอบ API ฝั่งเซิร์ฟเวอร์ จึงไม่เปิดปุ่มแก้ไขก่อนปลอดภัย</p>
      {loading?<p role="status">กำลังตรวจสิทธิ์พนักงาน...</p>:null}
      {error?<p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>:null}
      {notice?<p role="status" className="rounded-lg bg-emerald-50 p-3 text-emerald-800">{notice}</p>:null}
      <div className="space-y-2">
        {entries.map(item=><div key={item.menu_key} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
          <strong>{descriptions[item.menu_key]}</strong>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={item.can_view}
              disabled={loading||saving||Boolean(error)}
              onChange={event=>setEntries(old=>old.map(row=>row.menu_key===item.menu_key?{
                ...row,can_view:event.target.checked,can_edit:false
              }:row))}/>ดูเมนู</label>
            <label className="flex items-center gap-2 text-sm text-slate-500"><input type="checkbox" checked={false} disabled/>แก้ไข (รอเปิด)</label>
          </div>
        </div>)}
      </div>
      <div className="flex justify-end gap-3">
        <button className="rounded-lg border px-4 py-2" type="button" onClick={onClose}>ปิด</button>
        <button className="rounded-lg bg-emerald-700 px-4 py-2 font-bold text-white" type="button"
          disabled={loading||saving||Boolean(error)||context.role!=="owner"} onClick={()=>void save()}>
          {saving?"กำลังบันทึก...":"บันทึกสิทธิ์ CRM"}
        </button>
      </div>
    </div>
  </Modal>;
}
