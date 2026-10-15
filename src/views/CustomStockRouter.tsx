import { useEffect, useState } from "react";
import type { FeatureState, PortalContext } from "../types/portal";
import { resolveCustomInventoryMode } from "../lib/custom-inventory-mode";
import { StockView } from "./StockView";
import { BusinessStockOverview } from "./BusinessStockOverview";
import { OpticalOperationsView } from "./OpticalOperationsView";

export function CustomStockRouter({context,branchId,features}:{
  context:PortalContext;branchId:string|null;features:FeatureState;
}) {
  const mode=resolveCustomInventoryMode(features);
  const [selected,setSelected]=useState<"optical"|"other">("optical");
  useEffect(()=>setSelected("optical"),[context.tenantId,branchId,mode]);
  const canUseLiveOpticalStock=import.meta.env.VITE_OPTICAL_OPS_V1_ENABLED==="true";
  const hasFood=["takeaway","dine_in","buffet_table","delivery"].some(
    mode=>features.sales_modes?.[mode]===true
  );

  // Existing restaurant and ordinary-package stock retains the exact same
  // StockView and ingredient mutations. CUSTOM without explicit mode grants
  // also falls back to the previous behavior.
  if(mode==="legacy")return <StockView context={context} branchId={branchId}/>;

  const opticalContent=canUseLiveOpticalStock
    ? <OpticalOperationsView context={context} branchId={branchId} page="stock"/>
    : <BusinessStockOverview context={context} branchId={branchId} business="optical" strictOpticalCategory={mode==="mixed"}/>;

  if(mode==="optical")return opticalContent;
  if(mode==="retail")return <BusinessStockOverview context={context} branchId={branchId} business="retail"/>;

  return <section>
    <div className="custom-stock-switch" role="tablist" aria-label="เลือกสต๊อกตามโหมด CUSTOM">
      <button type="button" role="tab" aria-selected={selected==="optical"}
        onClick={()=>setSelected("optical")}>สต๊อกกรอบแว่น / เลนส์</button>
      <button type="button" role="tab" aria-selected={selected==="other"}
        onClick={()=>setSelected("other")}>{hasFood?"สต๊อกอาหาร / วัตถุดิบ":"สต๊อกขายทั่วไป"}</button>
    </div>
    {selected==="optical" ? opticalContent
      : hasFood?<StockView context={context} branchId={branchId}/>
        :<BusinessStockOverview context={context} branchId={branchId} business="retail"/>}
  </section>;
}
