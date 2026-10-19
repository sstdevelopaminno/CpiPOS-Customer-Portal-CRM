import {useRef,useState} from "react";
import {supabase} from "../lib/supabase";
import "../styles/custom-inventory.css";

type Branch={id:string;name:string};
type Kind="frame"|"lens"|"accessory";
type Row={
 id:number;name:string;sku:string;kind:Kind;brand:string;model:string;
 color:string;frame_size:string;lens_name:string;lens_index:string;
 lens_sph:string;lens_cyl:string;price:string;initial_quantity:string
};
const empty=(id:number,kind:Kind="frame"):Row=>({
 id,name:"",sku:"",kind,brand:"",model:"",color:"",frame_size:"",
 lens_name:"",lens_index:"",lens_sph:"",lens_cyl:"",price:"",initial_quantity:""
});
const kindLabel:Record<Kind,string>={frame:"กรอบแว่น",lens:"เลนส์",accessory:"อุปกรณ์เสริม"};
function check(rows:Row[],currency:string){
 const codes=new Set<string>();
 for(let i=0;i<rows.length;i++){
  const r=rows[i],code=r.sku.trim().toLowerCase(),price=Number(r.price),qty=r.initial_quantity.trim();
  if(!r.name.trim()||!/^[^\s,;()]{1,90}$/.test(r.sku.trim()))
   return "แถว "+(i+1)+": กรุณาระบุชื่อสินค้า และ SKU / บาร์โค้ดที่ถูกต้อง";
  if(codes.has(code))return "แถว "+(i+1)+": บาร์โค้ดซ้ำภายในฟอร์ม";
  codes.add(code);
  if(!r.price.trim()||!Number.isFinite(price)||price<0||price>999999999||
     (currency==="LAK"&&!Number.isInteger(price))||Math.round(price*100)/100!==price)
   return "แถว "+(i+1)+": ราคาสินค้าไม่ถูกต้อง";
  if(qty&&(!/^[1-9][0-9]*$/.test(qty)||Number(qty)>100000))
   return "แถว "+(i+1)+": จำนวนรับเข้าเริ่มต้นต้องเป็นจำนวนเต็ม 1–100000 หรือเว้นว่าง";
 }
 return "";
}
export function OpticalBulkCreateProduct({tenantId,branchId,branches,currency,onClose,onCreated}:{
 tenantId:string;branchId:string;branches:Branch[];currency:string;onClose:()=>void;
 onCreated:(target:string,receipts:{sku:string;quantity:string}[])=>void
}){
 const nextId=useRef(4);
 const [target,setTarget]=useState(branchId);
 const [rows,setRows]=useState<Row[]>([empty(1),empty(2),empty(3)]);
 const [saved,setSaved]=useState<number[]>([]);
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 const change=(id:number,key:keyof Row,value:string)=>setRows(old=>old.map(r=>
  r.id===id?{...r,[key]:value}:r
 ));
 async function saveAll(){
  if(busy)return;
  setError("");
  if(!branches.some(b=>b.id===target))return setError("ไม่มีสิทธิ์สำหรับสาขาที่เลือก");
  const validation=check(rows,currency);
  if(validation)return setError(validation);
  setBusy(true);
  const already=new Set(saved);
  try{
   for(let i=0;i<rows.length;i++){
    const r=rows[i];
    if(already.has(r.id))continue;
    // Catalog insert only. Never treat the proposed quantity as verified stock.
    const {id: _id,initial_quantity: _initial_quantity,...product}=r;
    void _id;void _initial_quantity;
    const {error:failure}=await supabase.rpc("customer_portal_optical_product_create_v1",{
     p_tenant_id:tenantId,p_branch_id:target,p_product:product,p_currency:currency
    });
    if(failure)throw new Error("แถว "+(i+1)+": "+failure.message);
    already.add(r.id);
    setSaved([...already]);
   }
   // Each receipt below still requires its own explicit audited confirmation popup.
   onCreated(target,rows.filter(r=>r.initial_quantity.trim()).map(r=>({
    sku:r.sku.trim(),quantity:r.initial_quantity.trim()
   })));
  }catch(e){
   setError((e instanceof Error?e.message:"บันทึกสินค้าไม่สำเร็จ")+
    " · สร้างสินค้าแล้ว "+already.size+" รายการ สามารถกดบันทึกอีกครั้งได้โดยไม่สร้างรายการเดิมซ้ำ");
  }finally{setBusy(false);}
 }
 const input=(r:Row,key:keyof Row,placeholder="",type="text")=>(
  <input type={type} aria-label={key+" แถว "+r.id} value={String(r[key])}
   placeholder={placeholder} disabled={busy||saved.includes(r.id)}
   min={type==="number"?(key==="price"?"0":"1"):undefined}
   max={key==="initial_quantity"?"100000":undefined}
   step={type==="number"?(key==="price"&&currency!=="LAK"?"0.01":"1"):undefined}
   autoComplete={key==="sku"?"off":undefined}
   onKeyDown={e=>{if(key==="sku"&&e.key==="Enter")e.preventDefault();}}
   onChange={e=>change(r.id,key,e.target.value)} />
 );
 return <div className="optical-stock-tables__overlay">
  <section role="dialog" aria-modal="true" aria-label="สร้างสินค้า Optical หลายรายการ"
   className="optical-stock-tables__dialog" style={{width:"min(1180px,98vw)",maxHeight:"92vh",overflow:"auto"}}>
   <h3>สร้างสินค้าหลายรายการ</h3>
   <p>กรอกหรือสแกนบาร์โค้ด เลือกประเภทในแต่ละแถว และระบุจำนวนรับเข้าเริ่มต้นได้ · การรับสต๊อกต้องยืนยันแยกใน Pop-up</p>
   <label style={{display:"grid",gap:7,margin:"16px 0"}}>เลือกสาขา
    <select value={target} disabled={busy||saved.length>0} onChange={e=>setTarget(e.target.value)}>
     {branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
    </select>
   </label>
   <div style={{overflowX:"auto"}}>
    <table style={{minWidth:1230,width:"100%",borderCollapse:"separate",borderSpacing:"6px 10px"}}>
     <thead><tr>{["#","ชื่อสินค้า *","ประเภท *","SKU / บาร์โค้ด *","แบรนด์ / ยี่ห้อ",
      "รุ่น / ชื่อเลนส์","สี / Index","ขนาด / SPH","CYL","ราคา ("+currency+") *",
      "จำนวนรับเข้าเริ่มต้น","สถานะ","ลบแถว"].map(x=><th key={x} style={{textAlign:"left",fontSize:12}}>{x}</th>)}</tr></thead>
     <tbody>{rows.map((r,i)=><tr key={r.id}>
      <td>{i+1}</td>
      <td>{input(r,"name")}</td>
      <td><select aria-label={"ประเภท แถว "+(i+1)} value={r.kind}
       disabled={busy||saved.includes(r.id)} onChange={e=>change(r.id,"kind",e.target.value)}>
       {Object.entries(kindLabel).map(([key,label])=><option key={key} value={key}>{label}</option>)}
      </select></td>
      <td>{input(r,"sku","กรอกหรือสแกน")}</td>
      <td>{input(r,"brand")}</td>
      <td>{input(r,r.kind==="lens"?"lens_name":"model")}</td>
      <td>{input(r,r.kind==="lens"?"lens_index":"color")}</td>
      <td>{input(r,r.kind==="lens"?"lens_sph":"frame_size")}</td>
      <td>{r.kind==="lens"?input(r,"lens_cyl"):"—"}</td>
      <td>{input(r,"price","","number")}</td>
      <td>{input(r,"initial_quantity","รอยืนยัน","number")}</td>
      <td style={{fontSize:12,color:saved.includes(r.id)?"#047857":"#64748b"}}>
       {saved.includes(r.id)?"สร้างแล้ว":"รอบันทึก"}</td>
      <td><button type="button" disabled={busy||rows.length<=1||saved.includes(r.id)}
       onClick={()=>setRows(old=>old.filter(x=>x.id!==r.id))}>ลบ</button></td>
     </tr>)}</tbody>
    </table>
   </div>
   <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center"}}>
    <button type="button" disabled={busy||rows.length>=50}
     onClick={()=>{const id=nextId.current++;setRows(old=>[...old,empty(id)]);}}>+ เพิ่มแถว</button>
    <span>{rows.length}/50 รายการ</span>
   </div>
   <p style={{fontSize:12,color:"#92400e"}}>จำนวนรับเข้าเป็นเพียงข้อมูลรอยืนยัน ไม่เปลี่ยนสต๊อกจริงจนกดอนุมัติใน Popup แต่ละรายการ หากเกิดข้อผิดพลาดระหว่างบันทึก ระบบจะคงรายการที่สร้างแล้วและไม่สร้างซ้ำเมื่อกดลองอีกครั้ง</p>
   {error?<p role="alert" style={{color:"#b91c1c"}}>{error}</p>:null}
   <div style={{display:"flex",justifyContent:"flex-end",gap:12,marginTop:16}}>
    <button type="button" className="secondaryButton" disabled={busy} onClick={onClose}>ยกเลิก</button>
    <button type="button" className="primaryAction" disabled={busy}
     onClick={()=>void saveAll()}>{busy?"กำลังบันทึก...":"บันทึกทั้งหมด"}</button>
   </div>
  </section>
 </div>;
}
