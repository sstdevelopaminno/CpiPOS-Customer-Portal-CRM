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

CREATE OR REPLACE FUNCTION public.customer_portal_dashboard_v2(p_tenant_id uuid, p_branch_id uuid, p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
  v_is_owner boolean := false;
  v_sales numeric := 0;
  v_orders bigint := 0;
  v_products bigint := 0;
  v_branches bigint := 0;
  v_low_stock bigint := 0;
  v_open_shifts bigint := 0;
  v_top_products jsonb := '[]'::jsonb;
begin
  if p_from is null or p_to is null or p_from >= p_to or p_to - p_from > interval '366 days' then
    raise exception using errcode='22023', message='invalid_report_range';
  end if;

  if not app.customer_portal_actor_can_manage(p_tenant_id,p_branch_id) then
    raise exception using errcode='42501',message='customer_portal_forbidden';
  end if;

  select exists(
    select 1 from public.user_branch_roles actor
    where actor.user_id=v_actor
      and actor.tenant_id=p_tenant_id
      and actor.role::text='owner'
  ) into v_is_owner;

  select coalesce(sum(coalesce(o.grand_total,o.total_amount,0)),0),count(*)
  into v_sales,v_orders
  from public.orders o
  where o.tenant_id=p_tenant_id
    and (p_branch_id is null or o.branch_id=p_branch_id)
    and (
      v_is_owner or exists(
        select 1 from public.user_branch_roles actor
        where actor.user_id=v_actor
          and actor.tenant_id=p_tenant_id
          and actor.branch_id=o.branch_id
          and actor.role::text='manager'
      )
    )
    and o.status::text='completed'
    and o.created_at>=p_from
    and o.created_at<p_to;

  select count(*) into v_products
  from public.products p
  where p.tenant_id=p_tenant_id
    and (p_branch_id is null or p.branch_id=p_branch_id)
    and (
      v_is_owner or exists(
        select 1 from public.user_branch_roles actor
        where actor.user_id=v_actor
          and actor.tenant_id=p_tenant_id
          and actor.branch_id=p.branch_id
          and actor.role::text='manager'
      )
    )
    and p.is_active=true
    and p.deleted_at is null;

  select count(*) into v_branches
  from public.branches b
  where b.tenant_id=p_tenant_id
    and (p_branch_id is null or b.id=p_branch_id)
    and (
      v_is_owner or exists(
        select 1 from public.user_branch_roles actor
        where actor.user_id=v_actor
          and actor.tenant_id=p_tenant_id
          and actor.branch_id=b.id
          and actor.role::text='manager'
      )
    )
    and b.is_active=true;

  select count(*) into v_low_stock
  from public.ingredients i
  where i.tenant_id=p_tenant_id
    and (p_branch_id is null or i.branch_id=p_branch_id)
    and (
      v_is_owner or exists(
        select 1 from public.user_branch_roles actor
        where actor.user_id=v_actor
          and actor.tenant_id=p_tenant_id
          and actor.branch_id=i.branch_id
          and actor.role::text='manager'
      )
    )
    and i.reorder_level is not null
    and i.quantity_on_hand<=i.reorder_level;

  select count(*) into v_open_shifts
  from public.shifts s
  where s.tenant_id=p_tenant_id
    and (p_branch_id is null or s.branch_id=p_branch_id)
    and (
      v_is_owner or exists(
        select 1 from public.user_branch_roles actor
        where actor.user_id=v_actor
          and actor.tenant_id=p_tenant_id
          and actor.branch_id=s.branch_id
          and actor.role::text='manager'
      )
    )
    and s.status::text='open';

  select coalesce(jsonb_agg(to_jsonb(r) order by r.sales_total desc,r.quantity desc),'[]'::jsonb)
  into v_top_products
  from (
    select
      coalesce(nullif(oi.name,''),nullif(p.name,''),'สินค้า')::text as name,
      sum(coalesce(oi.quantity,0))::numeric as quantity,
      sum(coalesce(oi.line_total,0))::numeric as sales_total
    from public.order_items oi
    join public.orders o
      on o.id=oi.order_id
     and o.tenant_id=oi.tenant_id
     and o.branch_id=oi.branch_id
    left join public.products p on p.id=oi.product_id
    where o.tenant_id=p_tenant_id
      and (p_branch_id is null or o.branch_id=p_branch_id)
      and (
        v_is_owner or exists(
          select 1 from public.user_branch_roles actor
          where actor.user_id=v_actor
            and actor.tenant_id=p_tenant_id
            and actor.branch_id=o.branch_id
            and actor.role::text='manager'
        )
      )
      and o.status::text='completed'
      and o.created_at>=p_from
      and o.created_at<p_to
    group by coalesce(nullif(oi.name,''),nullif(p.name,''),'สินค้า')
    order by sales_total desc,quantity desc
    limit 8
  ) r;

  return jsonb_build_object(
    'sales_total',v_sales,
    'order_count',v_orders,
    'average_ticket',case when v_orders>0 then round(v_sales/v_orders,2) else 0 end,
    'active_products',v_products,
    'active_branches',v_branches,
    'low_stock_count',v_low_stock,
    'open_shifts',v_open_shifts,
    'top_products',v_top_products,
    'from',p_from,
    'to',p_to,
    'branch_id',p_branch_id
  );
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
    'tables_count',(
      select count(*) from public.dining_tables x
      where x.tenant_id=p_tenant_id and (p_branch_id is null or x.branch_id=p_branch_id)
        and (v_is_owner or exists(select 1 from public.user_branch_roles a where a.user_id=v_actor and a.tenant_id=p_tenant_id and a.branch_id=x.branch_id and a.role::text='manager'))
        and coalesce(x.is_active,true)
    ),
    'kitchen_zones_count',(
      select count(*) from public.kitchen_zones x
      where x.tenant_id=p_tenant_id and (p_branch_id is null or x.branch_id=p_branch_id)
        and (v_is_owner or exists(select 1 from public.user_branch_roles a where a.user_id=v_actor and a.tenant_id=p_tenant_id and a.branch_id=x.branch_id and a.role::text='manager'))
        and coalesce(x.is_active,true)
    ),
    'kitchen_rules_count',(
      select count(*) from public.kitchen_routing_rules x
      where x.tenant_id=p_tenant_id and (p_branch_id is null or x.branch_id=p_branch_id)
        and (v_is_owner or exists(select 1 from public.user_branch_roles a where a.user_id=v_actor and a.tenant_id=p_tenant_id and a.branch_id=x.branch_id and a.role::text='manager'))
        and coalesce(x.is_active,true)
    ),
    'members_count',(
      select count(*) from public.mobile_members x
      where x.tenant_id=p_tenant_id and (p_branch_id is null or x.branch_id=p_branch_id)
        and (v_is_owner or exists(select 1 from public.user_branch_roles a where a.user_id=v_actor and a.tenant_id=p_tenant_id and a.branch_id=x.branch_id and a.role::text='manager'))
    ),
    'tax_invoices_count',(
      select count(*) from public.pos_tax_invoices x
      where x.tenant_id=p_tenant_id and (p_branch_id is null or x.branch_id=p_branch_id)
        and (v_is_owner or exists(select 1 from public.user_branch_roles a where a.user_id=v_actor and a.tenant_id=p_tenant_id and a.branch_id=x.branch_id and a.role::text='manager'))
    ),
    'ai_documents_count',(
      select count(*) from public.pos_ai_documents x
      where x.tenant_id=p_tenant_id and (p_branch_id is null or x.branch_id=p_branch_id)
        and (v_is_owner or exists(select 1 from public.user_branch_roles a where a.user_id=v_actor and a.tenant_id=p_tenant_id and a.branch_id=x.branch_id and a.role::text='manager'))
    ),
    'printers_count',(
      select count(*) from public.printer_devices x
      where x.tenant_id=p_tenant_id and (p_branch_id is null or x.branch_id=p_branch_id)
        and (v_is_owner or exists(select 1 from public.user_branch_roles a where a.user_id=v_actor and a.tenant_id=p_tenant_id and a.branch_id=x.branch_id and a.role::text='manager'))
        and coalesce(x.is_active,true)
    ),
    'display_pairings_count',(
      select count(*) from public.pos_customer_display_pairings x
      where x.tenant_id=p_tenant_id and (p_branch_id is null or x.branch_id=p_branch_id)
        and (v_is_owner or exists(select 1 from public.user_branch_roles a where a.user_id=v_actor and a.tenant_id=p_tenant_id and a.branch_id=x.branch_id and a.role::text='manager'))
        and coalesce(x.is_active,true)
    ),
    'audit_count',(
      select count(*) from public.audit_logs x
      where x.tenant_id=p_tenant_id and (p_branch_id is null or x.branch_id=p_branch_id)
        and (v_is_owner or exists(select 1 from public.user_branch_roles a where a.user_id=v_actor and a.tenant_id=p_tenant_id and a.branch_id=x.branch_id and a.role::text='manager'))
    )
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
        p_tenant_id,upper(btrim(p_payload->>'code')),btrim(p_payload->>'name'),
        nullif(btrim(coalesce(p_payload->>'address','')),''),
        coalesce((p_payload->>'is_active')::boolean,true)
      ) returning id into v_id;
    else
      v_id=(p_payload->>'id')::uuid;
      update public.branches
      set code=upper(btrim(p_payload->>'code')),
          name=btrim(p_payload->>'name'),
          address=nullif(btrim(coalesce(p_payload->>'address','')),''),
          is_active=coalesce((p_payload->>'is_active')::boolean,is_active),
          updated_at=now()
      where id=v_id and tenant_id=p_tenant_id;
      if not found then raise exception using errcode='P0002',message='branch_not_found'; end if;
    end if;
    if nullif(p_payload->>'id','') is null then
      insert into public.user_branch_roles(user_id,tenant_id,branch_id,role,is_default)
      values(v_actor,p_tenant_id,v_id,'owner'::public.branch_role,false)
      on conflict(user_id,tenant_id,branch_id) do update
      set role='owner'::public.branch_role;
    end if;
    return jsonb_build_object('ok',true,'id',v_id,'action',p_action);
  end if;

  if p_action='save_payment_account' then
    if not v_is_owner then
      raise exception using errcode='42501',message='owner_required';
    end if;
    if p_branch_id is null then
      raise exception using errcode='22023',message='branch_required';
    end if;
    if btrim(coalesce(p_payload->>'bank_name',''))='' or btrim(coalesce(p_payload->>'account_name',''))='' then
      raise exception using errcode='22023',message='invalid_payment_account';
    end if;
    if coalesce(nullif(p_payload->>'qr_mode',''),'promptpay_link')='promptpay_link'
       and regexp_replace(coalesce(p_payload->>'promptpay_phone',''),'[^0-9]','','g')='' then
      raise exception using errcode='22023',message='promptpay_required';
    end if;
    if coalesce(nullif(p_payload->>'qr_mode',''),'promptpay_link')='qr_image'
       and btrim(coalesce(p_payload->>'qr_image_url',''))='' then
      raise exception using errcode='22023',message='qr_image_required';
    end if;

    v_id=nullif(p_payload->>'id','')::uuid;

    if coalesce((p_payload->>'is_active')::boolean,true) then
      update public.tenant_payment_accounts
      set is_active=false,updated_at=now()
      where tenant_id=p_tenant_id
        and is_active=true
        and (v_id is null or id<>v_id)
        and (
          coalesce((p_payload->>'applies_to_all_branches')::boolean,false)
          or branch_id=p_branch_id
          or applies_to_all_branches=true
        );
    end if;

    if v_id is null then
      insert into public.tenant_payment_accounts(
        tenant_id,branch_id,bank_name,account_name,account_number,promptpay_phone,promptpay_payload,
        qr_image_url,qr_mode,applies_to_all_branches,is_active,created_by
      )
      values(
        p_tenant_id,p_branch_id,btrim(p_payload->>'bank_name'),
        btrim(p_payload->>'account_name'),
        nullif(btrim(coalesce(p_payload->>'account_number','')),''),
        nullif(regexp_replace(coalesce(p_payload->>'promptpay_phone',''),'[^0-9]','','g'),''),
        case when regexp_replace(coalesce(p_payload->>'promptpay_phone',''),'[^0-9]','','g')=''
          then null else 'https://promptpay.io/'||regexp_replace(coalesce(p_payload->>'promptpay_phone',''),'[^0-9]','','g') end,
        nullif(btrim(coalesce(p_payload->>'qr_image_url','')),''),
        coalesce(nullif(p_payload->>'qr_mode',''),'promptpay_link'),
        coalesce((p_payload->>'applies_to_all_branches')::boolean,false),
        coalesce((p_payload->>'is_active')::boolean,true),
        v_actor
      ) returning id into v_id;
    else
      update public.tenant_payment_accounts
      set branch_id=p_branch_id,
          bank_name=btrim(p_payload->>'bank_name'),
          account_name=btrim(p_payload->>'account_name'),
          account_number=nullif(btrim(coalesce(p_payload->>'account_number','')),''),
          promptpay_phone=nullif(regexp_replace(coalesce(p_payload->>'promptpay_phone',''),'[^0-9]','','g'),''),
          promptpay_payload=case when regexp_replace(coalesce(p_payload->>'promptpay_phone',''),'[^0-9]','','g')=''
            then null else 'https://promptpay.io/'||regexp_replace(coalesce(p_payload->>'promptpay_phone',''),'[^0-9]','','g') end,
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
        select br.id,br.code,br.name,br.address,br.is_active
        from public.branches br
        where br.tenant_id=p_tenant_id
          and (p_branch_id is null or br.id=p_branch_id)
          and (
            v_is_owner or exists(
              select 1 from public.user_branch_roles actor
              where actor.user_id=v_actor
                and actor.tenant_id=p_tenant_id
                and actor.branch_id=br.id
                and actor.role::text='manager'
            )
          )
      ) b
    ),'[]'::jsonb),
    'devices',coalesce((
      select jsonb_agg(to_jsonb(d) order by d.device_code)
      from (
        select bd.id,bd.branch_id,bd.device_code,bd.device_name,bd.device_type,bd.status,
          bd.is_locked,bd.last_seen_at,bd.is_active
        from public.branch_devices bd
        where bd.tenant_id=p_tenant_id
          and (p_branch_id is null or bd.branch_id=p_branch_id)
          and (
            v_is_owner or exists(
              select 1 from public.user_branch_roles actor
              where actor.user_id=v_actor
                and actor.tenant_id=p_tenant_id
                and actor.branch_id=bd.branch_id
                and actor.role::text='manager'
            )
          )
      ) d
    ),'[]'::jsonb),
    'payment_accounts',coalesce((
      select jsonb_agg(to_jsonb(a) order by a.is_active desc,a.bank_name)
      from (
        select pa.id,pa.branch_id,pa.bank_name,pa.account_name,pa.account_number,pa.promptpay_phone,
          pa.qr_image_url,pa.qr_mode,pa.applies_to_all_branches,pa.is_active
        from public.tenant_payment_accounts pa
        where pa.tenant_id=p_tenant_id
          and (
            v_is_owner
            or pa.applies_to_all_branches=true
            or pa.branch_id is null
            or exists(
              select 1 from public.user_branch_roles actor
              where actor.user_id=v_actor
                and actor.tenant_id=p_tenant_id
                and actor.branch_id=pa.branch_id
                and actor.role::text='manager'
            )
          )
          and (
            p_branch_id is null
            or pa.applies_to_all_branches=true
            or pa.branch_id is null
            or pa.branch_id=p_branch_id
          )
      ) a
    ),'[]'::jsonb),
    'tax_settings',coalesce((
      select jsonb_agg(to_jsonb(x))
      from (
        select ts.id,ts.branch_id,ts.is_enabled,ts.calculation_base,ts.settings,ts.updated_at
        from public.tenant_tax_settings ts
        where ts.tenant_id=p_tenant_id
          and (p_branch_id is null or ts.branch_id=p_branch_id)
          and (
            v_is_owner or exists(
              select 1 from public.user_branch_roles actor
              where actor.user_id=v_actor
                and actor.tenant_id=p_tenant_id
                and actor.branch_id=ts.branch_id
                and actor.role::text='manager'
            )
          )
      ) x
    ),'[]'::jsonb),
    'notifications',coalesce((
      select jsonb_agg(to_jsonb(n))
      from (
        select ns.tenant_id,ns.branch_id,ns.table_qr_popup_enabled,ns.table_qr_sound_enabled,
          ns.table_qr_sound_volume,ns.table_qr_popup_store_enabled,
          ns.table_qr_kitchen_auto_send_enabled,ns.table_qr_kitchen_auto_print_enabled,ns.updated_at
        from public.tenant_pos_notification_settings ns
        where ns.tenant_id=p_tenant_id
          and (p_branch_id is null or ns.branch_id=p_branch_id)
          and (
            v_is_owner or exists(
              select 1 from public.user_branch_roles actor
              where actor.user_id=v_actor
                and actor.tenant_id=p_tenant_id
                and actor.branch_id=ns.branch_id
                and actor.role::text='manager'
            )
          )
      ) n
    ),'[]'::jsonb),
    'is_owner',v_is_owner
  );
end;
$function$;

revoke all on function public.customer_portal_dashboard_v2(uuid,uuid,timestamptz,timestamptz) from public,anon;
grant execute on function public.customer_portal_dashboard_v2(uuid,uuid,timestamptz,timestamptz) to authenticated;
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
