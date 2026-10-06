import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const JSON_HEADERS={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
function adminKey(){const set=Deno.env.get("SUPABASE_SECRET_KEYS");if(set){try{const p=JSON.parse(set) as Record<string,string>;if(p.default)return p.default;}catch{}}const legacy=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");if(legacy)return legacy;throw new Error("admin_key_missing");}
function allowedOrigin(req:Request){const o=req.headers.get("origin")??"";if(!o)return "";if(o==="http://localhost:5173"||o==="http://127.0.0.1:5173")return o;if(/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(o))return o;return "";}
function headers(req:Request){const o=allowedOrigin(req);return{...JSON_HEADERS,...(o?{"access-control-allow-origin":o,vary:"origin"}:{}),"access-control-allow-headers":"authorization, apikey, content-type, x-client-info","access-control-allow-methods":"POST, OPTIONS"};}
function json(req:Request,body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:headers(req)});}
async function sha256(input:string){const d=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(input));return Array.from(new Uint8Array(d)).map(v=>v.toString(16).padStart(2,"0")).join("");}
Deno.serve(async req=>{
  if(req.method==="OPTIONS"){if(!allowedOrigin(req))return json(req,{error:"origin_not_allowed"},403);return new Response(null,{status:204,headers:headers(req)});}
  if(req.method!=="POST")return json(req,{error:"method_not_allowed"},405);
  if(!allowedOrigin(req))return json(req,{error:"origin_not_allowed"},403);
  try{
    const body=await req.json().catch(()=>({})) as Record<string,unknown>;
    const storeCode=String(body.store_code??"").trim(),pin=String(body.pin??"").trim();
    if(!/^[A-Za-z0-9_-]{3,32}$/.test(storeCode)||!/^[0-9]{4,12}$/.test(pin))return json(req,{error:"invalid_credentials"},401);
    const forwarded=req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()??"";
    const clientIp=req.headers.get("cf-connecting-ip")?.trim()||forwarded||"unknown";
    const clientKey=await sha256(`${clientIp}|${(req.headers.get("user-agent")??"unknown").slice(0,180)}`);
    const admin=createClient(Deno.env.get("SUPABASE_URL")??"",adminKey(),{auth:{persistSession:false,autoRefreshToken:false}});
    const{data:candidates,error:authError}=await admin.rpc("customer_portal_authenticate",{p_store_code:storeCode,p_pin:pin,p_client_key:clientKey});
    if(authError){if(authError.message?.includes("portal_rate_limited"))return json(req,{error:"too_many_attempts",retry_after_seconds:900},429);console.error("[customer-portal-login] rpc failed",authError.code??"rpc_error");return json(req,{error:"login_unavailable"},503);}
    const candidate=Array.isArray(candidates)?candidates[0]:null;
    if(!candidate?.email||!candidate?.user_id)return json(req,{error:"invalid_credentials"},401);
    const{data:linkData,error:linkError}=await admin.auth.admin.generateLink({type:"magiclink",email:String(candidate.email)});
    if(linkError||!linkData?.properties?.hashed_token){console.error("[customer-portal-login] token generation failed",linkError?.message??"missing_token");return json(req,{error:"login_unavailable"},503);}
    return json(req,{ok:true,token_hash:linkData.properties.hashed_token,token_type:"email",tenant:{id:candidate.tenant_id,code:candidate.tenant_code,name:candidate.tenant_name},role:candidate.portal_role});
  }catch(error){console.error("[customer-portal-login] unexpected",error instanceof Error?error.message:"unknown_error");return json(req,{error:"login_unavailable"},503);}
});
