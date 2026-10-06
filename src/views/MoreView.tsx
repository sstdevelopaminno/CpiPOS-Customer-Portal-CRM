import { useEffect, useState } from "react";
import { Banknote, Boxes, ChefHat, ChevronRight, FileText, History, ReceiptText, Table2, TrendingUp, UsersRound } from "lucide-react";
import { loadFeatureState, loadMoreSnapshot, type FeatureState, type MoreSnapshot, type PortalContext, type PortalView } from "../lib/portal";
import { ConnectedPosModuleModal, ErrorPanel } from "../components/common";
import { number } from "../lib/formatters";
import { POS_MORE_MENU_ITEMS, type PosMenuIcon, type PosMoreMenuItem } from "../config/pos-menu-catalog";

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
    return item.target?"เปิดใช้งานใน Customer Portal":"เชื่อมข้อมูล POS แล้ว";
  };
  const activate=(item:PosMoreMenuItem)=>{
    if(item.target){onNavigate(item.target);return;}
    setSelected(item);
  };

  return <>
    <div className="pageHeading"><div><p className="eyebrow">MORE · POS MENU</p><h2>เพิ่มเติม</h2><p>รายการและลำดับเมนูอ้างอิงจาก CpiPOS ฝั่ง POS โดยใช้สิทธิ์แพ็กเกจและนโยบาย IT ชุดเดียวกัน</p></div></div>
    {error?<ErrorPanel message={error}/>:null}
    <div className="moduleGrid posMenuGrid">{POS_MORE_MENU_ITEMS.map(item=>{const allowed=state?enabled(item):false;return <button key={item.key} className={`moduleCard posMenuCard ${allowed?"":"locked"} ${!item.target&&allowed?"linkedOnly":""}`} disabled={!state||!allowed} onClick={()=>activate(item)}><span className="moduleIcon"><MoreIcon name={item.icon}/></span><div><strong>{item.label}</strong><span>{item.desc}</span><small>{!state?"กำลังตรวจสิทธิ์...":!allowed?"ไม่ได้เปิดในแพ็กเกจ/ถูก IT ปิด":detail(item)}</small></div><ChevronRight size={18}/></button>;})}</div>
    <div className="auditNote">เมนูเพิ่มเติมตรงกับ POS/main แล้ว เมนูที่ยังไม่มี control-plane สำหรับ Customer Portal จะเปิดดูสถานะได้ แต่จะไม่เขียน transaction หรือค่าหน้าขายโดยตรง</div>
    {selected?<ConnectedPosModuleModal title={selected.label} description={selected.desc} detail={detail(selected)} onClose={()=>setSelected(null)}/>:null}
  </>;
}
