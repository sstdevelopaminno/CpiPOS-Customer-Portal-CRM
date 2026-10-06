import { describe,expect,it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root=process.cwd();
const sql=readFileSync(join(root,"supabase/sql/customer_portal_pos_admin_crud_parity.sql"),"utf8");
const phase2=readFileSync(join(root,"supabase/sql/customer_portal_pos_admin_phase2.sql"),"utf8");

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
  it("audits Customer Portal mutations",()=>{
    expect(sql).toContain("insert into public.audit_logs");
    expect(sql).toContain("'source','customer_portal'");
  });
});
