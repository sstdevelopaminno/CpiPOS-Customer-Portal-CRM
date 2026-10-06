-- Customer Portal CRM control-plane bridge.
-- Reads/writes shared CpiPOS-001 tables without modifying CpIPOS or CpIPOS-IT code.
-- Applied 2026-10-06.

grant usage on schema app to authenticated;
grant execute on function app.customer_portal_actor_can_manage(uuid,uuid) to authenticated;
revoke all on function app.customer_portal_actor_can_manage(uuid,uuid) from anon;

CREATE OR REPLACE FUNCTION public.customer_portal_billing_overview(p_tenant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
  v_role text;
  v_result jsonb;
begin
  select case
    when bool_or(ubr.role::text='owner') then 'owner'
    when bool_or(ubr.role::text='manager') then 'manager'
    else null end
  into v_role
  from public.user_branch_roles ubr
  join public.users_profiles up on up.id=ubr.user_id
  where ubr.user_id=v_actor and ubr.tenant_id=p_tenant_id
    and up.is_active=true and up.archived_at is null
    and ubr.role::text in ('owner','manager');

  if v_role is null then
    raise exception using errcode='42501',message='customer_portal_forbidden';
  end if;

  select jsonb_build_object(
    'runtime', (
      select to_jsonb(r) from (
        select lifecycle_status,access_locked,lock_reason,expires_at,payment_review_status,updated_at
        from public.tenant_subscription_runtime
        where tenant_id=p_tenant_id
        limit 1
      ) r
    ),
    'contract', (
      select to_jsonb(c) from (
        select tc.id,tc.package_id,sp.code as package_code,sp.name as package_name,
          tc.contract_type,tc.billing_interval,tc.status,tc.amount_per_cycle,tc.currency,
          tc.auto_renew,tc.started_at,tc.ended_at,tc.max_branches,tc.max_devices,tc.max_users
        from public.tenant_subscription_contracts tc
        left join public.subscription_packages sp on sp.id=tc.package_id
        where tc.tenant_id=p_tenant_id
        order by tc.created_at desc
        limit 1
      ) c
    ),
    'billingCycles', coalesce((
      select jsonb_agg(to_jsonb(c) order by c.period_end desc)
      from (
        select id,package_id,period_start,period_end,amount_due,amount_paid,status,created_at
        from public.tenant_billing_cycles
        where tenant_id=p_tenant_id
        order by period_end desc
        limit 36
      ) c
    ),'[]'::jsonb),
    'requests', case when v_role='owner' then coalesce((
      select jsonb_agg(to_jsonb(r) order by r.submitted_at desc)
      from (
        select pr.id,pr.request_type,pr.requested_package_id,sp.name as package_name,
          pr.status,pr.amount_reported,pr.currency,pr.submitted_at,pr.reviewed_at,
          pr.review_note,(pr.evidence_url is not null) as has_evidence,pr.metadata
        from public.tenant_subscription_payment_requests pr
        left join public.subscription_packages sp on sp.id=pr.requested_package_id
        where pr.tenant_id=p_tenant_id
        order by pr.created_at desc
        limit 30
      ) r
    ),'[]'::jsonb) else '[]'::jsonb end,
    'issuer', case when v_role='owner' then (
      select to_jsonb(i) from (
        select billing_legal_name_th,billing_bank_name,billing_bank_account_name,
          billing_bank_account_number,billing_promptpay_id,billing_email,support_email,
          billing_vat_registered
        from public.it_communication_settings
        where id='default'
        limit 1
      ) i
    ) else null end,
    'actor_role',v_role
  ) into v_result;

  return v_result;
end;
$function$;

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

CREATE OR REPLACE FUNCTION public.customer_portal_more_snapshot(p_tenant_id uuid, p_branch_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not app.customer_portal_actor_can_manage(p_tenant_id,p_branch_id) then
    raise exception using errcode='42501',message='customer_portal_forbidden';
  end if;

  return jsonb_build_object(
    'tables_count',(select count(*) from public.dining_tables where tenant_id=p_tenant_id and (p_branch_id is null or branch_id=p_branch_id) and coalesce(is_active,true)),
    'kitchen_zones_count',(select count(*) from public.kitchen_zones where tenant_id=p_tenant_id and (p_branch_id is null or branch_id=p_branch_id) and coalesce(is_active,true)),
    'kitchen_rules_count',(select count(*) from public.kitchen_routing_rules where tenant_id=p_tenant_id and (p_branch_id is null or branch_id=p_branch_id) and coalesce(is_active,true)),
    'members_count',(select count(*) from public.mobile_members where tenant_id=p_tenant_id and (p_branch_id is null or branch_id=p_branch_id)),
    'tax_invoices_count',(select count(*) from public.pos_tax_invoices where tenant_id=p_tenant_id and (p_branch_id is null or branch_id=p_branch_id)),
    'ai_documents_count',(select count(*) from public.pos_ai_documents where tenant_id=p_tenant_id and (p_branch_id is null or branch_id=p_branch_id)),
    'printers_count',(select count(*) from public.printer_devices where tenant_id=p_tenant_id and (p_branch_id is null or branch_id=p_branch_id) and coalesce(is_active,true)),
    'display_pairings_count',(select count(*) from public.pos_customer_display_pairings where tenant_id=p_tenant_id and (p_branch_id is null or branch_id=p_branch_id) and coalesce(is_active,true)),
    'audit_count',(select count(*) from public.audit_logs where tenant_id=p_tenant_id and (p_branch_id is null or branch_id=p_branch_id))
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.customer_portal_save_setting(p_tenant_id uuid, p_branch_id uuid, p_action text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
  v_is_owner boolean := false;
  v_allowed boolean := false;
  v_id uuid;
  v_branch_limit integer;
  v_active_branches integer;
begin
  select
    bool_or(ubr.role::text='owner'),
    bool_or(
      ubr.role::text='owner'
      or (ubr.role::text='manager' and (p_branch_id is null or ubr.branch_id=p_branch_id))
    )
  into v_is_owner,v_allowed
  from public.user_branch_roles ubr
  join public.users_profiles up on up.id=ubr.user_id
  where ubr.user_id=v_actor
    and ubr.tenant_id=p_tenant_id
    and up.is_active=true
    and up.archived_at is null
    and ubr.role::text in ('owner','manager');

  if not coalesce(v_allowed,false) then
    raise exception using errcode='42501',message='customer_portal_forbidden';
  end if;

  if p_action='update_store' then
    if not v_is_owner then
      raise exception using errcode='42501',message='owner_required';
    end if;
    update public.tenants
    set display_name=nullif(btrim(coalesce(p_payload->>'display_name','')),''),
        company_address=nullif(btrim(coalesce(p_payload->>'company_address','')),''),
        contact_phone=nullif(btrim(coalesce(p_payload->>'contact_phone','')),''),
        updated_at=now()
    where id=p_tenant_id;
    return jsonb_build_object('ok',true,'action',p_action);
  end if;

  if p_action='save_branch' then
    if not v_is_owner then
      raise exception using errcode='42501',message='owner_required';
    end if;
    if btrim(coalesce(p_payload->>'code',''))='' or length(btrim(p_payload->>'code'))>40 then
      raise exception using errcode='22023',message='invalid_branch_code';
    end if;
    if btrim(coalesce(p_payload->>'name',''))='' or length(btrim(p_payload->>'name'))>160 then
      raise exception using errcode='22023',message='invalid_branch_name';
    end if;

    if nullif(p_payload->>'id','') is null then
      select coalesce(tc.max_branches,tc.branch_limit,sp.max_branches)
      into v_branch_limit
      from public.tenant_subscription_contracts tc
      left join public.subscription_packages sp on sp.id=tc.package_id
      where tc.tenant_id=p_tenant_id
      order by tc.created_at desc limit 1;

      select count(*) into v_active_branches
      from public.branches where tenant_id=p_tenant_id and is_active=true;

      if v_branch_limit is not null and v_branch_limit>0 and v_active_branches>=v_branch_limit then
        raise exception using errcode='P0001',message='branch_limit_reached';
      end if;

      insert into public.branches(tenant_id,code,name,address,is_active)
      values(
        p_tenant_id,btrim(p_payload->>'code'),btrim(p_payload->>'name'),
        nullif(btrim(coalesce(p_payload->>'address','')),''),
        coalesce((p_payload->>'is_active')::boolean,true)
      ) returning id into v_id;
    else
      v_id=(p_payload->>'id')::uuid;
      update public.branches
      set code=btrim(p_payload->>'code'),
          name=btrim(p_payload->>'name'),
          address=nullif(btrim(coalesce(p_payload->>'address','')),''),
          is_active=coalesce((p_payload->>'is_active')::boolean,is_active),
          updated_at=now()
      where id=v_id and tenant_id=p_tenant_id;
      if not found then raise exception using errcode='P0002',message='branch_not_found'; end if;
    end if;
    return jsonb_build_object('ok',true,'id',v_id,'action',p_action);
  end if;

  if p_action='save_payment_account' then
    if not v_is_owner then
      raise exception using errcode='42501',message='owner_required';
    end if;
    if btrim(coalesce(p_payload->>'bank_name',''))='' then
      raise exception using errcode='22023',message='invalid_bank_name';
    end if;
    if nullif(p_payload->>'id','') is null then
      insert into public.tenant_payment_accounts(
        tenant_id,branch_id,bank_name,account_name,account_number,promptpay_phone,
        qr_image_url,qr_mode,applies_to_all_branches,is_active,created_by
      )
      values(
        p_tenant_id,
        case when coalesce((p_payload->>'applies_to_all_branches')::boolean,false) then null else p_branch_id end,
        btrim(p_payload->>'bank_name'),
        nullif(btrim(coalesce(p_payload->>'account_name','')),''),
        nullif(btrim(coalesce(p_payload->>'account_number','')),''),
        nullif(btrim(coalesce(p_payload->>'promptpay_phone','')),''),
        nullif(btrim(coalesce(p_payload->>'qr_image_url','')),''),
        coalesce(nullif(p_payload->>'qr_mode',''),'promptpay_link'),
        coalesce((p_payload->>'applies_to_all_branches')::boolean,false),
        coalesce((p_payload->>'is_active')::boolean,true),
        v_actor
      ) returning id into v_id;
    else
      v_id=(p_payload->>'id')::uuid;
      update public.tenant_payment_accounts
      set branch_id=case when coalesce((p_payload->>'applies_to_all_branches')::boolean,false) then null else p_branch_id end,
          bank_name=btrim(p_payload->>'bank_name'),
          account_name=nullif(btrim(coalesce(p_payload->>'account_name','')),''),
          account_number=nullif(btrim(coalesce(p_payload->>'account_number','')),''),
          promptpay_phone=nullif(btrim(coalesce(p_payload->>'promptpay_phone','')),''),
          qr_image_url=nullif(btrim(coalesce(p_payload->>'qr_image_url','')),''),
          qr_mode=coalesce(nullif(p_payload->>'qr_mode',''),'promptpay_link'),
          applies_to_all_branches=coalesce((p_payload->>'applies_to_all_branches')::boolean,false),
          is_active=coalesce((p_payload->>'is_active')::boolean,true),
          updated_at=now()
      where id=v_id and tenant_id=p_tenant_id;
      if not found then raise exception using errcode='P0002',message='payment_account_not_found'; end if;
    end if;
    return jsonb_build_object('ok',true,'id',v_id,'action',p_action);
  end if;

  if p_action='save_tax' then
    if p_branch_id is null then raise exception using errcode='22023',message='branch_required'; end if;
    insert into public.tenant_tax_settings(
      id,tenant_id,branch_id,is_enabled,calculation_base,settings
    )
    values(
      gen_random_uuid(),p_tenant_id,p_branch_id,
      coalesce((p_payload->>'is_enabled')::boolean,false),
      coalesce(nullif(p_payload->>'calculation_base',''),'exclusive'),
      coalesce(p_payload->'settings','{}'::jsonb)
    )
    on conflict(tenant_id,branch_id) do update
    set is_enabled=excluded.is_enabled,
        calculation_base=excluded.calculation_base,
        settings=excluded.settings,
        updated_at=now();
    return jsonb_build_object('ok',true,'action',p_action);
  end if;

  if p_action='save_notifications' then
    if p_branch_id is null then raise exception using errcode='22023',message='branch_required'; end if;
    insert into public.tenant_pos_notification_settings(
      tenant_id,branch_id,table_qr_popup_enabled,table_qr_sound_enabled,
      table_qr_sound_volume,table_qr_popup_store_enabled,
      table_qr_kitchen_auto_send_enabled,table_qr_kitchen_auto_print_enabled,updated_by
    )
    values(
      p_tenant_id,p_branch_id,
      coalesce((p_payload->>'table_qr_popup_enabled')::boolean,true),
      coalesce((p_payload->>'table_qr_sound_enabled')::boolean,true),
      greatest(0,least(1,coalesce((p_payload->>'table_qr_sound_volume')::numeric,1))),
      coalesce((p_payload->>'table_qr_popup_store_enabled')::boolean,true),
      coalesce((p_payload->>'table_qr_kitchen_auto_send_enabled')::boolean,false),
      coalesce((p_payload->>'table_qr_kitchen_auto_print_enabled')::boolean,false),
      v_actor
    )
    on conflict(tenant_id,branch_id) do update
    set table_qr_popup_enabled=excluded.table_qr_popup_enabled,
        table_qr_sound_enabled=excluded.table_qr_sound_enabled,
        table_qr_sound_volume=excluded.table_qr_sound_volume,
        table_qr_popup_store_enabled=excluded.table_qr_popup_store_enabled,
        table_qr_kitchen_auto_send_enabled=excluded.table_qr_kitchen_auto_send_enabled,
        table_qr_kitchen_auto_print_enabled=excluded.table_qr_kitchen_auto_print_enabled,
        updated_by=v_actor,
        updated_at=now();
    return jsonb_build_object('ok',true,'action',p_action);
  end if;

  raise exception using errcode='22023',message='unsupported_setting_action';

exception
  when unique_violation then
    raise exception using errcode='23505',message='setting_conflict';
end;
$function$;

CREATE OR REPLACE FUNCTION public.customer_portal_settings_snapshot(p_tenant_id uuid, p_branch_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
  v_is_owner boolean := false;
begin
  if not app.customer_portal_actor_can_manage(p_tenant_id,p_branch_id) then
    raise exception using errcode='42501',message='customer_portal_forbidden';
  end if;

  select exists(
    select 1 from public.user_branch_roles
    where user_id=v_actor and tenant_id=p_tenant_id and role::text='owner'
  ) into v_is_owner;

  return jsonb_build_object(
    'store',(
      select to_jsonb(t) from (
        select id,code,name,display_name,logo_url,company_address,contact_phone,owner_phone
        from public.tenants where id=p_tenant_id
      ) t
    ),
    'branches',coalesce((
      select jsonb_agg(to_jsonb(b) order by b.name)
      from (
        select id,code,name,address,is_active
        from public.branches
        where tenant_id=p_tenant_id
          and (v_is_owner or id=p_branch_id)
      ) b
    ),'[]'::jsonb),
    'devices',coalesce((
      select jsonb_agg(to_jsonb(d) order by d.device_code)
      from (
        select id,branch_id,device_code,device_name,device_type,status,is_locked,last_seen_at,is_active
        from public.branch_devices
        where tenant_id=p_tenant_id
          and (p_branch_id is null or branch_id=p_branch_id)
      ) d
    ),'[]'::jsonb),
    'payment_accounts',coalesce((
      select jsonb_agg(to_jsonb(a) order by a.is_active desc,a.bank_name)
      from (
        select id,branch_id,bank_name,account_name,account_number,promptpay_phone,qr_image_url,
          qr_mode,applies_to_all_branches,is_active
        from public.tenant_payment_accounts
        where tenant_id=p_tenant_id
          and (v_is_owner or branch_id=p_branch_id or branch_id is null or applies_to_all_branches=true)
      ) a
    ),'[]'::jsonb),
    'tax_settings',coalesce((
      select jsonb_agg(to_jsonb(x))
      from (
        select id,branch_id,is_enabled,calculation_base,settings,updated_at
        from public.tenant_tax_settings
        where tenant_id=p_tenant_id
          and (p_branch_id is null or branch_id=p_branch_id)
      ) x
    ),'[]'::jsonb),
    'notifications',coalesce((
      select jsonb_agg(to_jsonb(n))
      from (
        select tenant_id,branch_id,table_qr_popup_enabled,table_qr_sound_enabled,
          table_qr_sound_volume,table_qr_popup_store_enabled,
          table_qr_kitchen_auto_send_enabled,table_qr_kitchen_auto_print_enabled,updated_at
        from public.tenant_pos_notification_settings
        where tenant_id=p_tenant_id
          and (p_branch_id is null or branch_id=p_branch_id)
      ) n
    ),'[]'::jsonb),
    'is_owner',v_is_owner
  );
end;
$function$;

revoke all on function public.customer_portal_billing_overview(uuid) from public,anon;
grant execute on function public.customer_portal_billing_overview(uuid) to authenticated;
revoke all on function public.customer_portal_feature_state(uuid,uuid) from public,anon;
grant execute on function public.customer_portal_feature_state(uuid,uuid) to authenticated;
revoke all on function public.customer_portal_settings_snapshot(uuid,uuid) from public,anon;
grant execute on function public.customer_portal_settings_snapshot(uuid,uuid) to authenticated;
revoke all on function public.customer_portal_more_snapshot(uuid,uuid) from public,anon;
grant execute on function public.customer_portal_more_snapshot(uuid,uuid) to authenticated;
revoke all on function public.customer_portal_save_setting(uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.customer_portal_save_setting(uuid,uuid,text,jsonb) to authenticated;
