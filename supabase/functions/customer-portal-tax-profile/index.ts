import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const JSON_HEADERS={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const GEO_URL="https://raw.githubusercontent.com/thailand-geography-data/thailand-geography-json/main/src/geography.json";
const CACHE_MS=24*60*60*1000;
type GeoRow={provinceCode?:number|string;provinceNameTh?:string;districtCode?:number|string;districtNameTh?:string;subdistrictCode?:number|string;subdistrictNameTh?:string;postalCode?:number|string};
let geoCache:{expires:number;rows:GeoRow[]}|null=null;

function secretKey(){const set=Deno.env.get("SUPABASE_SECRET_KEYS");if(set){try{const p=JSON.parse(set) as Record<string,string>;if(p.default)return p.default;}catch{}}const legacy=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");if(legacy)return legacy;throw new Error("admin_key_missing");}
function publishableKey(){const set=Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");if(set){try{const p=JSON.parse(set) as Record<string,string>;if(p.default)return p.default;}catch{}}const legacy=Deno.env.get("SUPABASE_ANON_KEY");if(legacy)return legacy;throw new Error("publishable_key_missing");}
function allowedOrigin(req:Request){const o=req.headers.get("origin")??"";if(!o)return "";if(o==="http://localhost:5173"||o==="http://127.0.0.1:5173")return o;if(/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(o))return o;return "";}
function headers(req:Request){const o=allowedOrigin(req);return{...JSON_HEADERS,...(o?{"access-control-allow-origin":o,vary:"origin"}:{}),"access-control-allow-headers":"authorization, apikey, content-type, x-client-info","access-control-allow-methods":"POST, OPTIONS"};}
function json(req:Request,body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:headers(req)});}
function digits(v:unknown){return String(v??"").replace(/[^0-9]/g,"");}
function validTaxId(v:unknown){const d=digits(v);if(!/^\d{13}$/.test(d))return false;let sum=0;for(let i=0;i<12;i++)sum+=Number(d[i])*(13-i);return((11-(sum%11))%10)===Number(d[12]);}
async function loadGeo(){if(geoCache&&geoCache.expires>Date.now())return geoCache.rows;const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),8000);try{const response=await fetch(GEO_URL,{headers:{"accept":"application/json","user-agent":"CpiPOS-Customer-Portal/1.0"},signal:controller.signal});if(!response.ok)throw new Error("thai_address_source_http_"+response.status);const rows=await response.json() as GeoRow[];if(!Array.isArray(rows))throw new Error("thai_address_source_invalid");geoCache={rows,expires:Date.now()+CACHE_MS};return rows;}finally{clearTimeout(timer);}}
async function addressOptions(postal:string){const rows=await loadGeo();const seen=new Set<string>();const out:Array<Record<string,string>>=[];for(const row of rows){if(String(row.postalCode??"")!==postal)continue;const option={postal_code:postal,subdistrict:String(row.subdistrictNameTh??"").trim(),district:String(row.districtNameTh??"").trim(),province:String(row.provinceNameTh??"").trim(),subdistrict_code:String(row.subdistrictCode??""),district_code:String(row.districtCode??""),province_code:String(row.provinceCode??"")};if(!option.subdistrict||!option.district||!option.province)continue;const key=[option.subdistrict,option.district,option.province].join("|");if(seen.has(key))continue;seen.add(key);out.push(option);}return out.sort((a,b)=>(a.province+a.district+a.subdistrict).localeCompare(b.province+b.district+b.subdistrict,"th"));}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS"){if(!allowedOrigin(req))return json(req,{error:"origin_not_allowed"},403);return new Response(null,{status:204,headers:headers(req)});}
  if(req.method!=="POST")return json(req,{error:"method_not_allowed"},405);
  if(!allowedOrigin(req))return json(req,{error:"origin_not_allowed"},403);
  const authHeader=req.headers.get("authorization")??"";const token=authHeader.replace(/^Bearer\s+/i,"").trim();if(!token)return json(req,{error:"unauthorized"},401);
  const url=Deno.env.get("SUPABASE_URL")??"";const admin=createClient(url,secretKey(),{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:userData,error:userError}=await admin.auth.getUser(token);const actor=userData.user;if(userError||!actor)return json(req,{error:"unauthorized"},401);
  try{
    const body=await req.json().catch(()=>({})) as Record<string,unknown>;const action=String(body.action??"lookup_address");
    const tenantId=String(body.tenant_id??"");const branchId=String(body.branch_id??"");if(!UUID.test(tenantId)||!UUID.test(branchId))return json(req,{error:"invalid_scope"},422);
    const [{data:profile,error:profileError},{data:roles,error:roleError},{data:branch,error:branchError}]=await Promise.all([
      admin.from("users_profiles").select("is_active,archived_at").eq("id",actor.id).maybeSingle(),
      admin.from("user_branch_roles").select("branch_id,role").eq("tenant_id",tenantId).eq("user_id",actor.id),
      admin.from("branches").select("id,is_active").eq("tenant_id",tenantId).eq("id",branchId).maybeSingle()
    ]);
    if(profileError||roleError||branchError)return json(req,{error:"authorization_unavailable"},503);
    if(!profile?.is_active||profile.archived_at||!branch?.is_active)return json(req,{error:"forbidden"},403);
    const owner=(roles??[]).some(r=>r.role==="owner");const manager=(roles??[]).some(r=>r.role==="manager"&&r.branch_id===branchId);if(!owner&&!manager)return json(req,{error:"forbidden"},403);
    const userClient=createClient(url,publishableKey(),{global:{headers:{Authorization:authHeader}},auth:{persistSession:false,autoRefreshToken:false}});
    const {data:featureState,error:featureError}=await userClient.rpc("customer_portal_feature_state",{p_tenant_id:tenantId,p_branch_id:branchId});if(featureError)return json(req,{error:"feature_state_unavailable"},503);
    const state=(featureState??{}) as Record<string,unknown>;const packageFeatures=(state.package_features??{}) as Record<string,boolean>;const featureOverrides=(state.feature_overrides??{}) as Record<string,boolean>;const menuPolicy=(state.menu_policy??{}) as Record<string,boolean>;
    const base=Boolean(packageFeatures.core_pos_sales);const feature=Object.prototype.hasOwnProperty.call(featureOverrides,"core_pos_sales")?Boolean(featureOverrides.core_pos_sales):base;const menu=Object.prototype.hasOwnProperty.call(menuPolicy,"more.tax_invoices")?Boolean(menuPolicy["more.tax_invoices"]):true;if(!feature||!menu)return json(req,{error:"feature_not_enabled"},403);
    const postal=digits(body.postal_code);if(!/^\d{5}$/.test(postal))return json(req,{error:"postal_code_invalid"},422);const options=await addressOptions(postal);
    if(action==="lookup_address")return json(req,{ok:true,postal_code:postal,options,source:"thailand-geography-json"});
    if(action!=="create_profile")return json(req,{error:"invalid_action"},422);
    const entityType=String(body.entity_type??"");const displayName=String(body.display_name??"").trim();const taxId=digits(body.tax_id);const addressLine=String(body.address_line??"").trim();const subdistrict=String(body.subdistrict??"").trim();const district=String(body.district??"").trim();const province=String(body.province??"").trim();
    if(!["company","limited_partnership","shop","individual"].includes(entityType))return json(req,{error:"entity_type_invalid"},422);if(!displayName||displayName.length>200)return json(req,{error:"display_name_required"},422);if(!validTaxId(taxId))return json(req,{error:"tax_id_invalid"},422);if(!addressLine||addressLine.length>300)return json(req,{error:"address_required"},422);
    const exact=options.find(o=>o.subdistrict===subdistrict&&o.district===district&&o.province===province);if(!exact)return json(req,{error:"thai_address_selection_invalid"},422);
    const {data:created,error:createError}=await admin.from("pos_tax_invoice_profiles").insert({tenant_id:tenantId,branch_id:branchId,entity_type:entityType,display_name:displayName,tax_id:taxId,address_line:addressLine,subdistrict,district,province,postal_code:postal,created_by:actor.id,updated_by:actor.id,is_active:true}).select("id,entity_type,display_name,tax_id,address_line,subdistrict,district,province,postal_code,is_active,created_at,updated_at").single();
    if(createError){if(createError.code==="23505")return json(req,{error:"tax_profile_exists"},409);console.error("[customer-portal-tax-profile] insert",createError.message);return json(req,{error:"tax_profile_save_failed"},503);}
    await admin.from("audit_logs").insert({tenant_id:tenantId,branch_id:branchId,actor_user_id:actor.id,actor_role:owner?"owner":"manager",action:"tax_invoice_profile_created",target_table:"pos_tax_invoice_profiles",target_id:created.id,metadata:{source:"customer_portal",tax_id_last4:taxId.slice(-4),entity_type:entityType,address_source:"thailand-geography-json"},user_id:actor.id,role:owner?"owner":"manager",module:"customer_portal",entity_type:"tax_profile",entity_id:created.id});
    return json(req,{ok:true,profile:created},201);
  }catch(error){console.error("[customer-portal-tax-profile]",error instanceof Error?error.message:"unknown");const message=error instanceof Error?error.message:"";if(message.startsWith("thai_address_source_")||message==="AbortError")return json(req,{error:"thai_address_unavailable"},503);return json(req,{error:"tax_profile_unavailable"},503);}
});
