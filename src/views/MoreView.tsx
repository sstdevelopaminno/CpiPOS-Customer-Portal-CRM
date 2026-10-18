import { useEffect, useState } from "react";
import { Banknote, Boxes, ChefHat, ChevronRight, FileText, History, ReceiptText, Table2, TrendingUp, UsersRound } from "lucide-react";
import { loadFeatureState, loadMoreSnapshot, type FeatureState, type MoreSnapshot, type PortalContext, type PortalView } from "../lib/portal";
import { ConnectedPosModuleModal, ErrorPanel, Modal } from "../components/common";
import { TopicHub } from "../components/TopicHub";
import { number } from "../lib/formatters";
import { isCustomMenuVisible } from "../lib/custom-menu-access";
import {CRM_MORE_MENU_KEYS,isCrmMenuEnabled} from "../lib/crm-menu-policy";
import {visibleCrmMoreItems} from "../lib/crm-topic-visibility";
import { POS_MORE_MENU_ITEMS, type PosMenuIcon, type PosMoreMenuItem } from "../config/pos-menu-catalog";
import { PosAdminWorkspace } from "./pos-admin/PosAdminWorkspace";
import { settingsText, type CrmSettingsLanguage } from "../lib/settings-language";
import type { PosAdminModule } from "../types/pos-admin";

function MoreIcon({name}:{name:PosMenuIcon}) {
  if(name==="summary")return <TrendingUp/>;
  if(name==="receipt")return <ReceiptText/>;
  if(name==="tables")return <Table2/>;
  if(name==="kitchen")return <ChefHat/>;
  if(name==="stock")return <Boxes/>;
  if(name==="buffet")return <Banknote/>;
  if(name==="members")return <UsersRound/>;
  if(name==="tax")return <FileText/>;
  return <History/>;
}

export function MoreView({context,branchId,onNavigate,language="th",menuPolicy}:{context:PortalContext;branchId:string|null;onNavigate:(view:PortalView)=>void;language?:CrmSettingsLanguage;menuPolicy:Record<string,boolean>}){
  const T=(value:string)=>settingsText(language,value);
  const [state,setState]=useState<FeatureState|null>(null);
  const [snapshot,setSnapshot]=useState<MoreSnapshot|null>(null);
  const [selected,setSelected]=useState<PosMoreMenuItem|null>(null);
  const [adminModule,setAdminModule]=useState<PosAdminModule|null>(null);
  const [error,setError]=useState("");
  useEffect(()=>{
    let active=true;
    setState(null);
    setSnapshot(null);
    setError("");
    Promise.all([
      loadFeatureState(context.tenantId,branchId),
      loadMoreSnapshot(context.tenantId,branchId)
    ]).then(([features,data])=>{
      if(!active)return;
      setState(features);
      setSnapshot(data);
    }).catch(()=>{
      if(active)setError(T("ไม่สามารถตรวจสอบสิทธิ์เมนูเพิ่มเติมได้"));
    });
    return()=>{active=false;};
  },[context.tenantId,branchId]);

  const enabled=(item:PosMoreMenuItem)=>{
    const menu=Boolean(state&&isCrmMenuEnabled(menuPolicy,CRM_MORE_MENU_KEYS[item.key])&&state.menu_policy?.[item.key]!==false);
    const base=state?.package_features?.[item.feature]??false;
    const override=state?.feature_overrides?.[item.feature];
    return menu&&(override===undefined?base:override);
  };
  const detail=(item:PosMoreMenuItem)=>{
    if(item.countKey&&snapshot){
      return `${T("เชื่อมข้อมูล POS")} · ${number.format(Number(snapshot[item.countKey]??0))} ${T("รายการ")}`;
    }
    return T(item.adminModule?"จัดการเพิ่ม แก้ไข ลบจาก Customer Portal":item.target?"เปิดใช้งานใน Customer Portal":"เชื่อมข้อมูล POS แล้ว");
  };
  const activate=(item:PosMoreMenuItem)=>{
    if(item.target){onNavigate(item.target);return;}
    if(item.adminModule){setAdminModule(item.adminModule);return;}
    setSelected(item);
  };

  const visibleGroup=(keys:readonly string[])=>visibleCrmMoreItems(menuPolicy,state,keys);
  const renderMenuGroup=(keys:readonly string[])=>(
    <div className="moduleGrid posMenuGrid">{visibleGroup(keys).map(item=>{const allowed=state?enabled(item):false;return <button key={item.key} className={`moduleCard posMenuCard ${allowed?"":"locked"} ${!item.target&&!item.adminModule&&allowed?"linkedOnly":""}`} disabled={!state||!allowed} onClick={()=>activate(item)}><span className="moduleIcon"><MoreIcon name={item.icon}/></span><div><strong>{T(item.label)}</strong><span>{T(item.desc)}</span><small>{!state?T("กำลังตรวจสิทธิ์..."):!allowed?T("ไม่ได้เปิดในแพ็กเกจ/ถูก IT ปิด"):detail(item)}</small></div><ChevronRight size={18}/></button>;})}</div>
  );

  return <>
    <div className="pageHeading"><div><p className="eyebrow">MORE · POS MENU</p><h2>{T("เพิ่มเติม")}</h2><p>{T("รายการและลำดับเมนูอ้างอิงจาก CpiPOS ฝั่ง POS โดยใช้สิทธิ์แพ็กเกจและนโยบาย IT ชุดเดียวกัน")}</p></div></div>
    {error?<ErrorPanel message={error}/>:null}
    <TopicHub label={T("หมวดหมู่เมนูเพิ่มเติม")} items={[
      {id:"reports",title:T("ยอดขายและเอกสาร"),description:T("รายงาน ใบเสร็จ ใบกำกับภาษี และสินค้าขายดี"),keys:["more.receipts","more.tax_invoices","more.product_sales"]},
      {id:"restaurant",title:T("จัดการร้านอาหาร"),description:T("โต๊ะ ครัว และราคาบุฟเฟ่"),keys:["more.tables","more.kitchen_manage","more.buffet"]},
      {id:"customers",title:T("สินค้าและสมาชิก"),description:T("จัดการสมาชิกหน้าร้าน"),keys:["more.members"]}
    ].filter(group=>visibleGroup(group.keys).length>0).map(group=>({
      id:group.id,title:group.title,description:group.description,
      count:`${visibleGroup(group.keys).length} ${T("หัวข้อ")}`,
      content:renderMenuGroup(group.keys)
    }))}/>
    <div className="auditNote">{T("เมนูโต๊ะ ครัว บุฟเฟ่ และสมาชิกจัดการข้อมูล POS ชุดเดียวกันจาก Customer Portal ได้แล้ว ส่วนเมนูที่ยังไม่มี control-plane จะเปิดดูสถานะโดยไม่เขียนค่าหน้าขายโดยตรง")}</div>
    {selected&&isCrmMenuEnabled(menuPolicy,CRM_MORE_MENU_KEYS[selected.key])?<ConnectedPosModuleModal title={T(selected.label)} description={T(selected.desc)} detail={detail(selected)} onClose={()=>setSelected(null)}/>:null}
    {adminModule&&POS_MORE_MENU_ITEMS.some(item=>item.adminModule===adminModule&&isCrmMenuEnabled(menuPolicy,CRM_MORE_MENU_KEYS[item.key]))?<Modal title={T("จัดการข้อมูล POS")} subtitle={T("ข้อมูลจะใช้ร่วมกับ POS หลักตามสิทธิ์ที่กำหนด")} onClose={()=>setAdminModule(null)} wide workspace><div className="topicModalBody"><PosAdminWorkspace module={adminModule} context={context} branchId={branchId} onBack={()=>setAdminModule(null)}/></div></Modal>:null}
  </>;
}
