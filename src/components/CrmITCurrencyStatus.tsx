import {useEffect,useState} from "react";
import {readITApprovedSalesCurrency,type SalesCurrencyCode} from "../lib/it-approved-sales-currency";

type State={tenantId:string;status:"checking"|"ready"|"unavailable";code:SalesCurrencyCode|null};
const labels={
  th:{title:"สกุลเงินขายที่ IT อนุมัติ",old:"ยอดบิลย้อนหลังยังคงสกุลเงินเดิม",unknown:"ยังไม่สามารถตรวจสอบสกุลเงินได้"},
  en:{title:"IT-approved sales currency",old:"Historical receipts retain their original currency",unknown:"Unable to verify currency"},
  lo:{title:"ສະກຸນເງິນຂາຍທີ່ IT ອະນຸມັດ",old:"ບິນເກົ່າຍັງໃຊ້ສະກຸນເງິນເດີມ",unknown:"ຍັງກວດສອບສະກຸນເງິນບໍ່ໄດ້"}
} as const;

/** Tenant-scoped, low-cost current-currency polling. The table is not in
 * Supabase Realtime publication, so a browser-visible 10 s read is used.
 * Never rewrites product prices, historical orders, or the active POS shift. */
export function CrmITCurrencyStatus({tenantId,contextCurrency,language,onITCurrencyChanged}:{
  tenantId:string;
  contextCurrency:SalesCurrencyCode|null;
  language:"th"|"en"|"lo";
  onITCurrencyChanged:()=>Promise<void>;
}){
  const [snapshot,setSnapshot]=useState<State>({tenantId:"",status:"checking",code:null});
  useEffect(()=>{
    let alive=true;
    let busy=false;
    let lastNotified:SalesCurrencyCode|null=null;
    setSnapshot({tenantId,status:"checking",code:null});
    async function check(){
      if(!alive||busy||document.visibilityState==="hidden")return;
      busy=true;
      try{
        const code=await readITApprovedSalesCurrency(tenantId);
        if(!alive)return;
        setSnapshot({tenantId,status:code?"ready":"unavailable",code});
        if(code && code!==contextCurrency && lastNotified!==code){
          lastNotified=code;
          await onITCurrencyChanged(); // propagate LAK/THB to Optical stock and new-sale screens
        }
        if(code===contextCurrency)lastNotified=null;
      }catch{
        if(alive)setSnapshot({tenantId,status:"unavailable",code:null});
      }finally{busy=false;}
    }
    void check();
    const onFocus=()=>{void check();};
    window.addEventListener("focus",onFocus);
    document.addEventListener("visibilitychange",onFocus);
    const interval=window.setInterval(()=>{void check();},10_000);
    return()=>{
      alive=false;
      window.removeEventListener("focus",onFocus);
      document.removeEventListener("visibilitychange",onFocus);
      window.clearInterval(interval);
    };
  },[tenantId,contextCurrency,onITCurrencyChanged]);
  const text=labels[language];
  const valid=snapshot.tenantId===tenantId&&snapshot.status==="ready";
  return <div data-testid="crm-it-approved-sales-currency" role="status"
    className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <strong>{text.title}: <span data-testid="crm-current-currency-code">{valid?snapshot.code:"—"}</span></strong>
      <span className="text-xs text-emerald-800">{valid?text.old:snapshot.status==="checking"?"...":text.unknown}</span>
    </div>
  </div>;
}
