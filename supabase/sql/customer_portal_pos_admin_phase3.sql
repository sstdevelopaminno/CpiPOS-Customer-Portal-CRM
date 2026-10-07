-- Customer Portal POS administration phase 3. Applied to CpiPOS-001.\n\nCREATE OR REPLACE FUNCTION app.customer_portal_thai_tax_id_valid(p_value text)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v text := regexp_replace(coalesce(p_value,''),'[^0-9]','','g');
  v_sum integer := 0;
  i integer;
begin
  if v !~ '^[0-9]{13}$' then return false; end if;
  for i in 1..12 loop
    v_sum := v_sum + substr(v,i,1)::integer * (14-i);
  end loop;
  return ((11-(v_sum % 11)) % 10) = substr(v,13,1)::integer;
end
$function$;\n\nCREATE OR REPLACE FUNCTION app.customer_portal_verify_manager_pin(p_tenant_id uuid, p_branch_id uuid, p_pin text)
 RETURNS TABLE(user_id uuid, role text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'app', 'extensions'
AS $function$
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='customer_portal_unauthenticated';
  end if;
  if app.customer_portal_actor_role(p_tenant_id,p_branch_id) is null then
    raise exception using errcode='42501', message='customer_portal_forbidden';
  end if;
  if length(btrim(coalesce(p_pin,''))) < 4 then
    return;
  end if;

  return query
  select ubr.user_id, ubr.role::text
  from public.user_branch_roles ubr
  join public.users_profiles up on up.id=ubr.user_id
  where ubr.tenant_id=p_tenant_id
    and ubr.branch_id=p_branch_id
    and ubr.role::text in ('owner','manager')
    and up.is_active=true
    and up.pin_hash is not null
    and extensions.crypt(btrim(p_pin),up.pin_hash)=up.pin_hash
  order by case when ubr.role::text='owner' then 0 else 1 end
  limit 1;
end
$function$;\n\nCREATE OR REPLACE FUNCTION public.customer_portal_pos_admin_phase3_mutate(p_tenant_id uuid, p_branch_id uuid, p_action text, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'app', 'extensions'
AS $function$
declare
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_feature text;
  v_menu text;
  v_result jsonb := '{}'::jsonb;
  v_id uuid;
  v_row record;
  v_existing record;
  v_environment text;
  v_merchant_id text;
  v_is_active boolean;
  v_override_popup text;
  v_override_send text;
  v_override_print text;
  v_store_popup boolean;
  v_store_send boolean;
  v_store_print boolean;
  v_effective_popup boolean;
  v_table_id uuid;
  v_mode text;
  v_ttl integer;
  v_current_policy jsonb;
  v_next_policy jsonb;
  v_revoked integer := 0;
  v_tax_id text;
  v_seller_name text;
  v_seller_address text;
  v_branch_no text;
  v_settings jsonb;
  v_profile_id uuid;
  v_order_id uuid;
  v_approver uuid;
  v_approver_role text;
  v_profile record;
  v_order record;
  v_tenant record;
  v_tax record;
  v_seller jsonb;
  v_buyer jsonb;
  v_order_snapshot jsonb;
  v_tax_snapshot jsonb;
  v_items jsonb;
  v_payments jsonb;
  v_invoice_no text;
  v_invoice record;
begin
  if v_actor is null then raise exception using errcode='42501',message='customer_portal_unauthenticated'; end if;
  if p_branch_id is null then raise exception using errcode='22023',message='branch_required'; end if;
  v_actor_role:=app.customer_portal_actor_role(p_tenant_id,p_branch_id);
  if v_actor_role is null then raise exception using errcode='42501',message='customer_portal_forbidden'; end if;

  if p_action='inet.save' then v_feature:='inet_nops_qr'; v_menu:='settings.inet_nops';
  elsif p_action='order_kitchen.save' then v_feature:='kitchen_printing'; v_menu:='settings.order_kitchen';
  elsif p_action='table_qr.policy.save' then v_feature:='qr_table_ordering'; v_menu:='settings.table_qr';
  elsif p_action like 'tax_invoice.%' then v_feature:='core_pos_sales'; v_menu:='more.tax_invoices';
  else raise exception using errcode='22023',message='unsupported_pos_admin_action';
  end if;

  if not app.customer_portal_module_allowed(p_tenant_id,p_branch_id,v_feature,v_menu) then
    raise exception using errcode='42501',message='feature_not_enabled';
  end if;

  if p_action='inet.save' then
    v_environment:=lower(btrim(coalesce(p_payload->>'environment','uat')));
    if v_environment not in ('uat','production') then raise exception using errcode='22023',message='invalid_inet_environment'; end if;
    v_merchant_id:=btrim(coalesce(p_payload->>'merchant_id',''));
    v_is_active:=coalesce((p_payload->>'is_active')::boolean,false);
    if v_is_active and v_environment='production' and v_merchant_id='' then
      raise exception using errcode='22023',message='inet_merchant_id_required';
    end if;

    select * into v_existing
    from public.pos_payment_provider_settings
    where tenant_id=p_tenant_id and branch_id=p_branch_id and provider='inet_nops'
    order by updated_at desc limit 1;
    v_id:=v_existing.id;

    if v_is_active then
      update public.pos_payment_provider_settings
      set is_active=false,connection_status='disabled',updated_at=now()
      where tenant_id=p_tenant_id and branch_id=p_branch_id and provider='inet_nops'
        and is_active=true and (v_id is null or id<>v_id);
    end if;

    if v_id is not null then
      update public.pos_payment_provider_settings
      set environment=v_environment,merchant_id=nullif(v_merchant_id,''),is_active=v_is_active,
          connection_status=case
            when not v_is_active then 'disabled'
            when environment<>v_environment or coalesce(merchant_id,'')<>v_merchant_id then 'not_configured'
            else coalesce(connection_status,'not_configured') end,
          last_connection_error=case when not v_is_active then null else last_connection_error end,
          updated_at=now()
      where id=v_existing.id returning * into v_row;
    else
      insert into public.pos_payment_provider_settings(
        tenant_id,branch_id,provider,environment,merchant_id,is_active,connection_status,metadata
      ) values(
        p_tenant_id,p_branch_id,'inet_nops',v_environment,nullif(v_merchant_id,''),v_is_active,
        case when v_is_active then 'not_configured' else 'disabled' end,
        jsonb_build_object('managed_from','customer_portal')
      ) returning * into v_row;
    end if;
    v_id:=v_row.id;
    v_result:=jsonb_build_object(
      'settings',to_jsonb(v_row),
      'provider_test_available',false,
      'provider_test_note','บันทึกค่าแล้ว การทดสอบ Merchant Key/Callback ทำผ่าน POS server'
    );

  elsif p_action='order_kitchen.save' then
    select coalesce(table_qr_popup_override,'inherit'),
           coalesce(table_qr_kitchen_auto_send_override,'inherit'),
           coalesce(table_qr_kitchen_auto_print_override,'inherit'),
           coalesce(table_qr_popup_store_enabled,table_qr_popup_enabled,true),
           coalesce(table_qr_kitchen_auto_send_enabled,true),
           coalesce(table_qr_kitchen_auto_print_enabled,true)
    into v_override_popup,v_override_send,v_override_print,v_store_popup,v_store_send,v_store_print
    from public.tenant_pos_notification_settings
    where tenant_id=p_tenant_id and branch_id=p_branch_id;

    if not found then
      v_override_popup:='inherit';v_override_send:='inherit';v_override_print:='inherit';
      v_store_popup:=true;v_store_send:=true;v_store_print:=true;
    end if;
    v_store_popup:=coalesce((p_payload->>'popup_enabled')::boolean,v_store_popup);
    v_store_send:=coalesce((p_payload->>'kitchen_auto_send_enabled')::boolean,v_store_send);
    v_store_print:=coalesce((p_payload->>'kitchen_auto_print_enabled')::boolean,v_store_print);
    v_effective_popup:=case v_override_popup when 'force_on' then true when 'force_off' then false else v_store_popup end;

    insert into public.tenant_pos_notification_settings(
      tenant_id,branch_id,table_qr_popup_enabled,table_qr_popup_store_enabled,
      table_qr_kitchen_auto_send_enabled,table_qr_kitchen_auto_print_enabled,
      updated_at,updated_by
    ) values(
      p_tenant_id,p_branch_id,v_effective_popup,v_store_popup,v_store_send,v_store_print,now(),v_actor
    )
    on conflict(tenant_id,branch_id) do update set
      table_qr_popup_enabled=excluded.table_qr_popup_enabled,
      table_qr_popup_store_enabled=excluded.table_qr_popup_store_enabled,
      table_qr_kitchen_auto_send_enabled=excluded.table_qr_kitchen_auto_send_enabled,
      table_qr_kitchen_auto_print_enabled=excluded.table_qr_kitchen_auto_print_enabled,
      updated_at=excluded.updated_at,updated_by=excluded.updated_by;

    v_result:=jsonb_build_object(
      'store',jsonb_build_object('popup_enabled',v_store_popup,'kitchen_auto_send_enabled',v_store_send,'kitchen_auto_print_enabled',v_store_print),
      'override',jsonb_build_object('popup',v_override_popup,'kitchen_auto_send',v_override_send,'kitchen_auto_print',v_override_print),
      'effective',jsonb_build_object(
        'popup_enabled',v_effective_popup,
        'kitchen_auto_send_enabled',case v_override_send when 'force_on' then true when 'force_off' then false else v_store_send end,
        'kitchen_auto_print_enabled',case v_override_print when 'force_on' then true when 'force_off' then false else v_store_print end
      )
    );

  elsif p_action='table_qr.policy.save' then
    v_table_id:=nullif(p_payload->>'table_id','')::uuid;
    v_mode:=lower(btrim(coalesce(p_payload->>'mode','')));
    if v_table_id is null then raise exception using errcode='22023',message='invalid_table_id'; end if;
    if v_mode not in ('time','bill') then raise exception using errcode='22023',message='invalid_qr_policy_mode'; end if;
    if v_mode='time' then
      v_ttl:=coalesce((p_payload->>'ttl_minutes')::integer,0);
      if v_ttl<15 or v_ttl>1440 then raise exception using errcode='22023',message='invalid_qr_policy_ttl'; end if;
    else v_ttl:=null;
    end if;
    select * into v_existing from public.dining_tables
    where tenant_id=p_tenant_id and branch_id=p_branch_id and id=v_table_id and is_active=true;
    if not found then raise exception using errcode='P0002',message='table_not_found'; end if;

    v_current_policy:=case
      when v_existing.metadata->'qr_policy'->>'mode'='bill' then jsonb_build_object('version',1,'mode','bill','ttl_minutes',null)
      when coalesce(v_existing.metadata->'qr_policy'->>'ttl_minutes','') ~ '^\d+$'
        and (v_existing.metadata->'qr_policy'->>'ttl_minutes')::integer between 15 and 1440
      then jsonb_build_object('version',1,'mode','time','ttl_minutes',(v_existing.metadata->'qr_policy'->>'ttl_minutes')::integer)
      else jsonb_build_object('version',1,'mode','time','ttl_minutes',1080) end;
    v_next_policy:=jsonb_build_object('version',1,'mode',v_mode,'ttl_minutes',v_ttl);

    if v_current_policy<>v_next_policy then
      update public.table_qr_sessions
      set status='revoked',revoked_at=now(),updated_at=now()
      where tenant_id=p_tenant_id and branch_id=p_branch_id and table_id=v_table_id and status='active';
      get diagnostics v_revoked = row_count;
      update public.dining_tables
      set metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('qr_policy',v_next_policy),updated_at=now()
      where id=v_table_id;
    end if;
    v_id:=v_table_id;
    v_result:=jsonb_build_object('table_id',v_table_id,'policy',v_next_policy,'revoked_active_sessions',v_revoked,'changed',v_current_policy<>v_next_policy);

  elsif p_action='tax_invoice.seller.save' then
    v_tax_id:=regexp_replace(coalesce(p_payload->>'seller_tax_id',''),'[^0-9]','','g');
    v_seller_name:=btrim(coalesce(p_payload->>'seller_display_name',''));
    v_seller_address:=btrim(coalesce(p_payload->>'seller_address',''));
    v_branch_no:=regexp_replace(coalesce(p_payload->>'seller_branch_no',''),'[^0-9]','','g');
    if not app.customer_portal_thai_tax_id_valid(v_tax_id) then raise exception using errcode='22023',message='seller_tax_id_invalid'; end if;
    if v_seller_name='' or v_seller_address='' then raise exception using errcode='22023',message='seller_profile_incomplete'; end if;
    if v_branch_no<>'' and v_branch_no !~ '^[0-9]{5}$' then raise exception using errcode='22023',message='seller_branch_invalid'; end if;

    select coalesce(settings,'{}'::jsonb) into v_settings
    from public.tenant_tax_settings where tenant_id=p_tenant_id and branch_id=p_branch_id;
    v_settings:=coalesce(v_settings,'{}'::jsonb)||jsonb_build_object(
      'seller_tax_id',v_tax_id,'seller_display_name',v_seller_name,'seller_address',v_seller_address,'seller_branch_no',v_branch_no
    );
    insert into public.tenant_tax_settings(tenant_id,branch_id,is_enabled,calculation_base,settings,updated_at)
    values(p_tenant_id,p_branch_id,false,'net_after_discount',v_settings,now())
    on conflict(tenant_id,branch_id) do update set settings=excluded.settings,updated_at=now();
    v_result:=jsonb_build_object('saved',true,'seller',jsonb_build_object(
      'display_name',v_seller_name,'tax_id',v_tax_id,'branch_no',v_branch_no,'address',v_seller_address
    ));

  elsif p_action='tax_invoice.issue' then
    v_profile_id:=nullif(p_payload->>'profile_id','')::uuid;
    v_order_id:=nullif(p_payload->>'order_id','')::uuid;
    if v_profile_id is null or v_order_id is null then raise exception using errcode='22023',message='tax_invoice_selection_required'; end if;
    select x.user_id,x.role into v_approver,v_approver_role
    from app.customer_portal_verify_manager_pin(p_tenant_id,p_branch_id,btrim(coalesce(p_payload->>'manager_pin',''))) x limit 1;
    if v_approver is null then raise exception using errcode='42501',message='pin_rejected'; end if;

    select * into v_profile from public.pos_tax_invoice_profiles
    where tenant_id=p_tenant_id and branch_id=p_branch_id and id=v_profile_id and is_active=true;
    if not found then raise exception using errcode='P0002',message='tax_profile_not_found'; end if;

    select * into v_order from public.orders
    where tenant_id=p_tenant_id and branch_id=p_branch_id and id=v_order_id;
    if not found then raise exception using errcode='P0002',message='order_not_found'; end if;
    if v_order.status::text<>'completed' then raise exception using errcode='P0001',message='order_not_completed'; end if;

    select * into v_tenant from public.tenants where id=p_tenant_id;
    select * into v_tax from public.tenant_tax_settings where tenant_id=p_tenant_id and branch_id=p_branch_id;
    v_tax_id:=coalesce(v_tax.settings->>'seller_tax_id','');
    v_seller_name:=coalesce(nullif(btrim(v_tax.settings->>'seller_display_name'),''),nullif(btrim(v_tenant.display_name),''),v_tenant.name,'');
    v_seller_address:=coalesce(nullif(btrim(v_tax.settings->>'seller_address'),''),v_tenant.company_address,'');
    v_branch_no:=coalesce(v_tax.settings->>'seller_branch_no','');
    if not app.customer_portal_thai_tax_id_valid(v_tax_id) or v_seller_name='' or v_seller_address='' then
      raise exception using errcode='P0001',message='seller_tax_profile_required';
    end if;

    select * into v_invoice from public.pos_tax_invoices
    where tenant_id=p_tenant_id and branch_id=p_branch_id and order_id=v_order_id limit 1;
    if found then
      if v_invoice.profile_id<>v_profile_id then raise exception using errcode='23505',message='tax_invoice_already_issued'; end if;
      return jsonb_build_object('invoice_id',v_invoice.id,'invoice_no',v_invoice.invoice_no,'issued_at',v_invoice.issued_at,'already_issued',true,'print_required_in_pos',true);
    end if;

    v_buyer:=jsonb_build_object(
      'entity_type',v_profile.entity_type,'display_name',v_profile.display_name,'tax_id',v_profile.tax_id,
      'address_line',v_profile.address_line,'subdistrict',v_profile.subdistrict,'district',v_profile.district,
      'province',v_profile.province,'postal_code',v_profile.postal_code
    );
    v_seller:=jsonb_build_object(
      'display_name',v_seller_name,'tax_id',v_tax_id,'branch_no',v_branch_no,
      'address',v_seller_address,'phone',coalesce(v_tenant.contact_phone,'')
    );
    v_order_snapshot:=jsonb_build_object(
      'order_id',v_order.id,'order_no',v_order.order_no,'created_at',v_order.created_at,
      'paid_at',v_order.payment_completed_at,'subtotal',coalesce(v_order.subtotal,0),
      'discount_amount',coalesce(v_order.discount_amount,0),'tax_total',coalesce(v_order.tax_total,0),
      'grand_total',coalesce(v_order.grand_total,v_order.total_amount,0),'paid_total',coalesce(v_order.paid_total,0),
      'customer_name',v_order.customer_name
    );
    v_tax_snapshot:=jsonb_build_object(
      'source','order_snapshot','tax_total',coalesce(v_order.tax_total,0),
      'lines',case when jsonb_typeof(v_order.metadata->'tax_lines')='array' then v_order.metadata->'tax_lines' else '[]'::jsonb end,
      'warning',case when coalesce(v_order.tax_total,0)=0 and coalesce(jsonb_array_length(case when jsonb_typeof(v_order.metadata->'tax_lines')='array' then v_order.metadata->'tax_lines' else '[]'::jsonb end),0)=0
        then 'บิลนี้ไม่มีภาษีที่บันทึกไว้ ระบบจะไม่สมมติ VAT ย้อนหลัง' else null end
    );
    select coalesce(jsonb_agg(jsonb_build_object(
      'name',coalesce(oi.name,p.name,oi.product_id::text),'quantity',oi.quantity,'unit_price',oi.unit_price,
      'line_total',oi.line_total,'notes',oi.notes
    ) order by oi.created_at),'[]'::jsonb) into v_items
    from public.order_items oi left join public.products p on p.id=oi.product_id
    where oi.tenant_id=p_tenant_id and oi.branch_id=p_branch_id and oi.order_id=v_order_id
      and (upper(coalesce(v_tenant.code,'')) not like 'FF%' or coalesce(oi.unit_price,0)<>0);

    select coalesce(jsonb_agg(jsonb_build_object(
      'method',pay.method::text,'amount',pay.amount,'status',pay.status,'received_at',pay.received_at,'reference_no',pay.reference_no
    ) order by pay.received_at),'[]'::jsonb) into v_payments
    from public.payments pay where pay.tenant_id=p_tenant_id and pay.branch_id=p_branch_id and pay.order_id=v_order_id;

    v_invoice_no:='TAX-'||left(trim(both '-' from regexp_replace(upper(coalesce(v_order.order_no,'BILL')),'[^A-Z0-9ก-๙_-]+','-','g')),48);
    insert into public.pos_tax_invoices(
      tenant_id,branch_id,profile_id,order_id,invoice_no,buyer_snapshot,seller_snapshot,order_snapshot,
      tax_snapshot,items_snapshot,payments_snapshot,paper_width_mm,issued_by,metadata
    ) values(
      p_tenant_id,p_branch_id,v_profile_id,v_order_id,v_invoice_no,v_buyer,v_seller,v_order_snapshot,
      v_tax_snapshot,v_items,v_payments,58,v_approver,
      jsonb_build_object('source','customer_portal_tax_invoice_v1','requested_by',v_actor,'print_required_in_pos',true)
    ) returning * into v_invoice;
    v_id:=v_invoice.id;
    v_result:=jsonb_build_object('invoice_id',v_invoice.id,'invoice_no',v_invoice.invoice_no,'issued_at',v_invoice.issued_at,'already_issued',false,'print_required_in_pos',true);
  end if;

  insert into public.audit_logs(
    tenant_id,branch_id,actor_user_id,actor_role,action,target_table,target_id,metadata,
    user_id,role,module,entity_type,entity_id,new_value,override_by_user_id
  ) values(
    p_tenant_id,p_branch_id,v_actor,v_actor_role,
    'customer_portal_'||replace(p_action,'.','_'),
    case when p_action='inet.save' then 'pos_payment_provider_settings'
         when p_action='order_kitchen.save' then 'tenant_pos_notification_settings'
         when p_action='table_qr.policy.save' then 'dining_tables'
         when p_action='tax_invoice.seller.save' then 'tenant_tax_settings'
         else 'pos_tax_invoices' end,
    v_id,
    jsonb_build_object('source','customer_portal','payload',coalesce(p_payload,'{}'::jsonb)),
    v_actor,v_actor_role,'customer_portal',split_part(p_action,'.',1),v_id::text,v_result,
    case when p_action='tax_invoice.issue' then v_approver else null end
  );
  return coalesce(v_result,'{}'::jsonb);
end
$function$;\n\nCREATE OR REPLACE FUNCTION public.customer_portal_pos_admin_phase3_snapshot(p_tenant_id uuid, p_branch_id uuid, p_module text, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'app', 'extensions'
AS $function$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_feature text;
  v_menu text;
  v_result jsonb;
  v_period text := lower(coalesce(nullif(btrim(p_payload->>'period'),''),'day'));
  v_date text := btrim(coalesce(p_payload->>'date',''));
  v_from timestamptz;
  v_to timestamptz;
  v_start_date date;
  v_end_date date;
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
  v_page integer := greatest(1,coalesce((p_payload->>'page')::integer,1));
  v_page_size integer := least(50,greatest(7,coalesce((p_payload->>'page_size')::integer,20)));
  v_offset integer;
  v_search text := btrim(coalesce(p_payload->>'search',p_payload->>'q',''));
  v_status text := lower(btrim(coalesce(p_payload->>'status','all')));
  v_module_filter text := btrim(coalesce(p_payload->>'module_filter',''));
  v_total bigint := 0;
  v_pin text := btrim(coalesce(p_payload->>'manager_pin',''));
  v_approver uuid;
  v_approver_role text;
begin
  if v_actor is null then
    raise exception using errcode='42501',message='customer_portal_unauthenticated';
  end if;
  if p_branch_id is null then
    raise exception using errcode='22023',message='branch_required';
  end if;
  v_role := app.customer_portal_actor_role(p_tenant_id,p_branch_id);
  if v_role is null then
    raise exception using errcode='42501',message='customer_portal_forbidden';
  end if;

  case p_module
    when 'activity' then v_feature:='core_pos_sales'; v_menu:='settings.activity';
    when 'inet' then v_feature:='inet_nops_qr'; v_menu:='settings.inet_nops';
    when 'order_kitchen' then v_feature:='kitchen_printing'; v_menu:='settings.order_kitchen';
    when 'table_qr' then v_feature:='qr_table_ordering'; v_menu:='settings.table_qr';
    when 'receipts' then v_feature:='receipt_reprint_history'; v_menu:='more.receipts';
    when 'tax_invoices' then v_feature:='core_pos_sales'; v_menu:='more.tax_invoices';
    when 'product_sales' then v_feature:='advanced_sales_reports'; v_menu:='more.product_sales';
    else raise exception using errcode='22023',message='unsupported_pos_admin_module';
  end case;

  if not app.customer_portal_module_allowed(p_tenant_id,p_branch_id,v_feature,v_menu) then
    raise exception using errcode='42501',message='feature_not_enabled';
  end if;

  if v_period='custom'
     and coalesce(p_payload->>'from','') ~ '^\d{4}-\d{2}-\d{2}$'
     and coalesce(p_payload->>'to','') ~ '^\d{4}-\d{2}-\d{2}$' then
    v_start_date := (p_payload->>'from')::date;
    v_end_date := (p_payload->>'to')::date + 1;
  elsif v_period='year' then
    if v_date ~ '^\d{4}$' then
      v_start_date := make_date(v_date::integer,1,1);
    elsif v_date ~ '^\d{4}-\d{2}-\d{2}$' then
      v_start_date := make_date(extract(year from v_date::date)::integer,1,1);
    else
      v_start_date := make_date(extract(year from v_today)::integer,1,1);
    end if;
    v_end_date := (v_start_date + interval '1 year')::date;
  elsif v_period='month' then
    if v_date ~ '^\d{4}-\d{2}$' then
      v_start_date := (v_date||'-01')::date;
    elsif v_date ~ '^\d{4}-\d{2}-\d{2}$' then
      v_start_date := date_trunc('month',v_date::date)::date;
    else
      v_start_date := date_trunc('month',v_today)::date;
    end if;
    v_end_date := (v_start_date + interval '1 month')::date;
  else
    v_start_date := case when v_date ~ '^\d{4}-\d{2}-\d{2}$' then v_date::date else v_today end;
    v_end_date := v_start_date + 1;
    v_period := 'day';
  end if;
  v_from := (v_start_date::text||' 00:00:00+07')::timestamptz;
  v_to := (v_end_date::text||' 00:00:00+07')::timestamptz;
  v_offset := (v_page-1)*v_page_size;

  if p_module='activity' then
    select x.user_id,x.role into v_approver,v_approver_role
    from app.customer_portal_verify_manager_pin(p_tenant_id,p_branch_id,v_pin) x
    limit 1;
    if v_approver is null then
      insert into public.audit_logs(
        tenant_id,branch_id,actor_user_id,actor_role,action,target_table,module,entity_type,metadata,
        user_id,role
      ) values(
        p_tenant_id,p_branch_id,v_actor,v_role,'settings_activity_audit_pin_failed',
        'audit_logs','settings_activity_audit','audit_logs',
        jsonb_build_object('source','customer_portal'),v_actor,v_role
      );
      raise exception using errcode='42501',message='pin_rejected';
    end if;

    select count(*) into v_total
    from public.audit_logs al
    where al.tenant_id=p_tenant_id
      and al.branch_id=p_branch_id
      and al.created_at>=v_from and al.created_at<v_to
      and al.action<>'settings_activity_audit_pin_failed'
      and (v_module_filter='' or v_module_filter='all' or coalesce(al.module,'')=v_module_filter)
      and (v_search='' or al.action ilike '%'||v_search||'%' or coalesce(al.module,'') ilike '%'||v_search||'%'
        or coalesce(al.target_table,'') ilike '%'||v_search||'%' or coalesce(al.entity_type,'') ilike '%'||v_search||'%');

    select jsonb_build_object(
      'module','activity',
      'items',coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb),
      'pagination',jsonb_build_object(
        'page',v_page,'page_size',v_page_size,'total',v_total,
        'total_pages',greatest(1,ceil(v_total::numeric/v_page_size)::integer)
      ),
      'range',jsonb_build_object('period',v_period,'from',v_from,'to',v_to),
      'approved_by',v_approver,'approver_role',v_approver_role
    ) into v_result
    from (
      select al.id,al.branch_id,b.name as branch_name,b.code as branch_code,
             al.actor_user_id,coalesce(actor.full_name,al.actor_user_id::text,'-') as actor_name,
             coalesce(actor.email,'') as actor_email,coalesce(pup.employee_code,'') as actor_employee_code,
             coalesce(al.actor_role,al.role,'-') as actor_role,
             al.target_user_id,coalesce(target.full_name,al.target_user_id::text,'-') as target_user_name,
             al.action,coalesce(al.module,al.target_table,'general') as module,
             coalesce(al.target_table,al.entity_type,'') as target_table,
             al.target_id,coalesce(al.device_code,'') as device_code,al.pos_session_id,
             al.override_by_user_id,
             coalesce(approver.full_name,al.override_by_user_id::text,'') as approver_name,
             al.metadata,al.created_at,
             (lower(al.action) like '%delete%' or lower(al.action) like '%cancel%' or lower(al.action) like '%revok%') as is_delete_action,
             (lower(al.action) like '%pin%' or lower(al.action) like '%approval%') as is_pin_action
      from public.audit_logs al
      left join public.branches b on b.id=al.branch_id
      left join public.users_profiles actor on actor.id=al.actor_user_id
      left join public.pos_user_profiles pup on pup.tenant_id=p_tenant_id and pup.user_id=al.actor_user_id
      left join public.users_profiles target on target.id=al.target_user_id
      left join public.users_profiles approver on approver.id=al.override_by_user_id
      where al.tenant_id=p_tenant_id and al.branch_id=p_branch_id
        and al.created_at>=v_from and al.created_at<v_to
        and al.action<>'settings_activity_audit_pin_failed'
        and (v_module_filter='' or v_module_filter='all' or coalesce(al.module,'')=v_module_filter)
        and (v_search='' or al.action ilike '%'||v_search||'%' or coalesce(al.module,'') ilike '%'||v_search||'%'
          or coalesce(al.target_table,'') ilike '%'||v_search||'%' or coalesce(al.entity_type,'') ilike '%'||v_search||'%')
      order by al.created_at desc
      offset v_offset limit v_page_size
    ) x;

    insert into public.audit_logs(
      tenant_id,branch_id,actor_user_id,actor_role,action,target_table,module,entity_type,
      override_by_user_id,metadata,user_id,role
    ) values(
      p_tenant_id,p_branch_id,v_actor,v_role,'settings_activity_audit_viewed',
      'audit_logs','settings_activity_audit','audit_logs',v_approver,
      jsonb_build_object('source','customer_portal','period',v_period,'from',v_from,'to',v_to,'page',v_page,'page_size',v_page_size),
      v_actor,v_role
    );

  elsif p_module='inet' then
    select jsonb_build_object(
      'module','inet','settings',coalesce(to_jsonb(s),jsonb_build_object(
        'branch_id',p_branch_id,'environment','uat','merchant_id','','is_active',false,
        'connection_status','not_configured','last_connection_checked_at',null,'last_connection_error','',
        'last_test_order_id','','callback_url',null
      )),
      'provider_test_available',false,
      'provider_test_note','ทดสอบการเชื่อมต่อ INET ต้องใช้ Merchant Key ฝั่ง POS server'
    ) into v_result
    from (select 1) seed
    left join lateral (
      select id,branch_id,environment,coalesce(merchant_id,'') as merchant_id,is_active,
             connection_status,last_connection_checked_at,coalesce(last_connection_error,'') as last_connection_error,
             coalesce(last_test_order_id,'') as last_test_order_id,callback_url,updated_at
      from public.pos_payment_provider_settings
      where tenant_id=p_tenant_id and branch_id=p_branch_id and provider='inet_nops'
      order by updated_at desc limit 1
    ) s on true;

  elsif p_module='order_kitchen' then
    select jsonb_build_object(
      'module','order_kitchen',
      'policy',jsonb_build_object(
        'branch_id',p_branch_id,
        'store',jsonb_build_object(
          'popup_enabled',coalesce(n.table_qr_popup_store_enabled,n.table_qr_popup_enabled,true),
          'kitchen_auto_send_enabled',coalesce(n.table_qr_kitchen_auto_send_enabled,true),
          'kitchen_auto_print_enabled',coalesce(n.table_qr_kitchen_auto_print_enabled,true)
        ),
        'override',jsonb_build_object(
          'popup',coalesce(n.table_qr_popup_override,'inherit'),
          'kitchen_auto_send',coalesce(n.table_qr_kitchen_auto_send_override,'inherit'),
          'kitchen_auto_print',coalesce(n.table_qr_kitchen_auto_print_override,'inherit')
        ),
        'effective',jsonb_build_object(
          'popup_enabled',case coalesce(n.table_qr_popup_override,'inherit')
            when 'force_on' then true when 'force_off' then false
            else coalesce(n.table_qr_popup_store_enabled,n.table_qr_popup_enabled,true) end,
          'kitchen_auto_send_enabled',case coalesce(n.table_qr_kitchen_auto_send_override,'inherit')
            when 'force_on' then true when 'force_off' then false
            else coalesce(n.table_qr_kitchen_auto_send_enabled,true) end,
          'kitchen_auto_print_enabled',case coalesce(n.table_qr_kitchen_auto_print_override,'inherit')
            when 'force_on' then true when 'force_off' then false
            else coalesce(n.table_qr_kitchen_auto_print_enabled,true) end
        )
      )
    ) into v_result
    from (select 1) seed
    left join public.tenant_pos_notification_settings n
      on n.tenant_id=p_tenant_id and n.branch_id=p_branch_id;

  elsif p_module='table_qr' then
    select jsonb_build_object(
      'module','table_qr',
      'tables',coalesce(jsonb_agg(to_jsonb(x) order by x.table_code),'[]'::jsonb),
      'limits',jsonb_build_object('default_ttl_minutes',1080,'min_ttl_minutes',15,'max_ttl_minutes',1440,'bill_safety_ttl_minutes',10080)
    ) into v_result
    from (
      select t.id,t.table_code,t.table_name,t.zone_id,t.is_active,
             case when t.metadata->'qr_policy'->>'mode'='bill' then 'bill' else 'time' end as mode,
             case
               when t.metadata->'qr_policy'->>'mode'='bill' then null
               when coalesce(t.metadata->'qr_policy'->>'ttl_minutes','') ~ '^\d+$'
                 and (t.metadata->'qr_policy'->>'ttl_minutes')::integer between 15 and 1440
               then (t.metadata->'qr_policy'->>'ttl_minutes')::integer
               else 1080
             end as ttl_minutes,
             (select count(*) from public.table_qr_sessions q
               where q.tenant_id=p_tenant_id and q.branch_id=p_branch_id
                 and q.table_id=t.id and q.status='active') as active_qr_sessions
      from public.dining_tables t
      where t.tenant_id=p_tenant_id and t.branch_id=p_branch_id and t.is_active=true
    ) x;

  elsif p_module='receipts' then
    if v_status='' then v_status:='completed'; end if;
    select count(*) into v_total
    from public.orders o
    where o.tenant_id=p_tenant_id and o.branch_id=p_branch_id
      and o.created_at>=v_from and o.created_at<v_to
      and (v_status='all' or o.status::text=v_status)
      and (v_search='' or coalesce(o.order_no,'') ilike '%'||v_search||'%'
        or coalesce(o.customer_name,'') ilike '%'||v_search||'%'
        or coalesce(o.external_order_code,'') ilike '%'||v_search||'%');

    select jsonb_build_object(
      'module','receipts',
      'records',coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb),
      'pagination',jsonb_build_object('page',v_page,'page_size',v_page_size,'total',v_total,
        'total_pages',greatest(1,ceil(v_total::numeric/v_page_size)::integer)),
      'range',jsonb_build_object('period',v_period,'from',v_from,'to',v_to)
    ) into v_result
    from (
      select o.id,o.order_no,o.order_type::text as order_type,o.channel,o.customer_name,o.external_order_code,
             coalesce(o.subtotal,0) as subtotal,coalesce(o.discount_amount,0) as discount_amount,
             coalesce(o.tax_total,0) as tax_total,
             coalesce(o.grand_total,o.total_amount,0) as total_amount,coalesce(o.paid_total,0) as paid_total,
             o.status::text as status,o.created_at,o.payment_completed_at as paid_at,
             coalesce(u.full_name,'-') as cashier_name,
             case when o.table_id is not null then coalesce(dt.table_name,dt.table_code,'โต๊ะ')
                  when o.order_type::text='delivery_manual' then 'เดลิเวอรี่' else 'เคาน์เตอร์' end as table_label,
             coalesce(o.cash_received,0) as cash_received,coalesce(o.change_amount,0) as change_amount,o.notes,
             coalesce((select jsonb_agg(jsonb_build_object(
                'id',oi.id,'product_id',oi.product_id,'name',coalesce(oi.name,p.name,oi.product_id::text),
                'sku',p.sku,'category',p.category,'quantity',oi.quantity,'unit_price',oi.unit_price,
                'line_total',oi.line_total,'notes',oi.notes
              ) order by oi.created_at)
              from public.order_items oi left join public.products p on p.id=oi.product_id
              where oi.tenant_id=p_tenant_id and oi.branch_id=p_branch_id and oi.order_id=o.id),'[]'::jsonb) as items,
             coalesce((select jsonb_agg(jsonb_build_object(
                'method',pay.method::text,'amount',pay.amount,'status',pay.status,'received_at',pay.received_at
              ) order by pay.received_at)
              from public.payments pay
              where pay.tenant_id=p_tenant_id and pay.branch_id=p_branch_id and pay.order_id=o.id),'[]'::jsonb) as payments
      from public.orders o
      left join public.users_profiles u on u.id=coalesce(o.payment_completed_by,o.cashier_user_id,o.created_by)
      left join public.dining_tables dt on dt.id=o.table_id
      where o.tenant_id=p_tenant_id and o.branch_id=p_branch_id
        and o.created_at>=v_from and o.created_at<v_to
        and (v_status='all' or o.status::text=v_status)
        and (v_search='' or coalesce(o.order_no,'') ilike '%'||v_search||'%'
          or coalesce(o.customer_name,'') ilike '%'||v_search||'%'
          or coalesce(o.external_order_code,'') ilike '%'||v_search||'%')
      order by o.created_at desc
      offset v_offset limit v_page_size
    ) x;

  elsif p_module='tax_invoices' then
    select jsonb_build_object(
      'module','tax_invoices',
      'seller',jsonb_build_object(
        'display_name',coalesce(nullif(btrim(ts.settings->>'seller_display_name'),''),nullif(btrim(t.display_name),''),t.name,''),
        'tax_id',coalesce(ts.settings->>'seller_tax_id',''),
        'branch_no',coalesce(ts.settings->>'seller_branch_no',''),
        'address',coalesce(nullif(btrim(ts.settings->>'seller_address'),''),t.company_address,''),
        'phone',coalesce(t.contact_phone,''),
        'ready',app.customer_portal_thai_tax_id_valid(ts.settings->>'seller_tax_id')
          and btrim(coalesce(ts.settings->>'seller_display_name',t.display_name,t.name,''))<>''
          and btrim(coalesce(ts.settings->>'seller_address',t.company_address,''))<>''
      ),
      'profiles',coalesce((
        select jsonb_agg(to_jsonb(p) order by p.updated_at desc)
        from (
          select pr.id,pr.entity_type,pr.display_name,pr.tax_id,pr.address_line,pr.subdistrict,pr.district,pr.province,
                 pr.postal_code,pr.is_active,pr.created_at,pr.updated_at,
                 (select count(*) from public.pos_tax_invoices pi
                   where pi.tenant_id=p_tenant_id and pi.branch_id=p_branch_id and pi.profile_id=pr.id) as invoice_count,
                 (select max(pi.issued_at) from public.pos_tax_invoices pi
                   where pi.tenant_id=p_tenant_id and pi.branch_id=p_branch_id and pi.profile_id=pr.id) as last_issued_at
          from public.pos_tax_invoice_profiles pr
          where pr.tenant_id=p_tenant_id and pr.branch_id=p_branch_id and pr.is_active=true
          order by pr.updated_at desc limit 100
        ) p
      ),'[]'::jsonb),
      'receipts',coalesce((
        select jsonb_agg(to_jsonb(r) order by r.created_at desc)
        from (
          select o.id,o.order_no,o.customer_name,coalesce(o.grand_total,o.total_amount,0) as total,
                 coalesce(o.tax_total,0) as tax_total,o.created_at,o.payment_completed_at as paid_at,
                 pi.id as invoice_id,pi.invoice_no,pi.profile_id,pi.issued_at,pi.print_count,pi.last_printed_at
          from public.orders o
          left join public.pos_tax_invoices pi on pi.tenant_id=p_tenant_id and pi.branch_id=p_branch_id and pi.order_id=o.id
          where o.tenant_id=p_tenant_id and o.branch_id=p_branch_id and o.status::text='completed'
          order by o.created_at desc limit 50
        ) r
      ),'[]'::jsonb),
      'invoices',coalesce((
        select jsonb_agg(to_jsonb(i) order by i.issued_at desc)
        from (
          select pi.id,pi.order_id,pi.profile_id,pi.invoice_no,pi.paper_width_mm,pi.status,
                 pi.buyer_snapshot,pi.seller_snapshot,pi.order_snapshot,pi.tax_snapshot,
                 pi.print_count,pi.issued_at,pi.last_printed_at
          from public.pos_tax_invoices pi
          where pi.tenant_id=p_tenant_id and pi.branch_id=p_branch_id
          order by pi.issued_at desc limit 100
        ) i
      ),'[]'::jsonb)
    ) into v_result
    from public.tenants t
    left join public.tenant_tax_settings ts on ts.tenant_id=t.id and ts.branch_id=p_branch_id
    where t.id=p_tenant_id
    limit 1;

  else
    select jsonb_build_object(
      'module','product_sales',
      'rows',coalesce(jsonb_agg(to_jsonb(x) order by x.sales_total desc,x.quantity desc),'[]'::jsonb),
      'range',jsonb_build_object('period',v_period,'from',v_from,'to',v_to),
      'summary',jsonb_build_object(
        'product_count',count(*),
        'quantity',coalesce(sum(x.quantity),0),
        'sales_total',coalesce(sum(x.sales_total),0)
      )
    ) into v_result
    from (
      select coalesce(oi.product_id,p.id) as product_id,coalesce(p.sku,'') as sku,
             coalesce(p.name,oi.name,oi.product_id::text,'ไม่ระบุสินค้า') as name,
             coalesce(p.category,'') as category,
             sum(coalesce(oi.quantity,0))::numeric as quantity,
             sum(coalesce(oi.line_total,0))::numeric as sales_total,
             case when sum(coalesce(oi.quantity,0))<>0
                  then sum(coalesce(oi.line_total,0))/sum(coalesce(oi.quantity,0)) else 0 end as average_unit_price,
             count(distinct o.id) as order_count,max(o.created_at) as last_sold_at
      from public.order_items oi
      join public.orders o on o.id=oi.order_id and o.tenant_id=p_tenant_id and o.branch_id=p_branch_id
      left join public.products p on p.id=oi.product_id
      where oi.tenant_id=p_tenant_id and oi.branch_id=p_branch_id
        and o.status::text='completed'
        and o.created_at>=v_from and o.created_at<v_to
        and coalesce((o.metadata->>'sales_list_deleted')::boolean,false)=false
        and (v_search='' or coalesce(p.name,oi.name,'') ilike '%'||v_search||'%'
          or coalesce(p.sku,'') ilike '%'||v_search||'%' or coalesce(p.category,'') ilike '%'||v_search||'%')
      group by coalesce(oi.product_id,p.id),p.sku,coalesce(p.name,oi.name,oi.product_id::text,'ไม่ระบุสินค้า'),p.category
      order by sales_total desc,quantity desc
      limit 500
    ) x;
  end if;

  return coalesce(v_result,'{}'::jsonb);
end
$function$;

revoke all on function app.customer_portal_verify_manager_pin(uuid,uuid,text) from public,anon,authenticated;
grant execute on function app.customer_portal_verify_manager_pin(uuid,uuid,text) to service_role;
revoke all on function app.customer_portal_thai_tax_id_valid(text) from public,anon,authenticated;
grant execute on function app.customer_portal_thai_tax_id_valid(text) to service_role;
revoke all on function public.customer_portal_pos_admin_phase3_snapshot(uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.customer_portal_pos_admin_phase3_snapshot(uuid,uuid,text,jsonb) to authenticated;
revoke all on function public.customer_portal_pos_admin_phase3_mutate(uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.customer_portal_pos_admin_phase3_mutate(uuid,uuid,text,jsonb) to authenticated;
