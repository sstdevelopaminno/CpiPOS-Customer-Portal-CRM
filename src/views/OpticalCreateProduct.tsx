import {useState} from "react";
import {supabase} from "../lib/supabase";
type Branch={id:string;name:string};
type Form={name:string;sku:string;kind:"frame"|"lens"|"accessory";brand:string;model:string;color:string;
 frame_size:string;lens_name:string;lens_index:string;lens_sph:string;lens_cyl:string;price:string};
const initial:Form={name:"",sku:"",kind:"frame",brand:"",model:"",color:"",
 frame_size:"",lens_name:"",lens_index:"",lens_sph:"",lens_cyl:"",price:""};
export function OpticalCreateProduct({tenantId,branchId,branches,currency,onClose,onCreated}:{
 tenantId:string;branchId:string;branches:Branch[];currency:string;
 onClose:()=>void;onCreated:(branchId:string,sku:string,initialQuantity:string)=>void
}){
 const [target,setTarget]=useState(branchId);
 const [form,setForm]=useState<Form>(initial);
 const [initialQuantity,setInitialQuantity]=useState("");
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 const change=(key:keyof Form,value:string)=>setForm(f=>({...f,[key]:value}));
 async function save(){
  if(busy)return;
  setError("");
  if(!form.name.trim()||!/^[^\\s,;()]{1,90}$/.test(form.sku.trim())||!form.price.trim())
   return setError("ชื่อสินค้า SKU/บาร์โค้ด และราคา จำเป็นต้องกรอก");
  const price=Number(form.price),qty=initialQuantity.trim();
  if(!Number.isFinite(price)||price<0||price>999999999||
     (currency==="LAK"&&!Number.isInteger(price))||Math.round(price*100)/100!==price)
   return setError("ราคาสินค้าไม่ถูกต้อง");
  if(qty&&(!/^[1-9][0-9]*$/.test(qty)||Number(qty)>100000))
   return setError("จำนวนรับเข้าเริ่มต้นต้องเป็นจำนวนเต็มบวก 1–100000 หรือเว้นว่างหากยังไม่รับสต๊อก");
  if(!branches.some(b=>b.id===target))return setError("ไม่มีสิทธิ์สาขาที่เลือก");
  setBusy(true);
  try{
   const {error:e}=await supabase.rpc("customer_portal_optical_product_create_v1",{
    p_tenant_id:tenantId,p_branch_id:target,p_product:form,p_currency:currency
   });
   if(e)throw e;
   onCreated(target,form.sku.trim(),initialQuantity);
  }catch(e){setError(e instanceof Error?e.message:"เพิ่มสินค้าไม่สำเร็จ กรุณาตรวจสอบสิทธิ์");}
  finally{setBusy(false);}
 }
 const input=(key:keyof Form,label:string)=> <label key={key}>
   <span>{label}</span><input value={form[key]} maxLength={key==="name"?180:120}
     autoComplete={key==="sku"?"off":undefined} spellCheck={key==="sku"?false:undefined}
     onKeyDown={e=>{if(key==="sku"&&e.key==="Enter")e.preventDefault();}}
     onChange={e=>change(key,e.target.value)}/></label>;
 return <div className="optical-stock-tables__overlay">
  <section role="dialog" aria-modal="true" aria-label="เพิ่มสินค้า Optical" className="optical-stock-tables__dialog"
   style={{width:"min(750px,100%)",maxHeight:"90vh",overflow:"auto"}}>
   <h3>เพิ่มสินค้า CUSTOM Optical</h3>
   <p>เลือกสาขาและกรอกหรือสแกนบาร์โค้ด · หลังบันทึกข้อมูลสินค้าจะมีหน้าต่างให้ระบุจำนวนรับเข้าเพื่อยืนยันแยกต่างหาก</p>
   <div className="entityForm"><div className="formGrid">
    <label className="span2"><span>ลงสินค้าที่สาขา</span><select value={target}
      onChange={e=>setTarget(e.target.value)}>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
    {input("name","ชื่อสินค้า *")}
    {input("sku","SKU / บาร์โค้ด (กรอกหรือสแกน) *")}
    <label><span>ประเภท *</span><select value={form.kind}
      onChange={e=>change("kind",e.target.value)}>
      <option value="frame">กรอบแว่น</option><option value="lens">เลนส์</option>
      <option value="accessory">อุปกรณ์เสริม</option>
    </select></label>
    {input("brand","แบรนด์ / ยี่ห้อ")}
    {form.kind!=="lens"?<>
      {input("model","รุ่น")}
      {input("color","สี")}
      {input("frame_size","ขนาด")}
    </>:<>
      {input("lens_name","ชื่อเลนส์")}
      {input("lens_index","Index")}
      {input("lens_sph","ค่าสายตา SPH")}
      {input("lens_cyl","ค่าสายตา CYL")}
    </>}
    <label><span>จำนวนรับเข้าเริ่มต้น (เว้นว่างหากยังไม่รับสต๊อก)</span>
      <input type="number" min="1" max="100000" step="1" value={initialQuantity}
       onChange={e=>setInitialQuantity(e.target.value)}/></label>
    <label><span>ราคา ({currency}) *</span><input type="number" min="0"
      step={currency==="LAK"?"1":"0.01"} value={form.price}
      onChange={e=>change("price",e.target.value)}/></label>
   </div></div>
   {error?<p role="alert" style={{color:"#b91c1c"}}>{error}</p>:null}
   <div style={{display:"flex",gap:12,justifyContent:"flex-end"}}>
    <button className="secondaryButton" onClick={onClose} disabled={busy}>ยกเลิก</button>
    <button className="primaryAction" onClick={()=>void save()} disabled={busy}>{busy?"กำลังบันทึก":"บันทึกสินค้า"}</button>
   </div>
  </section>
 </div>;
}
