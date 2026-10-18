import {useCallback,useEffect,useRef,useState} from "react";
import {loadFeatureState,type FeatureState,type PortalRole} from "./portal";

/** Refresh IT control switches when CRM regains focus, without polling.
 * Any lookup failure closes navigation rather than reusing stale authorizations.
 */
export function usePortalMenuAccess(tenantId:string|null,branchId:string,role:PortalRole|null=null){
  const [menuAccess,setMenuAccess]=useState<FeatureState|null>(null);
  const [menuAccessError,setMenuAccessError]=useState(false);
  const request=useRef(0);
  const reloadMenuAccess=useCallback(async()=>{
    const token=++request.current;
    if(!tenantId){setMenuAccess(null);setMenuAccessError(false);return;}
    try{
      const state=await loadFeatureState(tenantId,branchId||null,role??"owner");
      if(token===request.current){setMenuAccess(state);setMenuAccessError(false);}
    }catch{
      if(token===request.current){setMenuAccess(null);setMenuAccessError(true);}
    }
  },[tenantId,branchId,role]);
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
    return()=>{
      request.current++;
      window.removeEventListener("focus",refresh);
      document.removeEventListener("visibilitychange",onVisibility);
    };
  },[reloadMenuAccess]);
  return {menuAccess,menuAccessError,reloadMenuAccess};
}
