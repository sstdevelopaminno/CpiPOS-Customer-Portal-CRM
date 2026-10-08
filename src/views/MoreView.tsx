import { useEffect, useState } from "react";
import { Banknote, Boxes, ChefHat, ChevronRight, FileText, History, ReceiptText, Table2, TrendingUp, UsersRound } from "lucide-react";
import { loadFeatureState, loadMoreSnapshot, type FeatureState, type MoreSnapshot, type PortalContext, type PortalView } from "../lib/portal";
import { ConnectedPosModuleModal, ErrorPanel, Modal } from "../components/common";
import { TopicHub } from "../components/TopicHub";
import { number } from "../lib/formatters";
import { POS_MORE_MENU_ITEMS, type PosMenuIcon, type PosMoreMenuItem } from "../config/pos-menu-catalog";
import { PosAdminWorkspace } from "./pos-admin/PosAdminWorkspace";
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

export function MoreView({context,branchId,onNavigate}:{context:PortalContext;branchId:string|null;onNavigate:(view:PortalView)=>void}){
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
      if(active)setError("ไม่สามารถตรวจสอบสิทธิ์เมนูเพิ่มเติมได้");
    });
    return()=>{active=false;};
  },[context.tenantId,branchId]);

  const enabled=(item:PosMoreMenuItem)=>{
    const menu=state?.menu_policy?.[item.key]!==false;
    const base=state?.package_features?.[item.feature]??false;
    const override=state?.feature_overrides?.[item.feature];
    return menu&&(override===undefined?base:override);
  };
  const detail=(item:PosMoreMenuItem)=>{
    if(item.countKey&&snapshot){
      return `เชื่อมข้อมูล POS · ${number.format(Number(snapshot[item.countKey]??0))} รายการ`;
    }
    return item.adminModule?"จัดการเพิ่ม แก้ไข ลบจาก Customer Portal":item.target?"เปิดใช้งานใน Customer Portal":"เชื่อมข้อมูล POS แล้ว";
  };
  const activate=(item:PosMoreMenuItem)=>{
    if(item.target){onNavigate(item.target);return;}
    if(item.adminModule){setAdminModule(item.adminModule);return;}
    setSelected(item);
  };

  const renderMenuGroup=(keys:readonly string[])=>(
    <div className="moduleGrid posMenuGrid">{POS_MORE_MENU_ITEMS.filter(item=>keys.includes(item.key)).map(item=>{const allowed=state?enabled(item):false;return <button key={item.key} className={`moduleCard posMenuCard ${allowed?"":"locked"} ${!item.target&&!item.adminModule&&allowed?"linkedOnly":""}`} disabled={!state||!allowed} onClick={()=>activate(item)}><span className="moduleIcon"><MoreIcon name={item.icon}/></span><div><strong>{item.label}</strong><span>{item.desc}</span><small>{!state?"กำลังตรวจสิทธิ์...":!allowed?"ไม่ได้เปิดในแพ็กเกจ/ถูก IT ปิด":detail(item)}</small></div><ChevronRight size={18}/></button>;})}</div>
  );

  return <>
    <div className="pageHeading"><div><p className="eyebrow">MORE · POS MENU</p><h2>เพิ่มเติม</h2><p>รายการและลำดับเมนูอ้างอิงจาก CpiPOS ฝั่ง POS โดยใช้สิทธิ์แพ็กเกจและนโยบาย IT ชุดเดียวกัน</p></div></div>
    {error?<ErrorPanel message={error}/>:null}
    <TopicHub label="หมวดหมู่เมนูเพิ่มเติม" items={[
      {id:"reports",title:"ยอดขายและเอกสาร",description:"รายงาน ใบเสร็จ ใบกำกับภาษี และสินค้าขายดี",count:"4 หัวข้อ",content:renderMenuGroup(["more.sales_summary","more.receipts","more.tax_invoices","more.product_sales"])},
      {id:"restaurant",title:"จัดการร้านอาหาร",description:"โต๊ะ ครัว และราคาบุฟเฟ่",count:"3 หัวข้อ",content:renderMenuGroup(["more.tables","more.kitchen_manage","more.buffet"])},
      {id:"customers",title:"สินค้าและสมาชิก",description:"จัดการสินค้า วัตถุดิบ และสมาชิกหน้าร้าน",count:"2 หัวข้อ",content:renderMenuGroup(["more.stock","more.members"])}
    ]}/>
    <div className="auditNote">เมนูโต๊ะ ครัว บุฟเฟ่ และสมาชิกจัดการข้อมูล POS ชุดเดียวกันจาก Customer Portal ได้แล้ว ส่วนเมนูที่ยังไม่มี control-plane จะเปิดดูสถานะโดยไม่เขียนค่าหน้าขายโดยตรง</div>
    {selected?<ConnectedPosModuleModal title={selected.label} description={selected.desc} detail={detail(selected)} onClose={()=>setSelected(null)}/>:null}
    {adminModule?<Modal title="จัดการข้อมูล POS" subtitle="ข้อมูลจะใช้ร่วมกับ POS หลักตามสิทธิ์ที่กำหนด" onClose={()=>setAdminModule(null)} wide workspace><div className="topicModalBody"><PosAdminWorkspace module={adminModule} context={context} branchId={branchId} onBack={()=>setAdminModule(null)}/></div></Modal>:null}
  </>;
}
