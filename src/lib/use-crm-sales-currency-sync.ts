import { useEffect } from "react";
import { supabase } from "./supabase";

/** Follow IT-approved contract currency. Real-time when published; refresh on focus and
 * a slow visible-tab fallback when the table is not published to Realtime.
 * Never converts, rewrites or relabels historical orders. */
export function useCrmSalesCurrencySync(tenantId:string|null,reloadContext:()=>Promise<void>){
  useEffect(()=>{
    if(!tenantId)return;
    let last=Date.now();
    let active=true;
    const refresh=()=>{
      if(!active||document.visibilityState==="hidden"||Date.now()-last<5000)return;
      last=Date.now();
      void reloadContext();
    };
    const onFocus=()=>refresh();
    const onVisible=()=>{if(document.visibilityState==="visible")refresh();};
    window.addEventListener("focus",onFocus);
    document.addEventListener("visibilitychange",onVisible);
    const timer=window.setInterval(refresh,30_000);
    const channel=supabase.channel("crm-contract-currency-"+tenantId)
      .on("postgres_changes",{
        event:"UPDATE",schema:"public",table:"tenant_subscription_contracts",
        filter:"tenant_id=eq."+tenantId
      },()=>{last=0;refresh();})
      .subscribe();
    return()=>{
      active=false;
      window.removeEventListener("focus",onFocus);
      document.removeEventListener("visibilitychange",onVisible);
      window.clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  },[tenantId,reloadContext]);
}
