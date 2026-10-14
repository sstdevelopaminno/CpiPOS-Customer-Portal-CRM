import { TopicHub } from "../components/TopicHub";
import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, Bell, Building2, ChefHat, ChevronRight, CreditCard, Languages, LayoutPanelTop, LoaderCircle, MonitorSmartphone, Printer, QrCode, RefreshCw, Save, Settings, Store, UsersRound } from "lucide-react";
import { loadFeatureState, loadMoreSnapshot, loadSettingsSnapshot, saveSetting, type FeatureState, type MoreSnapshot, type PortalContext, type PortalView, type SettingsSnapshot } from "../lib/portal";
import { ConnectedPosModuleModal, ErrorPanel, Modal } from "../components/common";
import { number } from "../lib/formatters";
import { isCustomMenuVisible } from "../lib/custom-menu-access";
import { POS_SETTINGS_MENU_ITEMS, type PosMenuIcon, type PosSettingsEditorKind, type PosSettingsMenuItem } from "../config/pos-menu-catalog";
import { PosAdminWorkspace } from "./pos-admin/PosAdminWorkspace";
import { CRM_SETTINGS_LANGUAGE_STORAGE, languageOptions, normalizeCrmSettingsLanguage, settingsMenuLocale, settingsText, type CrmSettingsLanguage } from "../lib/settings-language";
import type { PosAdminModule } from "../types/pos-admin";

function SettingsMenuIcon({name}:{name:PosMenuIcon}) {
  if(name==="store")return <Store/>;
  if(name==="branch")return <Building2/>;
  if(name==="terminal")return <MonitorSmartphone/>;
  if(name==="printer")return <Printer/>;
  if(name==="activity")return <Activity/>;
  if(name==="payment")return <CreditCard/>;
  if(name==="tax")return <Settings/>;
  if(name==="bell")return <Bell/>;
  if(name==="users")return <UsersRound/>;
  if(name==="language")return <Languages/>;
  if(name==="placement")return <LayoutPanelTop/>;
  if(name==="display")return <MonitorSmartphone/>;
  if(name==="kitchen")return <ChefHat/>;
  if(name==="qr")return <QrCode/>;
  return <Settings/>;
}

type EditableSettingKind=PosSettingsEditorKind;

function SettingEditorModal({
  kind,context,branchId,snapshot,onClose,onSaved,onContextChanged,language
}:{
  kind:EditableSettingKind;
  context:PortalContext;
  branchId:string|null;
  snapshot:SettingsSnapshot;
  onClose:()=>void;
  onSaved:()=>Promise<void>;
  onContextChanged:()=>Promise<void>;
  language:CrmSettingsLanguage;
}){
  const T=(value:string)=>settingsText(language,value);
  const initialBranchId=branchId||snapshot.branches[0]?.id||"";
  const firstBranch=snapshot.branches.find(b=>b.id===initialBranchId)??snapshot.branches[0];
  const firstAccount=snapshot.payment_accounts.find(a=>a.branch_id===initialBranchId)||snapshot.payment_accounts.find(a=>a.applies_to_all_branches)||snapshot.payment_accounts[0];
  const firstTax=snapshot.tax_settings.find(x=>x.branch_id===initialBranchId);
  const firstNotify=snapshot.notifications.find(x=>x.branch_id===initialBranchId);

  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [storeDraft,setStoreDraft]=useState({
    display_name:snapshot.store?.display_name||snapshot.store?.name||"",
    company_address:snapshot.store?.company_address||"",
    contact_phone:snapshot.store?.contact_phone||snapshot.store?.owner_phone||""
  });
  const [branchChoice,setBranchChoice]=useState(firstBranch?.id||"__new__");
  const [branchDraft,setBranchDraft]=useState({
    id:firstBranch?.id||"",code:firstBranch?.code||"",name:firstBranch?.name||"",
    address:firstBranch?.address||"",is_active:firstBranch?.is_active??true
  });
  const [accountChoice,setAccountChoice]=useState(firstAccount?.id||"__new__");
  const [accountDraft,setAccountDraft]=useState({
    id:firstAccount?.id||"",bank_name:firstAccount?.bank_name||"",account_name:firstAccount?.account_name||"",
    account_number:firstAccount?.account_number||"",promptpay_phone:firstAccount?.promptpay_phone||"",
    qr_image_url:firstAccount?.qr_image_url||"",qr_mode:firstAccount?.qr_mode||"promptpay_link",
    applies_to_all_branches:firstAccount?.applies_to_all_branches??false,is_active:firstAccount?.is_active??true
  });
  const [scopeBranch,setScopeBranch]=useState(initialBranchId);
  const [taxDraft,setTaxDraft]=useState({
    is_enabled:firstTax?.is_enabled??false,
    calculation_base:firstTax?.calculation_base||"exclusive",
    settings:firstTax?.settings??{}
  });
  const [notificationDraft,setNotificationDraft]=useState({
    table_qr_popup_enabled:firstNotify?.table_qr_popup_enabled??true,
    table_qr_sound_enabled:firstNotify?.table_qr_sound_enabled??true,
    table_qr_sound_volume:Number(firstNotify?.table_qr_sound_volume??1),
    table_qr_popup_store_enabled:firstNotify?.table_qr_popup_store_enabled??true,
    table_qr_kitchen_auto_send_enabled:firstNotify?.table_qr_kitchen_auto_send_enabled??false,
    table_qr_kitchen_auto_print_enabled:firstNotify?.table_qr_kitchen_auto_print_enabled??false
  });

  function chooseBranch(value:string){
    setBranchChoice(value);
    if(value==="__new__"){setBranchDraft({id:"",code:"",name:"",address:"",is_active:true});return;}
    const row=snapshot.branches.find(b=>b.id===value);
    if(row)setBranchDraft({id:row.id,code:row.code||"",name:row.name,address:row.address||"",is_active:row.is_active});
  }
  function chooseAccount(value:string){
    setAccountChoice(value);
    if(value==="__new__"){setAccountDraft({id:"",bank_name:"",account_name:"",account_number:"",promptpay_phone:"",qr_image_url:"",qr_mode:"promptpay_link",applies_to_all_branches:false,is_active:true});return;}
    const row=snapshot.payment_accounts.find(a=>a.id===value);
    if(row){
      setScopeBranch(row.branch_id||initialBranchId);
      setAccountDraft({
        id:row.id,bank_name:row.bank_name||"",account_name:row.account_name||"",account_number:row.account_number||"",
        promptpay_phone:row.promptpay_phone||"",qr_image_url:row.qr_image_url||"",qr_mode:row.qr_mode||"promptpay_link",
        applies_to_all_branches:row.applies_to_all_branches??false,is_active:row.is_active??true
      });
    }
  }
  function changeScope(value:string){
    setScopeBranch(value);
    const tax=snapshot.tax_settings.find(x=>x.branch_id===value);
    setTaxDraft({is_enabled:tax?.is_enabled??false,calculation_base:tax?.calculation_base||"exclusive",settings:tax?.settings??{}});
    const n=snapshot.notifications.find(x=>x.branch_id===value);
    setNotificationDraft({
      table_qr_popup_enabled:n?.table_qr_popup_enabled??true,
      table_qr_sound_enabled:n?.table_qr_sound_enabled??true,
      table_qr_sound_volume:Number(n?.table_qr_sound_volume??1),
      table_qr_popup_store_enabled:n?.table_qr_popup_store_enabled??true,
      table_qr_kitchen_auto_send_enabled:n?.table_qr_kitchen_auto_send_enabled??false,
      table_qr_kitchen_auto_print_enabled:n?.table_qr_kitchen_auto_print_enabled??false
    });
  }

  async function submit(event:React.FormEvent){
    event.preventDefault();setBusy(true);setError("");
    if(kind==="payments"&&accountDraft.qr_mode==="promptpay_link"&&!accountDraft.promptpay_phone.trim()){
      setError("กรุณาระบุหมายเลข PromptPay");
      setBusy(false);
      return;
    }
    try{
      if(kind==="store")await saveSetting(context.tenantId,null,"update_store",storeDraft);
      if(kind==="branches")await saveSetting(context.tenantId,branchDraft.id||null,"save_branch",branchDraft);
      if(kind==="payments")await saveSetting(context.tenantId,scopeBranch||null,"save_payment_account",accountDraft);
      if(kind==="taxes")await saveSetting(context.tenantId,scopeBranch||null,"save_tax",taxDraft);
      if(kind==="notifications")await saveSetting(context.tenantId,scopeBranch||null,"save_notifications",notificationDraft);
      await onSaved();
      if(kind==="store"||kind==="branches")await onContextChanged();
      onClose();
    }catch(err){setError(err instanceof Error?err.message:"บันทึกการตั้งค่าไม่สำเร็จ");}
    finally{setBusy(false);}
  }

  const title=T(kind==="store"?"ข้อมูลร้านค้า/บริษัท":kind==="branches"?"สาขา":kind==="payments"?"ตั้งค่าชำระเงิน":kind==="taxes"?"ตั้งค่าภาษี":"การแจ้งเตือน");
  return <Modal title={title} subtitle={T("บันทึกลงข้อมูลกลาง CpiPOS-001 และ POS จะอ่านค่าชุดเดียวกัน")} onClose={onClose} wide>
    <form className="entityForm" onSubmit={submit}>
      {error?<ErrorPanel message={error}/>:null}
      <div className="formGrid">
        {kind==="store"?<>
          <label className="span2"><span>{T("ชื่อร้าน/ชื่อแสดงผล")}</span><input value={storeDraft.display_name} onChange={e=>setStoreDraft({...storeDraft,display_name:e.target.value})} required/></label>
          <label className="span2"><span>{T("ที่อยู่")}</span><input value={storeDraft.company_address} onChange={e=>setStoreDraft({...storeDraft,company_address:e.target.value})}/></label>
          <label className="span2"><span>{T("เบอร์ติดต่อ")}</span><input value={storeDraft.contact_phone} onChange={e=>setStoreDraft({...storeDraft,contact_phone:e.target.value})}/></label>
        </>:null}

        {kind==="branches"?<>
          <label className="span2"><span>{T("เลือกสาขา")}</span><select value={branchChoice} onChange={e=>chooseBranch(e.target.value)}>{snapshot.branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}<option value="__new__">{T("+ เพิ่มสาขาใหม่")}</option></select></label>
          <label><span>{T("รหัสสาขา")}</span><input value={branchDraft.code} onChange={e=>setBranchDraft({...branchDraft,code:e.target.value})} required/></label>
          <label><span>{T("ชื่อสาขา")}</span><input value={branchDraft.name} onChange={e=>setBranchDraft({...branchDraft,name:e.target.value})} required/></label>
          <label className="span2"><span>{T("ที่อยู่สาขา")}</span><input value={branchDraft.address} onChange={e=>setBranchDraft({...branchDraft,address:e.target.value})}/></label>
          <label className="switchField span2"><input type="checkbox" checked={branchDraft.is_active} onChange={e=>setBranchDraft({...branchDraft,is_active:e.target.checked})}/><span>{T("เปิดใช้งานสาขา")}</span></label>
        </>:null}

        {kind==="payments"?<>
          <label className="span2"><span>{T("บัญชี")}</span><select value={accountChoice} onChange={e=>chooseAccount(e.target.value)}>{snapshot.payment_accounts.map(a=><option key={a.id} value={a.id}>{a.bank_name||"บัญชี"} · ••••{String(a.account_number||"").slice(-4)}</option>)}<option value="__new__">{T("+ เพิ่มบัญชีใหม่")}</option></select></label>
          <label><span>{T("สาขา")}</span><select value={scopeBranch} onChange={e=>setScopeBranch(e.target.value)} disabled={accountDraft.applies_to_all_branches}>{snapshot.branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
          <label><span>{T("ธนาคาร")}</span><input value={accountDraft.bank_name} onChange={e=>setAccountDraft({...accountDraft,bank_name:e.target.value})} required/></label>
          <label><span>{T("ชื่อบัญชี")}</span><input value={accountDraft.account_name} onChange={e=>setAccountDraft({...accountDraft,account_name:e.target.value})}/></label>
          <label><span>{T("เลขบัญชี")}</span><input value={accountDraft.account_number} onChange={e=>setAccountDraft({...accountDraft,account_number:e.target.value})}/></label>
          <label><span>PromptPay</span><input value={accountDraft.promptpay_phone} onChange={e=>setAccountDraft({...accountDraft,promptpay_phone:e.target.value})} required={accountDraft.qr_mode==="promptpay_link"} placeholder={accountDraft.qr_mode==="promptpay_link"?T("ระบุหมายเลข PromptPay"):undefined}/></label>
          <label><span>{T("รูปแบบ QR")}</span><select value={accountDraft.qr_mode} onChange={e=>setAccountDraft({...accountDraft,qr_mode:e.target.value})}><option value="promptpay_link">PromptPay</option><option value="qr_image">{T("รูป QR")}</option></select></label>
          {accountDraft.qr_mode==="qr_image"?<label className="span2"><span>{T("URL / พาธรูป QR")}</span><input value={accountDraft.qr_image_url} onChange={e=>setAccountDraft({...accountDraft,qr_image_url:e.target.value})} placeholder="https://... หรือพาธรูป QR ที่ระบบ POS ใช้งาน" required/><small>{T("ใช้รูป QR เดียวกับที่ POS อ่านจากบัญชีรับชำระ")}</small></label>:null}
          <label className="switchField"><input type="checkbox" checked={accountDraft.applies_to_all_branches} onChange={e=>setAccountDraft({...accountDraft,applies_to_all_branches:e.target.checked})}/><span>{T("ใช้ทุกสาขา")}</span></label>
          <label className="switchField"><input type="checkbox" checked={accountDraft.is_active} onChange={e=>setAccountDraft({...accountDraft,is_active:e.target.checked})}/><span>{T("เปิดใช้งาน")}</span></label>
        </>:null}

        {kind==="taxes"?<>
          <label className="span2"><span>{T("สาขา")}</span><select value={scopeBranch} onChange={e=>changeScope(e.target.value)}>{snapshot.branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
          <label><span>{T("วิธีคำนวณ")}</span><select value={taxDraft.calculation_base} onChange={e=>setTaxDraft({...taxDraft,calculation_base:e.target.value})}><option value="exclusive">{T("ภาษีแยกจากราคา")}</option><option value="inclusive">{T("ราคารวมภาษี")}</option></select></label>
          <label className="switchField"><input type="checkbox" checked={taxDraft.is_enabled} onChange={e=>setTaxDraft({...taxDraft,is_enabled:e.target.checked})}/><span>{T("เปิดใช้ภาษี")}</span></label>
        </>:null}

        {kind==="notifications"?<>
          <label className="span2"><span>{T("สาขา")}</span><select value={scopeBranch} onChange={e=>changeScope(e.target.value)}>{snapshot.branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
          <label className="switchField"><input type="checkbox" checked={notificationDraft.table_qr_popup_enabled} onChange={e=>setNotificationDraft({...notificationDraft,table_qr_popup_enabled:e.target.checked})}/><span>{T("Popup QR โต๊ะ")}</span></label>
          <label className="switchField"><input type="checkbox" checked={notificationDraft.table_qr_sound_enabled} onChange={e=>setNotificationDraft({...notificationDraft,table_qr_sound_enabled:e.target.checked})}/><span>{T("เสียงแจ้งเตือน")}</span></label>
          <label><span>{T("ระดับเสียง 0–1")}</span><input type="number" min="0" max="1" step="0.1" value={notificationDraft.table_qr_sound_volume} onChange={e=>setNotificationDraft({...notificationDraft,table_qr_sound_volume:Number(e.target.value)})}/></label>
          <label className="switchField"><input type="checkbox" checked={notificationDraft.table_qr_popup_store_enabled} onChange={e=>setNotificationDraft({...notificationDraft,table_qr_popup_store_enabled:e.target.checked})}/><span>{T("แจ้งหน้าร้าน")}</span></label>
          <label className="switchField"><input type="checkbox" checked={notificationDraft.table_qr_kitchen_auto_send_enabled} onChange={e=>setNotificationDraft({...notificationDraft,table_qr_kitchen_auto_send_enabled:e.target.checked})}/><span>{T("ส่งเข้าครัวอัตโนมัติ")}</span></label>
          <label className="switchField"><input type="checkbox" checked={notificationDraft.table_qr_kitchen_auto_print_enabled} onChange={e=>setNotificationDraft({...notificationDraft,table_qr_kitchen_auto_print_enabled:e.target.checked})}/><span>{T("พิมพ์ครัวอัตโนมัติ")}</span></label>
        </>:null}
      </div>
      <div className="modalActions"><button type="button" className="secondaryButton" onClick={onClose}>{T("ยกเลิก")}</button><button className="primaryAction" disabled={busy}>{busy?<LoaderCircle className="spin" size={17}/>:<Save size={17}/>}บันทึกการตั้งค่า</button></div>
    </form>
  </Modal>;
}

export function SettingsView({context,branchId,onNavigate,onContextChanged}:{context:PortalContext;branchId:string|null;onNavigate:(view:PortalView)=>void;onContextChanged:()=>Promise<void>}){
  const [snapshot,setSnapshot]=useState<SettingsSnapshot|null>(null);
  const [language,setLanguage]=useState<CrmSettingsLanguage>(()=>{
    try{return normalizeCrmSettingsLanguage(localStorage.getItem(CRM_SETTINGS_LANGUAGE_STORAGE));}
    catch{return "th";}
  });
  const [languageModalOpen,setLanguageModalOpen]=useState(false);
  const T=(value:string)=>settingsText(language,value);
  const setSettingsLanguage=(next:CrmSettingsLanguage)=>{
    setLanguage(next);
    try{localStorage.setItem(CRM_SETTINGS_LANGUAGE_STORAGE,next);}catch{ /* browser storage disabled */ }
  };
  const [linkedSnapshot,setLinkedSnapshot]=useState<MoreSnapshot|null>(null);
  const [features,setFeatures]=useState<FeatureState|null>(null);
  const [error,setError]=useState("");
  const [editor,setEditor]=useState<EditableSettingKind|null>(null);
  const [linkedItem,setLinkedItem]=useState<PosSettingsMenuItem|null>(null);
  const [adminModule,setAdminModule]=useState<PosAdminModule|null>(null);
  const refreshSeq=useRef(0);

  const refresh=useCallback(async()=>{
    const requestId=++refreshSeq.current;
    setError("");
    try{
      const [s,f,m]=await Promise.all([
        loadSettingsSnapshot(context.tenantId,branchId),
        loadFeatureState(context.tenantId,branchId),
        loadMoreSnapshot(context.tenantId,branchId)
      ]);
      if(requestId!==refreshSeq.current)return;
      setSnapshot(s);setFeatures(f);setLinkedSnapshot(m);
    }catch{
      if(requestId===refreshSeq.current)setError("ไม่สามารถโหลดการตั้งค่าร้านได้");
    }
  },[context.tenantId,branchId]);
  useEffect(()=>{
    void refresh();
    return()=>{refreshSeq.current+=1;};
  },[refresh]);

  const allowed=(key:string,feature:string)=>{
    if(features && !isCustomMenuVisible(features,key))return false;
    const base=features?.package_features?.[feature]??false;
    const override=features?.feature_overrides?.[feature];
    return override===undefined?base:override;
  };
  const detail=(item:PosSettingsMenuItem)=>{
    if(!snapshot)return "กำลังโหลดข้อมูล...";
    if(item.kind==="store")return snapshot.store?.display_name||snapshot.store?.name||"ร้านค้า";
    if(item.kind==="branches")return snapshot.branches.length+" "+T("สาขา");
    if(item.kind==="devices")return snapshot.devices.length+" "+T("เครื่อง");
    if(item.kind==="printers")return number.format(Number(linkedSnapshot?.printers_count??0))+" "+T("เครื่องที่เชื่อม");
    if(item.kind==="activity")return number.format(Number(linkedSnapshot?.audit_count??0))+" "+T("รายการ Audit");
    if(item.kind==="payments")return snapshot.payment_accounts.length+" "+T("บัญชี");
    if(item.kind==="taxes")return snapshot.tax_settings.filter(x=>x.is_enabled).length+" "+T("สาขาเปิดภาษี");
    if(item.kind==="notifications"||item.kind==="orderKitchen"||item.kind==="tableQr")return snapshot.notifications.length+" "+T("สาขามีการตั้งค่า");
    if(item.kind==="users")return "จัดการจากเมนูพนักงาน";
    if(item.kind==="display")return number.format(Number(linkedSnapshot?.display_pairings_count??0))+" "+T("การเชื่อมต่อ");
    if(item.kind==="language")return languageOptions.find(x=>x.code===language)?.label??"ไทย";
    if(item.kind==="placement")return T("ค่าเฉพาะเครื่อง POS");
    if(item.kind==="currency")return "ตั้งค่าที่เครื่อง POS โดยต้องได้รับสิทธิ์จาก IT";
    if(item.kind==="inet")return "เชื่อมการตั้งค่า INET QR";
    return "เชื่อมกับการตั้งค่า POS";
  };
  const canEdit=(item:PosSettingsMenuItem)=>{
    if(!item.editorKind||!snapshot)return false;
    return context.role==="owner"||["taxes","notifications"].includes(item.editorKind);
  };
  const activate=(item:PosSettingsMenuItem)=>{
    if(item.kind==="language"){setLanguageModalOpen(true);return;}
    if(item.target){onNavigate(item.target);return;}
    if(item.adminModule){setAdminModule(item.adminModule);return;}
    if(canEdit(item)&&item.editorKind){setEditor(item.editorKind);return;}
    setLinkedItem(item);
  };

  const renderSettingsGroup=(keys:readonly string[])=>(
    <div className="moduleGrid settingsGrid posMenuGrid">{POS_SETTINGS_MENU_ITEMS.filter(item=>keys.includes(item.kind) && (item.key !== "settings.currency" || (features?.is_custom === true && isCustomMenuVisible(features,item.key))) && (!(features?.is_custom || features?.is_internal_test_full) || isCustomMenuVisible(features,item.key))).map(item=>{const isAllowed=features?allowed(item.key,item.feature):false;const editable=canEdit(item);const directlyManaged=Boolean(item.target||item.adminModule||editable||item.kind==="language");const localized=settingsMenuLocale(language,item.kind,item.label,item.desc);return <button key={item.key} className={`moduleCard posMenuCard ${isAllowed?"":"locked"} ${isAllowed&&!directlyManaged?"linkedOnly":""}`} disabled={!features||!isAllowed} onClick={()=>activate(item)}><span className="moduleIcon"><SettingsMenuIcon name={item.icon}/></span><div><strong>{localized.label}</strong><span>{localized.desc}</span><small>{!features?T("กำลังตรวจสิทธิ์..."):!isAllowed?T("ไม่ได้เปิดในแพ็กเกจ/ถูก IT ปิด"):item.adminModule?T("จัดการเพิ่ม แก้ไข ลบจาก Customer Portal"):editable?T("กดเพื่อจัดการ"):item.target?T("เปิดใช้งานใน Customer Portal"):detail(item)}</small></div><ChevronRight size={18}/></button>;})}</div>
  );

  return <>
    <div className="pageHeading"><div><p className="eyebrow">SETTINGS · POS MENU</p><h2>{T("ตั้งค่า")}</h2><p>{T("รายการและลำดับเมนูอ้างอิงจาก CpiPOS ฝั่ง POS รวมเมนู QR โต๊ะและออเดอร์/ครัวที่แสดงในหน้าตั้งค่าจริง")}</p></div><div style={{display:"flex",flexWrap:"wrap",gap:8}}><button type="button" className="ghostButton" onClick={()=>setLanguageModalOpen(true)}><Languages size={18}/>{T("เปลี่ยนภาษา")}: {languageOptions.find(o=>o.code===language)?.label}</button><button className="ghostButton" onClick={()=>void Promise.all([refresh(),onContextChanged()])}><RefreshCw size={18}/>{T("รีเฟรช")}</button></div></div>
    {error?<ErrorPanel message={error}/>:null}
    {snapshot?<section className="settingsOverview">
      <div><Store size={20}/><span>{T("ร้าน")}</span><strong>{snapshot.store?.display_name||snapshot.store?.name||"—"}</strong></div>
      <div><Building2 size={20}/><span>{T("สาขา")}</span><strong>{snapshot.branches.length}</strong></div>
      <div><MonitorSmartphone size={20}/><span>{T("อุปกรณ์")}</span><strong>{snapshot.devices.length}</strong></div>
      <div><CreditCard size={20}/><span>{T("บัญชีรับเงิน")}</span><strong>{snapshot.payment_accounts.length}</strong></div>
    </section>:null}
    <TopicHub label={T("หมวดหมู่การตั้งค่า POS")} items={[
      {id:"store",title:T("ข้อมูลร้านและผู้ใช้งาน"),description:T("ข้อมูลบริษัท สาขา และสิทธิ์พนักงาน"),count:`3 ${T("หัวข้อ")}`,content:renderSettingsGroup(["store","branches","users"])},
      {id:"billing",title:T("การชำระเงินและภาษี"),description:T("บัญชีรับเงิน INET QR ภาษีและการแจ้งเตือน"),count:`4 ${T("หัวข้อ")}`,content:renderSettingsGroup(["payments","inet","taxes","notifications"])},
      {id:"hardware",title:T("เครื่องและอุปกรณ์"),description:T("เครื่องแคชเชียร์ เครื่องพิมพ์ และจอลูกค้า"),count:`3 ${T("หัวข้อ")}`,content:renderSettingsGroup(["devices","printers","display"])},
      {id:"operations",title:T("การดำเนินงานและการแสดงผล"),description:T("Audit ครัว QR โต๊ะ ภาษา และแถบเมนู"),count:`6 ${T("หัวข้อ")}`,content:renderSettingsGroup(["activity","orderKitchen","tableQr","language","currency","placement"])},
      {id:"connected",title:T("ข้อมูลร้านที่เชื่อมอยู่"),description:T("ดูสาขา เครื่อง และบัญชีรับเงินที่เชื่อมกับ POS"),content:<>
            {snapshot?<article className="panel settingsDataPanel"><div className="panelHeader"><div><p className="eyebrow">CONNECTED POS SETTINGS</p><h3>{T("ข้อมูลที่เชื่อมอยู่")}</h3></div></div><div className="settingsDataGrid">
      <div><strong>{T("ข้อมูลร้าน")}</strong><span>{snapshot.store?.company_address||"ยังไม่ได้ระบุที่อยู่"}</span><span>{snapshot.store?.contact_phone||snapshot.store?.owner_phone||"—"}</span></div>
      <div><strong>{T("สาขา")}</strong>{snapshot.branches.slice(0,5).map(b=><span key={b.id}>{b.name} · {b.is_active?"ใช้งาน":"ปิด"}</span>)}</div>
      <div><strong>{T("อุปกรณ์")}</strong>{snapshot.devices.slice(0,5).map(d=><span key={d.id}>{d.device_name||d.device_code||"POS"} · {d.status||"—"}</span>)}</div>
      <div><strong>{T("บัญชีรับชำระของร้าน")}</strong>{snapshot.payment_accounts.slice(0,5).map(a=><span key={a.id}>{a.bank_name||"บัญชี"} · ••••{String(a.account_number||"").slice(-4)}</span>)}</div>
    </div></article>:null}
      </>}
    ]}/>

    <div className="auditNote">{T("เครื่องแคชเชียร์ เครื่องพิมพ์ และ Customer Display pairing จัดการจาก Customer Portal ได้แล้ว; การค้นหา USB/Bluetooth จริงและค่า local เช่นภาษา/ตำแหน่งเมนูยังทำที่เครื่อง POS/Print Agent")}</div>
    {editor&&snapshot?<SettingEditorModal kind={editor} context={context} branchId={branchId} snapshot={snapshot} language={language} onClose={()=>setEditor(null)} onSaved={refresh} onContextChanged={onContextChanged}/>:null}
    {linkedItem?<ConnectedPosModuleModal title={settingsMenuLocale(language,linkedItem.kind,linkedItem.label,linkedItem.desc).label} description={settingsMenuLocale(language,linkedItem.kind,linkedItem.label,linkedItem.desc).desc} detail={detail(linkedItem)} onClose={()=>setLinkedItem(null)}/>:null}
    {languageModalOpen?<Modal title={T("เปลี่ยนภาษา")} subtitle={T("ภาษาไทย อังกฤษ หรือลาว")} onClose={()=>setLanguageModalOpen(false)}><div className="entityForm"><div className="formGrid">{languageOptions.map(option=><label key={option.code} className="switchField span2" style={{padding:"12px 16px",border:"1px solid #dbe2ed",borderRadius:12}}><input type="radio" name="crm-settings-language" checked={language===option.code} onChange={()=>{setSettingsLanguage(option.code);setLanguageModalOpen(false);}}/><span>{option.label}</span></label>)}</div><div className="modalActions"><button type="button" className="secondaryButton" onClick={()=>setLanguageModalOpen(false)}>{T("ยกเลิก")}</button></div></div></Modal>:null}
    {adminModule?<Modal title={T("ตั้งค่า POS")} subtitle={T("จัดการข้อมูลร่วมกับระบบ POS ภายใต้สิทธิ์ Owner/Manager")} onClose={()=>setAdminModule(null)} wide workspace><div className="topicModalBody"><PosAdminWorkspace module={adminModule} context={context} branchId={branchId} onBack={()=>setAdminModule(null)}/></div></Modal>:null}
  </>;
}
