import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Building2, ChevronRight, CreditCard, LoaderCircle, MonitorSmartphone, Printer, RefreshCw, Save, Settings, Store, UsersRound } from "lucide-react";
import { loadFeatureState, loadSettingsSnapshot, saveSetting, type FeatureState, type PortalContext, type PortalView, type SettingsSnapshot } from "../lib/portal";
import { ErrorPanel, Modal } from "../components/common";
import { number } from "../lib/formatters";

const settingsCatalog=[
  ["settings.store","ข้อมูลร้านค้า/บริษัท","ข้อมูลชื่อร้าน โลโก้ ที่อยู่ และการติดต่อ","core_pos_sales","store"],
  ["settings.branches","สาขา","สาขาและสถานะการเปิดใช้งาน","branch_management","branches"],
  ["settings.devices","เครื่องแคชเชียร์","อุปกรณ์ POS และสถานะออนไลน์","mobile_device_enrollment","devices"],
  ["settings.printers","เครื่องพิมพ์","การตั้งค่าเครื่องพิมพ์ของ POS","core_pos_sales","printers"],
  ["settings.activity","ตรวจสอบพฤติกรรมการใช้งาน","ประวัติการทำงานและ Audit","core_pos_sales","activity"],
  ["settings.payments","ตั้งค่าชำระเงิน","บัญชีธนาคารและ QR ของร้าน","core_pos_sales","payments"],
  ["settings.inet_nops","INET QR","การเชื่อมต่อช่องทางรับชำระ INET","inet_nops_qr","inet"],
  ["settings.taxes","ตั้งค่าภาษี","VAT และการคำนวณภาษี","core_pos_sales","taxes"],
  ["settings.notifications","การแจ้งเตือน","QR โต๊ะ เสียงแจ้งเตือน และครัว","qr_table_ordering","notifications"],
  ["settings.support","ศูนย์ช่วยเหลือ","Support และการติดต่อฝ่ายระบบ","core_pos_sales","support"],
  ["settings.push_notifications","การแจ้งเตือนอุปกรณ์","Push notification ของเครื่อง POS","core_pos_sales","push"],
  ["settings.users","ผู้ใช้งาน","พนักงาน สิทธิ์ และ PIN","user_management","users"],
  ["settings.language","เปลี่ยนภาษา","ภาษาแสดงผลของ POS","core_pos_sales","language"],
  ["settings.placement","สลับแถบเมนูหลัก","ตำแหน่งเมนูต่อเครื่อง POS","core_pos_sales","placement"],
  ["settings.display","จอลูกค้า","Customer Display","customer_facing_display","display"],
  ["settings.order_kitchen","ออเดอร์และครัว","การส่งออเดอร์และการแจ้งเตือนครัว","kitchen_printing","orderKitchen"],
  ["settings.table_qr","QR โต๊ะ","การรับออเดอร์ผ่าน QR โต๊ะ","qr_table_ordering","tableQr"]
] as const;

type EditableSettingKind="store"|"branches"|"payments"|"taxes"|"notifications";

function SettingEditorModal({
  kind,context,branchId,snapshot,onClose,onSaved,onContextChanged
}:{
  kind:EditableSettingKind;
  context:PortalContext;
  branchId:string|null;
  snapshot:SettingsSnapshot;
  onClose:()=>void;
  onSaved:()=>Promise<void>;
  onContextChanged:()=>Promise<void>;
}){
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

  const title=kind==="store"?"ข้อมูลร้านค้า/บริษัท":kind==="branches"?"สาขา":kind==="payments"?"ตั้งค่าชำระเงิน":kind==="taxes"?"ตั้งค่าภาษี":"การแจ้งเตือน";
  return <Modal title={title} subtitle="บันทึกลงข้อมูลกลาง CpiPOS-001 และ POS จะอ่านค่าชุดเดียวกัน" onClose={onClose} wide>
    <form className="entityForm" onSubmit={submit}>
      {error?<ErrorPanel message={error}/>:null}
      <div className="formGrid">
        {kind==="store"?<>
          <label className="span2"><span>ชื่อร้าน/ชื่อแสดงผล</span><input value={storeDraft.display_name} onChange={e=>setStoreDraft({...storeDraft,display_name:e.target.value})} required/></label>
          <label className="span2"><span>ที่อยู่</span><input value={storeDraft.company_address} onChange={e=>setStoreDraft({...storeDraft,company_address:e.target.value})}/></label>
          <label className="span2"><span>เบอร์ติดต่อ</span><input value={storeDraft.contact_phone} onChange={e=>setStoreDraft({...storeDraft,contact_phone:e.target.value})}/></label>
        </>:null}

        {kind==="branches"?<>
          <label className="span2"><span>เลือกสาขา</span><select value={branchChoice} onChange={e=>chooseBranch(e.target.value)}>{snapshot.branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}<option value="__new__">+ เพิ่มสาขาใหม่</option></select></label>
          <label><span>รหัสสาขา</span><input value={branchDraft.code} onChange={e=>setBranchDraft({...branchDraft,code:e.target.value})} required/></label>
          <label><span>ชื่อสาขา</span><input value={branchDraft.name} onChange={e=>setBranchDraft({...branchDraft,name:e.target.value})} required/></label>
          <label className="span2"><span>ที่อยู่สาขา</span><input value={branchDraft.address} onChange={e=>setBranchDraft({...branchDraft,address:e.target.value})}/></label>
          <label className="switchField span2"><input type="checkbox" checked={branchDraft.is_active} onChange={e=>setBranchDraft({...branchDraft,is_active:e.target.checked})}/><span>เปิดใช้งานสาขา</span></label>
        </>:null}

        {kind==="payments"?<>
          <label className="span2"><span>บัญชี</span><select value={accountChoice} onChange={e=>chooseAccount(e.target.value)}>{snapshot.payment_accounts.map(a=><option key={a.id} value={a.id}>{a.bank_name||"บัญชี"} · ••••{String(a.account_number||"").slice(-4)}</option>)}<option value="__new__">+ เพิ่มบัญชีใหม่</option></select></label>
          <label><span>สาขา</span><select value={scopeBranch} onChange={e=>setScopeBranch(e.target.value)} disabled={accountDraft.applies_to_all_branches}>{snapshot.branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
          <label><span>ธนาคาร</span><input value={accountDraft.bank_name} onChange={e=>setAccountDraft({...accountDraft,bank_name:e.target.value})} required/></label>
          <label><span>ชื่อบัญชี</span><input value={accountDraft.account_name} onChange={e=>setAccountDraft({...accountDraft,account_name:e.target.value})}/></label>
          <label><span>เลขบัญชี</span><input value={accountDraft.account_number} onChange={e=>setAccountDraft({...accountDraft,account_number:e.target.value})}/></label>
          <label><span>PromptPay</span><input value={accountDraft.promptpay_phone} onChange={e=>setAccountDraft({...accountDraft,promptpay_phone:e.target.value})} required={accountDraft.qr_mode==="promptpay_link"} placeholder={accountDraft.qr_mode==="promptpay_link"?"ระบุหมายเลข PromptPay":undefined}/></label>
          <label><span>รูปแบบ QR</span><select value={accountDraft.qr_mode} onChange={e=>setAccountDraft({...accountDraft,qr_mode:e.target.value})}><option value="promptpay_link">PromptPay</option><option value="qr_image">รูป QR</option></select></label>
          {accountDraft.qr_mode==="qr_image"?<label className="span2"><span>URL / พาธรูป QR</span><input value={accountDraft.qr_image_url} onChange={e=>setAccountDraft({...accountDraft,qr_image_url:e.target.value})} placeholder="https://... หรือพาธรูป QR ที่ระบบ POS ใช้งาน" required/><small>ใช้รูป QR เดียวกับที่ POS อ่านจากบัญชีรับชำระ</small></label>:null}
          <label className="switchField"><input type="checkbox" checked={accountDraft.applies_to_all_branches} onChange={e=>setAccountDraft({...accountDraft,applies_to_all_branches:e.target.checked})}/><span>ใช้ทุกสาขา</span></label>
          <label className="switchField"><input type="checkbox" checked={accountDraft.is_active} onChange={e=>setAccountDraft({...accountDraft,is_active:e.target.checked})}/><span>เปิดใช้งาน</span></label>
        </>:null}

        {kind==="taxes"?<>
          <label className="span2"><span>สาขา</span><select value={scopeBranch} onChange={e=>changeScope(e.target.value)}>{snapshot.branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
          <label><span>วิธีคำนวณ</span><select value={taxDraft.calculation_base} onChange={e=>setTaxDraft({...taxDraft,calculation_base:e.target.value})}><option value="exclusive">ภาษีแยกจากราคา</option><option value="inclusive">ราคารวมภาษี</option></select></label>
          <label className="switchField"><input type="checkbox" checked={taxDraft.is_enabled} onChange={e=>setTaxDraft({...taxDraft,is_enabled:e.target.checked})}/><span>เปิดใช้ภาษี</span></label>
        </>:null}

        {kind==="notifications"?<>
          <label className="span2"><span>สาขา</span><select value={scopeBranch} onChange={e=>changeScope(e.target.value)}>{snapshot.branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
          <label className="switchField"><input type="checkbox" checked={notificationDraft.table_qr_popup_enabled} onChange={e=>setNotificationDraft({...notificationDraft,table_qr_popup_enabled:e.target.checked})}/><span>Popup QR โต๊ะ</span></label>
          <label className="switchField"><input type="checkbox" checked={notificationDraft.table_qr_sound_enabled} onChange={e=>setNotificationDraft({...notificationDraft,table_qr_sound_enabled:e.target.checked})}/><span>เสียงแจ้งเตือน</span></label>
          <label><span>ระดับเสียง 0–1</span><input type="number" min="0" max="1" step="0.1" value={notificationDraft.table_qr_sound_volume} onChange={e=>setNotificationDraft({...notificationDraft,table_qr_sound_volume:Number(e.target.value)})}/></label>
          <label className="switchField"><input type="checkbox" checked={notificationDraft.table_qr_popup_store_enabled} onChange={e=>setNotificationDraft({...notificationDraft,table_qr_popup_store_enabled:e.target.checked})}/><span>แจ้งหน้าร้าน</span></label>
          <label className="switchField"><input type="checkbox" checked={notificationDraft.table_qr_kitchen_auto_send_enabled} onChange={e=>setNotificationDraft({...notificationDraft,table_qr_kitchen_auto_send_enabled:e.target.checked})}/><span>ส่งเข้าครัวอัตโนมัติ</span></label>
          <label className="switchField"><input type="checkbox" checked={notificationDraft.table_qr_kitchen_auto_print_enabled} onChange={e=>setNotificationDraft({...notificationDraft,table_qr_kitchen_auto_print_enabled:e.target.checked})}/><span>พิมพ์ครัวอัตโนมัติ</span></label>
        </>:null}
      </div>
      <div className="modalActions"><button type="button" className="secondaryButton" onClick={onClose}>ยกเลิก</button><button className="primaryAction" disabled={busy}>{busy?<LoaderCircle className="spin" size={17}/>:<Save size={17}/>}บันทึกการตั้งค่า</button></div>
    </form>
  </Modal>;
}

export function SettingsView({context,branchId,onNavigate,onContextChanged}:{context:PortalContext;branchId:string|null;onNavigate:(view:PortalView)=>void;onContextChanged:()=>Promise<void>}){
  const [snapshot,setSnapshot]=useState<SettingsSnapshot|null>(null);
  const [features,setFeatures]=useState<FeatureState|null>(null);
  const [error,setError]=useState("");
  const [editor,setEditor]=useState<EditableSettingKind|null>(null);
  const refreshSeq=useRef(0);

  const refresh=useCallback(async()=>{
    const requestId=++refreshSeq.current;
    setError("");
    try{
      const [s,f]=await Promise.all([loadSettingsSnapshot(context.tenantId,branchId),loadFeatureState(context.tenantId,branchId)]);
      if(requestId!==refreshSeq.current)return;
      setSnapshot(s);setFeatures(f);
    }catch{
      if(requestId===refreshSeq.current)setError("ไม่สามารถโหลดการตั้งค่าร้านได้");
    }
  },[context.tenantId,branchId]);
  useEffect(()=>{
    void refresh();
    return()=>{refreshSeq.current+=1;};
  },[refresh]);

  const allowed=(key:string,feature:string)=>{
    if(features?.menu_policy?.[key]===false)return false;
    const base=features?.package_features?.[feature]??false;
    const override=features?.feature_overrides?.[feature];
    return override===undefined?base:override;
  };
  const detail=(kind:string)=>{
    if(!snapshot)return "กำลังโหลดข้อมูล...";
    if(kind==="store")return snapshot.store?.display_name||snapshot.store?.name||"ร้านค้า";
    if(kind==="branches")return snapshot.branches.length+" สาขา";
    if(kind==="devices")return snapshot.devices.length+" เครื่อง";
    if(kind==="payments")return snapshot.payment_accounts.length+" บัญชี";
    if(kind==="taxes")return snapshot.tax_settings.filter(x=>x.is_enabled).length+" สาขาเปิดภาษี";
    if(kind==="notifications")return snapshot.notifications.length+" สาขา";
    if(kind==="users")return "จัดการจากเมนูพนักงาน";
    return "เชื่อมกับการตั้งค่า POS";
  };
  const editable=(kind:string):kind is EditableSettingKind=>["store","branches","payments","taxes","notifications"].includes(kind);
  const localOnly=["devices","printers","activity","inet","support","push","language","placement","display","orderKitchen","tableQr"];

  return <>
    <div className="pageHeading"><div><p className="eyebrow">SETTINGS</p><h2>ตั้งค่า</h2><p>โครงเมนูตาม POS และใช้สิทธิ์จากแพ็กเกจ + นโยบาย IT ชุดเดียวกัน</p></div><button className="ghostButton" onClick={()=>void Promise.all([refresh(),onContextChanged()])}><RefreshCw size={18}/>รีเฟรช</button></div>
    {error?<ErrorPanel message={error}/>:null}
    {snapshot?<section className="settingsOverview">
      <div><Store size={20}/><span>ร้าน</span><strong>{snapshot.store?.display_name||snapshot.store?.name||"—"}</strong></div>
      <div><Building2 size={20}/><span>สาขา</span><strong>{snapshot.branches.length}</strong></div>
      <div><MonitorSmartphone size={20}/><span>อุปกรณ์</span><strong>{snapshot.devices.length}</strong></div>
      <div><CreditCard size={20}/><span>บัญชีรับเงิน</span><strong>{snapshot.payment_accounts.length}</strong></div>
    </section>:null}
    <div className="moduleGrid settingsGrid">{settingsCatalog.map(([key,label,desc,feature,kind])=>{const isAllowed=features?allowed(key,feature):false;const target=kind==="users"?"staff" as PortalView:undefined;const canEdit=editable(kind)&&snapshot&&(context.role==="owner"||["taxes","notifications"].includes(kind));const disabled=!isAllowed||(!target&&!canEdit&&localOnly.includes(kind));return <button key={key} className={`moduleCard ${isAllowed?"":"locked"}`} disabled={disabled} onClick={()=>target?onNavigate(target):canEdit?setEditor(kind as EditableSettingKind):undefined}><span className="moduleIcon">{kind==="devices"?<MonitorSmartphone/>:kind==="payments"?<CreditCard/>:kind==="notifications"?<Bell/>:kind==="printers"?<Printer/>:kind==="branches"?<Building2/>:kind==="users"?<UsersRound/>:<Settings/>}</span><div><strong>{label}</strong><span>{desc}</span><small>{!features?"กำลังตรวจสิทธิ์...":!isAllowed?"ไม่ได้เปิดในแพ็กเกจ/ถูก IT ปิด":canEdit?"กดเพื่อจัดการ":detail(kind)}</small></div><ChevronRight size={18}/></button>;})}</div>
    {snapshot?<article className="panel settingsDataPanel"><div className="panelHeader"><div><p className="eyebrow">CONNECTED POS SETTINGS</p><h3>ข้อมูลที่เชื่อมอยู่</h3></div></div><div className="settingsDataGrid">
      <div><strong>ข้อมูลร้าน</strong><span>{snapshot.store?.company_address||"ยังไม่ได้ระบุที่อยู่"}</span><span>{snapshot.store?.contact_phone||snapshot.store?.owner_phone||"—"}</span></div>
      <div><strong>สาขา</strong>{snapshot.branches.slice(0,5).map(b=><span key={b.id}>{b.name} · {b.is_active?"ใช้งาน":"ปิด"}</span>)}</div>
      <div><strong>อุปกรณ์</strong>{snapshot.devices.slice(0,5).map(d=><span key={d.id}>{d.device_name||d.device_code||"POS"} · {d.status||"—"}</span>)}</div>
      <div><strong>บัญชีรับชำระของร้าน</strong>{snapshot.payment_accounts.slice(0,5).map(a=><span key={a.id}>{a.bank_name||"บัญชี"} · ••••{String(a.account_number||"").slice(-4)}</span>)}</div>
    </div></article>:null}
    <div className="auditNote">ค่าที่เป็น local ต่อเครื่อง เช่น ภาษา/ตำแหน่งแถบเมนู และฮาร์ดแวร์เครื่องพิมพ์ อ่านสถานะร่วมกันแต่ CRM จะไม่สั่งเปลี่ยนเครื่อง POS โดยตรง</div>
    {editor&&snapshot?<SettingEditorModal kind={editor} context={context} branchId={branchId} snapshot={snapshot} onClose={()=>setEditor(null)} onSaved={refresh} onContextChanged={onContextChanged}/>:null}
  </>;
}
