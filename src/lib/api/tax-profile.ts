import { supabase,supabaseKey,supabaseUrl } from "../supabase";

export type ThaiAddressOption={
  postal_code:string;subdistrict:string;district:string;province:string;
  subdistrict_code:string;district_code:string;province_code:string;
};
export type TaxProfileCreateInput={
  tenantId:string;branchId:string;entityType:"company"|"limited_partnership"|"shop"|"individual";
  displayName:string;taxId:string;addressLine:string;postalCode:string;address:ThaiAddressOption;
};

async function call(payload:Record<string,unknown>){
  const {data}=await supabase.auth.getSession();
  const token=data.session?.access_token;
  if(!token)throw new Error("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
  const response=await fetch(\`\${supabaseUrl}/functions/v1/customer-portal-tax-profile\`,{
    method:"POST",
    headers:{apikey:supabaseKey,authorization:\`Bearer \${token}\`,"content-type":"application/json"},
    body:JSON.stringify(payload)
  });
  const body=await response.json().catch(()=>({})) as {error?:string;options?:ThaiAddressOption[];profile?:Record<string,unknown>};
  if(!response.ok){
    const code=body.error??"";
    if(code==="postal_code_invalid")throw new Error("กรุณากรอกรหัสไปรษณีย์ 5 หลัก");
    if(code==="thai_address_unavailable")throw new Error("ระบบค้นหาที่อยู่ไทยไม่พร้อมใช้งาน กรุณาลองใหม่");
    if(code==="thai_address_selection_invalid")throw new Error("ที่อยู่ที่เลือกไม่ตรงกับข้อมูลรหัสไปรษณีย์");
    if(code==="tax_id_invalid")throw new Error("เลขประจำตัวผู้เสียภาษี 13 หลักไม่ถูกต้อง");
    if(code==="tax_profile_exists")throw new Error("เลขประจำตัวผู้เสียภาษีนี้มีอยู่ในทะเบียนของสาขาแล้ว");
    if(code==="feature_not_enabled")throw new Error("แพ็กเกจหรือฝ่าย IT ไม่อนุญาตเมนูใบกำกับภาษี");
    if(code==="forbidden")throw new Error("บัญชีนี้ไม่มีสิทธิ์จัดการทะเบียนผู้เสียภาษี");
    if(code==="display_name_required")throw new Error("กรุณากรอกชื่อผู้เสียภาษี");
    if(code==="address_required")throw new Error("กรุณากรอกรายละเอียดที่อยู่");
    throw new Error("ไม่สามารถดำเนินการทะเบียนผู้เสียภาษีได้");
  }
  return body;
}

export async function lookupThaiAddress(tenantId:string,branchId:string,postalCode:string){
  const body=await call({action:"lookup_address",tenant_id:tenantId,branch_id:branchId,postal_code:postalCode});
  return Array.isArray(body.options)?body.options:[];
}

export async function createTaxProfile(input:TaxProfileCreateInput){
  const body=await call({
    action:"create_profile",tenant_id:input.tenantId,branch_id:input.branchId,
    entity_type:input.entityType,display_name:input.displayName,tax_id:input.taxId,address_line:input.addressLine,
    postal_code:input.postalCode,subdistrict:input.address.subdistrict,district:input.address.district,province:input.address.province
  });
  return body.profile??{};
}
