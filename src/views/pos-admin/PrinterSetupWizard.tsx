import { useEffect,useMemo,useState } from "react";
import { Check,ChevronLeft,ChevronRight,CircleAlert,LoaderCircle,Network,Printer,RefreshCw,Usb,Wifi } from "lucide-react";
import { ErrorPanel,Modal } from "../../components/common";
import { bindPrinterAgent,loadPrinterHealth,queuePrinterTest,type PrinterDiscoveryCandidate,type PrinterHealthAgent,type PrinterHealthState } from "../../lib/api/printer-health";
import { mutatePosAdmin } from "../../lib/api/pos-admin";
import type { PortalContext } from "../../types/portal";
import type { PrinterKitchenZoneAdmin,PrinterPurpose } from "../../types/pos-admin";

type Mode="lan"|"usb"|"bluetooth";
type Step=1|2|3|4|5;
type SavedPrinter={profile:{id:string;printer_name:string};device:{id:string}};

const purposeOptions:{value:PrinterPurpose;label:string;help:string}[]=[
  {value:"receipt",label:"ใบเสร็จ",help:"พิมพ์ใบเสร็จหลังชำระเงิน"},
  {value:"reprint",label:"พิมพ์ซ้ำ",help:"พิมพ์ใบเสร็จย้อนหลัง"},
  {value:"kitchen",label:"ครัว",help:"ส่งออเดอร์เข้าครัว"},
  {value:"drink",label:"เครื่องดื่ม",help:"ส่งงานโซนเครื่องดื่ม"},
  {value:"bar",label:"บาร์",help:"ส่งงานโซนบาร์"},
  {value:"shift_report",label:"รายงานกะ",help:"พิมพ์สรุปปิดกะ"},
  {value:"payment_slip",label:"สลิปชำระเงิน",help:"พิมพ์หลักฐานชำระ"},
  {value:"cash_drawer",label:"ลิ้นชักเงิน",help:"สั่งเปิดลิ้นชักผ่านเครื่องพิมพ์"}
];
const zoned=new Set<PrinterPurpose>(["kitchen","drink","bar"]);

function transportsFor(agent:PrinterHealthAgent|null):Mode[]{
  if(!agent)return[];
  const raw=agent.transports.map(v=>String(v).toLowerCase()).filter((v):v is Mode=>v==="lan"||v==="usb"||v==="bluetooth");
  if(raw.length)return Array.from(new Set(raw));
  if((agent.runtime+" "+agent.device_model).toLowerCase().includes("android"))return["lan","usb","bluetooth"];
  return["usb"];
}
function sleep(ms:number){return new Promise(resolve=>window.setTimeout(resolve,ms));}
function statusLabel(status:string){
  if(status==="pending")return"รอ Print Agent";
  if(status==="printing")return"กำลังพิมพ์";
  if(status==="printed")return"พิมพ์สำเร็จ";
  if(status==="retrying")return"กำลังรอลองใหม่";
  if(status==="failed")return"พิมพ์ไม่สำเร็จ";
  return status||"—";
}

export function PrinterSetupWizard({context,branchId,health,kitchenZones,onRefresh,onClose,onCompleted}:{
  context:PortalContext;branchId:string;health:PrinterHealthState|null;kitchenZones:PrinterKitchenZoneAdmin[];
  onRefresh:()=>Promise<void>;onClose:()=>void;onCompleted:()=>Promise<void>;
}){
  const [step,setStep]=useState<Step>(1);
  const [agentId,setAgentId]=useState("");
  const [choice,setChoice]=useState("");
  const [mode,setMode]=useState<Mode>("usb");
  const [name,setName]=useState("");
  const [brand,setBrand]=useState("");
  const [model,setModel]=useState("");
  const [paper,setPaper]=useState<58|80>(80);
  const [ip,setIp]=useState("");
  const [port,setPort]=useState(9100);
  const [purposes,setPurposes]=useState<PrinterPurpose[]>(["receipt","reprint"]);
  const [zones,setZones]=useState<string[]>([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [savedProfileId,setSavedProfileId]=useState("");
  const [testJobId,setTestJobId]=useState("");
  const [testStatus,setTestStatus]=useState("");

  const onlineAgents=useMemo(()=>health?.agents.filter(a=>a.online)??[],[health]);
  const agent=onlineAgents.find(a=>a.id===agentId)??null;
  const transports=useMemo(()=>transportsFor(agent),[agent]);
  const candidates=useMemo(()=>health?.candidates.filter(c=>c.agent_id===agentId||(!c.agent_id&&c.runtime_device_code?.toUpperCase()===agent?.device_code.toUpperCase()))??[],[health,agentId,agent]);
  const candidate=health?.candidates.find(c=>c.id===choice)??null;

  useEffect(()=>{if(!agentId&&onlineAgents.length===1)setAgentId(onlineAgents[0].id);},[agentId,onlineAgents]);
  useEffect(()=>{
    if(!candidate)return;
    setMode(candidate.connection_mode);setName(candidate.display_name);setBrand(candidate.brand??"");setModel(candidate.model??"");setPaper(candidate.paper_width_mm);
  },[candidate]);

  function pickAgent(next:PrinterHealthAgent){setAgentId(next.id);setChoice("");setError("");}
  function pickLan(){setChoice("manual-lan");setMode("lan");setName(name||"LAN Receipt Printer");setPaper(paper||80);setError("");}
  function togglePurpose(p:PrinterPurpose){setPurposes(current=>current.includes(p)?current.filter(x=>x!==p):[...current,p]);}
  function toggleZone(code:string){setZones(current=>current.includes(code)?current.filter(x=>x!==code):[...current,code]);}
  function canStep2(){return Boolean(agent);}
  function canStep3(){
    if(choice==="manual-lan")return Boolean(agent&&transports.includes("lan")&&ip.trim()&&port>0&&port<=65535);
    return Boolean(candidate?.ready_for_setup&&agent);
  }
  function canReview(){return name.trim().length>0&&purposes.length>0;}
  function assignments(){
    const rows:Array<{purpose:PrinterPurpose;zone_key:string;is_default:boolean;copies:number}>=[];
    for(const p of purposes){
      if(zoned.has(p)&&zones.length){for(const z of zones)rows.push({purpose:p,zone_key:z,is_default:true,copies:1});}
      else rows.push({purpose:p,zone_key:"",is_default:false,copies:1});
    }
    return rows;
  }
  async function save(){
    if(!agent||!canReview())return;
    setBusy(true);setError("");
    try{
      const result=await mutatePosAdmin<SavedPrinter>(context.tenantId,branchId,"printer.save",{
        printer_name:name.trim(),brand:brand.trim(),model:model.trim(),connection_mode:mode,paper_width_mm:paper,
        ip_address:mode==="lan"?ip.trim():"",port:mode==="lan"?port:null,
        runtime_device_code:agent.device_code,discovered_device_id:candidate?.id??null,enabled:true,assignments:assignments()
      });
      await bindPrinterAgent(context.tenantId,branchId,result.profile.id,agent.id);
      setSavedProfileId(result.profile.id);setStep(5);await onCompleted();
    }catch(e){setError(e instanceof Error?e.message:"ตั้งค่าเครื่องพิมพ์ไม่สำเร็จ");}
    finally{setBusy(false);}
  }
  async function test(){
    if(!savedProfileId)return;
    setBusy(true);setError("");setTestStatus("pending");
    try{
      const queued=await queuePrinterTest(context.tenantId,branchId,savedProfileId);setTestJobId(queued.job.id);setTestStatus(queued.job.status);
      for(let i=0;i<6;i++){
        await sleep(1500);
        const next=await loadPrinterHealth(context.tenantId,branchId);
        const job=next.jobs.find(j=>j.id===queued.job.id);
        if(job){setTestStatus(job.status);if(job.status==="printed"||job.status==="failed")break;}
      }
      await onCompleted();
    }catch(e){setError(e instanceof Error?e.message:"Test Print ไม่สำเร็จ");setTestStatus("failed");}
    finally{setBusy(false);}
  }

  const stepNames=["เลือก Agent","เลือกเครื่อง","กำหนดหน้าที่","ตรวจสอบ","ทดสอบ"];
  return <Modal title="Printer Setup Wizard" onClose={onClose} wide>
    <div className="printerWizard">
      <div className="printerWizardSteps">{stepNames.map((label,index)=>{const n=(index+1) as Step;return <div key={label} className={(step===n?"active ":"")+(step>n?"done":"")}><span>{step>n?<Check size={13}/>:n}</span><strong>{label}</strong></div>;})}</div>
      {error?<ErrorPanel message={error}/>:null}

      {step===1?<div className="printerWizardBody">
        <div className="wizardIntro"><Wifi size={20}/><div><strong>เลือก POS / Print Agent ที่จะรับงานพิมพ์</strong><span>แสดงเฉพาะ Agent ที่ heartbeat ภายใน 5 นาที เพื่อป้องกันการผูกกับเครื่องที่ออฟไลน์</span></div></div>
        <div className="wizardCardGrid">{onlineAgents.length?onlineAgents.map(a=><button key={a.id} className={"wizardChoice "+(agentId===a.id?"selected":"")} onClick={()=>pickAgent(a)}><div className="wizardChoiceIcon"><Wifi size={18}/></div><div><strong>{a.agent_name}</strong><span>{a.device_code} · v{a.app_version||"—"}</span><small>{transportsFor(a).map(x=>x.toUpperCase()).join(" · ")}</small></div>{agentId===a.id?<Check size={18}/>:null}</button>):<div className="wizardBlocked"><CircleAlert size={20}/><div><strong>ยังไม่มี Print Agent ที่ Online</strong><span>เปิด POS/Print Agent แล้วกดรีเฟรช เมื่อ heartbeat เข้ามา Wizard จะเห็นเครื่องโดยอัตโนมัติ</span></div></div>}</div>
        <div className="wizardRefresh"><button className="secondaryButton" disabled={busy} onClick={()=>void onRefresh()}><RefreshCw size={14}/>รีเฟรช Agent</button></div>
      </div>:null}

      {step===2?<div className="printerWizardBody">
        <div className="wizardIntro"><Printer size={20}/><div><strong>เลือกเครื่องพิมพ์ที่ตรวจพบ</strong><span>USB/Bluetooth ใช้ physical candidate จาก POS Auto Registry เท่านั้น ส่วน LAN ตั้ง IP ได้จาก CRM</span></div></div>
        <div className="wizardCandidateList">
          {candidates.map(c=><button key={c.id} disabled={!c.ready_for_setup} className={"wizardCandidate "+(choice===c.id?"selected ":"")+(!c.ready_for_setup?"blocked":"")} onClick={()=>setChoice(c.id)}><div className="wizardChoiceIcon">{c.connection_mode==="usb"?<Usb size={18}/>:<Wifi size={18}/>}</div><div><strong>{c.display_name}</strong><span>{c.connection_mode.toUpperCase()} · {c.paper_width_mm}mm · {c.status}</span><small>{c.ready_for_setup?"ยืนยัน physical target แล้ว พร้อมตั้งค่า":"รอยืนยันจาก POS/Print Agent · "+c.verification_state}</small></div>{choice===c.id?<Check size={18}/>:null}</button>)}
          {transports.includes("lan")?<button className={"wizardCandidate "+(choice==="manual-lan"?"selected":"")} onClick={pickLan}><div className="wizardChoiceIcon"><Network size={18}/></div><div><strong>เครื่องพิมพ์ LAN / ESC-POS</strong><span>กำหนด IP และ Port เอง</span><small>Print Agent {agent?.device_code} จะรับงานจาก Cloud แล้วพิมพ์ในเครือข่ายร้าน</small></div>{choice==="manual-lan"?<Check size={18}/>:null}</button>:null}
        </div>
        {choice==="manual-lan"?<div className="wizardLanForm"><label><span>IP / Hostname</span><input value={ip} onChange={e=>setIp(e.target.value)} placeholder="192.168.1.100"/></label><label><span>Port</span><input type="number" min={1} max={65535} value={port} onChange={e=>setPort(Number(e.target.value)||9100)}/></label></div>:null}
        {!candidates.length&&!transports.includes("lan")?<div className="wizardBlocked"><CircleAlert size={20}/><div><strong>Agent ยังไม่ส่ง physical printer candidate</strong><span>เชื่อม USB/Bluetooth ที่ POS แล้วเปิด Print Agent ให้ Auto Registry ตรวจพบก่อน</span></div></div>:null}
        <div className="wizardRefresh"><button className="secondaryButton" onClick={()=>void onRefresh()}><RefreshCw size={14}/>ค้นหาใหม่</button></div>
      </div>:null}

      {step===3?<div className="printerWizardBody">
        <div className="wizardFormGrid">
          <label><span>ชื่อเครื่องพิมพ์</span><input value={name} onChange={e=>setName(e.target.value)} placeholder="Receipt Counter 1"/></label>
          <label><span>กระดาษ</span><select value={paper} onChange={e=>setPaper(Number(e.target.value) as 58|80)}><option value={58}>58 mm</option><option value={80}>80 mm</option></select></label>
          <label><span>ยี่ห้อ</span><input value={brand} onChange={e=>setBrand(e.target.value)} placeholder="ถ้าทราบ"/></label>
          <label><span>รุ่น</span><input value={model} onChange={e=>setModel(e.target.value)} placeholder="ถ้าทราบ"/></label>
        </div>
        <div className="wizardSection"><strong>หน้าที่ของเครื่องพิมพ์</strong><div className="wizardPurposeGrid">{purposeOptions.map(p=><label key={p.value} className={purposes.includes(p.value)?"checked":""}><input type="checkbox" checked={purposes.includes(p.value)} onChange={()=>togglePurpose(p.value)}/><span><b>{p.label}</b><small>{p.help}</small></span></label>)}</div></div>
        {purposes.some(p=>zoned.has(p))&&kitchenZones.length?<div className="wizardSection"><strong>โซนครัวที่เครื่องนี้รับงาน</strong><div className="wizardZoneGrid">{kitchenZones.filter(z=>z.is_active).map(z=><label key={z.id} className={zones.includes(z.zone_code)?"checked":""}><input type="checkbox" checked={zones.includes(z.zone_code)} onChange={()=>toggleZone(z.zone_code)}/><span>{z.zone_name}<small>{z.zone_code}</small></span></label>)}</div><small>ไม่เลือกโซน = รับงานประเภทนั้นแบบทั่วไป</small></div>:null}
      </div>:null}

      {step===4?<div className="printerWizardBody">
        <div className="wizardReview">
          <div><span>Print Agent</span><strong>{agent?.agent_name}</strong><small>{agent?.device_code}</small></div>
          <div><span>การเชื่อมต่อ</span><strong>{mode.toUpperCase()}</strong><small>{candidate?.display_name||(mode==="lan"?ip+":"+port:"—")}</small></div>
          <div><span>เครื่องพิมพ์</span><strong>{name}</strong><small>{paper}mm {brand||model?"· "+[brand,model].filter(Boolean).join(" "):""}</small></div>
          <div><span>หน้าที่</span><strong>{purposes.length} รายการ</strong><small>{purposes.join(" · ")}</small></div>
        </div>
        <div className="phase3InfoStrip"><Check size={18}/><div><strong>พร้อมบันทึกลง control plane เดียวกับ POS</strong><span>Wizard จะ claim physical candidate แบบ atomic, บันทึก routing/assignments, ผูก Agent และเปิดใช้งาน Printer Profile</span></div></div>
      </div>:null}

      {step===5?<div className="printerWizardBody">
        <div className="wizardComplete"><div className="wizardCompleteIcon"><Check size={28}/></div><strong>ตั้งค่าเครื่องพิมพ์แล้ว</strong><span>{name} ถูกบันทึกและผูกกับ {agent?.agent_name}</span></div>
        <div className="wizardTestPanel"><Printer size={20}/><div><strong>ทดสอบพิมพ์จริง</strong><span>งาน Test Print จะเข้า queue เดียวกับ POS และต้องถูก Print Agent claim/ACK</span></div><button className="primaryAction" disabled={busy} onClick={()=>void test()}>{busy?<LoaderCircle className="spin" size={15}/>:<Printer size={15}/>}Test Print</button></div>
        {testJobId?<div className={"wizardTestStatus "+testStatus}><span>สถานะ</span><strong>{statusLabel(testStatus)}</strong><small>Job {testJobId.slice(0,8)}</small></div>:null}
        {testStatus==="failed"?<div className="wizardBlocked"><CircleAlert size={18}/><div><strong>Test Print ล้มเหลว</strong><span>ตรวจสาย/กระดาษ/สิทธิ์ USB หรือ Bluetooth แล้วสามารถ Retry จาก Print Queue ได้</span></div></div>:null}
      </div>:null}

      <div className="wizardFooter">
        <button className="secondaryButton" type="button" disabled={busy} onClick={()=>{if(step===1)onClose();else if(step===5)onClose();else setStep((step-1) as Step);}}>{step===1||step===5?"ปิด":<><ChevronLeft size={15}/>ย้อนกลับ</>}</button>
        {step<4?<button className="primaryAction" type="button" disabled={busy||(step===1&&!canStep2())||(step===2&&!canStep3())||(step===3&&!canReview())} onClick={()=>setStep((step+1) as Step)}>ถัดไป<ChevronRight size={15}/></button>:null}
        {step===4?<button className="primaryAction" type="button" disabled={busy||!canReview()} onClick={()=>void save()}>{busy?<LoaderCircle className="spin" size={15}/>:<Check size={15}/>}บันทึกและผูก Agent</button>:null}
      </div>
    </div>
  </Modal>;
}
