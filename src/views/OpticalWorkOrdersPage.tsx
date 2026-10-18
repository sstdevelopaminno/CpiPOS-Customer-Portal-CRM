import {useState} from "react";
import type {PortalContext} from "../types/portal";
import type {CrmSettingsLanguage} from "../lib/settings-language";
import {opticalText} from "../lib/optical-locale";
import {useOpticalStaffRights} from "../lib/use-optical-staff-rights";
import {OpticalWorkOrderDrafts} from "./OpticalWorkOrderDrafts";
import {OpticalOperationsView} from "./OpticalOperationsView";

/**
 * Dedicated PRIMARY navigation page for CUSTOM Optical work orders.
 * Uses existing order data, Draft RPC, and tenant Owner-issued employee grants.
 * It does not create a POS cart or enable payments.
 */
export function OpticalWorkOrdersPage({context,branchId,language}:{
  context:PortalContext;branchId:string;language:CrmSettingsLanguage;
}){
  const [reloadToken,setReloadToken]=useState(0);
  const effectiveBranch=branchId||context.branches[0]?.id||"";
  const rights=useOpticalStaffRights(context.role,context.tenantId,effectiveBranch,context.userId);
  const draftsEnabled=import.meta.env.VITE_OPTICAL_WORK_ORDER_DRAFTS_V1_ENABLED==="true"
    &&context.salesCurrencyCode==="LAK"
    &&(context.role==="owner"||(context.role==="staff"&&rights.ordersEdit));
  return <section className="space-y-4" aria-label={opticalText(language,"ใบสั่งงานแว่นตา")}>
    <header className="rounded-xl border border-emerald-100 bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">CUSTOM · OPTICAL WORK ORDERS</p>
      <h2 className="mt-1 text-2xl font-bold text-slate-950">{opticalText(language,"ใบสั่งงานแว่นตา")}</h2>
      <p className="mt-1 text-sm text-slate-600">{language==="en"
        ?"Customer work orders, printable job sheets and status history. POS checkout remains separate."
        :language==="lo"?"ລາຍການໃບສັ່ງງານ ພິມໃບງານ ແລະ ປະຫວັດສະຖານະ · ການຊຳລະເງິນຢູ່ຝັ່ງ POS"
        :"รายการใบสั่งงานลูกค้า พิมพ์ใบงาน และติดตามสถานะ · การรับชำระเงินอยู่ฝั่ง POS"}</p>
    </header>
    {!draftsEnabled?<p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      {language==="en"
        ?"Work orders are read-only until the tenant's draft-writing database migration and rollout are verified."
        :language==="lo"
          ?"ເບິ່ງລາຍການໃບງານໄດ້ ແຕ່ການສ້າງ/ແກ້ໄຂຍັງບໍ່ເປີດຈົນກວ່າກວດຖານຂໍ້ມູນແລ້ວ"
          :"เปิดดูใบงานได้ แต่การสร้างและแก้ไขยังปิดไว้จนกว่าจะตรวจฐานข้อมูลและสิทธิ์ครบ"}</p>:null}
    {draftsEnabled?<OpticalWorkOrderDrafts
      context={context} branchId={effectiveBranch} staffEditAllowed={rights.ordersEdit}
      onIssued={()=>setReloadToken(value=>value+1)}/>:null}
    <OpticalOperationsView context={context} branchId={effectiveBranch||null}
      page="orders" reloadToken={reloadToken}/>
  </section>;
}
