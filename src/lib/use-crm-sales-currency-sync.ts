import { useEffect } from "react";
import { supabase } from "./supabase";
import type {PortalRole} from "../types/portal";

/** Lightweight visible-tab reconciliation, plus Realtime if the contract table
 * is ever published. Historical receipts always retain their recorded currency.
 * Staff look up only their authorized scoped RPC, never the billing contract. */
export function useCrmSalesCurrencySync(
  tenantId:string|null,role:PortalRole|null,branchId:string|null,
  currentCurrency:string|null,reloadContext:()=>Promise<void>
){
  useEffect(()=>{
    if(!tenantId||!role)return;
    let active=true;
    let busy=false;
    let lastRefresh=0;
    const refreshContext=()=>{
      if(!active||document.visibilityState==="hidden"||
         Date.now()-lastRefresh<5000)return;
      lastRefresh=Date.now();
      void reloadContext();
    };
    const check=async()=>{
      if(!active||busy||document.visibilityState==="hidden")return;
      busy=true;
      try{
        let code:string|null=null;
        if(role==="staff"){
          if(!branchId)return;
          const {data,error}=await supabase.rpc("customer_portal_staff_feature_state_v1",{
            p_tenant_id:tenantId,p_branch_id:branchId
          });
          if(error){refreshContext();return;}
          const value=(data??{}) as Record<string,unknown>;
          const candidate=value.sales_currency_code;
          if(candidate==="LAK"||candidate==="THB"||candidate==="USD")code=candidate;
        }else{
          const {data,error}=await supabase.from("tenant_subscription_contracts")
            .select("metadata").eq("tenant_id",tenantId).eq("status","active")
            .order("created_at",{ascending:false}).limit(1).maybeSingle();
          if(error)return;
          const candidate=(data?.metadata as Record<string,unknown>|null)?.pos_currency_code;
          if(candidate==="LAK"||candidate==="THB"||candidate==="USD")code=candidate;
        }
        if(active&&code!==null&&code!==currentCurrency)refreshContext();
      }catch{ /* Existing permissions and currency remain unchanged on outage. */ }
      finally{busy=false;}
    };
    const onFocus=()=>{refreshContext();};
    const onVisible=()=>{if(document.visibilityState==="visible")refreshContext();};
    window.addEventListener("focus",onFocus);
    document.addEventListener("visibilitychange",onVisible);
    // Supabase live publication currently excludes this contract table.
    // Poll only one small scoped read per visible tab, rather than a full context.
    const timer=window.setInterval(()=>{void check();},10_000);
    const channel=supabase.channel("crm-contract-currency-"+tenantId)
      .on("postgres_changes",{
        event:"UPDATE",schema:"public",table:"tenant_subscription_contracts",
        filter:"tenant_id=eq."+tenantId
      },refreshContext).subscribe();
    return()=>{
      active=false;
      window.removeEventListener("focus",onFocus);
      document.removeEventListener("visibilitychange",onVisible);
      window.clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  },[tenantId,role,branchId,currentCurrency,reloadContext]);
}
