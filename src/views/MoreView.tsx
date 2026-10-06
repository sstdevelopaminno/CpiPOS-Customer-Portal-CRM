import { useEffect, useState } from "react";
import { Banknote, Boxes, ChefHat, ChevronRight, FileText, History, ReceiptText, Table2, TrendingUp, UsersRound } from "lucide-react";
import { loadFeatureState, loadMoreSnapshot, type FeatureState, type MoreSnapshot, type PortalContext, type PortalView } from "../lib/portal";
import { ErrorPanel } from "../components/common";
import { number } from "../lib/formatters";

type MoreItem={key:string;label:string;desc:string;feature:string;target?:PortalView;icon:React.ReactNode};
const moreItems:MoreItem[]=[
  {key:"more.sales_summary",label:"สรุปยอดขาย",desc:"ยอดขาย ภาษี และภาพรวมการดำเนินงาน",feature:"advanced_sales_reports",target:"dashboard",icon:<TrendingUp/>},
  {key:"more.receipts",label:"ใบเสร็จย้อนหลัง",desc:"ค้นหาและตรวจสอบรายการขายย้อนหลัง",feature:"receipt_reprint_history",target:"sales",icon:<ReceiptText/>},
  {key:"more.tables",label:"จัดการโต๊ะ",desc:"โต๊ะ โซน และผังร้านสำหรับโหมดนั่งโต๊ะ",feature:"table_management",icon:<Table2/>},
  {key:"more.kitchen_manage",label:"จัดการครัว",desc:"โซนครัว เส้นทางอาหาร และสถานะ KDS",feature:"kitchen_printing",icon:<ChefHat/>},
  {key:"more.stock",label:"จัดการสินค้า",desc:"สินค้า วัตถุดิบ ราคา และสต๊อก",feature:"stock_management",target:"products",icon:<Boxes/>},
  {key:"more.buffet",label:"ตั้งค่าราคาบุฟเฟ่",desc:"ข้อมูลราคาบุฟเฟ่ที่ใช้ร่วมกับ POS",feature:"table_management",icon:<Banknote/>},
  {key:"more.members",label:"สมาชิก",desc:"ข้อมูลสมาชิกหน้าร้าน",feature:"core_pos_sales",icon:<UsersRound/>},
  {key:"more.tax_invoices",label:"ออกใบกำกับภาษี",desc:"ข้อมูลใบกำกับภาษีจากรายการขาย",feature:"core_pos_sales",target:"sales",icon:<FileText/>},
  {key:"more.product_sales",label:"รายการขายสินค้า",desc:"รายการสินค้าที่ขายและสินค้าขายดี",feature:"advanced_sales_reports",target:"sales",icon:<History/>},
  {key:"more.ai_documents",label:"เก็บไฟล์เอกสาร",desc:"เอกสารและรายงานจาก CpiPOS AI",feature:"cpipos_ai",icon:<FileText/>}
];

export function MoreView({context,branchId,onNavigate}:{context:PortalContext;branchId:string|null;onNavigate:(view:PortalView)=>void}){
  const [state,setState]=useState<FeatureState|null>(null);
  const [snapshot,setSnapshot]=useState<MoreSnapshot|null>(null);
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
  const enabled=(item:MoreItem)=>{
    const menu=state?.menu_policy?.[item.key]!==false;
    const base=state?.package_features?.[item.feature]??false;
    const override=state?.feature_overrides?.[item.feature];
    return menu&&(override===undefined?base:override);
  };
  return <>
    <div className="pageHeading"><div><p className="eyebrow">MORE</p><h2>เพิ่มเติม</h2><p>เมนูชุดเดียวกับ POS โดยตรวจสิทธิ์แพ็กเกจและนโยบายจาก IT ก่อนแสดงการใช้งาน</p></div></div>
    {error?<ErrorPanel message={error}/>:null}
    <div className="moduleGrid">{moreItems.map(item=>{const allowed=state?enabled(item):false;const count=item.key==="more.tables"?snapshot?.tables_count:item.key==="more.kitchen_manage"?snapshot?.kitchen_zones_count:item.key==="more.members"?snapshot?.members_count:item.key==="more.tax_invoices"?snapshot?.tax_invoices_count:item.key==="more.ai_documents"?snapshot?.ai_documents_count:null;return <button key={item.key} className={`moduleCard ${allowed?"":"locked"}`} disabled={!allowed||!item.target} onClick={()=>item.target&&onNavigate(item.target)}><span className="moduleIcon">{item.icon}</span><div><strong>{item.label}</strong><span>{item.desc}</span><small>{!state?"กำลังตรวจสิทธิ์...":!allowed?"ไม่ได้เปิดในแพ็กเกจ/ถูก IT ปิด":item.target?"พร้อมใช้งานใน CRM":count==null?"เชื่อมข้อมูล POS แล้ว":`เชื่อมข้อมูล POS · ${number.format(Number(count))} รายการ`}</small></div><ChevronRight size={18}/></button>;})}</div>
    <div className="auditNote">เมนูที่ยังไม่มีหน้าจัดการเฉพาะใน CRM จะยังไม่เขียนข้อมูลลง POS โดยตรง เพื่อรักษา transaction และกติกาเดิมของ POS/IT</div>
  </>;
}
