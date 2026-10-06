import { supabase } from "../supabase";
import type { MoreSnapshot } from "../../types/portal";

export async function loadMoreSnapshot(tenantId:string,branchId:string|null):Promise<MoreSnapshot>{
  const {data,error}=await supabase.rpc("customer_portal_more_snapshot",{
    p_tenant_id:tenantId,p_branch_id:branchId
  });
  if(error)throw error;
  return data as unknown as MoreSnapshot;
}
