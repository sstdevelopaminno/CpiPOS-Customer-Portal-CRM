import { useCallback, useEffect, useState } from "react";
import { Clock3, CreditCard, LoaderCircle, RefreshCw } from "lucide-react";
import { loadPackage, submitPackagePayment, type PackageInfo, type PortalContext } from "../lib/portal";
import { Empty, ErrorPanel, Modal } from "../components/common";
import { number, dateTime, dateOnly, formatCurrency } from "../lib/formatters";

function billingStatusLabel(status:string){
  return ({
    paid:"ชำระแล้ว",pending:"รอชำระ/ตรวจสอบ",under_review:"กำลังตรวจสอบ",
    open:"รอชำระ",due:"รอชำระ",overdue:"เกินกำหนด",cancelled:"ยกเลิก",
    active:"ใช้งาน",trial:"ทดลองใช้งาน",trial_due:"Trial ใกล้หมด · รอชำระ",upcoming:"ยังไม่ถึงกำหนด",prepaid:"ชำระล่วงหน้าแล้ว",not_payable:"ไม่เรียกเก็บ",locked:"ระงับใช้งาน"
  } as Record<string,string>)[status]??status;
}
const PAYABLE_BILLING_STATUSES=new Set(["open","due","overdue","pending"]);

function PackagePaymentModal({
  tenantId,info,cycle,onClose,onSaved
}:{
  tenantId:string;
  info:PackageInfo;
  cycle:PackageInfo["billingCycles"][number]|null;
  onClose:()=>void;
  onSaved:()=>Promise<void>;
}){
  const [slip,setSlip]=useState<File|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const contract=info.contract;
  const billingCurrency=contract?.currency||"THB";
  const expected=cycle?Math.max(0,Number(cycle.amount_due)-Number(cycle.amount_paid)):Number(contract?.amount_per_cycle??0);
  const packageId=contract?.package_id??"";

  async function submit(event:React.FormEvent){
    event.preventDefault();
    if(!slip||!packageId)return;
    setBusy(true);setError("");
    try{
      await submitPackagePayment({
        tenantId,
        billingCycleId:cycle?.id??null,
        packageId,
        billingInterval:contract?.billing_interval??"monthly",
        expectedAmount:expected,
        slip
      });
      await onSaved();
      onClose();
    }catch(err){setError(err instanceof Error?err.message:"ส่งหลักฐานการชำระไม่สำเร็จ");}
    finally{setBusy(false);}
  }

  return <Modal title="ชำระค่าบริการแพ็กเกจ" subtitle="ส่งหลักฐานให้ฝ่าย IT ตรวจสอบเงินเข้าก่อนอัปเดตสิทธิ์" onClose={onClose}>
    <form className="entityForm" onSubmit={submit}>
      {error?<ErrorPanel message={error}/>:null}
      <div className="paymentSummary">
        <div><span>แพ็กเกจ</span><strong>{contract?.package_name||contract?.package_code||"CpiPOS"}</strong></div>
        <div><span>ยอดที่ต้องชำระ</span><strong>{formatCurrency(expected,billingCurrency)}</strong></div>
        {cycle?<div><span>รอบบิล</span><strong>{dateOnly.format(new Date(cycle.period_start))} – {dateOnly.format(new Date(cycle.period_end))}</strong></div>:null}
      </div>
      <div className="issuerBox">
        <strong>{info.issuer?.billing_legal_name_th||"บัญชีรับชำระค่าบริการ CpiPOS"}</strong>
        <span>{info.issuer?.billing_bank_name||"ธนาคาร"} · {info.issuer?.billing_bank_account_name||"บัญชีบริษัท"}</span>
        <b>{info.issuer?.billing_bank_account_number||info.issuer?.billing_promptpay_id||"กรุณาติดต่อฝ่าย Support"}</b>
      </div>
      <div className="formGrid singleColumn">
        <label><span>แนบสลิปการโอน</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setSlip(e.target.files?.[0]??null)} required/><small>รองรับ JPG, PNG และ WebP ไม่เกิน 4 MB</small></label>
      </div>
      <div className="modalActions"><button type="button" className="secondaryButton" onClick={onClose}>ยกเลิก</button><button className="primaryAction" disabled={busy||!slip||expected<=0}>{busy?<LoaderCircle className="spin" size={17}/>:<CreditCard size={17}/>}ส่งหลักฐานชำระเงิน</button></div>
    </form>
  </Modal>;
}

export function PackageView({ context }: { context: PortalContext }) {
  const [info,setInfo]=useState<PackageInfo|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [paying,setPaying]=useState<PackageInfo["billingCycles"][number]|null|undefined>(undefined);

  const refresh=useCallback(async()=>{
    setLoading(true);setError("");
    try{
      const data=await loadPackage(context.tenantId,context.role);
      setInfo(data);
    }catch{setError("ไม่สามารถโหลดข้อมูลแพ็กเกจได้");}
    finally{setLoading(false);}
  },[context.tenantId,context.role]);
  useEffect(()=>{void refresh();},[refresh]);
  if(loading&&!info)return <div className="loadingPanel"><LoaderCircle className="spin"/>กำลังโหลดแพ็กเกจ...</div>;

  const expiry=info?.runtime?.expires_at||info?.contract?.ended_at;
  const daysRemaining=info?.currentDue?.days_until_due??(expiry?Math.ceil((new Date(expiry).getTime()-Date.now())/86400000):null);
  const openRequest=info?.requests.find(row=>["pending","under_review"].includes(row.status));
  const dueCycles=(info?.billingCycles??[]).filter(cycle=>PAYABLE_BILLING_STATUSES.has(cycle.status)&&Number(cycle.amount_due)>Number(cycle.amount_paid));
  const currentDue=info?.currentDue??null;
  const canUpcoming=Boolean(context.role==="owner"&&!openRequest&&!dueCycles.length&&currentDue?.payable_now&&Number(currentDue.amount_due)>0);
  const status=info?.runtime?.lifecycle_status||info?.contract?.status||"—";
  const interval=info?.contract?.billing_interval==="yearly"?"รายปี":info?.contract?.billing_interval==="monthly"?"รายเดือน":info?.contract?.billing_interval||"—";
  const billingCurrency=info?.contract?.currency||"THB";

  return <>
    <div className="pageHeading"><div><p className="eyebrow">PACKAGE & BILLING</p><h2>แพ็กเกจและการชำระเงิน</h2><p>สถานะสิทธิ์ รอบบิล และรายการชำระเชื่อมกับระบบ POS/IT ชุดเดียวกัน</p></div><button className="ghostButton" onClick={()=>void refresh()}><RefreshCw size={18}/>รีเฟรช</button></div>
    {error?<ErrorPanel message={error}/>:null}
    <section className="packageHero packageHeroFive">
      <div><span>แพ็กเกจ</span><strong>{info?.contract?.package_name||info?.contract?.package_code||"—"}</strong><small>{info?.contract?.package_code||"แพ็กเกจปัจจุบัน"}</small></div>
      <div><span>สถานะ</span><strong>{billingStatusLabel(status)}</strong><small>{info?.runtime?.access_locked?"การใช้งานถูกจำกัด":"ระบบพร้อมใช้งาน"}</small></div>
      <div><span>รอบชำระ</span><strong>{interval}</strong><small>Auto renew: {info?.contract?.auto_renew?"เปิด":"ปิด"}</small></div>
      <div><span>หมดอายุ</span><strong>{expiry?dateOnly.format(new Date(expiry)):"—"}</strong><small>{daysRemaining===null?"ไม่กำหนด":daysRemaining<0?`เกินกำหนด ${Math.abs(daysRemaining)} วัน`:`เหลือ ${daysRemaining} วัน`}</small></div>
      <div><span>ค่าบริการต่อรอบ</span><strong>{info?.contract?.amount_per_cycle==null?"—":formatCurrency(Number(info.contract.amount_per_cycle),billingCurrency)}</strong><small>{billingCurrency}</small></div>
    </section>

    {openRequest?<div className="billingAlert"><Clock3 size={20}/><div><strong>รายการกำลังรอตรวจสอบ</strong><span>{billingStatusLabel(openRequest.status)} · {openRequest.package_name||info?.contract?.package_name||"แพ็กเกจ"} · ส่งเมื่อ {dateTime.format(new Date(openRequest.submitted_at))}</span></div></div>:null}
    {currentDue?<div className={"billingAlert "+(["open","overdue","trial_due"].includes(currentDue.status)?"warning":"")}><Clock3 size={20}/><div><strong>รอบที่ต้องชำระปัจจุบัน · {billingStatusLabel(currentDue.status)}</strong><span>{currentDue.due_at?`ครบกำหนด ${dateOnly.format(new Date(currentDue.due_at))} · `:""}ยอด {formatCurrency(Number(currentDue.amount_due??0),currentDue.currency||billingCurrency)} · ชำระแล้วรอบนี้ {formatCurrency(Number(currentDue.amount_paid??0),currentDue.currency||billingCurrency)}</span><small>คำนวณจากวันสิ้นสุดสิทธิ์ปัจจุบัน ไม่ใช้ Settlement ที่ชำระแล้วในอดีตมาแทนรอบนี้</small></div>{canUpcoming?<button className="primaryAction" onClick={()=>setPaying(null)}>ชำระเงิน</button>:null}</div>:null}

    {context.role==="owner"?<article className="panel tablePanel"><div className="panelHeader"><div><p className="eyebrow">BILLING HISTORY</p><h3>ประวัติรอบบิลจาก Settlement</h3><small>รายการชำระเงินจริงในอดีต แยกจากรอบที่ต้องชำระปัจจุบันด้านบน</small></div></div>{info?.billingCycles.length?<div className="tableWrap boundedTable"><table><thead><tr><th>ช่วงรอบบิล</th><th>สถานะ</th><th className="right">ยอดเรียกเก็บ</th><th className="right">ชำระแล้ว</th><th className="right">คงค้าง</th><th></th></tr></thead><tbody>{info.billingCycles.map(cycle=>{const outstanding=Math.max(0,Number(cycle.amount_due)-Number(cycle.amount_paid));const payable=PAYABLE_BILLING_STATUSES.has(cycle.status)&&outstanding>0&&!openRequest;return <tr key={cycle.id}><td>{dateOnly.format(new Date(cycle.period_start))} – {dateOnly.format(new Date(cycle.period_end))}</td><td><span className={cycle.status==="paid"?"status status-completed":"status status-pending"}>{cycle.status==="paid"?"ชำระแล้ว (ประวัติ)":billingStatusLabel(cycle.status)}</span></td><td className="right">{formatCurrency(Number(cycle.amount_due),billingCurrency)}</td><td className="right">{formatCurrency(Number(cycle.amount_paid),billingCurrency)}</td><td className="right"><strong>{formatCurrency(outstanding,billingCurrency)}</strong></td><td className="right">{payable?<button className="tableAction payAction" onClick={()=>setPaying(cycle)}><CreditCard size={15}/>ชำระเงิน</button>:null}</td></tr>;})}</tbody></table></div>:<Empty>ยังไม่มีประวัติรอบบิลที่แสดงได้</Empty>}</article>:<div className="infoBox">Manager ดูสถานะแพ็กเกจได้ ส่วนการชำระเงินและประวัติหลักฐานสงวนสำหรับ Owner</div>}

    {context.role==="owner"&&info?.requests.length?<article className="panel tablePanel"><div className="panelHeader"><div><p className="eyebrow">PAYMENT REQUESTS</p><h3>สถานะการชำระและคำขอ</h3></div></div><div className="tableWrap"><table><thead><tr><th>วันที่ส่ง</th><th>แพ็กเกจ</th><th>ประเภท</th><th>สถานะ</th><th>หลักฐาน</th></tr></thead><tbody>{info.requests.map(row=><tr key={row.id}><td>{dateTime.format(new Date(row.submitted_at))}</td><td>{row.package_name||"—"}</td><td>{row.request_type}</td><td><span className={["pending","under_review"].includes(row.status)?"status status-pending":"status"}>{billingStatusLabel(row.status)}</span></td><td>{row.has_evidence?"ส่งแล้ว":"—"}</td></tr>)}</tbody></table></div></article>:null}
    <div className="auditNote">CRM ส่งเฉพาะคำขอและหลักฐานไปยัง billing control plane เดิม การอนุมัติเงินจริง การออกใบเสร็จ และการเปลี่ยนสิทธิ์ยังดำเนินการโดย POS/IT ตามขั้นตอนเดิม</div>
    {paying!==undefined&&info?<PackagePaymentModal tenantId={context.tenantId} info={info} cycle={paying} onClose={()=>setPaying(undefined)} onSaved={refresh}/>:null}
  </>;
}
