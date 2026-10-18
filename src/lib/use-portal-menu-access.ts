import {useCallback,useEffect,useRef,useState} from "react";
import {loadFeatureState,type FeatureState} from "./portal";

/** Reconcile IT CRM switches while visible and on focus, using tenant-scoped RPC.
 * Any lookup failure closes navigation rather than reusing stale authorizations.
 */
export function usePortalMenuAccess(tenantId:string|null,branchId:string){
  const [menuAccess,setMenuAccess]=useState<FeatureState|null>(null);
  const [menuAccessError,setMenuAccessError]=useState(false);
  const request=useRef(0);
  const reloadMenuAccess=useCallback(async()=>{
    const token=++request.current;
    if(!tenantId){setMenuAccess(null);setMenuAccessError(false);return;}
    try{
      const state=await loadFeatureState(tenantId,branchId||null);
      if(token===request.current){setMenuAccess(state);setMenuAccessError(false);}
    }catch{
      if(token===request.current){setMenuAccess(null);setMenuAccessError(true);}
    }
  },[tenantId,branchId]);
  useEffect(()=>{
    setMenuAccess(null);setMenuAccessError(false);
    void reloadMenuAccess();
    let last=Date.now();
    const refresh=()=>{
      if(Date.now()-last<5000)return;
      last=Date.now();void reloadMenuAccess();
    };
    const onVisibility=()=>{if(document.visibilityState==="visible")refresh();};
    window.addEventListener("focus",refresh);
    document.addEventListener("visibilitychange",onVisibility);
    // IT may close a submenu while this CRM tab stays open. Revalidate rather
    // than waiting for a manual page refresh; never poll hidden browser tabs.
    const interval=window.setInterval(()=>{
      if(document.visibilityState==="visible")void reloadMenuAccess();
    },10_000);
    return()=>{
      request.current++;
      window.clearInterval(interval);
      window.removeEventListener("focus",refresh);
      document.removeEventListener("visibilitychange",onVisibility);
    };
  },[reloadMenuAccess]);
  return {menuAccess,menuAccessError,reloadMenuAccess};
}
