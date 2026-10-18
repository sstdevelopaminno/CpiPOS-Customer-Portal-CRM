import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
const read=(path:string)=>readFileSync(new URL("../src/"+path,import.meta.url),"utf8");
describe("CUSTOM Optical Owner-issued CRM staff access stays fail-closed",()=>{
  const auth=read("lib/api/auth.ts");
  const billing=read("lib/api/billing.ts");
  const main=read("App.tsx");
  const optical=read("views/OpticalWorkspace.tsx");
  const staff=read("views/StaffView.tsx");
  const permissions=read("views/StaffCrmPermissionsModal.tsx");
  const customer=read("views/OpticalCustomersView.tsx");
  const operations=read("views/OpticalOperationsView.tsx");
  it("requires role-specific rollout AND server-validated Owner grants before staff navigation",()=>{
    expect(auth).toContain('.in("role", ["owner", "manager", "staff"])');
    expect(auth).toContain('VITE_CRM_STAFF_ACCESS_V1_ENABLED!=="true"');
    expect(auth).toContain('customer_portal_staff_feature_state_v1');
    expect(billing).toContain('role==="staff"');
    expect(billing).toContain('VITE_CRM_STAFF_ACCESS_V1_ENABLED!=="true"');
    expect(billing).toContain("customer_portal_staff_feature_state_v1");
    expect(main).toContain('usePortalMenuAccess(context?.tenantId??null,context?.role==="staff"');
  });
  it("does not give staff any other CRM menu or financial ledger read",()=>{
    expect(main).toContain('context?.role==="staff"?false');
    expect(optical).toContain('readOnly={context.role==="staff"}');
    expect(optical).toContain('context.role!=="staff"?<OpticalCustomerAddressEditor');
    expect(customer).toContain("if(!activeBranch||saving||readOnly)return;");
    expect(customer).toContain("if(!activeBranch||readOnly||!window.confirm(");
    expect(operations).toContain('if(context.role==="staff"||page!=="orders"');
    expect(operations).toContain('{context.role!=="staff"?<>');
  });
  it("only tenant Owner has staged individual CRM staff grant control",()=>{
    expect(staff).toContain('context.role==="owner"&&row.branch_role==="staff"');
    expect(permissions).toContain('context.role!=="owner"');
    expect(permissions).toContain("customer_portal_staff_crm_permissions_v1");
    expect(permissions).toContain("customer_portal_set_staff_crm_permission_v1");
    expect(permissions).toContain("p_can_edit:false");
    expect(permissions).toContain('checked={false} disabled');
  });
});
