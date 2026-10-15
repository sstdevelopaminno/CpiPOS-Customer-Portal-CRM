import {supabase} from "./supabase";

export type CustomBranding={system_name:string;accent_color:string;sidebar_color:string;logo_url:string|null};
export const BRANDING_DEFAULT:CustomBranding={
 system_name:"CpiPOS",accent_color:"#1453A6",sidebar_color:"#071B37",logo_url:null
};
function validColor(color:unknown,fallback:string){
 return typeof color==="string"&&/^#[0-9a-fA-F]{6}$/.test(color)?color:fallback;
}
export function normalizeBranding(raw:unknown):CustomBranding{
 const d=raw&&typeof raw==="object"?raw as Record<string,unknown>:{};
 const name=typeof d.system_name==="string"?d.system_name.trim():"";
 const url=typeof d.logo_url==="string"&&d.logo_url.startsWith("https://")
   &&d.logo_url.includes("/storage/v1/object/public/custom-branding/")?d.logo_url:null;
 return {system_name:name.length>=2&&name.length<=55&&!/[<>]/.test(name)?name:"CpiPOS",
  accent_color:validColor(d.accent_color,BRANDING_DEFAULT.accent_color),
  sidebar_color:validColor(d.sidebar_color,BRANDING_DEFAULT.sidebar_color),logo_url:url};
}
export async function fetchCustomBranding(tenantId:string){
 const {data,error}=await supabase.rpc("customer_portal_custom_branding_v1",{
  p_tenant_id:tenantId
 });
 if(error)throw error;
 return normalizeBranding(data);
}
export async function saveCustomBranding(tenantId:string,payload:CustomBranding){
 const {data,error}=await supabase.rpc("customer_portal_custom_branding_v1",{
  p_tenant_id:tenantId,p_payload:payload
 });
 if(error)throw error;
 return normalizeBranding(data);
}
export async function uploadCustomBrandingLogo(tenantId:string,file:File){
 if(file.size<1||file.size>1048576||!["image/png","image/jpeg","image/webp"].includes(file.type))
  throw new Error("โลโก้ต้องเป็น JPG PNG WebP และไม่เกิน 1 MB");
 const ext=file.type==="image/png"?"png":file.type==="image/webp"?"webp":"jpg";
 const path=tenantId+"/"+crypto.randomUUID()+"."+ext;
 const {error}=await supabase.storage.from("custom-branding").upload(path,file,{
  contentType:file.type,cacheControl:"31536000",upsert:false
 });
 if(error)throw error;
 return supabase.storage.from("custom-branding").getPublicUrl(path).data.publicUrl;
}
