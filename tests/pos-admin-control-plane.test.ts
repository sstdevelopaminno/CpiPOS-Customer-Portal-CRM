import { describe,expect,it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root=process.cwd();
const sql=readFileSync(join(root,"supabase/sql/customer_portal_pos_admin_crud_parity.sql"),"utf8");
const phase2=readFileSync(join(root,"supabase/sql/customer_portal_pos_admin_phase2.sql"),"utf8");
const phase3=readFileSync(join(root,"supabase/sql/customer_portal_pos_admin_phase3.sql"),"utf8");
const phase4=readFileSync(join(root,"supabase/sql/customer_portal_pos_admin_phase4.sql"),"utf8");
const taxProfileEdge=readFileSync(join(root,"supabase/functions/customer-portal-tax-profile/index.ts"),"utf8");
const printerAdminEdge=readFileSync(join(root,"supabase/functions/customer-portal-printer-admin/index.ts"),"utf8");

describe("POS admin control-plane",()=>{
  it("requires feature and menu policy before mutations",()=>{
    expect(sql).toContain("customer_portal_module_allowed");
    expect(sql).toContain("customer_portal_feature_state");
    expect(sql).toContain("feature_not_enabled");
  });
  it("keeps POS data integrity behaviors",()=>{
    expect(sql).toContain("set deleted_at=now()");
    expect(sql).toContain("'archived',true");
    expect(sql).toContain("update public.pos_sessions set status='revoked'");
    expect(sql).toContain("device_quota_blocked");
  });
  it("locks internal SECURITY DEFINER helpers away from browser roles",()=>{
    const lockdown=readFileSync(join(root,"supabase/sql/customer_portal_pos_admin_helper_lockdown.sql"),"utf8");
    expect(lockdown).toContain("from public,anon,authenticated");
    expect(lockdown).toContain("to service_role");
  });
  it("phase2 keeps printer, display and floor-plan control server-side",()=>{
    expect(phase2).toContain("customer_portal_pos_admin_phase2_snapshot");
    expect(phase2).toContain("customer_portal_pos_admin_phase2_mutate");
    expect(phase2).toContain("printer_device_assignments");
    expect(phase2).toContain("display.pairing.create");
    expect(phase2).toContain("floor_plan.save");
    expect(phase2).not.toContain("display.policy.save");
  });
  it("hardens Customer Display pairing code generation",()=>{
    const pairing=readFileSync(join(root,"supabase/sql/customer_portal_pos_admin_phase2_pairing_hardening.sql"),"utf8");
    expect(pairing).toContain("get_byte(v_rand,0)::bigint");
    expect(pairing).toContain("customer_display_pairing_conflict");
    expect(pairing).toContain("extensions.digest");
  });
  it("phase3 enforces PIN, IT overrides and shared POS document policy",()=>{
    expect(phase3).toContain("customer_portal_verify_manager_pin");
    expect(phase3).toContain("extensions.crypt");
    expect(phase3).toContain("table_qr_popup_override");
    expect(phase3).toContain("table_qr_sessions");
    expect(phase3).toContain("pos_payment_provider_settings");
    expect(phase3).toContain("pos_tax_invoices");
    expect(phase3).toContain("receipt_reprint_history");
    expect(phase3).not.toContain("service_role_key");
  });
  it("keeps internal phase3 helpers unavailable to browser roles",()=>{
    expect(phase3).toContain("customer_portal_verify_manager_pin(uuid,uuid,text) from public,anon,authenticated");
    expect(phase3).toContain("customer_portal_thai_tax_id_valid(text) from public,anon,authenticated");
    expect(phase3).toContain("customer_portal_pos_admin_phase3_snapshot(uuid,uuid,text,jsonb) to authenticated");
  });
  it("phase4 queues remote print only through registered online Print Agent paths",()=>{
    expect(phase4).toContain("customer_portal_pos_admin_phase4_print_state");
    expect(phase4).toContain("customer_portal_pos_admin_phase4_queue_print");
    expect(phase4).toContain("customer_portal_verify_manager_pin");
    expect(phase4).toContain("customer_portal_printer_matches_agent");
    expect(phase4).toContain("last_seen_at>=now()-interval '5 minutes'");
    expect(phase4).toContain("'customer_portal_remote_print'");
    expect(phase4).toContain("idempotency_key");
  });
  it("phase4 keeps print routing browser-safe",()=>{
    expect(phase4).toContain("from public,anon,authenticated");
    expect(phase4).toContain("to service_role");
    expect(phase4).toContain("to authenticated");
    expect(phase4).not.toContain("api_key_hash");
  });
  it("validates Thai tax addresses in the authenticated Edge Function",()=>{
    expect(taxProfileEdge).toContain("thailand-geography-json");
    expect(taxProfileEdge).toContain("thai_address_selection_invalid");
    expect(taxProfileEdge).toContain("admin.auth.getUser(token)");
    expect(taxProfileEdge).toContain("customer_portal_feature_state");
    expect(taxProfileEdge).toContain("tax_invoice_profile_created");
  });
  it("phase5 keeps printer health and retry behind authenticated server control",()=>{
    expect(printerAdminEdge).toContain("admin.auth.getUser(token)");
    expect(printerAdminEdge).toContain("customer_portal_feature_state");
    expect(printerAdminEdge).toContain("settings.printers");
    expect(printerAdminEdge).not.toContain("api_key_hash");
    expect(printerAdminEdge).toContain("printer_agent_offline");
    expect(printerAdminEdge).toContain("customer_portal_printer_test");
    expect(printerAdminEdge).toContain("job_retry_not_allowed");
    expect(printerAdminEdge).toContain("bcrypt.compare");
  });
  it("phase5 never replays unsafe kitchen or device command jobs",()=>{
    expect(printerAdminEdge).toContain("row.kitchen_ticket_id");
    expect(printerAdminEdge).toContain("row.printer_role===\"kitchen\"&&!testPrint");
    expect(printerAdminEdge).toContain("meta.command");
    expect(printerAdminEdge).toContain('status:"pending",retry_count:0');
  });
  it("audits Customer Portal mutations",()=>{
    expect(sql).toContain("insert into public.audit_logs");
    expect(sql).toContain("'source','customer_portal'");
  });
});
