import {useRef,useState} from "react";
import {supabase} from "../lib/supabase";
import {opticalText,readOpticalLanguage} from "../lib/optical-locale";
import "../styles/custom-inventory.css";

const skuPattern=/^[^\s,;()]{1,90}$/;
export function OpticalStockAdjustPopup({tenantId,branchId,initialSku="",initialQuantity="",currency,queueLabel,products=[],onClose,onSaved}:{
 tenantId:string;branchId:string;initialSku?:string;initialQuantity?:string;currency:string;queueLabel?:string;products?:{sku:string;label:string}[];
 onClose:()=>void;onSaved:()=>void
}){
 const [language]=useState(readOpticalLanguage);
 const T=(t:string)=>opticalText(language,t);
 const [sku,setSku]=useState(initialSku);
 const [direction,setDirection]=useState<"receive"|"issue">("receive");
 const [quantity,setQuantity]=useState(initialQuantity);
 const [note,setNote]=useState("");
 const [error,setError]=useState("");
 const [errorField,setErrorField]=useState<"sku"|"quantity"|"note"|null>(null);
 const [busy,setBusy]=useState(false);
 const requestId=useRef(crypto.randomUUID());
 const term=sku.trim().toLowerCase();
 const matches=products.filter(p=>!term||p.sku.toLowerCase().includes(term)||
   p.label.toLowerCase().includes(term)).slice(0,8);
 async function submit(e:React.FormEvent){
  e.preventDefault();
  if(busy)return;
  const count=Number(quantity);
  if(currency!=="LAK")return setError("Optical Stock ยังรองรับเฉพาะ LAK");
  if(!skuPattern.test(sku.trim())){
   setErrorField("sku");return setError("กรุณาระบุ SKU / บาร์โค้ดสินค้าที่ถูกต้อง");
  }
  if(!/^[1-9][0-9]*$/.test(quantity.trim())||!Number.isSafeInteger(count)||count>100000){
   setErrorField("quantity");return setError("จำนวนต้องเป็นจำนวนเต็มบวกตั้งแต่ 1 ถึง 100,000 ชิ้น");
  }
  if(!note.trim()){
   setErrorField("note");return setError("กรุณาระบุเหตุผลในการปรับสต๊อก");
  }
  if(note.trim().length<3){
   setErrorField("note");return setError("เหตุผลในการปรับสต๊อกต้องมีอย่างน้อย 3 ตัวอักษร");
  }
  if(note.trim().length>300){
   setErrorField("note");return setError("เหตุผลในการปรับสต๊อกต้องไม่เกิน 300 ตัวอักษร");
  }
  setBusy(true);setError("");setErrorField(null);
  try{
   const {data:auth,error:authError}=await supabase.auth.getUser();
   if(authError||!auth.user)throw new Error("กรุณาเข้าสู่ระบบอีกครั้ง");
   const {error:rpcError}=await supabase.rpc("optical_adjust_stock_tx",{
    p_tenant_id:tenantId,p_branch_id:branchId,p_actor:auth.user.id,
    p_sku:sku.trim(),p_quantity_delta:direction==="receive"?count:-count,
    p_note:note.trim(),p_request_id:requestId.current,p_source:"crm"
   });
   if(rpcError)throw new Error(rpcError.message);
   onSaved();
  }catch(e){setError(e instanceof Error?e.message:"ไม่สามารถบันทึกสต๊อกได้");}
  finally{setBusy(false);}
 }
 return <div className="optical-stock-tables__overlay">
   <section role="dialog" aria-modal="true" aria-label={T("รับเข้า / เบิกออกสต๊อก Optical")}
    className="optical-stock-tables__dialog" style={{width:"min(680px,100%)",maxHeight:"90vh",overflowY:"auto"}}>
    <h3>{T("รับเข้า / เบิกออกสต๊อก Optical")}</h3>
    <p>{T("สแกน SKU และยืนยันจำนวน · ไม่ใช่การรับชำระหรือเปลี่ยนราคาขาย")}</p>
    {queueLabel?<p role="status" style={{padding:"10px 12px",borderRadius:8,background:"#fffbeb",color:"#92400e"}}>
      {queueLabel}
    </p>:null}
    <form className="entityForm" onSubmit={e=>void submit(e)}>
      <div className="formGrid">
        <label className="span2"><span>{T("SKU / บาร์โค้ด")}</span>
          <input value={sku} autoFocus autoComplete="off" spellCheck={false}
           onKeyDown={e=>{if(e.key==="Enter")e.preventDefault();}}
           aria-invalid={errorField==="sku"}
           onChange={e=>{setSku(e.target.value);if(errorField==="sku"){setErrorField(null);setError("");}}} required/>
          {errorField==="sku"&&error?<small role="alert" style={{color:"#be123c"}}>{error}</small>:null}
        </label>
        {matches.length?<div className="span2" style={{display:"grid",gap:5,maxHeight:175,overflowY:"auto"}}>
          <strong style={{fontSize:12}}>เลือกสินค้าจากรายการ</strong>
          {matches.map(p=><button key={p.sku} type="button"
            onClick={()=>setSku(p.sku)} style={{padding:"6px 10px",textAlign:"left",
              border:"1px solid #d1d5db",borderRadius:8,background:"#f8fafc"}}>
            {p.label} · {p.sku}
          </button>)}
        </div>:null}
        <fieldset className="span2" style={{display:"flex",flexWrap:"wrap",gap:18}}>
          <legend>{T("ประเภทการปรับจำนวน")}</legend>
          <label><input type="radio" checked={direction==="receive"}
             onChange={()=>setDirection("receive")}/> {T("เพิ่มจำนวน (รับเข้า)")}</label>
          <label><input type="radio" checked={direction==="issue"}
             onChange={()=>setDirection("issue")}/> {T("ลดจำนวน (เบิกออก)")}</label>
        </fieldset>
        <label><span>{T("จำนวนเพิ่ม/ลด *")}</span>
          <input type="number" min="1" max="100000" step="1" inputMode="numeric"
            value={quantity} aria-invalid={errorField==="quantity"}
            onChange={e=>{setQuantity(e.target.value);if(errorField==="quantity"){setErrorField(null);setError("");}}} required/>
          {errorField==="quantity"&&error?<small role="alert" style={{color:"#be123c"}}>{error}</small>:null}
        </label>
        <label><span>{T("สกุลเงิน")}</span><input value={currency} readOnly/></label>
        <div className="span2">
          <strong style={{display:"block",fontSize:13,marginBottom:7}}>{T("เลือกเหตุผลอย่างรวดเร็ว (หรือพิมพ์เอง)")}</strong>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {(direction==="receive"
              ?["รับสินค้าตามใบส่งของ","รับสินค้าเข้าใหม่","ปรับยอดจากผลตรวจนับ"]
              :["เบิกใช้ภายในร้าน","สินค้าชำรุด","ปรับยอดจากผลตรวจนับ"]
            ).map(reason=><button key={reason} type="button" className="secondaryButton"
              onClick={()=>{setNote(reason);setError("");setErrorField(null);}}>{T(reason)}</button>)}
          </div>
        </div>
        <label className="span2"><span>{T("เหตุผล / เอกสารอ้างอิง *")}</span>
          <textarea value={note} minLength={3} maxLength={300} rows={3} required
            aria-invalid={errorField==="note"}
            placeholder="เช่น รับตามใบส่งของเลขที่ ... / ปรับตามผลนับจริง"
            onChange={e=>{setNote(e.target.value);if(errorField==="note"){setErrorField(null);setError("");}}}/>
          <small style={{color:"#64748b"}}>ต้องระบุเหตุผลอย่างน้อย 3 ตัวอักษร เพื่อเก็บประวัติตรวจสอบ</small>
          {errorField==="note"&&error?<small role="alert" style={{color:"#be123c"}}>{error}</small>:null}
        </label>
      </div>
      {error&&!errorField?<p role="alert" className="business-stock__error">{error}</p>:null}
      <p style={{fontSize:12,color:"#64748b"}}>{T("ระบบจะบันทึกประวัติครั้งเดียวตามเลขอ้างอิง เพื่อป้องกันการเพิ่ม/ลดซ้ำ")}</p>
      <div style={{display:"flex",gap:12,justifyContent:"flex-end"}}>
        <button type="button" className="secondaryButton" onClick={onClose} disabled={busy}>{T("ยกเลิก")}</button>
        <button type="submit" className="primaryAction" disabled={busy}>{T(busy?"กำลังบันทึก...":"ยืนยันปรับจำนวน")}</button>
      </div>
    </form>
   </section>
 </div>;
}
