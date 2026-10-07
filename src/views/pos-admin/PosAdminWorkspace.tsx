import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, ChefHat, CircleAlert, LoaderCircle, Pencil, Plus, RefreshCw, Search, Table2, Trash2, UsersRound, UtensilsCrossed, MonitorSmartphone } from "lucide-react";
import { Empty, ErrorPanel, Modal } from "../../components/common";
import { loadPosAdminSnapshot, mutatePosAdmin } from "../../lib/api/pos-admin";
import type { PortalContext } from "../../types/portal";
import { FloorPlanEditor } from "./FloorPlanEditor";
import { KitchenProductRouting } from "./KitchenProductRouting";
import { PrinterWorkspace } from "./PrinterWorkspace";
import { DisplayWorkspace } from "./DisplayWorkspace";
import {
  ActivityWorkspace,InetWorkspace,OrderKitchenWorkspace,ProductSalesWorkspace,
  ReceiptsWorkspace,TableQrWorkspace,TaxInvoicesWorkspace
} from "./Phase3Workspaces";
import type {
  BuffetAdminSnapshot, BuffetProductAdmin, CashierDeviceAdmin, DevicesAdminSnapshot, DiningTableAdmin,
  KitchenAdminSnapshot, KitchenZoneAdmin, MemberAdmin, MembersAdminSnapshot, PosAdminModule,
  TableZoneAdmin, TablesAdminSnapshot
} from "../../types/pos-admin";

type WorkspaceProps={module:PosAdminModule;context:PortalContext;branchId:string|null;onBack:()=>void};

function ScopeHeader({title,subtitle,context,branchId,onBranchChange,onBack,onRefresh,busy=false}:{
  title:string;subtitle:string;context:PortalContext;branchId:string;onBranchChange:(id:string)=>void;
  onBack:()=>void;onRefresh:()=>void;busy?:boolean;
}){
  return <div className="adminModuleHeader">
    <div className="adminModuleTitle">
      <button className="iconButton" onClick={onBack} aria-label="กลับ"><ArrowLeft size={19}/></button>
      <div><p className="eyebrow">POS BACK OFFICE</p><h2>{title}</h2><p>{subtitle}</p></div>
    </div>
    <div className="adminModuleTools">
      <select value={branchId} onChange={e=>onBranchChange(e.target.value)} aria-label="เลือกสาขา">
        {context.branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
      </select>
      <button className="ghostButton" disabled={busy} onClick={onRefresh}><RefreshCw size={17} className={busy?"spin":""}/>รีเฟรช</button>
    </div>
  </div>;
}

function useSnapshot<T>(context:PortalContext,branchId:string,module:PosAdminModule){
  const [data,setData]=useState<T|null>(null);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const refresh=useCallback(async()=>{
    if(!branchId)return;
    setBusy(true);setError("");
    try{setData(await loadPosAdminSnapshot(context.tenantId,branchId,module) as T);}
    catch(err){setError(err instanceof Error?err.message:"โหลดข้อมูลไม่สำเร็จ");}
    finally{setBusy(false);}
  },[context.tenantId,branchId,module]);
  useEffect(()=>{void refresh();},[refresh]);
  return {data,setData,error,setError,busy,refresh};
}

function TablesWorkspace({context,branchId,onBack}:{context:PortalContext;branchId:string;onBack:()=>void}){
  const {data,error,setError,busy,refresh}=useSnapshot<TablesAdminSnapshot>(context,branchId,"tables");
  const [table,setTable]=useState<DiningTableAdmin|null|undefined>(undefined);
  const [zone,setZone]=useState<TableZoneAdmin|null|undefined>(undefined);
  const [saving,setSaving]=useState(false);

  async function saveZone(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setSaving(true);setError("");
    const form=new FormData(event.currentTarget);
    try{
      await mutatePosAdmin(context.tenantId,branchId,"table_zone.save",{
        id:zone?.id??null,zone_name:String(form.get("zone_name")??""),color:String(form.get("color")??"#0ea5e9"),
        display_order:Number(form.get("display_order")??0),is_active:form.get("is_active")==="on"
      });
      setZone(undefined);await refresh();
    }catch(err){setError(err instanceof Error?err.message:"บันทึกโซนไม่สำเร็จ");}finally{setSaving(false);}
  }
  async function saveTable(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setSaving(true);setError("");
    const form=new FormData(event.currentTarget);
    try{
      await mutatePosAdmin(context.tenantId,branchId,"table.save",{
        id:table?.id??null,zone_id:String(form.get("zone_id")??"")||null,table_code:String(form.get("table_code")??""),
        table_name:String(form.get("table_name")??""),capacity:Number(form.get("capacity")??4),
        status:String(form.get("status")??"available"),shape:String(form.get("shape")??"rectangle"),
        is_active:form.get("is_active")==="on"
      });
      setTable(undefined);await refresh();
    }catch(err){setError(err instanceof Error?err.message:"บันทึกโต๊ะไม่สำเร็จ");}finally{setSaving(false);}
  }
  async function remove(action:string,id:string,label:string){
    if(!window.confirm(`ยืนยันลบ ${label}?`))return;
    try{await mutatePosAdmin(context.tenantId,branchId,action,{id});await refresh();}
    catch(err){setError(err instanceof Error?err.message:"ลบข้อมูลไม่สำเร็จ");}
  }

  return <>
    {error?<ErrorPanel message={error}/>:null}
    <div className="adminKpis">
      <div><span>โต๊ะทั้งหมด</span><strong>{data?.tables.length??"—"}</strong></div>
      <div><span>โซน</span><strong>{data?.zones.length??"—"}</strong></div>
      <div><span>โต๊ะเปิดใช้งาน</span><strong>{data?.tables.filter(x=>x.is_active).length??"—"}</strong></div>
    </div>
    <section className="panel adminPanel">
      <div className="panelHeader"><div><p className="eyebrow">TABLE ZONES</p><h3>โซนโต๊ะ</h3></div><button className="primaryAction" onClick={()=>setZone(null)}><Plus size={17}/>เพิ่มโซน</button></div>
      <div className="tableWrap"><table><thead><tr><th>โซน</th><th>สี</th><th>ลำดับ</th><th>สถานะ</th><th></th></tr></thead><tbody>
        {data?.zones.length?data.zones.map(z=><tr key={z.id}><td><strong>{z.zone_name}</strong></td><td><span className="zoneColor" style={{background:z.color}}/>{z.color}</td><td>{z.display_order}</td><td><span className={`status ${z.is_active?"status-success":"status-muted"}`}>{z.is_active?"ใช้งาน":"ปิด"}</span></td><td><div className="inlineActions"><button className="tableAction" onClick={()=>setZone(z)}><Pencil size={15}/>แก้ไข</button><button className="tableAction danger" onClick={()=>void remove("table_zone.delete",z.id,z.zone_name)}><Trash2 size={15}/>ลบ</button></div></td></tr>):<tr><td colSpan={5}><Empty>ยังไม่มีโซนโต๊ะ</Empty></td></tr>}
      </tbody></table></div>
    </section>
    <section className="panel adminPanel">
      <div className="panelHeader"><div><p className="eyebrow">DINING TABLES</p><h3>โต๊ะ</h3></div><button className="primaryAction" onClick={()=>setTable(null)}><Plus size={17}/>เพิ่มโต๊ะ</button></div>
      <div className="tableWrap boundedTable"><table><thead><tr><th>รหัส</th><th>ชื่อโต๊ะ</th><th>โซน</th><th>ที่นั่ง</th><th>สถานะ</th><th></th></tr></thead><tbody>
        {data?.tables.length?data.tables.map(t=><tr key={t.id}><td><strong>{t.table_code}</strong></td><td>{t.table_name||"—"}</td><td>{data.zones.find(z=>z.id===t.zone_id)?.zone_name||"—"}</td><td>{t.capacity}</td><td><span className={`status ${t.is_active?"status-success":"status-muted"}`}>{t.status}</span></td><td><div className="inlineActions"><button className="tableAction" onClick={()=>setTable(t)}><Pencil size={15}/>แก้ไข</button><button className="tableAction danger" onClick={()=>void remove("table.delete",t.id,`โต๊ะ ${t.table_code}`)}><Trash2 size={15}/>ลบ</button></div></td></tr>):<tr><td colSpan={6}><Empty>ยังไม่มีโต๊ะ</Empty></td></tr>}
      </tbody></table></div>
    </section>
    {data?<FloorPlanEditor context={context} branchId={branchId} snapshot={data} onRefresh={refresh} onError={setError}/>:null}
    {zone!==undefined?<Modal title={zone?"แก้ไขโซน":"เพิ่มโซน"} onClose={()=>setZone(undefined)}>
      <form className="entityForm" onSubmit={saveZone}><div className="formGrid">
        <label className="span2"><span>ชื่อโซน</span><input name="zone_name" defaultValue={zone?.zone_name??""} required/></label>
        <label><span>สี</span><input name="color" type="color" defaultValue={zone?.color??"#0ea5e9"}/></label>
        <label><span>ลำดับ</span><input name="display_order" type="number" defaultValue={zone?.display_order??0}/></label>
        <label className="switchField span2"><input name="is_active" type="checkbox" defaultChecked={zone?.is_active??true}/><span>เปิดใช้งาน</span></label>
      </div><div className="modalActions"><button type="button" className="secondaryButton" onClick={()=>setZone(undefined)}>ยกเลิก</button><button className="primaryAction" disabled={saving}>{saving?<LoaderCircle className="spin" size={17}/>:null}บันทึก</button></div></form>
    </Modal>:null}
    {table!==undefined?<Modal title={table?"แก้ไขโต๊ะ":"เพิ่มโต๊ะ"} onClose={()=>setTable(undefined)}>
      <form className="entityForm" onSubmit={saveTable}><div className="formGrid">
        <label><span>รหัสโต๊ะ</span><input name="table_code" defaultValue={table?.table_code??""} placeholder="เว้นว่างเพื่อสร้างอัตโนมัติ"/></label>
        <label><span>ชื่อโต๊ะ</span><input name="table_name" defaultValue={table?.table_name??""}/></label>
        <label><span>โซน</span><select name="zone_id" defaultValue={table?.zone_id??""}><option value="">ไม่ระบุ</option>{data?.zones.map(z=><option key={z.id} value={z.id}>{z.zone_name}</option>)}</select></label>
        <label><span>จำนวนที่นั่ง</span><input name="capacity" type="number" min={1} defaultValue={table?.capacity??4}/></label>
        <label><span>สถานะ</span><select name="status" defaultValue={table?.status??"available"}><option value="available">available</option><option value="occupied">occupied</option><option value="ordering">ordering</option><option value="pending_payment">pending payment</option><option value="reserved">reserved</option><option value="disabled">disabled</option></select></label>
        <label><span>รูปทรง</span><select name="shape" defaultValue={table?.shape??"rectangle"}><option value="rectangle">สี่เหลี่ยมผืนผ้า</option><option value="square">สี่เหลี่ยม</option><option value="circle">วงกลม</option></select></label>
        <label className="switchField span2"><input name="is_active" type="checkbox" defaultChecked={table?.is_active??true}/><span>เปิดใช้งานโต๊ะ</span></label>
      </div><div className="modalActions"><button type="button" className="secondaryButton" onClick={()=>setTable(undefined)}>ยกเลิก</button><button className="primaryAction" disabled={saving}>{saving?<LoaderCircle className="spin" size={17}/>:null}บันทึก</button></div></form>
    </Modal>:null}
  </>;
}

function MembersWorkspace({context,branchId,onBack}:{context:PortalContext;branchId:string;onBack:()=>void}){
  const {data,error,setError,refresh}=useSnapshot<MembersAdminSnapshot>(context,branchId,"members");
  const [query,setQuery]=useState("");
  const [member,setMember]=useState<MemberAdmin|null|undefined>(undefined);
  const [saving,setSaving]=useState(false);
  const rows=useMemo(()=>{const q=query.trim().toLowerCase();if(!q)return data?.members??[];return (data?.members??[]).filter(m=>[m.name,m.phone,m.email??"",m.member_token??""].some(v=>v.toLowerCase().includes(q)));},[data,query]);
  async function save(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setSaving(true);setError("");const form=new FormData(event.currentTarget);
    try{await mutatePosAdmin(context.tenantId,branchId,"member.save",{
      name:String(form.get("name")??""),phone:String(form.get("phone")??""),email:String(form.get("email")??""),
      points:Number(form.get("points")??0),stamps:Number(form.get("stamps")??0)
    });setMember(undefined);await refresh();}catch(err){setError(err instanceof Error?err.message:"บันทึกสมาชิกไม่สำเร็จ");}finally{setSaving(false);}
  }
  async function remove(row:MemberAdmin){if(!window.confirm(`ยืนยันลบสมาชิก ${row.name}?`))return;try{await mutatePosAdmin(context.tenantId,branchId,"member.delete",{id:row.id});await refresh();}catch(err){setError(err instanceof Error?err.message:"ลบสมาชิกไม่สำเร็จ");}}
  return <>
    {error?<ErrorPanel message={error}/>:null}
    <div className="toolbar"><label className="searchBox"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="ค้นหาชื่อ เบอร์โทร อีเมล..."/></label><button className="primaryAction" onClick={()=>setMember(null)}><Plus size={17}/>เพิ่มสมาชิก</button></div>
    <section className="panel tablePanel"><div className="tableWrap boundedTable"><table><thead><tr><th>สมาชิก</th><th>เบอร์โทร</th><th>แต้ม</th><th>แสตมป์</th><th>อัปเดต</th><th></th></tr></thead><tbody>
      {rows.length?rows.map(m=><tr key={m.id}><td><strong>{m.name}</strong><br/><small>{m.email||"—"}</small></td><td>{m.phone}</td><td>{m.points_balance}</td><td>{m.stamp_balance}</td><td>{new Date(m.updated_at).toLocaleString("th-TH")}</td><td><div className="inlineActions"><button className="tableAction" onClick={()=>setMember(m)}><Pencil size={15}/>แก้ไข</button><button className="tableAction danger" onClick={()=>void remove(m)}><Trash2 size={15}/>ลบ</button></div></td></tr>):<tr><td colSpan={6}><Empty>ไม่พบสมาชิก</Empty></td></tr>}
    </tbody></table></div></section>
    {member!==undefined?<Modal title={member?"แก้ไขสมาชิก":"เพิ่มสมาชิก"} onClose={()=>setMember(undefined)}>
      <form className="entityForm" onSubmit={save}><div className="formGrid">
        <label className="span2"><span>ชื่อสมาชิก</span><input name="name" defaultValue={member?.name??""} required/></label>
        <label><span>เบอร์โทร</span><input name="phone" defaultValue={member?.phone??""} readOnly={Boolean(member)} required inputMode="numeric"/></label>
        <label><span>อีเมล</span><input name="email" type="email" defaultValue={member?.email??""}/></label>
        <label><span>แต้ม</span><input name="points" type="number" min={0} defaultValue={member?.points_balance??0}/></label>
        <label><span>แสตมป์</span><input name="stamps" type="number" min={0} defaultValue={member?.stamp_balance??0}/></label>
      </div><div className="modalActions"><button type="button" className="secondaryButton" onClick={()=>setMember(undefined)}>ยกเลิก</button><button className="primaryAction" disabled={saving}>{saving?<LoaderCircle className="spin" size={17}/>:null}บันทึก</button></div></form>
    </Modal>:null}
  </>;
}

function KitchenWorkspace({context,branchId,onBack}:{context:PortalContext;branchId:string;onBack:()=>void}){
  const {data,error,setError,refresh}=useSnapshot<KitchenAdminSnapshot>(context,branchId,"kitchen");
  const [zone,setZone]=useState<KitchenZoneAdmin|null|undefined>(undefined);
  const [saving,setSaving]=useState(false);
  const categoryMap=useMemo(()=>{const map=new Map<string,string[]>();for(const r of data?.routing_rules??[]){if(r.category_name)map.set(r.zone_id,[...(map.get(r.zone_id)??[]),r.category_name]);}return map;},[data]);
  async function save(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setSaving(true);setError("");const form=new FormData(event.currentTarget);
    try{await mutatePosAdmin(context.tenantId,branchId,"kitchen.zone.save",{
      id:zone?.id??null,zone_code:String(form.get("zone_code")??""),zone_name:String(form.get("zone_name")??""),
      description:String(form.get("description")??""),default_printer_id:String(form.get("default_printer_id")??"")||null,
      display_order:Number(form.get("display_order")??0),is_active:form.get("is_active")==="on",
      kds_enabled:form.get("kds_enabled")==="on",category_names:form.getAll("categories").map(String)
    });setZone(undefined);await refresh();}catch(err){setError(err instanceof Error?err.message:"บันทึกโซนครัวไม่สำเร็จ");}finally{setSaving(false);}
  }
  async function action(name:string,row:KitchenZoneAdmin,payload:Record<string,unknown>={}){
    try{await mutatePosAdmin(context.tenantId,branchId,name,{id:row.id,...payload});await refresh();}catch(err){setError(err instanceof Error?err.message:"ดำเนินการไม่สำเร็จ");}
  }
  return <>
    {error?<ErrorPanel message={error}/>:null}
    <div className="adminKpis"><div><span>โซนครัว</span><strong>{data?.zones.length??"—"}</strong></div><div><span>KDS เปิด</span><strong>{data?.zones.filter(z=>z.kds_enabled).length??"—"}</strong></div><div><span>เครื่องพิมพ์พร้อมใช้</span><strong>{data?.printers.length??"—"}</strong></div></div>
    <section className="panel adminPanel"><div className="panelHeader"><div><p className="eyebrow">KITCHEN MANAGEMENT</p><h3>โซนครัวและเส้นทางอาหาร</h3></div><button className="primaryAction" onClick={()=>setZone(null)}><Plus size={17}/>เพิ่มโซนครัว</button></div>
      <div className="tableWrap boundedTable"><table><thead><tr><th>Kitchen ID</th><th>โซน</th><th>หมวดหมู่</th><th>KDS</th><th>เครื่องพิมพ์</th><th>สถานะ</th><th></th></tr></thead><tbody>
      {data?.zones.length?data.zones.map(z=><tr key={z.id}><td className="monoCode">{z.access_code||"—"}</td><td><strong>{z.zone_name}</strong><br/><small>{z.zone_code}</small></td><td>{(categoryMap.get(z.id)??[]).join(", ")||"—"}</td><td><button className={`miniToggle ${z.kds_enabled?"on":""}`} onClick={()=>void action("kitchen.zone.kds",z,{kds_enabled:!z.kds_enabled})}>{z.kds_enabled?"ON":"OFF"}</button></td><td>{data.printers.find(p=>p.id===z.default_printer_id)?.printer_name||"—"}</td><td>{z.is_active?"ใช้งาน":"ปิด"}</td><td><div className="inlineActions"><button className="tableAction" onClick={()=>setZone(z)}><Pencil size={15}/>แก้ไข</button><button className="tableAction" onClick={()=>void action("kitchen.zone.rotate_access_code",z)}>เปลี่ยน ID</button><button className="tableAction danger" disabled={!z.is_active} onClick={()=>void action("kitchen.zone.disable",z)}>ปิด</button></div></td></tr>):<tr><td colSpan={7}><Empty>ยังไม่มีโซนครัว</Empty></td></tr>}
      </tbody></table></div>
    </section>
    {data?<KitchenProductRouting context={context} branchId={branchId} snapshot={data} onRefresh={refresh} onError={setError}/>:null}
    {zone!==undefined?<Modal title={zone?"แก้ไขโซนครัว":"เพิ่มโซนครัว"} onClose={()=>setZone(undefined)} wide>
      <form className="entityForm" onSubmit={save}><div className="formGrid">
        <label><span>ชื่อโซนครัว</span><input name="zone_name" defaultValue={zone?.zone_name??""} required/></label>
        <label><span>รหัสโซน</span><input name="zone_code" defaultValue={zone?.zone_code??""} maxLength={32} required/></label>
        <label className="span2"><span>คำอธิบาย</span><input name="description" defaultValue={String(zone?.metadata?.description??"")}/></label>
        <label><span>เครื่องพิมพ์หลัก</span><select name="default_printer_id" defaultValue={zone?.default_printer_id??""}><option value="">ไม่ระบุ</option>{data?.printers.map(p=><option key={p.id} value={p.id}>{p.printer_name} ({p.paper_width_mm}mm)</option>)}</select></label>
        <label><span>ลำดับแสดงผล</span><input name="display_order" type="number" defaultValue={zone?.display_order??0}/></label>
        <div className="span2"><span className="fieldLabel">หมวดหมู่อาหาร</span><div className="adminCheckGrid">{data?.categories.map(c=><label key={c}><input type="checkbox" name="categories" value={c} defaultChecked={(categoryMap.get(zone?.id??"")??[]).includes(c)}/><span>{c}</span></label>)}</div></div>
        <label className="switchField"><input name="kds_enabled" type="checkbox" defaultChecked={zone?.kds_enabled??true}/><span>เปิดระบบจอครัว KDS</span></label>
        <label className="switchField"><input name="is_active" type="checkbox" defaultChecked={zone?.is_active??true}/><span>เปิดใช้งานโซน</span></label>
      </div><div className="modalActions"><button type="button" className="secondaryButton" onClick={()=>setZone(undefined)}>ยกเลิก</button><button className="primaryAction" disabled={saving}>{saving?<LoaderCircle className="spin" size={17}/>:null}บันทึก</button></div></form>
    </Modal>:null}
  </>;
}

type BuffetPlanView={id:string|null;name:string;sku:string;mode:"per_person"|"set";price:number;active:boolean;draft:boolean;archived:boolean;itemCount:number};
function readBuffetMode(row:BuffetProductAdmin):"per_person"|"set"|null{
  const meta=row.metadata?.cpipos_buffet_plan;
  if(meta&&typeof meta==="object"&&!Array.isArray(meta)){
    const mode=(meta as Record<string,unknown>).mode;
    if(mode==="per_person"||mode==="set")return mode;
  }
  const sku=String(row.sku??"").toUpperCase();
  if(sku.startsWith("BUFFET-PER-PERSON"))return "per_person";
  if(sku.startsWith("BUFFET-SET"))return "set";
  return null;
}
function metaBool(row:BuffetProductAdmin,key:string){
  const meta=row.metadata?.cpipos_buffet_plan;
  return Boolean(meta&&typeof meta==="object"&&!Array.isArray(meta)&&(meta as Record<string,unknown>)[key]===true);
}
function BuffetWorkspace({context,branchId,onBack}:{context:PortalContext;branchId:string;onBack:()=>void}){
  const {data,error,setError,refresh}=useSnapshot<BuffetAdminSnapshot>(context,branchId,"buffet");
  const [edit,setEdit]=useState<BuffetPlanView|null|undefined>(undefined);
  const [saving,setSaving]=useState(false);
  const plans=useMemo(()=>{
    const rows=(data?.plans??[]).map(row=>{const mode=readBuffetMode(row);if(!mode)return null;return {id:row.id,name:row.name,sku:row.sku??row.id,mode,price:Number(row.price??0),active:row.is_active,draft:metaBool(row,"draft"),archived:metaBool(row,"archived"),itemCount:Number(row.item_count??0)} as BuffetPlanView;}).filter((x):x is BuffetPlanView=>Boolean(x)&&!x!.archived);
    if(!rows.some(x=>x.sku==="BUFFET-PER-PERSON"))rows.unshift({id:null,name:"บุฟเฟ่รายท่าน",sku:"BUFFET-PER-PERSON",mode:"per_person",price:0,active:false,draft:false,archived:false,itemCount:0});
    if(!rows.some(x=>x.sku==="BUFFET-SET"))rows.splice(Math.min(1,rows.length),0,{id:null,name:"บุฟเฟ่แบบชุด",sku:"BUFFET-SET",mode:"set",price:0,active:false,draft:false,archived:false,itemCount:0});
    return rows;
  },[data]);
  async function save(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(!edit)return;setSaving(true);setError("");const form=new FormData(event.currentTarget);
    try{await mutatePosAdmin(context.tenantId,branchId,"buffet.save",{product_id:edit.id,mode:edit.mode,price:Number(form.get("price")??0)});setEdit(undefined);await refresh();}catch(err){setError(err instanceof Error?err.message:"บันทึกราคาไม่สำเร็จ");}finally{setSaving(false);}
  }
  async function create(mode:"per_person"|"set"){try{await mutatePosAdmin(context.tenantId,branchId,"buffet.create",{mode});await refresh();}catch(err){setError(err instanceof Error?err.message:"เพิ่มแพ็กเกจบุฟเฟ่ไม่สำเร็จ");}}
  async function remove(plan:BuffetPlanView){if(!plan.id||!window.confirm(`ยืนยันนำ ${plan.name} ออกจากการใช้งาน?`))return;try{await mutatePosAdmin(context.tenantId,branchId,"buffet.delete",{product_id:plan.id});await refresh();}catch(err){setError(err instanceof Error?err.message:"ลบราคาไม่สำเร็จ");}}
  return <>
    {error?<ErrorPanel message={error}/>:null}
    <div className="adminActionRow"><button className="secondaryButton" onClick={()=>void create("per_person")}><Plus size={17}/>เพิ่มแบบรายท่าน</button><button className="secondaryButton" onClick={()=>void create("set")}><Plus size={17}/>เพิ่มแบบชุด</button></div>
    <div className="buffetAdminGrid">{plans.map(p=><article className="buffetAdminCard" key={p.id??p.sku}><div><span className="eyebrow">{p.mode==="per_person"?"PER PERSON":"SET"}</span><h3>{p.name}</h3><p>{p.sku}</p></div><strong>฿{p.price.toLocaleString("th-TH",{minimumFractionDigits:2})}</strong><div className="buffetMeta"><span>{p.itemCount} รายการสินค้า</span><span>{p.id?(p.active?"ใช้งาน":"ยังไม่เปิด"):"ยังไม่ได้กำหนดราคา"}</span></div><div className="inlineActions"><button className="tableAction" onClick={()=>setEdit(p)}><Pencil size={15}/>กำหนดราคา</button>{p.id?<button className="tableAction danger" onClick={()=>void remove(p)}><Trash2 size={15}/>นำออก</button>:null}</div></article>)}</div>
    {edit!==undefined&&edit?<Modal title={`กำหนดราคา · ${edit.name}`} onClose={()=>setEdit(undefined)}>
      <form className="entityForm" onSubmit={save}><div className="formGrid singleColumn"><label><span>ราคา (บาท)</span><input name="price" type="number" min="0.01" step="0.01" defaultValue={edit.price||""} required/></label></div><div className="modalActions"><button type="button" className="secondaryButton" onClick={()=>setEdit(undefined)}>ยกเลิก</button><button className="primaryAction" disabled={saving}>{saving?<LoaderCircle className="spin" size={17}/>:null}บันทึกราคา</button></div></form>
    </Modal>:null}
  </>;
}

function DevicesWorkspace({context,branchId,onBack}:{context:PortalContext;branchId:string;onBack:()=>void}){
  const {data,error,setError,refresh}=useSnapshot<DevicesAdminSnapshot>(context,branchId,"devices");
  const [device,setDevice]=useState<CashierDeviceAdmin|null|undefined>(undefined);
  const [saving,setSaving]=useState(false);
  const active=data?.devices.filter(d=>d.status==="active").length??0;
  async function save(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setSaving(true);setError("");const form=new FormData(event.currentTarget);
    try{await mutatePosAdmin(context.tenantId,branchId,"device.save",{
      id:device?.id??null,device_code:String(form.get("device_code")??""),device_name:String(form.get("device_name")??""),
      device_type:String(form.get("device_type")??"pos_terminal"),status:String(form.get("status")??"active"),
      is_locked:form.get("is_locked")==="on",counter_name:String(form.get("counter_name")??""),location:String(form.get("location")??"")
    });setDevice(undefined);await refresh();}catch(err){setError(err instanceof Error?err.message:"บันทึกเครื่องไม่สำเร็จ");}finally{setSaving(false);}
  }
  async function remove(row:CashierDeviceAdmin){if(!window.confirm(`ยืนยันลบเครื่อง ${row.device_name}? Session ของเครื่องนี้จะถูก revoke`))return;try{await mutatePosAdmin(context.tenantId,branchId,"device.delete",{id:row.id});await refresh();}catch(err){setError(err instanceof Error?err.message:"ลบเครื่องไม่สำเร็จ");}}
  return <>
    {error?<ErrorPanel message={error}/>:null}
    <div className="adminKpis"><div><span>เครื่องทั้งหมด</span><strong>{data?.devices.length??"—"}</strong></div><div><span>ใช้งาน</span><strong>{active}</strong></div><div><span>โควตาแพ็กเกจ</span><strong>{data?.max_devices??"ไม่จำกัด"}</strong></div></div>
    {data?.contract_status&& !["active","trial"].includes(data.contract_status)?<div className="errorPanel"><CircleAlert size={19}/><span>สัญญาปัจจุบัน: {data.contract_status} — ไม่สามารถเพิ่มเครื่องใหม่ได้</span></div>:null}
    <section className="panel adminPanel"><div className="panelHeader"><div><p className="eyebrow">CASHIER DEVICES</p><h3>เครื่องแคชเชียร์</h3></div><button className="primaryAction" onClick={()=>setDevice(null)}><Plus size={17}/>เพิ่มเครื่อง</button></div><div className="tableWrap boundedTable"><table><thead><tr><th>รหัส</th><th>ชื่อเครื่อง</th><th>ประเภท</th><th>สถานะ</th><th>ใช้งานล่าสุด</th><th></th></tr></thead><tbody>
      {data?.devices.length?data.devices.map(d=><tr key={d.id}><td><strong>{d.device_code}</strong></td><td>{d.device_name}<br/><small>{String(d.metadata?.counter_name??"")}</small></td><td>{d.device_type}</td><td><span className={`status ${d.status==="active"?"status-success":"status-muted"}`}>{d.status}</span></td><td>{d.last_seen_at?new Date(d.last_seen_at).toLocaleString("th-TH"):"—"}</td><td><div className="inlineActions"><button className="tableAction" onClick={()=>setDevice(d)}><Pencil size={15}/>แก้ไข</button><button className="tableAction danger" onClick={()=>void remove(d)}><Trash2 size={15}/>ลบ</button></div></td></tr>):<tr><td colSpan={6}><Empty>ยังไม่มีเครื่องแคชเชียร์</Empty></td></tr>}
    </tbody></table></div></section>
    {device!==undefined?<Modal title={device?"แก้ไขเครื่องแคชเชียร์":"เพิ่มเครื่องแคชเชียร์"} onClose={()=>setDevice(undefined)}>
      <form className="entityForm" onSubmit={save}><div className="formGrid">
        <label><span>รหัสเครื่อง</span><input name="device_code" defaultValue={device?.device_code??""} required/></label>
        <label><span>ชื่อเครื่อง</span><input name="device_name" defaultValue={device?.device_name??""} required/></label>
        <label><span>ประเภท</span><select name="device_type" defaultValue={device?.device_type??"pos_terminal"}><option value="pos_terminal">POS Terminal</option><option value="mobile_scanner">Mobile Scanner</option><option value="kiosk">Kiosk</option></select></label>
        <label><span>สถานะ</span><select name="status" defaultValue={device?.status??"active"}><option value="active">Active</option><option value="inactive">Inactive</option><option value="maintenance">Maintenance</option></select></label>
        <label><span>ชื่อเคาน์เตอร์</span><input name="counter_name" defaultValue={String(device?.metadata?.counter_name??"")}/></label>
        <label><span>ตำแหน่ง</span><input name="location" defaultValue={String(device?.metadata?.location??"")}/></label>
        <label className="switchField span2"><input name="is_locked" type="checkbox" defaultChecked={device?.is_locked??true}/><span>ล็อกเครื่องกับการลงทะเบียน POS</span></label>
      </div><div className="modalActions"><button type="button" className="secondaryButton" onClick={()=>setDevice(undefined)}>ยกเลิก</button><button className="primaryAction" disabled={saving}>{saving?<LoaderCircle className="spin" size={17}/>:null}บันทึก</button></div></form>
    </Modal>:null}
  </>;
}

export function PosAdminWorkspace({module,context,branchId,onBack}:WorkspaceProps){
  const [scope,setScope]=useState(()=>branchId||context.branches[0]?.id||"");
  useEffect(()=>{if(branchId&&context.branches.some(b=>b.id===branchId))setScope(branchId);},[branchId,context.branches]);
  const [refreshKey,setRefreshKey]=useState(0);
  if(!scope)return <><div className="pageHeading"><div><p className="eyebrow">POS BACK OFFICE</p><h2>เลือกสาขาก่อนใช้งาน</h2></div></div><ErrorPanel message="ไม่พบสาขาที่บัญชีนี้มีสิทธิ์จัดการ"/></>;

  const titles:Record<PosAdminModule,[string,string]>={
    tables:["จัดการโต๊ะ","เพิ่ม แก้ไข ลบโต๊ะและโซน โดยใช้ข้อมูลชุดเดียวกับ POS"],
    members:["สมาชิก","เพิ่ม แก้ไข และลบสมาชิกหน้าร้านจากระบบหลังบ้าน"],
    kitchen:["จัดการครัว","จัดการโซนครัว KDS เครื่องพิมพ์ และเส้นทางหมวดหมู่อาหาร"],
    buffet:["ตั้งค่าราคาบุฟเฟ่","จัดการแพ็กเกจราคาแบบรายท่านและแบบชุดที่ POS ใช้ขายจริง"],
    devices:["เครื่องแคชเชียร์","เพิ่ม แก้ไข ลบเครื่อง POS พร้อมควบคุมโควตาและ revoke session"],
    printers:["เครื่องพิมพ์","จัดการเครื่องพิมพ์ งานพิมพ์ และการผูกโซนครัวด้วย registry ชุดเดียวกับ POS"],
    display:["จอลูกค้า","สร้างและยกเลิก Customer Display pairing ภายใต้ IT Policy เดียวกับ POS"],
    activity:["ตรวจสอบพฤติกรรมการใช้งาน","Audit Log สำหรับ Owner/Manager พร้อม PIN approval แบบเดียวกับ POS"],
    inet:["INET QR","ตั้งค่า Dynamic QR ของ INET NOPS ตามแพ็กเกจและสาขา"],
    order_kitchen:["การแจ้งเตือนออเดอร์และครัว","ตั้งค่าร้าน พร้อมแสดง IT override และผลใช้งานจริง"],
    table_qr:["ตั้งค่า QR โต๊ะ","กำหนดอายุ QR รายโต๊ะและ revoke QR เดิมเมื่อ policy เปลี่ยน"],
    receipts:["ใบเสร็จย้อนหลัง","ค้นหาและตรวจรายละเอียดใบเสร็จจากข้อมูล POS ชุดเดียวกัน"],
    tax_invoices:["ออกใบกำกับภาษี","จัดการข้อมูลผู้ขายและออกทะเบียนใบกำกับภาษีจากบิลที่ชำระแล้ว"],
    product_sales:["รายการขายสินค้า","สรุปยอดขาย จำนวน และอันดับสินค้าตามช่วงเวลา"]
  };
  const [title,subtitle]=titles[module];
  const childKey=`${module}:${scope}:${refreshKey}`;
  return <>
    <ScopeHeader title={title} subtitle={subtitle} context={context} branchId={scope} onBranchChange={setScope} onBack={onBack} onRefresh={()=>setRefreshKey(k=>k+1)}/>
    <div key={childKey}>
      {module==="tables"?<TablesWorkspace context={context} branchId={scope} onBack={onBack}/>:null}
      {module==="members"?<MembersWorkspace context={context} branchId={scope} onBack={onBack}/>:null}
      {module==="kitchen"?<KitchenWorkspace context={context} branchId={scope} onBack={onBack}/>:null}
      {module==="buffet"?<BuffetWorkspace context={context} branchId={scope} onBack={onBack}/>:null}
      {module==="devices"?<DevicesWorkspace context={context} branchId={scope} onBack={onBack}/>:null}
      {module==="printers"?<PrinterWorkspace context={context} branchId={scope}/>:null}
      {module==="display"?<DisplayWorkspace context={context} branchId={scope}/>:null}
      {module==="activity"?<ActivityWorkspace context={context} branchId={scope}/>:null}
      {module==="inet"?<InetWorkspace context={context} branchId={scope}/>:null}
      {module==="order_kitchen"?<OrderKitchenWorkspace context={context} branchId={scope}/>:null}
      {module==="table_qr"?<TableQrWorkspace context={context} branchId={scope}/>:null}
      {module==="receipts"?<ReceiptsWorkspace context={context} branchId={scope}/>:null}
      {module==="tax_invoices"?<TaxInvoicesWorkspace context={context} branchId={scope}/>:null}
      {module==="product_sales"?<ProductSalesWorkspace context={context} branchId={scope}/>:null}
    </div>
  </>;
}
