import {supabase} from "./supabase";

export type SalesCurrencyCode="THB"|"LAK"|"USD";
export type CurrencyContractSnapshot={
  metadata:Record<string,unknown>|null;
  status:string|null;
  ended_at:string|null;
};

/** The IT-approved NEW-SALES currency is stored on the latest contract, never
 * derived from historical receipts. Old contracts without a currency field
 * retain their original THB default. A failed or expired contract is unknown. */
export function currencyFromITContract(contract:CurrencyContractSnapshot|null,now=Date.now()):SalesCurrencyCode|null{
  if(!contract||!["active","trial"].includes(contract.status??""))return null;
  if(contract.ended_at){
    const end=Date.parse(contract.ended_at);
    if(!Number.isFinite(end)||end<=now)return null;
  }
  const raw=contract.metadata?.pos_currency_code;
  if(raw==null)return "THB"; // backward-compatible older tenants
  return raw==="THB"||raw==="LAK"||raw==="USD"?raw:null;
}

export async function readITApprovedSalesCurrency(tenantId:string):Promise<SalesCurrencyCode|null>{
  if(!tenantId)throw new Error("tenant_required");
  const {data,error}=await supabase.from("tenant_subscription_contracts")
    .select("metadata,status,ended_at")
    .eq("tenant_id",tenantId)
    .order("created_at",{ascending:false})
    .limit(1).maybeSingle();
  if(error)throw error; // never substitute THB on an RLS/network error
  return currencyFromITContract(data as CurrencyContractSnapshot|null);
}
