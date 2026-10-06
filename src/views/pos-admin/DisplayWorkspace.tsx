import { useCallback,useEffect,useState } from "react";
import { Copy,MonitorSmartphone,Plus,PowerOff } from "lucide-react";
import { Empty,ErrorPanel,Modal } from "../../components/common";
import { loadPosAdminSnapshot,mutatePosAdmin } from "../../lib/api/pos-admin";
import type { PortalContext } from "../../types/portal";
import type { DisplayAdminSnapshot,DisplayPairingAdmin } from "../../types/pos-admin";

type NewCode={pairing_code:string;expires_at:string};

export function DisplayWorkspace({context,branchId}:{context:PortalContext;branchId:string}){
  const [data,setData]=useState<DisplayAdminSnapshot|null>(null);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [code,setCode]=useState<NewCode|null>(null);
  const refresh=useCallback(async()=>{setBusy(true);setError("");try{setData(await loadPosAdminSnapshot(context.tenantId,branchId,"display"));}catch(e){setError(e instanceof Error?e.message:"โหลด Customer Display ไม่สำเร็จ");}finally{setBusy(false);}},[context.tenantId,branchId]);
  useEffect(()=>{void refresh();},[refresh]);
  async function create(){
    setBusy(true);setError("");
    try{const r=await mutatePosAdmin<NewCode>(context.tenantId,branchId,"display.pairing.create",{});setCode(r);await refresh();}
    catch(e){setError(e instanceof Error?e.message:"สร้าง Pairing Code ไม่สำเร็จ");}finally{setBusy(false);}
  }
  async function disable(row:DisplayPairingAdmin){
    if(!window.confirm(`ยืนยันยกเลิกการเชื่อมต่อ ${row.device_name||"Customer Display"}?`))return;
    try{await mutatePosAdmin(context.tenantId,branchId,"display.pairing.disable",{id:row.id});await refresh();}
    catch(e){setError(e instanceof Error?e.message:"ยกเลิกการเชื่อมต่อไม่สำเร็จ");}
  }
  const active=data?.pairings.filter(p=>p.is_active&&p.paired&&(!p.device_token_expires_at||new Date(p.device_token_expires_at)>new Date())).length??0;
  return <>
    {error?<ErrorPanel message={error}/>:null}
    <div className="adminKpis"><div><span>จอที่เชื่อมอยู่</span><strong>{active}</strong></div><div><span>สูงสุดตาม IT Policy</span><strong>{data?.policy.max_active_devices??"—"}</strong></div><div><span>ตัดเมื่อไม่ใช้งาน</span><strong>{data?String(data.policy.inactive_expire_hours)+" ชม.":"—"}</strong></div></div>
    <section className="panel adminPanel"><div className="panelHeader"><div><p className="eyebrow">CUSTOMER DISPLAY</p><h3>จอลูกค้าและ Pairing</h3><small>จำนวนจอสูงสุดและอายุ inactivity ถูกควบคุมโดย IT Policy; Owner/Manager สร้างหรือยกเลิก pairing ได้</small></div><button className="primaryAction" disabled={busy} onClick={()=>void create()}><Plus size={16}/>สร้าง Pairing Code</button></div>
      <div className="displayPolicyStrip"><MonitorSmartphone size={19}/><div><strong>Channel: {data?.policy.channel??"main"}</strong><span>Policy source: {data?.policy.source==="it_policy"?"ฝ่าย IT":"ค่าเริ่มต้นระบบ"}</span></div></div>
      <div className="tableWrap boundedTable"><table><thead><tr><th>อุปกรณ์</th><th>สถานะ</th><th>ใช้งานล่าสุด</th><th>Token หมดอายุ</th><th></th></tr></thead><tbody>
        {data?.pairings.length?data.pairings.map(p=><tr key={p.id}><td><strong>{p.device_name||(p.paired?"Customer Display":"รอจับคู่")}</strong><br/><small>{p.channel}</small></td><td><span className={`status ${p.is_active?"status-success":"status-muted"}`}>{!p.is_active?"ยกเลิก":p.paired?"เชื่อมแล้ว":"รอจับคู่"}</span></td><td>{p.last_seen_at?new Date(p.last_seen_at).toLocaleString("th-TH"):"—"}</td><td>{p.device_token_expires_at?new Date(p.device_token_expires_at).toLocaleDateString("th-TH"):p.pair_code_expires_at?("Pair code: "+new Date(p.pair_code_expires_at).toLocaleTimeString("th-TH",{hour:"2-digit",minute:"2-digit"})):"—"}</td><td>{p.is_active?<button className="tableAction danger" onClick={()=>void disable(p)}><PowerOff size={14}/>ยกเลิก</button>:null}</td></tr>):<tr><td colSpan={5}><Empty>ยังไม่มี Customer Display ที่ลงทะเบียน</Empty></td></tr>}
      </tbody></table></div>
    </section>
    {code?<Modal title="Pairing Code สำหรับจอลูกค้า" onClose={()=>setCode(null)}><div className="pairingCodeBody"><p>นำรหัส 6 หลักนี้ไปกรอกที่หน้า Customer Display ภายใน 10 นาที รหัสจะแสดงครั้งเดียวใน CRM</p><strong>{code.pairing_code}</strong><span>หมดอายุ {new Date(code.expires_at).toLocaleString("th-TH")}</span><button className="secondaryButton" onClick={()=>void navigator.clipboard?.writeText(code.pairing_code)}><Copy size={16}/>คัดลอกรหัส</button><div className="modalActions"><button className="primaryAction" onClick={()=>setCode(null)}>เสร็จสิ้น</button></div></div></Modal>:null}
  </>;
}
