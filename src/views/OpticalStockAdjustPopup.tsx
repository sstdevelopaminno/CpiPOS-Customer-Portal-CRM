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
  if(!skuPattern.test(sku.trim())||!Number.isSafeInteger(count)||count<1||count>100000||
    note.trim().length<3||note.trim().length>300)
   return setError("กรุณาตรวจสอบ SKU, จำนวนเต็ม 1–100000 และเหตุผลอย่างน้อย 3 ตัวอักษร");
  setBusy(true);setError("");
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
           onChange={e=>setSku(e.target.value)} required/></label>
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
          <input type="number" min="1" max="100000" step="1"
            value={quantity} onChange={e=>setQuantity(e.target.value)} required/></label>
        <label><span>{T("สกุลเงิน")}</span><input value={currency} readOnly/></label>
        <label className="span2"><span>{T("เหตุผล / เอกสารอ้างอิง *")}</span>
          <textarea value={note} maxLength={300} rows={3} required
            placeholder="เช่น รับตามใบส่งของเลขที่ ... / ปรับตามผลนับจริง"
            onChange={e=>setNote(e.target.value)}/></label>
      </div>
      {error?<p role="alert" className="business-stock__error">{error}</p>:null}
      <p style={{fontSize:12,color:"#64748b"}}>{T("ระบบจะบันทึกประวัติครั้งเดียวตามเลขอ้างอิง เพื่อป้องกันการเพิ่ม/ลดซ้ำ")}</p>
      <div style={{display:"flex",gap:12,justifyContent:"flex-end"}}>
        <button type="button" className="secondaryButton" onClick={onClose} disabled={busy}>{T("ยกเลิก")}</button>
        <button type="submit" className="primaryAction" disabled={busy}>{T(busy?"กำลังบันทึก...":"ยืนยันปรับจำนวน")}</button>
      </div>
    </form>
   </section>
 </div>;
}
