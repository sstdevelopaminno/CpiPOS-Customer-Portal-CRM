-- Restrict internal SECURITY DEFINER helpers. Public authenticated clients use only the scoped public RPCs.
revoke all on function app.customer_portal_actor_role(uuid,uuid) from public,anon,authenticated;
revoke all on function app.customer_portal_module_allowed(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function app.customer_portal_actor_role(uuid,uuid) to service_role;
grant execute on function app.customer_portal_module_allowed(uuid,uuid,text,text) to service_role;
