import {useEffect,useState} from "react";
import { settingsText, type CrmSettingsLanguage } from "../lib/settings-language";
import {BRANDING_DEFAULT,fetchCustomBranding,saveCustomBranding,
 uploadCustomBrandingLogo,type CustomBranding} from "../lib/custom-branding";

const colors=["#1453A6","#047857","#7C3AED","#DB2777","#EA580C","#0F766E","#DC2626","#0F172A"];
export function CustomBrandingEditor({tenantId,onSaved,language="th"}:{tenantId:string;onSaved:()=>void;language?:CrmSettingsLanguage}){
 const T=(value:string)=>settingsText(language,value);
 const [form,setForm]=useState<CustomBranding>(BRANDING_DEFAULT);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const [success,setSuccess]=useState("");
 const [fileKey,setFileKey]=useState(0);
 useEffect(()=>{let active=true;
  void fetchCustomBranding(tenantId).then(v=>{if(active)setForm(v);})
   .catch(()=>{if(active)setError(T("ไม่สามารถอ่านธีมได้ กรุณาตรวจสอบสิทธิ์ CUSTOM และฐานข้อมูล"));})
   .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false};
 },[tenantId]);
 async function uploadLogo(file:File|null){
  if(!file||busy)return;
  setBusy(true);setError("");setSuccess("");
  try{const logo_url=await uploadCustomBrandingLogo(tenantId,file);setForm(v=>({...v,logo_url}));}
  catch(e){setError(e instanceof Error?e.message:T("อัปโหลดไม่สำเร็จ"));}
  finally{setBusy(false);}
 }
 async function save(nextForm:CustomBranding=form,reset=false){
  setBusy(true);setError("");setSuccess("");
  try{
   if(nextForm.system_name.trim().length<2||nextForm.system_name.trim().length>55)throw new Error(T("ชื่อระบบต้องมี 2–55 ตัวอักษร"));
   const next=await saveCustomBranding(tenantId,nextForm);
   setForm(next);if(reset)setFileKey(k=>k+1);
   setSuccess(T(reset?"คืนค่าสี โลโก้ และชื่อระบบ CpiPOS เดิมแล้ว ทั้ง POS และ CRM":"บันทึกการตั้งค่าร่วมกับ POS สำเร็จ"));
   onSaved();
  }catch(e){setError(e instanceof Error?e.message:T("บันทึกธีมไม่สำเร็จ"));}
  finally{setBusy(false);}
 }
 async function resetBrand(){
  if(loading||busy)return;
  if(!window.confirm(T("ยืนยันคืนค่าสี โลโก้ และชื่อระบบ CpiPOS เดิม? ข้อมูลสินค้าและข้อมูลร้านจะไม่เปลี่ยน")))return;
  await save({...BRANDING_DEFAULT},true);
 }
 return <div className="entityForm">
  <p>{T("เปลี่ยนภาพลักษณ์ร้านได้โดยไม่เปลี่ยนผู้ผลิต")} <strong>Powered by CpiPOS</strong></p>
  {loading?<p role="status">{T("กำลังโหลดธีม...")}</p>:null}
  {!loading?<div className="formGrid">
   <label className="span2"><span>{T("ชื่อระบบที่แสดง")}</span><input value={form.system_name} maxLength={55}
    onChange={e=>setForm(v=>({...v,system_name:e.target.value}))}/></label>
   <label className="span2"><span>{T("โลโก้ของร้าน JPG / PNG / WebP ไม่เกิน 1 MB")}</span>
    <input key={fileKey} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy}
     onChange={e=>void uploadLogo(e.currentTarget.files?.[0]??null)}/></label>
   {form.logo_url?<div className="span2" style={{display:"flex",gap:12,alignItems:"center"}}>
     <img alt={T("โลโก้ร้าน")} src={form.logo_url} style={{width:64,height:64,objectFit:"contain",borderRadius:8}}/>
     <button type="button" className="secondaryButton" onClick={()=>setForm(v=>({...v,logo_url:null}))}>{T("ไม่ใช้โลโก้นี้")}</button>
   </div>:null}
   <div className="span2"><strong>{T("สีไฮไลต์")}</strong><div style={{display:"flex",gap:8,marginTop:8,flexWrap:"wrap"}}>
     {colors.map(color=><button key={color} type="button" title={color} aria-label={T("เลือกสี")+" "+color}
      aria-pressed={form.accent_color.toUpperCase()===color}
      onClick={()=>setForm(v=>({...v,accent_color:color}))}
      style={{width:38,height:38,borderRadius:10,background:color,
        border:form.accent_color.toUpperCase()===color?"3px solid #111":"3px solid white"}}/>)}
   </div></div>
   <label><span>{T("กำหนดสีไฮไลต์")}</span><input type="color" value={form.accent_color}
    onChange={e=>setForm(v=>({...v,accent_color:e.target.value}))}/></label>
   <label><span>{T("สีพื้นหลังเมนู")}</span><input type="color" value={form.sidebar_color}
    onChange={e=>setForm(v=>({...v,sidebar_color:e.target.value}))}/></label>
   <div className="span2" style={{borderRadius:14,overflow:"hidden",border:"1px solid #d7e3df"}}>
    <div style={{padding:20,background:form.sidebar_color,color:"white"}}>
     <div style={{display:"flex",alignItems:"center",gap:12}}>
      {form.logo_url?<img alt="" src={form.logo_url} style={{height:45,width:45,objectFit:"contain",background:"white",borderRadius:8}}/>:null}
      <div><strong>{form.system_name||T("ชื่อระบบ")}</strong><small style={{display:"block"}}>Powered by CpiPOS</small></div>
     </div>
     <div style={{background:form.accent_color,padding:12,borderRadius:8,marginTop:18}}>{T("เมนูที่เลือก · ไฮไลต์")}</div>
     <div style={{padding:12,marginTop:4}}>{T("เมนูปกติ")}</div>
    </div>
   </div>
  </div>:null}
  {error?<p role="alert" style={{color:"#b91c1c"}}>{error}</p>:null}
  {success?<p role="status" style={{color:"#047857"}}>{success}</p>:null}
  <div className="modalActions"><button className="primaryAction" type="button" onClick={()=>void save()} disabled={busy||loading}>
   {T(busy?"กำลังบันทึก...":"บันทึกธีมสี โลโก้ และชื่อระบบ")}</button>
   <button type="button" className="secondaryButton" disabled={busy||loading}
     onClick={()=>void resetBrand()}>{T("คืนค่าธีม โลโก้ และชื่อระบบ CpiPOS เดิม")}</button></div>
 </div>;
}
