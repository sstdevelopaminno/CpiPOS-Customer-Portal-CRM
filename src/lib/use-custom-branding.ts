import {useEffect,useState} from "react";
import {fetchCustomBranding,type CustomBranding} from "./custom-branding";
export function useCustomBranding(tenantId:string|undefined,isCustom:boolean){
 const [branding,setBranding]=useState<CustomBranding|null>(null);
 useEffect(()=>{
   if(!tenantId||!isCustom){setBranding(null);return;}
   let cancelled=false;
   async function refresh(){
     try{const b=await fetchCustomBranding(tenantId!);if(!cancelled)setBranding(b);}
     catch{if(!cancelled)setBranding(null);}
   }
   void refresh();
   window.addEventListener("cpipos-custom-branding-updated",refresh);
   return()=>{cancelled=true;window.removeEventListener("cpipos-custom-branding-updated",refresh);};
 },[tenantId,isCustom]);
 return branding;
}
