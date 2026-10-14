import { supabase, supabaseKey, supabaseUrl } from "../supabase";
import type { FeatureState, PackageInfo, PortalRole } from "../../types/portal";

export async function loadPackage(tenantId: string, _role: PortalRole): Promise<PackageInfo> {
  const { data, error } = await supabase.rpc("customer_portal_billing_overview", {
    p_tenant_id: tenantId
  });
  if (error) throw error;
  const value = (data ?? {}) as unknown as PackageInfo;
  return {
    runtime: value.runtime ?? null,
    contract: value.contract ?? null,
    currentDue: value.currentDue ?? null,
    billingCycles: Array.isArray(value.billingCycles) ? value.billingCycles : [],
    requests: Array.isArray(value.requests) ? value.requests : [],
    issuer: value.issuer ?? null,
    actor_role: value.actor_role ?? null
  };
}

export async function loadFeatureState(tenantId: string, branchId: string | null): Promise<FeatureState> {
  const { data, error } = await supabase.rpc("customer_portal_feature_state", {
    p_tenant_id: tenantId,
    p_branch_id: branchId
  });
  if (error) throw error;
  const value=(data??{}) as Record<string,unknown>;
  // Fail closed: CUSTOM is not equivalent to Optical permission.
  // The authoritative IT sales-mode switch is on the latest tenant contract.
  let opticalRetailEnabled=false;
  if(value.is_custom===true || value.is_internal_test_full===true){
    const {data:contract,error:contractError}=await supabase
      .from("tenant_subscription_contracts")
      .select("metadata,status,ended_at")
      .eq("tenant_id",tenantId)
      .order("created_at",{ascending:false}).limit(1).maybeSingle();
    // Optical fails closed if its extra lookup fails, without breaking normal
    // CRM menus for existing CUSTOM tenants.
    if(!contractError){
      const grants=contract?.metadata?.sales_modes as Record<string,unknown>|undefined;
      const active=contract?.status==="active"||contract?.status==="trial";
      opticalRetailEnabled=Boolean(active
        && (!contract?.ended_at || Date.parse(contract.ended_at)>Date.now())
        && grants?.optical_retail===true);
    }
  }
  return {
    package_id: typeof value.package_id==="string"?value.package_id:null,
    is_custom: value.is_custom === true,
    is_internal_test_full: value.is_internal_test_full === true,
    optical_retail_enabled: opticalRetailEnabled,
    package_features: (value.package_features??{}) as Record<string,boolean>,
    feature_overrides: (value.feature_overrides??{}) as Record<string,boolean>,
    menu_policy: (value.menu_policy??{}) as Record<string,boolean>
  };
}

export async function submitPackagePayment(input:{
  tenantId:string;
  billingCycleId?:string|null;
  requestId?:string|null;
  packageId:string;
  billingInterval:string;
  expectedAmount:number;
  slip:File;
}) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token=sessionData.session?.access_token;
  if(!token) throw new Error("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
  const form=new FormData();
  form.set("tenant_id",input.tenantId);
  form.set("request_key",input.requestId||crypto.randomUUID());
  form.set("package_id",input.packageId);
  form.set("billing_interval",input.billingInterval);
  form.set("expected_amount",String(input.expectedAmount));
  if(input.billingCycleId) form.set("billing_cycle_id",input.billingCycleId);
  form.set("slip",input.slip);
  const response=await fetch(`${supabaseUrl}/functions/v1/customer-portal-billing-payment`,{
    method:"POST",
    headers:{apikey:supabaseKey,authorization:`Bearer ${token}`},
    body:form
  });
  const payload=await response.json().catch(()=>({})) as {error?:string;status?:string;scan_status?:string;provisional_access?:boolean;review_deadline?:string|null};
  if(!response.ok){
    if(payload.error==="payable_cycle_exists") throw new Error("มีรอบบิลที่ต้องชำระอยู่ กรุณาชำระจากรายการรอบบิลนั้น");
    if(payload.error==="renewal_not_due") throw new Error("ยังไม่ถึงช่วงเวลาที่เปิดให้ชำระรอบถัดไป");
    if(payload.error==="payment_support_required") throw new Error("เกินกำหนดชำระด้วยตนเองแล้ว กรุณาติดต่อฝ่าย Support");
    if(payload.error==="billing_cycle_mismatch"||payload.error==="billing_cycle_unavailable") throw new Error("รอบบิลมีการเปลี่ยนแปลง กรุณารีเฟรชแล้วลองใหม่");
    if(payload.error==="slip_required") throw new Error("กรุณาแนบสลิป JPG, PNG หรือ WebP ขนาดไม่เกิน 4 MB");
    if(payload.error==="slip_type_invalid") throw new Error("ไฟล์สลิปไม่ตรงกับรูปแบบภาพที่รองรับ กรุณาเลือกไฟล์ใหม่");
    if(payload.error==="cycle_not_payable"||payload.error==="amount_unavailable") throw new Error("รอบบิลนี้ไม่สามารถชำระได้ กรุณารีเฟรชสถานะล่าสุด");
    if(payload.error==="open_request_exists") throw new Error("มีคำขอชำระเงินที่อยู่ระหว่างตรวจสอบ กรุณารอผลจากฝ่าย IT");
    throw new Error("ไม่สามารถส่งหลักฐานการชำระเงินได้");
  }
  return payload;
}
