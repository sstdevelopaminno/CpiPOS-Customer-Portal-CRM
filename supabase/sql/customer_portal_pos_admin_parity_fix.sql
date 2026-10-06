-- Follow-up parity fix applied to CpiPOS-001 after customer_portal_pos_admin_crud_parity.
-- Keeps branch device policy behavior aligned with POS and preserves audit target IDs for created records.

CREATE OR REPLACE FUNCTION public.customer_portal_pos_admin_mutate(p_tenant_id uuid, p_branch_id uuid, p_action text, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'app'
AS $function$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_feature text;
  v_feature2 text;
  v_menu text;
  v_id uuid;
  v_zone_id uuid;
  v_table_id uuid;
  v_member_id uuid;
  v_device_id uuid;
  v_product_id uuid;
  v_current record;
  v_row record;
  v_code text;
  v_name text;
  v_phone text;
  v_email text;
  v_mode text;
  v_sku text;
  v_price numeric;
  v_metadata jsonb;
  v_status text;
  v_shape text;
  v_capacity integer;
  v_active_count integer;
  v_max_devices integer;
  v_contract_status text;
  v_prev_branch uuid;
  v_prev_code text;
  v_prev_status text;
  v_categories text[];
  v_zone_ids uuid[];
  v_result jsonb;
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

  if p_action like 'table.%' or p_action like 'table_zone.%' then
    v_feature:='table_management'; v_menu:='more.tables';
  elsif p_action like 'member.%' then
    v_feature:='core_pos_sales'; v_menu:='more.members';
  elsif p_action like 'kitchen.%' then
    v_feature:='kitchen_printing'; v_menu:='more.kitchen_manage';
  elsif p_action like 'buffet.%' then
    v_feature:='table_management'; v_feature2:='core_pos_sales'; v_menu:='more.buffet';
  elsif p_action like 'device.%' then
    v_feature:='mobile_device_enrollment'; v_menu:='settings.devices';
  else
    raise exception using errcode='22023',message='unsupported_pos_admin_action';
  end if;

  if not app.customer_portal_module_allowed(p_tenant_id,p_branch_id,v_feature,v_menu) then
    raise exception using errcode='42501',message='feature_not_enabled';
  end if;
  if v_feature2 is not null and not app.customer_portal_module_allowed(p_tenant_id,p_branch_id,v_feature2,v_menu) then
    raise exception using errcode='42501',message='feature_not_enabled';
  end if;

  -- TABLE ZONES
  if p_action='table_zone.save' then
    v_name:=btrim(coalesce(p_payload->>'zone_name',''));
    if v_name='' then raise exception using errcode='22023',message='invalid_zone_name'; end if;
    v_id:=nullif(p_payload->>'id','')::uuid;
    if v_id is null then
      insert into public.table_zones(tenant_id,branch_id,zone_name,color,display_order,is_active,metadata)
      values(
        p_tenant_id,p_branch_id,v_name,
        coalesce(nullif(btrim(p_payload->>'color'),''),'#0ea5e9'),
        coalesce((p_payload->>'display_order')::integer,0),
        coalesce((p_payload->>'is_active')::boolean,true),
        coalesce(p_payload->'metadata','{}'::jsonb)
      )
      returning * into v_row;
      v_id:=v_row.id;
    else
      update public.table_zones
      set zone_name=v_name,
          color=coalesce(nullif(btrim(p_payload->>'color'),''),color),
          display_order=coalesce((p_payload->>'display_order')::integer,display_order),
          is_active=coalesce((p_payload->>'is_active')::boolean,is_active),
          metadata=coalesce(p_payload->'metadata',metadata),
          updated_at=now()
      where tenant_id=p_tenant_id and branch_id=p_branch_id and id=v_id
      returning * into v_row;
      if not found then raise exception using errcode='P0002',message='zone_not_found'; end if;
    end if;
    v_result:=to_jsonb(v_row);

  elsif p_action='table_zone.delete' then
    v_id:=nullif(p_payload->>'id','')::uuid;
    if v_id is null then raise exception using errcode='22023',message='invalid_zone_id'; end if;
    if exists(select 1 from public.dining_tables where tenant_id=p_tenant_id and branch_id=p_branch_id and zone_id=v_id) then
      raise exception using errcode='23503',message='zone_in_use';
    end if;
    delete from public.table_zones
    where tenant_id=p_tenant_id and branch_id=p_branch_id and id=v_id
    returning * into v_row;
    if not found then raise exception using errcode='P0002',message='zone_not_found'; end if;
    v_result:=jsonb_build_object('id',v_id,'deleted',true);

  -- DINING TABLES
  elsif p_action='table.save' then
    v_table_id:=nullif(p_payload->>'id','')::uuid;
    v_zone_id:=nullif(p_payload->>'zone_id','')::uuid;
    if v_zone_id is not null and not exists(
      select 1 from public.table_zones where tenant_id=p_tenant_id and branch_id=p_branch_id and id=v_zone_id
    ) then raise exception using errcode='22023',message='invalid_zone_id'; end if;

    v_status:=coalesce(nullif(p_payload->>'status',''),'available');
    if v_status not in ('available','occupied','ordering','pending_payment','reserved','disabled') then
      raise exception using errcode='22023',message='invalid_table_status';
    end if;
    v_shape:=coalesce(nullif(p_payload->>'shape',''),'rectangle');
    if v_shape not in ('square','rectangle','circle') then
      raise exception using errcode='22023',message='invalid_table_shape';
    end if;
    v_capacity:=greatest(1,coalesce((p_payload->>'capacity')::integer,4));
    v_code:=btrim(coalesce(p_payload->>'table_code',''));

    if v_table_id is null then
      if v_code='' then
        select (coalesce(max(
          case when substring(table_code from '([0-9]+)$') is not null
            then substring(table_code from '([0-9]+)$')::integer else null end
        ),0)+1)::text
        into v_code
        from public.dining_tables
        where tenant_id=p_tenant_id and branch_id=p_branch_id;
      end if;
      insert into public.dining_tables(
        tenant_id,branch_id,zone_id,table_code,table_name,capacity,status,shape,
        position_x,position_y,width,height,rotation,is_active,metadata
      ) values(
        p_tenant_id,p_branch_id,v_zone_id,v_code,nullif(btrim(p_payload->>'table_name'),''),
        v_capacity,v_status,v_shape,
        coalesce((p_payload->>'position_x')::numeric,0),coalesce((p_payload->>'position_y')::numeric,0),
        greatest(40,coalesce((p_payload->>'width')::numeric,96)),
        greatest(40,coalesce((p_payload->>'height')::numeric,72)),
        coalesce((p_payload->>'rotation')::numeric,0),
        coalesce((p_payload->>'is_active')::boolean,true),
        coalesce(p_payload->'metadata','{}'::jsonb)
      ) returning * into v_row;
    else
      update public.dining_tables
      set zone_id=case when p_payload ? 'zone_id' then v_zone_id else zone_id end,
          table_code=case when v_code<>'' then v_code else table_code end,
          table_name=case when p_payload ? 'table_name' then nullif(btrim(p_payload->>'table_name'),'') else table_name end,
          capacity=v_capacity,status=v_status,shape=v_shape,
          position_x=coalesce((p_payload->>'position_x')::numeric,position_x),
          position_y=coalesce((p_payload->>'position_y')::numeric,position_y),
          width=greatest(40,coalesce((p_payload->>'width')::numeric,width)),
          height=greatest(40,coalesce((p_payload->>'height')::numeric,height)),
          rotation=coalesce((p_payload->>'rotation')::numeric,rotation),
          is_active=coalesce((p_payload->>'is_active')::boolean,is_active),
          metadata=coalesce(p_payload->'metadata',metadata),
          updated_at=now()
      where tenant_id=p_tenant_id and branch_id=p_branch_id and id=v_table_id
      returning * into v_row;
      if not found then raise exception using errcode='P0002',message='table_not_found'; end if;
    end if;
    v_result:=to_jsonb(v_row);

  elsif p_action='table.delete' then
    v_table_id:=nullif(p_payload->>'id','')::uuid;
    if v_table_id is null then raise exception using errcode='22023',message='invalid_table_id'; end if;
    update public.orders set table_id=null
    where tenant_id=p_tenant_id and branch_id=p_branch_id and table_id=v_table_id;
    delete from public.dining_tables
    where tenant_id=p_tenant_id and branch_id=p_branch_id and id=v_table_id
    returning * into v_row;
    if not found then raise exception using errcode='P0002',message='table_not_found'; end if;
    v_result:=jsonb_build_object('id',v_table_id,'deleted',true);

  -- MEMBERS
  elsif p_action='member.save' then
    v_name:=btrim(coalesce(p_payload->>'name',''));
    v_phone:=regexp_replace(coalesce(p_payload->>'phone',''),'[^0-9]','','g');
    v_email:=lower(btrim(coalesce(p_payload->>'email','')));
    if v_name='' or v_phone !~ '^[0-9]{9,10}$' then
      raise exception using errcode='22023',message='invalid_member_input';
    end if;
    if v_email<>'' and v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
      raise exception using errcode='22023',message='invalid_member_email';
    end if;
    select id,member_token into v_member_id,v_code
    from public.mobile_members
    where tenant_id=p_tenant_id and branch_id=p_branch_id and phone=v_phone
    limit 1;
    if v_member_id is null then
      insert into public.mobile_members(
        tenant_id,branch_id,name,phone,email,member_token,points_balance,stamp_balance,status,deleted_at,updated_at
      ) values(
        p_tenant_id,p_branch_id,v_name,v_phone,nullif(v_email,''),
        'mem_'||replace(gen_random_uuid()::text,'-',''),
        greatest(0,coalesce((p_payload->>'points')::integer,0)),
        greatest(0,coalesce((p_payload->>'stamps')::integer,0)),
        'active',null,now()
      ) returning * into v_row;
      v_member_id:=v_row.id;
    else
      update public.mobile_members
      set name=v_name,email=nullif(v_email,''),
          member_token=coalesce(nullif(v_code,''),'mem_'||replace(gen_random_uuid()::text,'-','')),
          points_balance=greatest(0,coalesce((p_payload->>'points')::integer,points_balance)),
          stamp_balance=greatest(0,coalesce((p_payload->>'stamps')::integer,stamp_balance)),
          status='active',deleted_at=null,updated_at=now()
      where id=v_member_id
      returning * into v_row;
    end if;
    v_result:=to_jsonb(v_row);

  elsif p_action='member.delete' then
    v_member_id:=nullif(p_payload->>'id','')::uuid;
    if v_member_id is null then raise exception using errcode='22023',message='invalid_member_id'; end if;
    update public.mobile_members
    set deleted_at=now(),updated_at=now()
    where tenant_id=p_tenant_id and branch_id=p_branch_id and id=v_member_id
    returning * into v_row;
    if not found then raise exception using errcode='P0002',message='member_not_found'; end if;
    v_result:=jsonb_build_object('id',v_member_id,'deleted',true);

  -- KITCHEN
  elsif p_action='kitchen.zone.save' then
    v_id:=nullif(p_payload->>'id','')::uuid;
    v_code:=upper(btrim(coalesce(p_payload->>'zone_code','')));
    v_name:=btrim(coalesce(p_payload->>'zone_name',''));
    if v_name='' then raise exception using errcode='22023',message='invalid_kitchen_zone_name'; end if;
    if v_code !~ '^[A-Z0-9_-]{1,32}$' then raise exception using errcode='22023',message='invalid_kitchen_zone_code'; end if;
    v_zone_id:=nullif(p_payload->>'default_printer_id','')::uuid;
    if v_zone_id is not null and not exists(
      select 1 from public.printer_profiles
      where tenant_id=p_tenant_id and branch_id=p_branch_id and id=v_zone_id and enabled=true
    ) then raise exception using errcode='22023',message='invalid_kitchen_printer'; end if;
    v_metadata:=case when btrim(coalesce(p_payload->>'description',''))=''
      then '{}'::jsonb else jsonb_build_object('description',btrim(p_payload->>'description')) end;
    if v_id is null then
      insert into public.kitchen_zones(
        tenant_id,branch_id,zone_code,zone_name,display_order,is_active,kds_enabled,
        default_printer_id,metadata,created_by
      ) values(
        p_tenant_id,p_branch_id,v_code,v_name,coalesce((p_payload->>'display_order')::integer,0),
        coalesce((p_payload->>'is_active')::boolean,true),coalesce((p_payload->>'kds_enabled')::boolean,true),
        v_zone_id,v_metadata,v_actor
      ) returning * into v_row;
      v_id:=v_row.id;
    else
      update public.kitchen_zones
      set zone_code=v_code,zone_name=v_name,
          display_order=coalesce((p_payload->>'display_order')::integer,display_order),
          is_active=coalesce((p_payload->>'is_active')::boolean,is_active),
          kds_enabled=coalesce((p_payload->>'kds_enabled')::boolean,kds_enabled),
          default_printer_id=v_zone_id,metadata=v_metadata,updated_at=now()
      where tenant_id=p_tenant_id and branch_id=p_branch_id and id=v_id
      returning * into v_row;
      if not found then raise exception using errcode='P0002',message='kitchen_zone_not_found'; end if;
    end if;

    if p_payload ? 'category_names' then
      select coalesce(array_agg(distinct btrim(value)) filter(where btrim(value)<>''),array[]::text[])
      into v_categories from jsonb_array_elements_text(coalesce(p_payload->'category_names','[]'::jsonb));
      delete from public.kitchen_routing_rules
      where tenant_id=p_tenant_id and branch_id=p_branch_id and zone_id=v_id and product_id is null;
      if coalesce(array_length(v_categories,1),0)>0 then
        insert into public.kitchen_routing_rules(
          tenant_id,branch_id,zone_id,product_id,category_name,priority,is_active,metadata,created_by
        )
        select p_tenant_id,p_branch_id,v_id,null,c,100,true,'{}'::jsonb,v_actor
        from unnest(v_categories) c;
      end if;
    end if;
    v_result:=to_jsonb(v_row);

  elsif p_action='kitchen.zone.kds' then
    v_id:=nullif(p_payload->>'id','')::uuid;
    update public.kitchen_zones
    set kds_enabled=coalesce((p_payload->>'kds_enabled')::boolean,false),updated_at=now()
    where tenant_id=p_tenant_id and branch_id=p_branch_id and id=v_id
    returning * into v_row;
    if not found then raise exception using errcode='P0002',message='kitchen_zone_not_found'; end if;
    v_result:=to_jsonb(v_row);

  elsif p_action='kitchen.zone.disable' then
    v_id:=nullif(p_payload->>'id','')::uuid;
    update public.kitchen_zones
    set is_active=false,updated_at=now()
    where tenant_id=p_tenant_id and branch_id=p_branch_id and id=v_id
    returning * into v_row;
    if not found then raise exception using errcode='P0002',message='kitchen_zone_not_found'; end if;
    delete from public.printer_device_assignments
    where tenant_id=p_tenant_id and branch_id=p_branch_id and zone_key=upper(v_row.zone_code);
    v_result:=to_jsonb(v_row);

  elsif p_action='kitchen.zone.rotate_access_code' then
    v_id:=nullif(p_payload->>'id','')::uuid;
    select to_jsonb(x) into v_result
    from public.rotate_kitchen_zone_access_code(p_tenant_id,p_branch_id,v_id,v_actor) x;

  elsif p_action='kitchen.routes.replace' then
    select coalesce(array_agg(value::uuid),array[]::uuid[])
    into v_zone_ids from jsonb_array_elements_text(coalesce(p_payload->'zone_ids','[]'::jsonb));
    select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into v_result
    from public.replace_kitchen_routes(
      p_tenant_id,p_branch_id,
      coalesce(nullif(p_payload->>'scope_type',''),'category'),
      v_zone_ids,
      nullif(p_payload->>'product_id','')::uuid,
      nullif(btrim(p_payload->>'category_name'),''),
      v_actor
    ) x;

  -- BUFFET PRICING
  elsif p_action='buffet.create' then
    v_mode:=case p_payload->>'mode' when 'set' then 'set' when 'per_person' then 'per_person' else null end;
    if v_mode is null then raise exception using errcode='22023',message='invalid_buffet_mode'; end if;
    select count(*) into v_active_count
    from public.products
    where tenant_id=p_tenant_id and branch_id=p_branch_id and deleted_at is null
      and coalesce(metadata->'cpipos_buffet_plan'->>'mode','')=v_mode;
    v_name:=case when v_mode='per_person' then 'บุฟเฟ่รายท่าน' else 'บุฟเฟ่แบบชุด' end
      || ' ' || greatest(2,v_active_count+1)::text;
    v_sku:=(case when v_mode='per_person' then 'BUFFET-PER-PERSON-' else 'BUFFET-SET-' end)
      || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
    v_metadata:=jsonb_build_object('cpipos_buffet_plan',jsonb_build_object(
      'mode',v_mode,'draft',true,'archived',false,'sort_order',(extract(epoch from clock_timestamp())*1000)::bigint
    ));
    insert into public.products(
      tenant_id,branch_id,sku,name,category,price,is_combo,is_active,stock_deduction_mode,sell_unit,metadata
    ) values(p_tenant_id,p_branch_id,v_sku,v_name,'บุฟเฟ่',0,false,false,'unit_only','unit',v_metadata)
    returning * into v_row;
    v_product_id:=v_row.id;
    v_result:=to_jsonb(v_row);

  elsif p_action='buffet.save' then
    v_product_id:=nullif(p_payload->>'product_id','')::uuid;
    v_mode:=case p_payload->>'mode' when 'set' then 'set' when 'per_person' then 'per_person' else null end;
    v_price:=round(greatest(0,coalesce((p_payload->>'price')::numeric,0)),2);
    if v_price<=0 then raise exception using errcode='22023',message='invalid_buffet_price'; end if;

    if v_product_id is null then
      if v_mode is null then raise exception using errcode='22023',message='invalid_buffet_mode'; end if;
      v_sku:=case when v_mode='per_person' then 'BUFFET-PER-PERSON' else 'BUFFET-SET' end;
      select * into v_current from public.products
      where tenant_id=p_tenant_id and branch_id=p_branch_id and sku=v_sku and deleted_at is null limit 1;
      if found then
        v_product_id:=v_current.id;
      else
        v_name:=case when v_mode='per_person' then 'บุฟเฟ่รายท่าน' else 'บุฟเฟ่แบบชุด' end;
        v_metadata:=jsonb_build_object('cpipos_buffet_plan',jsonb_build_object(
          'mode',v_mode,'draft',false,'archived',false,'sort_order',(extract(epoch from clock_timestamp())*1000)::bigint
        ));
        insert into public.products(
          tenant_id,branch_id,sku,name,category,price,is_combo,is_active,stock_deduction_mode,sell_unit,metadata
        ) values(p_tenant_id,p_branch_id,v_sku,v_name,'บุฟเฟ่',v_price,false,true,'unit_only','unit',v_metadata)
        returning * into v_row;
        v_product_id:=v_row.id;
        v_result:=to_jsonb(v_row);
      end if;
    end if;

    if v_result is null then
      select * into v_current from public.products
      where tenant_id=p_tenant_id and branch_id=p_branch_id and id=v_product_id and deleted_at is null;
      if not found then raise exception using errcode='P0002',message='buffet_plan_not_found'; end if;
      v_mode:=coalesce(v_mode,
        case when coalesce(v_current.metadata->'cpipos_buffet_plan'->>'mode','')='set' then 'set'
             when coalesce(v_current.metadata->'cpipos_buffet_plan'->>'mode','')='per_person' then 'per_person'
             when upper(coalesce(v_current.sku,'')) like 'BUFFET-SET%' then 'set'
             when upper(coalesce(v_current.sku,'')) like 'BUFFET-PER-PERSON%' then 'per_person'
             else null end);
      if v_mode is null then raise exception using errcode='22023',message='buffet_plan_not_found'; end if;
      v_metadata:=coalesce(v_current.metadata,'{}'::jsonb)
        || jsonb_build_object('cpipos_buffet_plan',jsonb_build_object(
          'mode',v_mode,'draft',false,'archived',false,
          'sort_order',coalesce((v_current.metadata->'cpipos_buffet_plan'->>'sort_order')::bigint,(extract(epoch from clock_timestamp())*1000)::bigint)
        ));
      update public.products set price=v_price,is_active=true,metadata=v_metadata,updated_at=now()
      where id=v_product_id returning * into v_row;
      v_result:=to_jsonb(v_row);
    end if;

  elsif p_action='buffet.delete' then
    v_product_id:=nullif(p_payload->>'product_id','')::uuid;
    select * into v_current from public.products
    where tenant_id=p_tenant_id and branch_id=p_branch_id and id=v_product_id and deleted_at is null;
    if not found then raise exception using errcode='P0002',message='buffet_plan_not_found'; end if;
    v_mode:=case when coalesce(v_current.metadata->'cpipos_buffet_plan'->>'mode','')='set' then 'set'
                 when coalesce(v_current.metadata->'cpipos_buffet_plan'->>'mode','')='per_person' then 'per_person'
                 when upper(coalesce(v_current.sku,'')) like 'BUFFET-SET%' then 'set'
                 else 'per_person' end;
    v_metadata:=coalesce(v_current.metadata,'{}'::jsonb)
      || jsonb_build_object('cpipos_buffet_plan',jsonb_build_object(
        'mode',v_mode,'draft',false,'archived',true,
        'sort_order',coalesce((v_current.metadata->'cpipos_buffet_plan'->>'sort_order')::bigint,(extract(epoch from clock_timestamp())*1000)::bigint)
      ));
    update public.products set is_active=false,metadata=v_metadata,updated_at=now()
    where id=v_product_id returning * into v_row;
    v_result:=jsonb_build_object('product_id',v_product_id,'archived',true);

  -- CASHIER DEVICES
  elsif p_action='device.save' then
    v_device_id:=nullif(p_payload->>'id','')::uuid;
    v_code:=upper(regexp_replace(btrim(coalesce(p_payload->>'device_code','')),'[^A-Z0-9_-]','','g'));
    v_name:=btrim(coalesce(p_payload->>'device_name',''));
    if v_code='' or v_name='' then raise exception using errcode='22023',message='device_identity_required'; end if;
    v_status:=case p_payload->>'status'
      when 'inactive' then 'inactive' when 'maintenance' then 'maintenance' else 'active' end;

    v_prev_branch:=null; v_prev_code:=null; v_prev_status:=null;
    if v_device_id is not null then
      select branch_id,device_code,status into v_prev_branch,v_prev_code,v_prev_status
      from public.branch_devices
      where tenant_id=p_tenant_id and id=v_device_id;
      if not found then raise exception using errcode='P0002',message='cashier_device_not_found'; end if;
      if v_prev_branch<>p_branch_id and v_role<>'owner' then
        raise exception using errcode='42501',message='customer_portal_forbidden';
      end if;
    end if;

    if v_status='active' and (v_device_id is null or coalesce(v_prev_status,'')<>'active') then
      select c.status,coalesce(c.max_devices,c.terminal_limit_per_branch,sp.max_devices)
      into v_contract_status,v_max_devices
      from public.tenant_subscription_contracts c
      left join public.subscription_packages sp on sp.id=c.package_id
      where c.tenant_id=p_tenant_id order by c.created_at desc limit 1;
      if v_contract_status is not null and v_contract_status not in ('active','trial') then
        raise exception using errcode='42501',message='contract_suspended';
      end if;
      if v_max_devices is not null then
        select count(*) into v_active_count
        from public.branch_devices
        where tenant_id=p_tenant_id and branch_id=p_branch_id and status='active';
        if v_active_count>=v_max_devices then
          raise exception using errcode='P0001',message='device_quota_blocked';
        end if;
      end if;
    end if;

    if v_device_id is not null and (v_prev_branch<>p_branch_id or coalesce(v_prev_code,'')<>v_code) then
      update public.pos_sessions set status='revoked',revoked_at=now(),updated_at=now()
      where tenant_id=p_tenant_id and status='active'
        and (device_id=v_device_id or (branch_id=v_prev_branch and device_code=v_prev_code));
    end if;

    v_metadata:=jsonb_build_object(
      'counter_name',nullif(btrim(p_payload->>'counter_name'),''),
      'location',nullif(btrim(p_payload->>'location'),''),
      'provisioned_from','customer_portal'
    );
    if v_device_id is null then
      insert into public.branch_devices(
        tenant_id,branch_id,device_code,device_name,device_type,status,is_locked,metadata,is_active
      ) values(
        p_tenant_id,p_branch_id,v_code,v_name,
        case p_payload->>'device_type' when 'mobile_scanner' then 'mobile_scanner' when 'kiosk' then 'kiosk' else 'pos_terminal' end,
        v_status,coalesce((p_payload->>'is_locked')::boolean,true),v_metadata,true
      ) returning * into v_row;
      v_device_id:=v_row.id;
    else
      update public.branch_devices
      set branch_id=p_branch_id,device_code=v_code,device_name=v_name,
          device_type=case p_payload->>'device_type' when 'mobile_scanner' then 'mobile_scanner' when 'kiosk' then 'kiosk' else 'pos_terminal' end,
          status=v_status,is_locked=coalesce((p_payload->>'is_locked')::boolean,true),
          metadata=v_metadata,is_active=true,updated_at=now()
      where tenant_id=p_tenant_id and id=v_device_id
      returning * into v_row;
    end if;

    select count(*) into v_active_count from public.branch_devices
    where tenant_id=p_tenant_id and branch_id=p_branch_id and status='active';
    insert into public.branch_login_policies(tenant_id,branch_id,max_devices)
    values(p_tenant_id,p_branch_id,greatest(1,v_active_count))
    on conflict(tenant_id,branch_id) do update
      set max_devices=greatest(public.branch_login_policies.max_devices,excluded.max_devices),updated_at=now();
    v_result:=to_jsonb(v_row);

  elsif p_action='device.delete' then
    v_device_id:=nullif(p_payload->>'id','')::uuid;
    select branch_id,device_code,device_name into v_prev_branch,v_prev_code,v_name
    from public.branch_devices where tenant_id=p_tenant_id and id=v_device_id;
    if not found then raise exception using errcode='P0002',message='cashier_device_not_found'; end if;
    if v_prev_branch<>p_branch_id and v_role<>'owner' then raise exception using errcode='42501',message='customer_portal_forbidden'; end if;
    update public.pos_sessions set status='revoked',revoked_at=now(),updated_at=now()
    where tenant_id=p_tenant_id and branch_id=v_prev_branch and status='active'
      and (device_id=v_device_id or device_code=v_prev_code);
    delete from public.branch_devices where tenant_id=p_tenant_id and id=v_device_id;
    select count(*) into v_active_count from public.branch_devices
    where tenant_id=p_tenant_id and branch_id=v_prev_branch and status='active';
    insert into public.branch_login_policies(tenant_id,branch_id,max_devices)
    values(p_tenant_id,v_prev_branch,greatest(1,v_active_count))
    on conflict(tenant_id,branch_id) do update
      set max_devices=greatest(public.branch_login_policies.max_devices,excluded.max_devices),updated_at=now();
    v_result:=jsonb_build_object('id',v_device_id,'deleted',true);
  end if;

  insert into public.audit_logs(
    tenant_id,branch_id,actor_user_id,actor_role,action,target_table,target_id,metadata,
    user_id,role,module,entity_type,entity_id,new_value
  ) values(
    p_tenant_id,p_branch_id,v_actor,v_role,
    'customer_portal_'||replace(p_action,'.','_'),
    case
      when p_action like 'table_zone.%' then 'table_zones'
      when p_action like 'table.%' then 'dining_tables'
      when p_action like 'member.%' then 'mobile_members'
      when p_action like 'kitchen.%' then 'kitchen_zones'
      when p_action like 'buffet.%' then 'products'
      when p_action like 'device.%' then 'branch_devices'
      else 'customer_portal'
    end,
    coalesce(v_table_id,v_member_id,v_device_id,v_product_id,v_id),
    jsonb_build_object('source','customer_portal','payload',coalesce(p_payload,'{}'::jsonb)),
    v_actor,v_role,'customer_portal',split_part(p_action,'.',1),
    coalesce(v_table_id,v_member_id,v_device_id,v_product_id,v_id)::text,
    coalesce(v_result,'{}'::jsonb)
  );

  return coalesce(v_result,'{}'::jsonb);
end
$function$;
