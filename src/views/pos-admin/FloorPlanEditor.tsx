import { useEffect,useRef,useState,type FormEvent,type PointerEvent as ReactPointerEvent } from "react";
import { LoaderCircle, Pencil, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { Modal } from "../../components/common";
import { mutatePosAdmin } from "../../lib/api/pos-admin";
import type { PortalContext } from "../../types/portal";
import type { FloorLayoutObjectAdmin,FloorObjectType,TablesAdminSnapshot } from "../../types/pos-admin";

type Props={context:PortalContext;branchId:string;snapshot:TablesAdminSnapshot;onRefresh:()=>Promise<void>;onError:(message:string)=>void};
type DragState={kind:"table"|"object";id:string;offsetX:number;offsetY:number};
const CANVAS_W=1000,CANVAS_H=620;
const objectLabels:Record<FloorObjectType,string>={counter:"เคาน์เตอร์",cashier:"จุดแคชเชียร์",partition:"ฉากกั้น",plant:"ต้นไม้",entrance:"ทางเข้า",service_station:"จุดบริการ"};

export function FloorPlanEditor({context,branchId,snapshot,onRefresh,onError}:Props){
  const [tables,setTables]=useState(snapshot.tables);
  const [objects,setObjects]=useState(snapshot.layout_objects??[]);
  const [dirty,setDirty]=useState(false);
  const [saving,setSaving]=useState(false);
  const [editor,setEditor]=useState<FloorLayoutObjectAdmin|null|undefined>(undefined);
  const canvasRef=useRef<HTMLDivElement|null>(null);
  const dragRef=useRef<DragState|null>(null);
  useEffect(()=>{setTables(snapshot.tables);setObjects(snapshot.layout_objects??[]);setDirty(false);},[snapshot]);

  function beginDrag(e:ReactPointerEvent<HTMLDivElement>,kind:"table"|"object",id:string){
    if(e.button!==0)return;
    const rect=e.currentTarget.getBoundingClientRect();
    dragRef.current={kind,id,offsetX:e.clientX-rect.left,offsetY:e.clientY-rect.top};
    e.currentTarget.setPointerCapture(e.pointerId);e.preventDefault();
  }
  function moveDrag(e:ReactPointerEvent<HTMLDivElement>){
    const drag=dragRef.current,canvas=canvasRef.current;if(!drag||!canvas)return;
    const rect=canvas.getBoundingClientRect();
    if(drag.kind==="table")setTables(rows=>rows.map(row=>row.id!==drag.id?row:{...row,position_x:Math.round(Math.max(0,Math.min(CANVAS_W-Number(row.width),e.clientX-rect.left-drag.offsetX))),position_y:Math.round(Math.max(0,Math.min(CANVAS_H-Number(row.height),e.clientY-rect.top-drag.offsetY)))}));
    else setObjects(rows=>rows.map(row=>row.id!==drag.id?row:{...row,position_x:Math.round(Math.max(0,Math.min(CANVAS_W-Number(row.width),e.clientX-rect.left-drag.offsetX))),position_y:Math.round(Math.max(0,Math.min(CANVAS_H-Number(row.height),e.clientY-rect.top-drag.offsetY)))}));
    setDirty(true);e.preventDefault();
  }
  function endDrag(){dragRef.current=null;}

  async function savePlan(reset=false){
    setSaving(true);onError("");
    try{
      await mutatePosAdmin(context.tenantId,branchId,"floor_plan.save",{reset,
        tables:tables.map(t=>({id:t.id,zone_id:t.zone_id,position_x:t.position_x,position_y:t.position_y,width:t.width,height:t.height,rotation:t.rotation})),
        objects:objects.map(o=>({id:o.id,zone_id:o.zone_id,position_x:o.position_x,position_y:o.position_y,width:o.width,height:o.height,rotation:o.rotation,z_index:o.z_index}))
      });
      await onRefresh();setDirty(false);
    }catch(err){onError(err instanceof Error?err.message:"บันทึกผังร้านไม่สำเร็จ");}finally{setSaving(false);}
  }
  async function saveObject(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setSaving(true);onError("");const form=new FormData(event.currentTarget);
    try{
      await mutatePosAdmin(context.tenantId,branchId,"layout_object.save",{
        id:editor?.id??null,object_type:String(form.get("object_type")??"counter"),object_name:String(form.get("object_name")??""),
        zone_id:String(form.get("zone_id")??"")||null,color:String(form.get("color")??"#475569"),width:Number(form.get("width")??120),
        height:Number(form.get("height")??60),rotation:Number(form.get("rotation")??0),z_index:Number(form.get("z_index")??1),
        position_x:editor?.position_x??24,position_y:editor?.position_y??24,is_active:true
      });
      setEditor(undefined);await onRefresh();
    }catch(err){onError(err instanceof Error?err.message:"บันทึกวัตถุในผังไม่สำเร็จ");}finally{setSaving(false);}
  }
  async function removeObject(row:FloorLayoutObjectAdmin){
    if(!window.confirm(`ยืนยันลบ ${row.object_name||objectLabels[row.object_type]} จากผังร้าน?`))return;
    try{await mutatePosAdmin(context.tenantId,branchId,"layout_object.delete",{id:row.id});await onRefresh();}
    catch(err){onError(err instanceof Error?err.message:"ลบวัตถุไม่สำเร็จ");}
  }

  return <section className="panel floorPlanPanel">
    <div className="panelHeader"><div><p className="eyebrow">FLOOR PLAN</p><h3>ผังร้านแบบลากวาง</h3><small>ลากโต๊ะและวัตถุไปยังตำแหน่งที่ต้องการ แล้วกดบันทึกผัง</small></div><div className="inlineActions">
      <button className="secondaryButton" onClick={()=>setEditor(null)}><Plus size={16}/>เพิ่มวัตถุ</button>
      <button className="secondaryButton" disabled={saving} onClick={()=>{if(window.confirm("รีเซ็ตตำแหน่งโต๊ะและวัตถุทั้งหมด?"))void savePlan(true);}}><RotateCcw size={16}/>รีเซ็ต</button>
      <button className="primaryAction" disabled={saving||!dirty} onClick={()=>void savePlan(false)}>{saving?<LoaderCircle className="spin" size={16}/>:<Save size={16}/>}บันทึกผัง</button>
    </div></div>
    <div className="floorCanvasScroll"><div ref={canvasRef} className="floorCanvas" onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
      {objects.filter(o=>o.is_active).map(o=><div key={o.id} className={`floorObjectNode floorObject-${o.object_type}`} onPointerDown={e=>beginDrag(e,"object",o.id)} onDoubleClick={()=>setEditor(o)} title="ลากเพื่อย้าย · ดับเบิลคลิกเพื่อแก้ไข" style={{left:Number(o.position_x),top:Number(o.position_y),width:Number(o.width),height:Number(o.height),transform:`rotate(${Number(o.rotation)}deg)`,zIndex:o.z_index,background:o.color}}><span>{o.object_name||objectLabels[o.object_type]}</span></div>)}
      {tables.filter(t=>t.is_active).map(t=><div key={t.id} className={`floorTableNode floorTable-${t.shape}`} onPointerDown={e=>beginDrag(e,"table",t.id)} title={t.table_name||`โต๊ะ ${t.table_code}`} style={{left:Number(t.position_x),top:Number(t.position_y),width:Number(t.width),height:Number(t.height),transform:`rotate(${Number(t.rotation)}deg)`}}><strong>{t.table_name||t.table_code}</strong><span>{t.capacity} ที่นั่ง</span></div>)}
    </div></div>
    <div className="floorObjectList">{(snapshot.layout_objects??[]).map(o=><div key={o.id}><span className="zoneColor" style={{background:o.color}}/><strong>{o.object_name||objectLabels[o.object_type]}</strong><small>{objectLabels[o.object_type]}</small><div className="inlineActions"><button className="tableAction" onClick={()=>setEditor(o)}><Pencil size={14}/>แก้ไข</button><button className="tableAction danger" onClick={()=>void removeObject(o)}><Trash2 size={14}/>ลบ</button></div></div>)}</div>
    {editor!==undefined?<Modal title={editor?"แก้ไขวัตถุในผัง":"เพิ่มวัตถุในผัง"} onClose={()=>setEditor(undefined)}><form className="entityForm" onSubmit={saveObject}><div className="formGrid">
      <label><span>ประเภท</span><select name="object_type" defaultValue={editor?.object_type??"counter"}>{Object.entries(objectLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
      <label><span>ชื่อแสดงผล</span><input name="object_name" defaultValue={editor?.object_name??""}/></label>
      <label><span>โซน</span><select name="zone_id" defaultValue={editor?.zone_id??""}><option value="">ไม่ระบุ</option>{snapshot.zones.map(z=><option key={z.id} value={z.id}>{z.zone_name}</option>)}</select></label>
      <label><span>สี</span><input type="color" name="color" defaultValue={editor?.color??"#475569"}/></label>
      <label><span>ความกว้าง</span><input type="number" min={24} name="width" defaultValue={editor?.width??120}/></label>
      <label><span>ความสูง</span><input type="number" min={24} name="height" defaultValue={editor?.height??60}/></label>
      <label><span>หมุน (องศา)</span><input type="number" name="rotation" defaultValue={editor?.rotation??0}/></label>
      <label><span>ชั้นการแสดงผล</span><input type="number" min={1} name="z_index" defaultValue={editor?.z_index??1}/></label>
    </div><div className="modalActions"><button type="button" className="secondaryButton" onClick={()=>setEditor(undefined)}>ยกเลิก</button><button className="primaryAction" disabled={saving}>{saving?<LoaderCircle className="spin" size={16}/>:null}บันทึก</button></div></form></Modal>:null}
  </section>;
}
