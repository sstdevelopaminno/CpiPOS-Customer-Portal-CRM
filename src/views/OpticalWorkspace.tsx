import type { PortalContext } from "../types/portal";
import type { CrmSettingsLanguage } from "../lib/settings-language";
import { settingsText } from "../lib/settings-language";
import { opticalText } from "../lib/optical-locale";
import { BusinessStockOverview } from "./BusinessStockOverview";
import { OpticalCustomersView } from "./OpticalCustomersView";
import { OpticalCustomerAddressEditor } from "./OpticalCustomerAddressEditor";
import { OpticalOperationsView } from "./OpticalOperationsView";

export type OpticalTab = "customers" | "orders" | "stock" | "reports";
type Props = {
  context: PortalContext;
  branchId: string;
  language: CrmSettingsLanguage;
  stockBusinessMode: string;
  activeOpticalTab: OpticalTab|null;
  opticalTabsAllowed: OpticalTab[];
  opticalFinanceUiEnabled: boolean;
  canSeeStock: boolean;
  setOpticalTab: (tab:OpticalTab)=>void;
};

/** Keep the existing POS cart independent of this CRM read-only work-order shell. */
export function OpticalWorkspace({context,branchId,language,stockBusinessMode,activeOpticalTab,
  opticalTabsAllowed,opticalFinanceUiEnabled,canSeeStock,setOpticalTab}:Props){
  return (
    <div className="space-y-4">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label={opticalText(language,"ใบสั่งงานแว่นตา")}>
            {([["customers","ประวัติลูกค้า"],["orders","ใบสั่งงานแว่นตา"],
              ["stock","สต๊อกกรอบแว่นและเลนส์"],["reports","รายงานเจ้าของร้าน"]] as const)
              .filter(([id])=>opticalTabsAllowed.includes(id))
              .filter(([id])=>id!=="reports"||opticalFinanceUiEnabled)
              .map(([id,label])=><button type="button" role="tab"
                aria-selected={activeOpticalTab===id} key={id} onClick={()=>setOpticalTab(id)}
                className={`rounded-xl border px-4 py-2 text-sm font-bold ${activeOpticalTab===id?"border-emerald-700 bg-emerald-700 text-white":"border-emerald-100 bg-white text-emerald-800"}`}>{opticalText(language,label)}</button>)}
          </div>
          {activeOpticalTab==="stock" && canSeeStock ? (
            <BusinessStockOverview context={context} branchId={branchId||null} business="optical" strictOpticalCategory={stockBusinessMode==="mixed"}/>
          ) : activeOpticalTab==="stock" ? (
            <p role="alert">{opticalText(language,"สต๊อกกรอบแว่นและเลนส์")} — {settingsText(language,"ไม่ได้เปิดในแพ็กเกจ/ถูก IT ปิด")}</p>
          ) : activeOpticalTab==="customers"?<div className="space-y-4">
            <OpticalCustomersView context={context} branchId={branchId||null} readOnly={context.role==="staff"}/>
            {context.role!=="staff"?<OpticalCustomerAddressEditor context={context} branchId={branchId||null}/>:null}
          </div> : activeOpticalTab==="reports"&&!opticalFinanceUiEnabled ? (
            <p role="alert">{opticalText(language,"รายงานเจ้าของร้าน")} — {settingsText(language,"ไม่ได้เปิดในแพ็กเกจ/ถูก IT ปิด")}</p>
          ) : activeOpticalTab==="reports"&&context.role!=="owner" ? (
            <p role="alert">{opticalText(language,"รายงานเจ้าของร้าน")} — Owner</p>
          ) : (
            <div className="space-y-3">
              {activeOpticalTab==="orders"&&(!opticalFinanceUiEnabled||context.role==="staff")?
                <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  {language==="en"?"Work-order list only. Creating, editing and checkout are locked until the Optical finance rollout is approved.":language==="lo"?"ສະແດງລາຍການໃບງານເທົ່ານັ້ນ; ການສ້າງ ແກ້ໄຂ ແລະ ຊຳລະເງິນ ຍັງບໍ່ເປີດໃຊ້":"เปิดดูรายการใบงานเท่านั้น การสร้าง แก้ไข และชำระเงินจริงยังปิดไว้จนผ่านการทดสอบและอนุมัติเปิดโมดูล"}
                </p>:null}
              <OpticalOperationsView context={context} branchId={branchId||null} page={activeOpticalTab==="reports"?"reports":"orders"}/>
            </div>
          )}
        </div>
  );
}
