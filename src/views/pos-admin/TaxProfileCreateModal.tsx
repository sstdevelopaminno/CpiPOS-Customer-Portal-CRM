import { useState,type FormEvent } from "react";
import { LoaderCircle,MapPin,Search } from "lucide-react";
import { ErrorPanel,Modal } from "../../components/common";
import { createTaxProfile,lookupThaiAddress,type ThaiAddressOption } from "../../lib/api/tax-profile";
import type { PortalContext } from "../../types/portal";

export function TaxProfileCreateModal({context,branchId,onClose,onCreated}:{context:PortalContext;branchId:string;onClose:()=>void;onCreated:()=>void|Promise<void>}){
  const [entityType,setEntityType]=useState<"company"|"limited_partnership"|"shop"|"individual">("company");
  const [postal,setPostal]=useState(""); const [options,setOptions]=useState<ThaiAddressOption[]>([]); const [selected,setSelected]=useState("");
  const [busy,setBusy]=useState(false); const [lookupBusy,setLookupBusy]=useState(false); const [error,setError]=useState("");
  async function lookup(){
    setLookupBusy(true);setError("");setOptions([]);setSelected("");
    try{const rows=await lookupThaiAddress(context.tenantId,branchId,postal);setOptions(rows);if(rows.length===1)setSelected("0");if(!rows.length)setError("ไม่พบตำบล/แขวงสำหรับรหัสไปรษณีย์นี้");}
    catch(e){setError(e instanceof Error?e.message:"ค้นหาที่อยู่ไม่สำเร็จ");}
    finally{setLookupBusy(false);}
  }
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const address=options[Number(selected)];if(!address){setError("กรุณาค้นหาและเลือกตำบล/แขวงให้ถูกต้อง");return;}
    const form=new FormData(e.currentTarget);setBusy(true);setError("");
    try{await createTaxProfile({tenantId:context.tenantId,branchId,entityType,displayName:String(form.get("display_name")??""),taxId:String(form.get("tax_id")??""),addressLine:String(form.get("address_line")??""),postalCode:postal,address});await onCreated();onClose();}
    catch(err){setError(err instanceof Error?err.message:"บันทึกทะเบียนผู้เสียภาษีไม่สำเร็จ");setBusy(false);}
  }
  return <Modal title="เพิ่มทะเบียนผู้เสียภาษี" onClose={onClose}>
    <form className="entityForm taxProfileForm" onSubmit={submit}>
      {error?<ErrorPanel message={error}/>:null}
      <div className="formGrid">
        <label><span>ประเภท</span><select value={entityType} onChange={e=>setEntityType(e.target.value as typeof entityType)}><option value="company">บริษัท</option><option value="limited_partnership">ห้างหุ้นส่วนจำกัด</option><option value="shop">ร้านค้า</option><option value="individual">บุคคลธรรมดา</option></select></label>
        <label><span>เลขผู้เสียภาษี 13 หลัก</span><input name="tax_id" inputMode="numeric" maxLength={13} required/></label>
        <label className="span2"><span>ชื่อสำหรับออกใบกำกับภาษี</span><input name="display_name" required/></label>
        <label className="span2"><span>บ้านเลขที่ / อาคาร / ถนน / ซอย</span><textarea name="address_line" rows={3} required/></label>
        <label><span>รหัสไปรษณีย์</span><input inputMode="numeric" maxLength={5} value={postal} onChange={e=>{setPostal(e.target.value.replace(/\D/g,"").slice(0,5));setOptions([]);setSelected("");}} placeholder="10110" required/></label>
        <div className="taxAddressLookup"><button className="secondaryButton" type="button" disabled={lookupBusy||postal.length!==5} onClick={()=>void lookup()}>{lookupBusy?<LoaderCircle className="spin" size={15}/>:<Search size={15}/>}ค้นหาที่อยู่</button></div>
        <label className="span2"><span>ตำบล/แขวง · อำเภอ/เขต · จังหวัด</span><select value={selected} onChange={e=>setSelected(e.target.value)} disabled={!options.length} required><option value="">เลือกที่อยู่จากข้อมูลรหัสไปรษณีย์</option>{options.map((o,i)=><option key={[o.subdistrict_code,o.district_code,o.province_code].join("-")} value={String(i)}>{o.subdistrict+" · "+o.district+" · "+o.province}</option>)}</select></label>
      </div>
      {selected!==""&&options[Number(selected)]?<div className="taxAddressPreview"><MapPin size={17}/><span>{options[Number(selected)].subdistrict} {options[Number(selected)].district} {options[Number(selected)].province} {postal}</span></div>:null}
      <div className="modalActions"><button className="secondaryButton" type="button" onClick={onClose}>ยกเลิก</button><button className="primaryAction" disabled={busy||selected===""}>{busy?<LoaderCircle className="spin" size={16}/>:null}บันทึกทะเบียน</button></div>
    </form>
  </Modal>;
}
