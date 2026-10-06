import { useCallback,useEffect,useMemo,useState,type FormEvent } from "react";
import { LoaderCircle,Pencil,Plus,Power,PowerOff,Trash2 } from "lucide-react";
import { Empty,ErrorPanel,Modal } from "../../components/common";
import { loadPosAdminSnapshot,mutatePosAdmin } from "../../lib/api/pos-admin";
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
  const [editor,setEditor]=useState<Editor|null|undefined>(undefined);
  const refresh=useCallback(async()=>{setBusy(true);setError("");try{setData(await loadPosAdminSnapshot<PrintersAdminSnapshot>(context.tenantId,branchId,"printers"));}catch(e){setError(e instanceof Error?e.message:"โหลดเครื่องพิมพ์ไม่สำเร็จ");}finally{setBusy(false);}},[context.tenantId,branchId]);
  useEffect(()=>{void refresh();},[refresh]);
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
      setEditor(undefined);await refresh();
    }catch(err){setError(err instanceof Error?err.message:"บันทึกเครื่องพิมพ์ไม่สำเร็จ");}finally{setBusy(false);}
  }
  async function action(name:string,profile:PrinterProfileAdmin){
    if(name==="printer.delete"&&!window.confirm(`ยืนยันลบเครื่องพิมพ์ ${profile.printer_name}?`))return;
    try{await mutatePosAdmin(context.tenantId,branchId,name,{id:profile.id});await refresh();}
    catch(err){setError(err instanceof Error?err.message:"ดำเนินการเครื่องพิมพ์ไม่สำเร็จ");}
  }
  return <>
    {error?<ErrorPanel message={error}/>:null}
    <div className="adminKpis"><div><span>โปรไฟล์เครื่องพิมพ์</span><strong>{data?.profiles.length??"—"}</strong></div><div><span>เชื่อมใช้งาน</span><strong>{data?.devices.filter(d=>d.is_active).length??"—"}</strong></div><div><span>โซนครัว</span><strong>{data?.kitchen_zones.length??"—"}</strong></div></div>
    <section className="panel adminPanel"><div className="panelHeader"><div><p className="eyebrow">PRINTER REGISTRY</p><h3>เครื่องพิมพ์และเส้นทางงานพิมพ์</h3><small>LAN จัดค่าได้จาก CRM; USB/Bluetooth ใช้ Print Agent/POS สำหรับการค้นหาฮาร์ดแวร์จริง</small></div><button className="primaryAction" onClick={()=>edit(null)}><Plus size={16}/>เพิ่มเครื่องพิมพ์</button></div>
      <div className="tableWrap boundedTable"><table><thead><tr><th>เครื่องพิมพ์</th><th>การเชื่อมต่อ</th><th>หน้าที่</th><th>โซน</th><th>สถานะ</th><th></th></tr></thead><tbody>
        {data?.profiles.length?data.profiles.map(p=>{const d=byProfile.get(p.id);const a=d?.assignments??[];return <tr key={p.id}><td><strong>{p.printer_name}</strong><br/><small>{d?.brand||""} {d?.model||""}</small></td><td>{d?.connection_mode||p.connection_type}<br/><small>{p.ip_address||d?.runtime_device_code||"—"}</small></td><td>{Array.from(new Set(a.map(x=>x.purpose))).join(", ")||p.printer_role}</td><td>{Array.from(new Set(a.map(x=>x.zone_key).filter(Boolean))).join(", ")||"—"}</td><td><span className={`status ${p.enabled&&d?.is_active?"status-success":"status-muted"}`}>{d?.status||(p.enabled?"configured":"disabled")}</span></td><td><div className="inlineActions"><button className="tableAction" onClick={()=>edit(p)}><Pencil size={14}/>แก้ไข</button>{p.enabled&&d?.is_active?<button className="tableAction" onClick={()=>void action("printer.disconnect",p)}><PowerOff size={14}/>ตัดการเชื่อม</button>:d?<button className="tableAction" onClick={()=>void action("printer.reconnect",p)}><Power size={14}/>เชื่อมใหม่</button>:null}<button className="tableAction danger" onClick={()=>void action("printer.delete",p)}><Trash2 size={14}/>ลบ</button></div></td></tr>}):<tr><td colSpan={6}><Empty>ยังไม่มีเครื่องพิมพ์</Empty></td></tr>}
      </tbody></table></div>
    </section>
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
