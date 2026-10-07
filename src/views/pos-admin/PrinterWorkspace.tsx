import { useCallback,useEffect,useMemo,useState,type FormEvent } from "react";
import { Activity,Link2,LoaderCircle,Pencil,Plus,Power,PowerOff,Printer,RefreshCw,RotateCcw,Trash2,Wifi,WifiOff } from "lucide-react";
import { Empty,ErrorPanel,Modal } from "../../components/common";
import { loadPosAdminSnapshot,mutatePosAdmin } from "../../lib/api/pos-admin";
import { bindPrinterAgent,loadPrinterHealth,queuePrinterTest,retryPrinterJob,type PrinterHealthJob,type PrinterHealthProfile,type PrinterHealthState } from "../../lib/api/printer-health";
import type { PortalContext } from "../../types/portal";
import type { PrinterAssignmentAdmin,PrinterDeviceAdmin,PrinterProfileAdmin,PrinterPurpose,PrintersAdminSnapshot } from "../../types/pos-admin";

type Editor={profile:PrinterProfileAdmin|null;device:PrinterDeviceAdmin|null;assignments:PrinterAssignmentAdmin[]};
const basePurposes:{value:PrinterPurpose;label:string}[]=[
  {value:"receipt",label:"ใบเสร็จ"},{value:"reprint",label:"พิมพ์ซ้ำ"},{value:"shift_report",label:"รายงานกะ"},
  {value:"payment_slip",label:"สลิปชำระเงิน"},{value:"cash_drawer",label:"ลิ้นชักเงิน"}
];

export function PrinterWorkspace({context,branchId}:{context:PortalContext;branchId:string}){
  const [data,setData]=useState<PrintersAdminSnapshot|null>(null);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [healthBusy,setHealthBusy]=useState(false);
  const [healthError,setHealthError]=useState("");
  const [health,setHealth]=useState<PrinterHealthState|null>(null);
  const [editor,setEditor]=useState<Editor|null|undefined>(undefined);
  const [bindTarget,setBindTarget]=useState<PrinterHealthProfile|null>(null);
  const [retryTarget,setRetryTarget]=useState<PrinterHealthJob|null>(null);
  const [retryPin,setRetryPin]=useState("");
  const refresh=useCallback(async()=>{setBusy(true);setError("");try{setData(await loadPosAdminSnapshot<PrintersAdminSnapshot>(context.tenantId,branchId,"printers"));}catch(e){setError(e instanceof Error?e.message:"โหลดเครื่องพิมพ์ไม่สำเร็จ");}finally{setBusy(false);}},[context.tenantId,branchId]);
  const refreshHealth=useCallback(async()=>{setHealthBusy(true);setHealthError("");try{setHealth(await loadPrinterHealth(context.tenantId,branchId));}catch(e){setHealthError(e instanceof Error?e.message:"โหลด Printer Health ไม่สำเร็จ");}finally{setHealthBusy(false);}},[context.tenantId,branchId]);
  useEffect(()=>{void refresh();void refreshHealth();},[refresh,refreshHealth]);
  const byProfile=useMemo(()=>new Map((data?.devices??[]).filter(d=>d.printer_profile_id).map(d=>[d.printer_profile_id!,d])),[data]);
  function edit(profile:PrinterProfileAdmin|null){const device=profile?byProfile.get(profile.id)??null:null;setEditor({profile,device,assignments:device?.assignments??[]});}
  async function save(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(!editor)return;setBusy(true);setError("");const form=new FormData(e.currentTarget);
    const assignments=[
      ...form.getAll("purpose").map(v=>({purpose:String(v),zone_key:"",is_default:false,copies:1})),
      ...form.getAll("zone_assignment").map(v=>{const [purpose,zone_key]=String(v).split("|");return {purpose,zone_key,is_default:false,copies:1};})
    ];
    try{
      await mutatePosAdmin(context.tenantId,branchId,"printer.save",{
        id:editor.profile?.id??null,printer_name:String(form.get("printer_name")??""),
        brand:String(form.get("brand")??""),model:String(form.get("model")??""),
        connection_mode:String(form.get("connection_mode")??"lan"),
        paper_width_mm:Number(form.get("paper_width_mm")??80),ip_address:String(form.get("ip_address")??""),
        port:String(form.get("port")??"")?Number(form.get("port")):null,
        runtime_device_code:String(form.get("runtime_device_code")??""),
        device_fingerprint:editor.device?.device_fingerprint??null,
        enabled:form.get("enabled")==="on",assignments
      });
      setEditor(undefined);await refresh();await refreshHealth();
    }catch(err){setError(err instanceof Error?err.message:"บันทึกเครื่องพิมพ์ไม่สำเร็จ");}finally{setBusy(false);}
  }
  async function action(name:string,profile:PrinterProfileAdmin){
    if(name==="printer.delete"&&!window.confirm(`ยืนยันลบเครื่องพิมพ์ ${profile.printer_name}?`))return;
    try{await mutatePosAdmin(context.tenantId,branchId,name,{id:profile.id});await refresh();await refreshHealth();}
    catch(err){setError(err instanceof Error?err.message:"ดำเนินการเครื่องพิมพ์ไม่สำเร็จ");}
  }
  async function saveBinding(agentId:string|null){
    if(!bindTarget)return;setHealthBusy(true);setHealthError("");
    try{setHealth(await bindPrinterAgent(context.tenantId,branchId,bindTarget.id,agentId));setBindTarget(null);}
    catch(e){setHealthError(e instanceof Error?e.message:"ผูก Print Agent ไม่สำเร็จ");}
    finally{setHealthBusy(false);}
  }
  async function testPrint(profile:PrinterHealthProfile){
    setHealthBusy(true);setHealthError("");
    try{await queuePrinterTest(context.tenantId,branchId,profile.id);await refreshHealth();window.alert("ส่ง Test Print เข้าคิว Print Agent แล้ว");}
    catch(e){setHealthError(e instanceof Error?e.message:"ส่ง Test Print ไม่สำเร็จ");}
    finally{setHealthBusy(false);}
  }
  async function retryJob(){
    if(!retryTarget?.printer_id||retryPin.length<4)return;setHealthBusy(true);setHealthError("");
    try{setHealth(await retryPrinterJob(context.tenantId,branchId,retryTarget.printer_id,retryTarget.id,retryPin));setRetryTarget(null);setRetryPin("");}
    catch(e){setHealthError(e instanceof Error?e.message:"Retry งานพิมพ์ไม่สำเร็จ");}
    finally{setHealthBusy(false);}
  }
  function jobStatus(status:string){if(status==="pending")return"รอคิว";if(status==="printing")return"กำลังพิมพ์";if(status==="printed")return"พิมพ์แล้ว";if(status==="retrying")return"รอลองใหม่";if(status==="failed")return"ล้มเหลว";return status;}
  return <>
    {error?<ErrorPanel message={error}/>:null}
    {healthError?<ErrorPanel message={healthError}/>:null}
    <div className="adminKpis"><div><span>โปรไฟล์เครื่องพิมพ์</span><strong>{data?.profiles.length??"—"}</strong></div><div><span>เชื่อมใช้งาน</span><strong>{data?.devices.filter(d=>d.is_active).length??"—"}</strong></div><div><span>โซนครัว</span><strong>{data?.kitchen_zones.length??"—"}</strong></div></div>

    <section className="panel adminPanel printerHealthPanel"><div className="panelHeader"><div><p className="eyebrow">PRINT AGENT HEALTH</p><h3>สถานะ Print Agent และคิวงานพิมพ์</h3><small>Heartbeat 5 นาที · Test Print และ Retry ใช้ queue/claim/ACK ชุดเดียวกับ POS</small></div><button className="secondaryButton" disabled={healthBusy} onClick={()=>void refreshHealth()}><RefreshCw className={healthBusy?"spin":""} size={15}/>รีเฟรช</button></div>
      <div className="printerHealthKpis"><div><Wifi size={17}/><span>Agent online<strong>{health?.summary.online_agents??"—"} / {health?.summary.total_agents??"—"}</strong></span></div><div><Printer size={17}/><span>เครื่องพร้อม<strong>{health?.summary.ready_printers??"—"} / {health?.summary.total_printers??"—"}</strong></span></div><div><Activity size={17}/><span>งานในคิว<strong>{health?.summary.queued_jobs??"—"}</strong></span></div><div><RotateCcw size={17}/><span>งานล้มเหลว<strong>{health?.summary.failed_jobs??"—"}</strong></span></div></div>
      <div className="printerAgentGrid">
        {health?.agents.length?health.agents.map(a=><article className={"printerAgentCard "+(a.online?"online":"offline")} key={a.id}><div className="printerAgentIcon">{a.online?<Wifi size={18}/>:<WifiOff size={18}/>}</div><div><strong>{a.agent_name}</strong><span>{a.device_code} · v{a.app_version||"—"}</span><small>{a.online?"Online":"Offline / stale"} · ล่าสุด {a.last_seen_at?new Date(a.last_seen_at).toLocaleString("th-TH"):"ไม่เคย heartbeat"}</small></div></article>):<div className="printerHealthEmpty"><WifiOff size={18}/><span>ยังไม่มี Print Agent ในสาขานี้</span></div>}
      </div>
      <div className="tableWrap boundedTable printerHealthTable"><table><thead><tr><th>เครื่องพิมพ์</th><th>Agent</th><th>พร้อม</th><th>อุปกรณ์</th><th></th></tr></thead><tbody>
        {health?.printers.length?health.printers.map(p=><tr key={p.id}><td><strong>{p.printer_name}</strong><br/><small>{p.printer_role} · {p.paper_width_mm}mm · {p.connection_type}</small></td><td>{p.binding_mode==="specific"?(health.agents.find(a=>a.id===p.bound_agent_id)?.agent_name||p.bound_device_code||"ผูกเฉพาะ Agent"):"ทุก Agent ในสาขา"}</td><td><span className={"status "+(p.ready?"status-success":"status-muted")}>{p.ready?"พร้อมพิมพ์":p.enabled?"Agent offline":"ปิดใช้งาน"}</span></td><td>{String(p.device?.display_name??"—")}<br/><small>{String(p.device?.status??"")}</small></td><td><div className="inlineActions"><button className="tableAction" onClick={()=>setBindTarget(p)}><Link2 size={14}/>ผูก Agent</button><button className="tableAction" disabled={!p.ready||healthBusy} onClick={()=>void testPrint(p)}><Printer size={14}/>Test Print</button></div></td></tr>):<tr><td colSpan={5}><Empty>ยังไม่มี Printer Profile ในสาขานี้</Empty></td></tr>}
      </tbody></table></div>
    </section>
    <section className="panel adminPanel printerJobsPanel"><div className="panelHeader"><div><p className="eyebrow">PRINT QUEUE</p><h3>งานพิมพ์ล่าสุด</h3><small>Retry จาก CRM จำกัดเฉพาะงานที่ล้มเหลวและปลอดภัยต่อการส่งซ้ำ</small></div></div>
      <div className="tableWrap boundedTable"><table><thead><tr><th>เวลา</th><th>เครื่อง</th><th>ประเภท</th><th>สถานะ</th><th>Retry</th><th>ข้อผิดพลาด</th><th></th></tr></thead><tbody>
      {health?.jobs.length?health.jobs.slice(0,30).map(j=><tr key={j.id}><td>{new Date(j.created_at).toLocaleString("th-TH")}</td><td>{j.printer_name||"—"}</td><td>{j.test_print?"Test Print":j.document_type||j.request_source||j.printer_role}</td><td><span className={"printJobStatus status-"+j.status}>{jobStatus(j.status)}</span></td><td>{j.retry_count}/{j.max_retry_count}</td><td className="printerJobError">{j.last_error||j.agent_error_code||"—"}</td><td>{j.retry_allowed?<button className="tableAction" onClick={()=>{setRetryTarget(j);setRetryPin("");}}><RotateCcw size={14}/>Retry</button>:null}</td></tr>):<tr><td colSpan={7}><Empty>ยังไม่มีงานพิมพ์ในสาขานี้</Empty></td></tr>}
      </tbody></table></div>
    </section>
    <section className="panel adminPanel"><div className="panelHeader"><div><p className="eyebrow">PRINTER REGISTRY</p><h3>เครื่องพิมพ์และเส้นทางงานพิมพ์</h3><small>LAN จัดค่าได้จาก CRM; USB/Bluetooth ใช้ Print Agent/POS สำหรับการค้นหาฮาร์ดแวร์จริง</small></div><button className="primaryAction" onClick={()=>edit(null)}><Plus size={16}/>เพิ่มเครื่องพิมพ์</button></div>
      <div className="tableWrap boundedTable"><table><thead><tr><th>เครื่องพิมพ์</th><th>การเชื่อมต่อ</th><th>หน้าที่</th><th>โซน</th><th>สถานะ</th><th></th></tr></thead><tbody>
        {data?.profiles.length?data.profiles.map(p=>{const d=byProfile.get(p.id);const a=d?.assignments??[];return <tr key={p.id}><td><strong>{p.printer_name}</strong><br/><small>{d?.brand||""} {d?.model||""}</small></td><td>{d?.connection_mode||p.connection_type}<br/><small>{p.ip_address||d?.runtime_device_code||"—"}</small></td><td>{Array.from(new Set(a.map(x=>x.purpose))).join(", ")||p.printer_role}</td><td>{Array.from(new Set(a.map(x=>x.zone_key).filter(Boolean))).join(", ")||"—"}</td><td><span className={`status ${p.enabled&&d?.is_active?"status-success":"status-muted"}`}>{d?.status||(p.enabled?"configured":"disabled")}</span></td><td><div className="inlineActions"><button className="tableAction" onClick={()=>edit(p)}><Pencil size={14}/>แก้ไข</button>{p.enabled&&d?.is_active?<button className="tableAction" onClick={()=>void action("printer.disconnect",p)}><PowerOff size={14}/>ตัดการเชื่อม</button>:d?<button className="tableAction" onClick={()=>void action("printer.reconnect",p)}><Power size={14}/>เชื่อมใหม่</button>:null}<button className="tableAction danger" onClick={()=>void action("printer.delete",p)}><Trash2 size={14}/>ลบ</button></div></td></tr>}):<tr><td colSpan={6}><Empty>ยังไม่มีเครื่องพิมพ์</Empty></td></tr>}
      </tbody></table></div>
    </section>
    {bindTarget?<Modal title={"ผูก Print Agent · "+bindTarget.printer_name} onClose={()=>setBindTarget(null)}><div className="entityForm"><div className="phase3InfoStrip"><Link2 size={18}/><div><strong>เลือก Agent เฉพาะเครื่อง หรือให้ Agent ใดก็ได้ในสาขารับงาน</strong><span>การผูกจะเปลี่ยนเฉพาะ routing metadata ของ Printer Profile ไม่แจก API key ให้ Browser</span></div></div><div className="agentBindingList"><button className={"agentBindingOption "+(bindTarget.binding_mode==="branch_any"?"active":"")} onClick={()=>void saveBinding(null)}><strong>ทุก Agent ในสาขา</strong><span>เหมาะกับสาขาที่มี Agent สำรองและรับงานแทนกันได้</span></button>{health?.agents.map(a=><button key={a.id} className={"agentBindingOption "+(bindTarget.bound_agent_id===a.id?"active":"")} onClick={()=>void saveBinding(a.id)}><strong>{a.agent_name}</strong><span>{a.device_code} · {a.online?"Online":"Offline"} · v{a.app_version||"—"}</span></button>)}</div><div className="modalActions"><button className="secondaryButton" onClick={()=>setBindTarget(null)}>ปิด</button></div></div></Modal>:null}
    {retryTarget?<Modal title="ยืนยัน Retry งานพิมพ์" onClose={()=>setRetryTarget(null)}><div className="entityForm"><div className="phase3InfoStrip phase4Warning"><RotateCcw size={18}/><div><strong>ระบบจะนำงานเดิมกลับเข้าคิว</strong><span>ใช้เฉพาะงาน failed ที่ไม่ใช่งานครัว/คำสั่งลิ้นชัก เพื่อป้องกันการทำงานซ้ำ</span></div></div><label><span>งาน</span><input value={(retryTarget.printer_name||"Printer")+" · "+(retryTarget.document_type||retryTarget.request_source||retryTarget.printer_role)} readOnly/></label><label><span>PIN Owner/Manager</span><input type="password" inputMode="numeric" value={retryPin} onChange={e=>setRetryPin(e.target.value.replace(/\D/g,"").slice(0,12))}/></label><div className="modalActions"><button className="secondaryButton" onClick={()=>setRetryTarget(null)}>ยกเลิก</button><button className="primaryAction" disabled={healthBusy||retryPin.length<4} onClick={()=>void retryJob()}>{healthBusy?<LoaderCircle className="spin" size={16}/>:<RotateCcw size={16}/>}ยืนยัน Retry</button></div></div></Modal>:null}
    {editor!==undefined&&editor?<Modal title={editor.profile?"แก้ไขเครื่องพิมพ์":"เพิ่มเครื่องพิมพ์"} onClose={()=>setEditor(undefined)} wide>
      <form className="entityForm" onSubmit={save}><div className="formGrid">
        <label><span>ชื่อเครื่องพิมพ์</span><input name="printer_name" defaultValue={editor.profile?.printer_name??""} required/></label>
        <label><span>รูปแบบเชื่อมต่อ</span><select name="connection_mode" defaultValue={editor.device?.connection_mode??(editor.profile?.connection_type==="NETWORK_ESC_POS"?"lan":editor.profile?.connection_type==="BLUETOOTH_BRIDGE"?"bluetooth":"usb")}><option value="lan">LAN / Network</option><option value="usb">USB / Print Agent</option><option value="bluetooth">Bluetooth / Print Agent</option></select></label>
        <label><span>ยี่ห้อ</span><input name="brand" defaultValue={editor.device?.brand??""}/></label>
        <label><span>รุ่น</span><input name="model" defaultValue={editor.device?.model??""}/></label>
        <label><span>ขนาดกระดาษ</span><select name="paper_width_mm" defaultValue={editor.profile?.paper_width_mm??80}><option value="58">58 mm</option><option value="80">80 mm</option></select></label>
        <label><span>IP Address (LAN)</span><input name="ip_address" defaultValue={editor.profile?.ip_address??""} placeholder="192.168.1.100"/></label>
        <label><span>Port</span><input name="port" type="number" defaultValue={editor.profile?.port??9100}/></label>
        <label><span>Runtime Device Code</span><input name="runtime_device_code" defaultValue={editor.device?.runtime_device_code??""} placeholder="สำหรับ USB/Bluetooth"/></label>
        <label className="switchField span2"><input name="enabled" type="checkbox" defaultChecked={editor.profile?.enabled??true}/><span>เปิดใช้งานเครื่องพิมพ์</span></label>
        <div className="span2"><span className="fieldLabel">งานพิมพ์ทั่วไป</span><div className="adminCheckGrid">{basePurposes.map(p=><label key={p.value}><input name="purpose" type="checkbox" value={p.value} defaultChecked={editor.assignments.some(a=>a.purpose===p.value&&a.zone_key==="")}/><span>{p.label}</span></label>)}</div></div>
        <div className="span2"><span className="fieldLabel">งานพิมพ์ตามโซนครัว</span><div className="printerZoneGrid"><div className="printerZoneHead"><span>โซน</span><span>ครัว</span><span>เครื่องดื่ม</span><span>บาร์</span></div>{data?.kitchen_zones.map(z=><div className="printerZoneRow" key={z.id}><strong>{z.zone_name}<small>{z.zone_code}</small></strong>{(["kitchen","drink","bar"] as PrinterPurpose[]).map(p=><label key={p}><input name="zone_assignment" type="checkbox" value={`${p}|${z.zone_code}`} defaultChecked={editor.assignments.some(a=>a.purpose===p&&a.zone_key.toUpperCase()===z.zone_code.toUpperCase())}/></label>)}</div>)}</div></div>
      </div><div className="modalActions"><button type="button" className="secondaryButton" onClick={()=>setEditor(undefined)}>ยกเลิก</button><button className="primaryAction" disabled={busy}>{busy?<LoaderCircle className="spin" size={16}/>:null}บันทึก</button></div></form>
    </Modal>:null}
  </>;
}
