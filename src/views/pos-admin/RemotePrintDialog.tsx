import { useCallback,useEffect,useMemo,useState } from "react";
import { CircleAlert,LoaderCircle,Printer,RefreshCw,Wifi,WifiOff } from "lucide-react";
import { ErrorPanel,Modal } from "../../components/common";
import { loadRemotePrintState,queueRemotePrint,type RemotePrintState } from "../../lib/api/remote-print";
import type { PortalContext } from "../../types/portal";

export function RemotePrintDialog(props:{
  context:PortalContext;branchId:string;documentType:"receipt"|"tax_invoice";documentId:string;documentLabel:string;onClose:()=>void;
}){
  const {context,branchId,documentType,documentId,documentLabel,onClose}=props;
  const [state,setState]=useState<RemotePrintState|null>(null);
  const [printerId,setPrinterId]=useState(""); const [pin,setPin]=useState("");
  const [busy,setBusy]=useState(false); const [error,setError]=useState(""); const [success,setSuccess]=useState("");
  const refresh=useCallback(async()=>{setBusy(true);setError("");try{const next=await loadRemotePrintState(context.tenantId,branchId);setState(next);const ready=next.printers.find(p=>p.ready);setPrinterId(current=>next.printers.some(p=>p.id===current&&p.ready)?current:ready?.id??"");}catch(e){setError(e instanceof Error?e.message:"โหลดสถานะ Print Agent ไม่สำเร็จ");}finally{setBusy(false);}},[context.tenantId,branchId]);
  useEffect(()=>{void refresh();},[refresh]);
  const readyPrinters=useMemo(()=>state?.printers.filter(p=>p.ready)??[],[state]);
  const recent=state?.recent_jobs.filter(j=>j.document_type===documentType&&j.order_id===documentId).slice(0,3)??[];
  async function submit(){
    if(!printerId||pin.length<4)return;
    setBusy(true);setError("");setSuccess("");
    try{const result=await queueRemotePrint({tenantId:context.tenantId,branchId,documentType,documentId,printerId,managerPin:pin});setSuccess("ส่งเข้าคิว "+result.printer_name+" แล้ว · สถานะ "+result.status);setPin("");await refresh();}
    catch(e){setError(e instanceof Error?e.message:"ส่งงานพิมพ์ไม่สำเร็จ");setBusy(false);}
  }
  return <Modal title={"Remote Print · "+documentLabel} onClose={onClose}>
    <div className="entityForm remotePrintDialog">
      {error?<ErrorPanel message={error}/>:null}
      <div className="remotePrintHealth">
        <div><Printer size={18}/><span><strong>{state?.printers.length??0}</strong> เครื่องพิมพ์ใบเสร็จ</span></div>
        <div>{readyPrinters.length?<Wifi size={18}/>:<WifiOff size={18}/>}<span><strong>{readyPrinters.length}</strong> พร้อมพิมพ์ตอนนี้</span></div>
        <button className="ghostButton" type="button" disabled={busy} onClick={()=>void refresh()}><RefreshCw size={14}/>รีเฟรช</button>
      </div>
      {!state?.printers.length?<div className="phase3InfoStrip phase4Warning"><CircleAlert size={18}/><div><strong>ยังไม่มี Receipt Printer Profile</strong><span>ไปที่ ตั้งค่า → เครื่องพิมพ์ เพื่อสร้าง/ผูกเครื่องพิมพ์กับ Print Agent ก่อน</span></div></div>:!readyPrinters.length?<div className="phase3InfoStrip phase4Warning"><CircleAlert size={18}/><div><strong>ยังไม่มี Print Agent ที่ online สำหรับเครื่องพิมพ์นี้</strong><span>Agent ต้อง Active และ heartbeat ภายใน 5 นาที ระบบจึงจะอนุญาต Remote Print</span></div></div>:null}
      <label><span>เครื่องพิมพ์</span><select value={printerId} onChange={e=>setPrinterId(e.target.value)} disabled={!readyPrinters.length}>{readyPrinters.length?readyPrinters.map(p=><option key={p.id} value={p.id}>{p.printer_name+" · "+p.paper_width_mm+"mm · "+p.connection_type}</option>):<option value="">ยังไม่มีเครื่องพร้อม</option>}</select></label>
      <label><span>PIN Owner/Manager</span><input type="password" inputMode="numeric" value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,"").slice(0,12))} placeholder="ยืนยันก่อนส่งเข้าคิว"/></label>
      {success?<p className="phase4Success">{success}</p>:null}
      {recent.length?<div className="remotePrintRecent"><strong>งานล่าสุด</strong>{recent.map(j=><span key={j.id}>{j.printer_name||"Printer"}+" · "+{j.status}+" · "+{new Date(j.created_at).toLocaleString("th-TH")}</span>)}</div>:null}
      <div className="modalActions"><button className="secondaryButton" type="button" onClick={onClose}>ปิด</button><button className="primaryAction" type="button" disabled={busy||!printerId||pin.length<4} onClick={()=>void submit()}>{busy?<LoaderCircle className="spin" size={16}/>:<Printer size={16}/>}ส่งงานพิมพ์</button></div>
    </div>
  </Modal>;
}
