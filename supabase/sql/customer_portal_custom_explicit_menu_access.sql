-- Proposed CUSTOM menu policy alignment for POS / IT / CRM.
-- Production release SQL for the CUSTOM policy; changes only two existing functions.
-- Must run before the CRM UI is promoted, and verify unchanged fixed-plan grants.
-- Fixed packages: unchanged behavior; CUSTOM: explicit menu and parent allow, on
-- top of existing subscription, feature-override and role checks.

CREATE OR REPLACE FUNCTION public.customer_portal_feature_state(p_tenant_id uuid, p_branch_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_package_id uuid;
begin
  if not app.customer_portal_actor_can_manage(p_tenant_id,p_branch_id) then
    raise exception using errcode='42501',message='customer_portal_forbidden';
  end if;

  select package_id into v_package_id
  from public.tenant_subscription_contracts
  where tenant_id=p_tenant_id
  order by created_at desc
  limit 1;

  return jsonb_build_object(
    'package_id',v_package_id,
    'is_custom',coalesce((
      select lower(code)='custom' from public.subscription_packages
      where id=v_package_id
    ),false),
    'package_features',coalesce((
      select jsonb_object_agg(feature_code,included)
      from public.subscription_package_features
      where package_id=v_package_id
    ),'{}'::jsonb),
    'feature_overrides',coalesce((
      select jsonb_object_agg(feature_code,is_enabled order by case when branch_id is null then 0 else 1 end)
      from public.tenant_feature_subscriptions
      where tenant_id=p_tenant_id
        and (branch_id is null or branch_id=p_branch_id)
    ),'{}'::jsonb),
    'menu_policy',coalesce((
      select jsonb_object_agg(menu_key,is_enabled)
      from public.tenant_pos_menu_policies
      where tenant_id=p_tenant_id
    ),'{}'::jsonb)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION app.customer_portal_module_allowed(p_tenant_id uuid, p_branch_id uuid, p_feature text, p_menu_key text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'app'
AS $function$
declare
  v_state jsonb;
  v_package boolean;
  v_override boolean;
  v_menu boolean;
  v_is_custom boolean;
  v_parent text;
  v_parent_enabled boolean;
begin
  if app.customer_portal_actor_role(p_tenant_id,p_branch_id) is null then
    return false;
  end if;
  v_state := public.customer_portal_feature_state(p_tenant_id,p_branch_id);
  v_package := coalesce((v_state->'package_features'->>p_feature)::boolean,false);
  if (v_state->'feature_overrides') ? p_feature then
    v_override := (v_state->'feature_overrides'->>p_feature)::boolean;
  else
    v_override := null;
  end if;
  v_is_custom := coalesce((v_state->>'is_custom')::boolean,false);
  if v_is_custom then
    v_menu := coalesce((v_state->'menu_policy'->>p_menu_key)::boolean,false);
    v_parent := case
      when p_menu_key like 'more.%' then 'main.more'
      when p_menu_key like 'settings.%' then 'main.settings'
      else null end;
    v_parent_enabled := v_parent is null or
      coalesce((v_state->'menu_policy'->>v_parent)::boolean,false);
  else
    v_menu := coalesce((v_state->'menu_policy'->>p_menu_key)::boolean,true);
    v_parent_enabled := true;
  end if;
  return coalesce(v_override,v_package,false) and v_menu and v_parent_enabled;
end;
$function$;
