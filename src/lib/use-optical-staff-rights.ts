import {useCallback,useEffect,useRef,useState} from "react";
import {supabase} from "./supabase";
import type {PortalRole} from "../types/portal";
type Grant={menu_key:string;can_view:boolean;can_edit:boolean};
type Rights={customerEdit:boolean;ordersEdit:boolean};
const DENIED:Rights={customerEdit:false,ordersEdit:false};

/** UI capability hint. The SECURITY DEFINER RPC independently rechecks the
 * latest IT package approval, per-employee Owner grant, branch and role at write time.
 * A failed lookup never carries permissions from an earlier tenant or branch. */
export function useOpticalStaffRights(role:PortalRole,tenantId:string,branchId:string,userId:string){
  const [rights,setRights]=useState<Rights>(DENIED);
  const request=useRef(0);
  const refresh=useCallback(async()=>{
    const token=++request.current;
    setRights(DENIED);
    if(role!=="staff"||!tenantId||!branchId||!userId||
       import.meta.env.VITE_CRM_STAFF_ACCESS_V1_ENABLED!=="true")return;
    try{
      const {data,error}=await supabase.rpc("customer_portal_staff_crm_permissions_v1",{
        p_tenant_id:tenantId,p_branch_id:branchId,p_user_id:userId
      });
      if(error||!Array.isArray(data))return;
      const rows=data as Grant[];
      if(token!==request.current)return;
      const grant=(key:string)=>rows.some(r=>r.menu_key===key&&r.can_view===true&&r.can_edit===true);
      setRights({customerEdit:grant("main.crm_optical_customers"),
        ordersEdit:grant("main.crm_optical_orders")});
    }catch{if(token===request.current)setRights(DENIED);}
  },[role,tenantId,branchId,userId]);
  useEffect(()=>{
    void refresh();
    const whenFocus=()=>{if(document.visibilityState==="visible")void refresh();};
    window.addEventListener("focus",whenFocus);
    return()=>{request.current++;window.removeEventListener("focus",whenFocus);};
  },[refresh]);
  return role==="owner"?{customerEdit:true,ordersEdit:true}:
    role==="staff"?rights:DENIED;
}
