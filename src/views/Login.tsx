import { useState } from "react";
import { CircleAlert, Download, LoaderCircle, ShieldCheck, TrendingUp, UserRoundCheck } from "lucide-react";
import { loginWithStoreEmployeeCode } from "../lib/portal";

export function Login({
  onSuccess,
  canInstall,
  onInstall
}: {
  onSuccess: () => Promise<void>;
  canInstall: boolean;
  onInstall: () => Promise<void>;
}) {
  const [storeCode, setStoreCode] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await loginWithStoreEmployeeCode(storeCode, employeeCode);
      await onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return <main className="loginPage">
    <section className="loginBrand">
      <div className="brandPill">CpiPOS CUSTOMER PORTAL</div>
      <h1>บริหารร้านง่ายขึ้น<br/><span>ทุกที่ ทุกเวลา</span></h1>
      <p className="loginLead">ติดตามยอดขาย ตรวจสอบสินค้าและสต๊อก พร้อมดูภาพรวมการดำเนินงานของร้านได้สะดวกในที่เดียว</p>
      <div className="loginBenefits">
        <span><ShieldCheck size={19}/> สำหรับเจ้าของร้านและผู้จัดการ</span>
        <span><UserRoundCheck size={19}/> ใช้งานพร้อมกันได้หลายเครื่อง</span>
        <span><TrendingUp size={19}/> ติดตามข้อมูลร้านได้ทุกที่ทุกเวลา</span>
      </div>
    </section>
    <section className="loginCard">
      <div className="loginLogoWrap"><img className="loginLogo" src="/cpipos-logo.png" alt="CpiPOS" /></div>
      <div><p className="eyebrow">WELCOME BACK</p><h2>เข้าสู่ระบบร้านค้า</h2><p className="muted">ใช้รหัสร้าน และรหัสพนักงานของเจ้าของร้านหรือผู้จัดการ</p></div>
      <form onSubmit={submit}>
        <label><span>รหัสร้าน</span><input autoComplete="username" value={storeCode} onChange={e=>setStoreCode(e.target.value)} placeholder="เช่น 900001" maxLength={32} required/></label>
        <label><span>รหัสพนักงาน</span><input autoComplete="off" inputMode="text" type="text" value={employeeCode} onChange={e=>setEmployeeCode(e.target.value.replace(/[^A-Za-z0-9._-]/g,"").slice(0,32))} placeholder="เช่น 182536" minLength={2} maxLength={32} required/></label>
        {error ? <div className="errorBox"><CircleAlert size={18}/>{error}</div> : null}
        <button className="primaryButton" disabled={busy}>{busy?<LoaderCircle className="spin" size={19}/>:null}{busy?"กำลังตรวจสอบ...":"เข้าสู่ระบบ"}</button>
      </form>
      {canInstall ? <button type="button" className="installButton" onClick={() => void onInstall()}><Download size={18}/>ติดตั้ง CpiPOS เป็นเว็บแอป</button> : null}
      <p className="securityCopy">สำหรับบัญชีเจ้าของร้านและผู้จัดการเท่านั้น</p>
    </section>
  </main>;
}
