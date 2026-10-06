import { describe,expect,it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root=process.cwd();
const sql=readFileSync(join(root,"supabase/sql/customer_portal_pos_admin_crud_parity.sql"),"utf8");

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
  it("audits Customer Portal mutations",()=>{
    expect(sql).toContain("insert into public.audit_logs");
    expect(sql).toContain("'source','customer_portal'");
  });
});
