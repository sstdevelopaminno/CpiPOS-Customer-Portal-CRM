-- Customer Portal POS administration phase 2.
-- Applied to CpiPOS-001. Shared POS data/control plane; Customer Display policy remains IT-owned.

CREATE OR REPLACE FUNCTION public.customer_portal_pos_admin_phase2_mutate(p_tenant_id uuid, p_branch_id uuid, p_action text, p_payload jsonb DEFAULT '{}'::jsonb)
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
  v_id uuid;
  v_target_id uuid;
  v_row record;
  v_current record;
  v_item jsonb;
  v_zone_id uuid;
  v_object_type text;
  v_name text;
  v_color text;
  v_width numeric;
  v_height numeric;
  v_profile_id uuid;
  v_device_id uuid;
  v_mode text;
  v_connection_type text;
  v_profile_role text;
  v_ip text;
  v_runtime text;
  v_fingerprint text;
  v_assignments jsonb;
  v_purposes jsonb;
  v_zones jsonb;
  v_metadata jsonb;
  v_has_receipt boolean;
  v_has_kitchen boolean;
  v_has_report boolean;
  v_has_drawer boolean;
  v_pairing_code text;
  v_pairing_hash text;
  v_rand bytea;
  v_expires timestamptz;
  v_inactive_hours integer;
  v_pairing_id uuid;
  v_result jsonb;
  v_count integer := 0;
begin
  if v_actor is null then
    raise exception using errcode='42501',message='customer_portal_unauthenticated';
  end if;
  if p_branch_id is null then
    raise exception using errcode='22023',message='branch_required';
  end if;

  v_actor_role := app.customer_portal_actor_role(p_tenant_id,p_branch_id);
  if v_actor_role is null then
    raise exception using errcode='42501',message='customer_portal_forbidden';
  end if;

  if p_action like 'floor_plan.%' or p_action like 'layout_object.%' then
    v_feature:='table_management'; v_menu:='more.tables';
  elsif p_action like 'printer.%' then
    v_feature:='core_pos_sales'; v_menu:='settings.printers';
  elsif p_action like 'display.%' then
    v_feature:='customer_facing_display'; v_menu:='settings.display';
  else
    raise exception using errcode='22023',message='unsupported_pos_admin_action';
  end if;

  if not app.customer_portal_module_allowed(p_tenant_id,p_branch_id,v_feature,v_menu) then
    raise exception using errcode='42501',message='feature_not_enabled';
  end if;

  -- Floor-plan bulk save: same persisted coordinates/dimensions used by POS.
  if p_action='floor_plan.save' then
    for v_item in select value from jsonb_array_elements(coalesce(p_payload->'tables','[]'::jsonb))
    loop
      v_id:=nullif(v_item->>'id','')::uuid;
      v_zone_id:=nullif(v_item->>'zone_id','')::uuid;
      if v_id is null then raise exception using errcode='22023',message='invalid_table_id'; end if;
      if v_zone_id is not null and not exists(
        select 1 from public.table_zones
        where tenant_id=p_tenant_id and branch_id=p_branch_id and id=v_zone_id
      ) then raise exception using errcode='22023',message='invalid_zone_id'; end if;

      update public.dining_tables
      set zone_id=v_zone_id,
          position_x=case when coalesce((p_payload->>'reset')::boolean,false) then 0 else coalesce((v_item->>'position_x')::numeric,position_x) end,
          position_y=case when coalesce((p_payload->>'reset')::boolean,false) then 0 else coalesce((v_item->>'position_y')::numeric,position_y) end,
          width=case when coalesce((p_payload->>'reset')::boolean,false) then 96 else greatest(40,coalesce((v_item->>'width')::numeric,width)) end,
          height=case when coalesce((p_payload->>'reset')::boolean,false) then 72 else greatest(40,coalesce((v_item->>'height')::numeric,height)) end,
          rotation=case when coalesce((p_payload->>'reset')::boolean,false) then 0 else coalesce((v_item->>'rotation')::numeric,rotation) end,
          updated_at=now()
      where tenant_id=p_tenant_id and branch_id=p_branch_id and id=v_id;
      if not found then raise exception using errcode='P0002',message='table_not_found'; end if;
      v_count:=v_count+1;
    end loop;

    for v_item in select value from jsonb_array_elements(coalesce(p_payload->'objects','[]'::jsonb))
    loop
      v_id:=nullif(v_item->>'id','')::uuid;
      v_zone_id:=nullif(v_item->>'zone_id','')::uuid;
      if v_id is null then raise exception using errcode='22023',message='invalid_layout_object_id'; end if;
      if v_zone_id is not null and not exists(
        select 1 from public.table_zones
        where tenant_id=p_tenant_id and branch_id=p_branch_id and id=v_zone_id
      ) then raise exception using errcode='22023',message='invalid_zone_id'; end if;

      update public.table_layout_objects
      set zone_id=v_zone_id,
          position_x=case when coalesce((p_payload->>'reset')::boolean,false) then 24 else coalesce((v_item->>'position_x')::numeric,position_x) end,
          position_y=case when coalesce((p_payload->>'reset')::boolean,false) then 24 else coalesce((v_item->>'position_y')::numeric,position_y) end,
          width=case when coalesce((p_payload->>'reset')::boolean,false) then 120 else greatest(24,coalesce((v_item->>'width')::numeric,width)) end,
          height=case when coalesce((p_payload->>'reset')::boolean,false) then 60 else greatest(24,coalesce((v_item->>'height')::numeric,height)) end,
          rotation=case when coalesce((p_payload->>'reset')::boolean,false) then 0 else coalesce((v_item->>'rotation')::numeric,rotation) end,
          z_index=greatest(1,coalesce((v_item->>'z_index')::integer,z_index)),
          updated_at=now()
      where tenant_id=p_tenant_id and branch_id=p_branch_id and id=v_id;
      if not found then raise exception using errcode='P0002',message='layout_object_not_found'; end if;
      v_count:=v_count+1;
    end loop;
    v_result:=jsonb_build_object('saved',true,'item_count',v_count,'reset',coalesce((p_payload->>'reset')::boolean,false));

  elsif p_action='layout_object.save' then
    v_id:=nullif(p_payload->>'id','')::uuid;
    v_zone_id:=nullif(p_payload->>'zone_id','')::uuid;
    v_object_type:=lower(btrim(coalesce(p_payload->>'object_type','')));
    if v_object_type not in ('counter','cashier','partition','plant','entrance','service_station') then
      raise exception using errcode='22023',message='invalid_layout_object_type';
    end if;
    if v_zone_id is not null and not exists(
      select 1 from public.table_zones
      where tenant_id=p_tenant_id and branch_id=p_branch_id and id=v_zone_id
    ) then raise exception using errcode='22023',message='invalid_zone_id'; end if;

    v_name:=nullif(btrim(coalesce(p_payload->>'object_name','')),'');
    v_color:=coalesce(nullif(btrim(p_payload->>'color'),''),
      case v_object_type
        when 'counter' then '#475569'
        when 'cashier' then '#0369a1'
        when 'partition' then '#7c2d12'
        when 'plant' then '#166534'
        when 'entrance' then '#7c3aed'
        else '#b45309'
      end);
    v_width:=greatest(24,coalesce((p_payload->>'width')::numeric,
      case v_object_type when 'counter' then 140 when 'cashier' then 120 when 'partition' then 160 when 'plant' then 56 when 'entrance' then 120 else 108 end));
    v_height:=greatest(24,coalesce((p_payload->>'height')::numeric,
      case v_object_type when 'counter' then 68 when 'cashier' then 64 when 'partition' then 22 when 'plant' then 56 when 'entrance' then 46 else 62 end));

    if v_id is null then
      insert into public.table_layout_objects(
        tenant_id,branch_id,zone_id,object_type,object_name,color,position_x,position_y,
        width,height,rotation,z_index,is_active,metadata
      ) values(
        p_tenant_id,p_branch_id,v_zone_id,v_object_type,v_name,v_color,
        coalesce((p_payload->>'position_x')::numeric,24),
        coalesce((p_payload->>'position_y')::numeric,24),
        v_width,v_height,coalesce((p_payload->>'rotation')::numeric,0),
        greatest(1,coalesce((p_payload->>'z_index')::integer,1)),
        coalesce((p_payload->>'is_active')::boolean,true),
        coalesce(p_payload->'metadata','{}'::jsonb)
      ) returning * into v_row;
      v_id:=v_row.id;
    else
      update public.table_layout_objects
      set zone_id=v_zone_id,object_type=v_object_type,object_name=v_name,color=v_color,
          position_x=coalesce((p_payload->>'position_x')::numeric,position_x),
          position_y=coalesce((p_payload->>'position_y')::numeric,position_y),
          width=v_width,height=v_height,rotation=coalesce((p_payload->>'rotation')::numeric,rotation),
          z_index=greatest(1,coalesce((p_payload->>'z_index')::integer,z_index)),
          is_active=coalesce((p_payload->>'is_active')::boolean,is_active),
          metadata=coalesce(p_payload->'metadata',metadata),updated_at=now()
      where tenant_id=p_tenant_id and branch_id=p_branch_id and id=v_id
      returning * into v_row;
      if not found then raise exception using errcode='P0002',message='layout_object_not_found'; end if;
    end if;
    v_target_id:=v_id;
    v_result:=to_jsonb(v_row);

  elsif p_action='layout_object.delete' then
    v_id:=nullif(p_payload->>'id','')::uuid;
    if v_id is null then raise exception using errcode='22023',message='invalid_layout_object_id'; end if;
    delete from public.table_layout_objects
    where tenant_id=p_tenant_id and branch_id=p_branch_id and id=v_id
    returning * into v_row;
    if not found then raise exception using errcode='P0002',message='layout_object_not_found'; end if;
    v_target_id:=v_id;
    v_result:=jsonb_build_object('id',v_id,'deleted',true);

  -- Printer configuration registry. Physical discovery remains POS/Print Agent responsibility.
  elsif p_action='printer.save' then
    v_profile_id:=nullif(p_payload->>'id','')::uuid;
    v_name:=btrim(coalesce(p_payload->>'printer_name',''));
    v_mode:=lower(btrim(coalesce(p_payload->>'connection_mode','')));
    v_ip:=nullif(btrim(coalesce(p_payload->>'ip_address','')),'');
    v_runtime:=nullif(btrim(coalesce(p_payload->>'runtime_device_code','')),'');
    if v_name='' then raise exception using errcode='22023',message='printer_name_required'; end if;
    if v_mode not in ('lan','usb','bluetooth') then raise exception using errcode='22023',message='connection_mode_invalid'; end if;
    if coalesce((p_payload->>'paper_width_mm')::integer,0) not in (58,80) then
      raise exception using errcode='22023',message='paper_width_invalid';
    end if;
    if v_mode='lan' and v_ip is null then raise exception using errcode='22023',message='lan_ip_required'; end if;

    select coalesce(jsonb_agg(jsonb_build_object(
      'purpose',q.purpose,'zoneKey',q.zone_key,'isDefault',q.is_default,'copies',q.copies
    ) order by q.purpose,q.zone_key),'[]'::jsonb)
    into v_assignments
    from (
      select distinct on (purpose,zone_key)
        purpose,zone_key,is_default,copies
      from (
        select
          lower(btrim(a->>'purpose')) as purpose,
          case
            when lower(btrim(a->>'purpose')) in ('kitchen','drink','bar')
              then upper(btrim(coalesce(a->>'zone_key','')))
            else ''
          end as zone_key,
          coalesce((a->>'is_default')::boolean,false) as is_default,
          greatest(1,least(9,coalesce((a->>'copies')::integer,1))) as copies
        from jsonb_array_elements(coalesce(p_payload->'assignments','[]'::jsonb)) a
        where lower(btrim(a->>'purpose')) in
          ('receipt','kitchen','drink','bar','reprint','shift_report','payment_slip','cash_drawer')
      ) n
      order by purpose,zone_key
    ) q;

    if jsonb_array_length(v_assignments)=0 then
      raise exception using errcode='22023',message='printer_purpose_required';
    end if;

    if exists(
      select 1
      from jsonb_array_elements(v_assignments) a
      where a->>'purpose' in ('kitchen','drink','bar')
        and coalesce(a->>'zoneKey','')<>''
        and not exists(
          select 1 from public.kitchen_zones z
          where z.tenant_id=p_tenant_id and z.branch_id=p_branch_id
            and z.is_active=true and upper(z.zone_code)=upper(a->>'zoneKey')
        )
    ) then
      raise exception using errcode='22023',message='printer_zone_invalid';
    end if;

    select coalesce(jsonb_agg(distinct a->>'purpose'),'[]'::jsonb)
    into v_purposes from jsonb_array_elements(v_assignments) a;
    select coalesce(jsonb_agg(distinct a->>'zoneKey') filter(where coalesce(a->>'zoneKey','')<>''),'[]'::jsonb)
    into v_zones from jsonb_array_elements(v_assignments) a;

    v_has_receipt:=exists(select 1 from jsonb_array_elements(v_assignments) a where a->>'purpose' in ('receipt','cash_drawer','reprint','payment_slip'));
    v_has_kitchen:=exists(select 1 from jsonb_array_elements(v_assignments) a where a->>'purpose' in ('kitchen','drink','bar'));
    v_has_report:=exists(select 1 from jsonb_array_elements(v_assignments) a where a->>'purpose'='shift_report');
    v_has_drawer:=exists(select 1 from jsonb_array_elements(v_assignments) a where a->>'purpose'='cash_drawer');

    v_profile_role:=case when v_has_receipt then 'receipt' when v_has_kitchen then 'kitchen' when v_has_report then 'report' else 'receipt' end;
    v_connection_type:=case v_mode when 'lan' then 'NETWORK_ESC_POS' when 'bluetooth' then 'BLUETOOTH_BRIDGE' else 'LOCAL_BRIDGE' end;

    if v_profile_id is not null then
      select p.id,d.id as device_id,d.device_fingerprint
      into v_current
      from public.printer_profiles p
      left join public.printer_devices d on d.printer_profile_id=p.id and d.tenant_id=p_tenant_id and d.branch_id=p_branch_id
      where p.tenant_id=p_tenant_id and p.branch_id=p_branch_id and p.id=v_profile_id;
      if not found then raise exception using errcode='P0002',message='printer_not_found'; end if;
      v_device_id:=v_current.device_id;
      v_fingerprint:=coalesce(nullif(btrim(p_payload->>'device_fingerprint'),''),v_current.device_fingerprint);
    else
      v_fingerprint:=nullif(btrim(p_payload->>'device_fingerprint'),'');
    end if;

    v_fingerprint:=coalesce(
      v_fingerprint,
      lower(v_mode||':'||coalesce(v_runtime,v_ip,v_name))
    );

    v_metadata:=jsonb_build_object(
      'setup_version','printer_settings_v3',
      'routing_version','tenant_branch_pos_zone_v1',
      'user_connection_mode',v_mode,
      'transport_mode',v_mode,
      'agent_transport_mode',v_mode,
      'native_transport',true,
      'brand',nullif(btrim(p_payload->>'brand'),''),
      'model',nullif(btrim(p_payload->>'model'),''),
      'device_fingerprint',v_fingerprint,
      'print_functions',v_purposes,
      'print_zones',v_zones,
      'printer_assignments',v_assignments,
      'agent_device_code',v_runtime,
      'agent_device_codes',case when v_runtime is null then '[]'::jsonb else jsonb_build_array(v_runtime) end,
      'print_mode','agent',
      'processing_mode','print_agent',
      'queue_only',true,
      'bridge_url',case when v_mode in ('usb','bluetooth') then 'native-agent://android-pos' else null end,
      'bluetooth_name',case when v_mode='bluetooth' then coalesce(nullif(btrim(p_payload->>'model'),''),v_name) else null end,
      'cash_drawer_enabled',v_has_drawer,
      'cash_drawer',jsonb_build_object(
        'enabled',v_has_drawer,'connectionMode','printer-kick','openSupported',true,
        'statusSupported',false,'kickPin',0,'pulseOnMs',50,'pulseOffMs',250,
        'autoOpenOnCashPayment',v_has_drawer
      ),
      'capabilities',jsonb_build_object(
        'receipt',exists(select 1 from jsonb_array_elements(v_assignments) a where a->>'purpose'='receipt'),
        'kitchen',v_has_kitchen,
        'reprint',exists(select 1 from jsonb_array_elements(v_assignments) a where a->>'purpose'='reprint'),
        'shift_report',v_has_report,
        'payment_slip',exists(select 1 from jsonb_array_elements(v_assignments) a where a->>'purpose'='payment_slip'),
        'cash_drawer',v_has_drawer,
        'paper_58',(p_payload->>'paper_width_mm')::integer=58,
        'paper_80',(p_payload->>'paper_width_mm')::integer=80
      ),
      'quarantine_replay_allowed',false,
      'managed_from','customer_portal'
    );

    if v_profile_id is null then
      insert into public.printer_profiles(
        tenant_id,branch_id,printer_name,printer_role,connection_type,ip_address,port,
        paper_width_mm,enabled,metadata,created_by
      ) values(
        p_tenant_id,p_branch_id,v_name,v_profile_role::public.printer_role,
        v_connection_type::public.printer_connection_type,v_ip,
        case when p_payload ? 'port' then nullif(p_payload->>'port','')::integer else null end,
        (p_payload->>'paper_width_mm')::integer,
        coalesce((p_payload->>'enabled')::boolean,true),v_metadata,v_actor
      ) returning id into v_profile_id;
    else
      update public.printer_profiles
      set printer_name=v_name,printer_role=v_profile_role::public.printer_role,
          connection_type=v_connection_type::public.printer_connection_type,
          ip_address=v_ip,
          port=case when p_payload ? 'port' then nullif(p_payload->>'port','')::integer else port end,
          paper_width_mm=(p_payload->>'paper_width_mm')::integer,
          enabled=coalesce((p_payload->>'enabled')::boolean,enabled),
          metadata=v_metadata,updated_at=now()
      where tenant_id=p_tenant_id and branch_id=p_branch_id and id=v_profile_id;
      if not found then raise exception using errcode='P0002',message='printer_not_found'; end if;
    end if;

    if v_device_id is null then
      insert into public.printer_devices(
        tenant_id,branch_id,printer_profile_id,display_name,brand,model,connection_mode,
        paper_width_mm,device_fingerprint,runtime_device_code,status,capabilities,is_active,
        metadata,created_by
      ) values(
        p_tenant_id,p_branch_id,v_profile_id,v_name,
        nullif(btrim(p_payload->>'brand'),''),nullif(btrim(p_payload->>'model'),''),
        v_mode,(p_payload->>'paper_width_mm')::integer,v_fingerprint,v_runtime,'checking',
        v_metadata->'capabilities',true,v_metadata,v_actor
      ) returning id into v_device_id;
    else
      update public.printer_devices
      set printer_profile_id=v_profile_id,display_name=v_name,
          brand=nullif(btrim(p_payload->>'brand'),''),
          model=nullif(btrim(p_payload->>'model'),''),
          connection_mode=v_mode,paper_width_mm=(p_payload->>'paper_width_mm')::integer,
          device_fingerprint=v_fingerprint,runtime_device_code=v_runtime,
          status=case when coalesce((p_payload->>'enabled')::boolean,true) then 'checking' else 'disconnected' end,
          capabilities=v_metadata->'capabilities',
          is_active=coalesce((p_payload->>'enabled')::boolean,true),
          disconnected_at=case when coalesce((p_payload->>'enabled')::boolean,true) then null else now() end,
          metadata=v_metadata,updated_at=now()
      where tenant_id=p_tenant_id and branch_id=p_branch_id and id=v_device_id;
    end if;

    update public.kitchen_zones set default_printer_id=null,updated_at=now()
    where tenant_id=p_tenant_id and branch_id=p_branch_id and default_printer_id=v_profile_id;

    delete from public.printer_device_assignments
    where tenant_id=p_tenant_id and branch_id=p_branch_id and printer_device_id=v_device_id;

    insert into public.printer_device_assignments(
      tenant_id,branch_id,printer_device_id,purpose,zone_key,is_enabled,is_default,copies
    )
    select p_tenant_id,p_branch_id,v_device_id,
           (a->>'purpose')::text,coalesce(a->>'zoneKey',''),true,
           coalesce((a->>'isDefault')::boolean,false),
           greatest(1,least(9,coalesce((a->>'copies')::integer,1)))
    from jsonb_array_elements(v_assignments) a;

    update public.kitchen_zones z
    set default_printer_id=v_profile_id,updated_at=now()
    where z.tenant_id=p_tenant_id and z.branch_id=p_branch_id and z.is_active=true
      and exists(
        select 1 from jsonb_array_elements(v_assignments) a
        where a->>'purpose' in ('kitchen','drink','bar')
          and coalesce(a->>'zoneKey','')<>''
          and upper(a->>'zoneKey')=upper(z.zone_code)
      );

    insert into public.printer_device_history(
      tenant_id,branch_id,printer_device_id,printer_profile_id,event_type,device_name,
      brand,model,connection_mode,paper_width_mm,details,created_by
    ) values(
      p_tenant_id,p_branch_id,v_device_id,v_profile_id,
      case when p_payload->>'id' is null or btrim(coalesce(p_payload->>'id',''))='' then 'connected' else 'updated' end,
      v_name,nullif(btrim(p_payload->>'brand'),''),nullif(btrim(p_payload->>'model'),''),
      v_mode,(p_payload->>'paper_width_mm')::integer,
      jsonb_build_object('source','customer_portal','assignments',v_assignments,'fingerprint',v_fingerprint,'runtime_device_code',v_runtime),
      v_actor
    );

    v_target_id:=v_profile_id;
    select jsonb_build_object(
      'profile',to_jsonb(p),
      'device',to_jsonb(d),
      'assignments',coalesce((
        select jsonb_agg(to_jsonb(a) order by a.purpose,a.zone_key)
        from public.printer_device_assignments a
        where a.tenant_id=p_tenant_id and a.branch_id=p_branch_id and a.printer_device_id=v_device_id
      ),'[]'::jsonb)
    ) into v_result
    from public.printer_profiles p
    join public.printer_devices d on d.id=v_device_id
    where p.id=v_profile_id;

  elsif p_action in ('printer.disconnect','printer.reconnect') then
    v_profile_id:=nullif(p_payload->>'id','')::uuid;
    if v_profile_id is null then raise exception using errcode='22023',message='printer_id_required'; end if;
    select p.id,d.id as device_id,d.display_name,d.brand,d.model,d.connection_mode,d.paper_width_mm
    into v_current
    from public.printer_profiles p
    join public.printer_devices d on d.printer_profile_id=p.id
    where p.tenant_id=p_tenant_id and p.branch_id=p_branch_id and p.id=v_profile_id
    limit 1;
    if not found then raise exception using errcode='P0002',message='printer_device_not_found'; end if;
    v_device_id:=v_current.device_id;

    update public.printer_profiles
    set enabled=(p_action='printer.reconnect'),updated_at=now()
    where tenant_id=p_tenant_id and branch_id=p_branch_id and id=v_profile_id;
    update public.printer_devices
    set status=case when p_action='printer.reconnect' then 'checking' else 'disconnected' end,
        is_active=(p_action='printer.reconnect'),
        disconnected_at=case when p_action='printer.reconnect' then null else now() end,
        updated_at=now()
    where tenant_id=p_tenant_id and branch_id=p_branch_id and id=v_device_id
    returning * into v_row;

    insert into public.printer_device_history(
      tenant_id,branch_id,printer_device_id,printer_profile_id,event_type,device_name,
      brand,model,connection_mode,paper_width_mm,details,created_by
    ) values(
      p_tenant_id,p_branch_id,v_device_id,v_profile_id,
      case when p_action='printer.reconnect' then 'reconnected' else 'disconnected' end,
      v_current.display_name,v_current.brand,v_current.model,v_current.connection_mode,
      v_current.paper_width_mm,jsonb_build_object('source','customer_portal'),v_actor
    );
    v_target_id:=v_profile_id;
    v_result:=to_jsonb(v_row);

  elsif p_action='printer.delete' then
    v_profile_id:=nullif(p_payload->>'id','')::uuid;
    if v_profile_id is null then raise exception using errcode='22023',message='printer_id_required'; end if;
    select p.id,p.printer_name,d.id as device_id,d.display_name,d.brand,d.model,d.connection_mode,d.paper_width_mm
    into v_current
    from public.printer_profiles p
    left join public.printer_devices d on d.printer_profile_id=p.id
    where p.tenant_id=p_tenant_id and p.branch_id=p_branch_id and p.id=v_profile_id;
    if not found then raise exception using errcode='P0002',message='printer_not_found'; end if;

    update public.kitchen_zones set default_printer_id=null,updated_at=now()
    where tenant_id=p_tenant_id and branch_id=p_branch_id and default_printer_id=v_profile_id;

    if v_current.device_id is not null then
      insert into public.printer_device_history(
        tenant_id,branch_id,printer_device_id,printer_profile_id,event_type,device_name,
        brand,model,connection_mode,paper_width_mm,details,created_by
      ) values(
        p_tenant_id,p_branch_id,v_current.device_id,v_profile_id,'deleted',
        coalesce(v_current.display_name,v_current.printer_name),
        v_current.brand,v_current.model,v_current.connection_mode,v_current.paper_width_mm,
        jsonb_build_object('source','customer_portal'),v_actor
      );
      update public.printer_devices
      set is_active=false,status='disconnected',disconnected_at=now(),updated_at=now()
      where tenant_id=p_tenant_id and branch_id=p_branch_id and id=v_current.device_id;
    end if;

    delete from public.printer_profiles
    where tenant_id=p_tenant_id and branch_id=p_branch_id and id=v_profile_id;
    v_target_id:=v_profile_id;
    v_result:=jsonb_build_object('id',v_profile_id,'deleted',true);

  -- Customer Display policy remains IT-owned. Owner/Manager can create/revoke pairings.
  elsif p_action='display.pairing.create' then
    select coalesce(inactive_expire_hours,72)
    into v_inactive_hours
    from public.pos_customer_display_policies
    where tenant_id=p_tenant_id and branch_id=p_branch_id and channel='main' and is_active=true
    limit 1;
    v_inactive_hours:=coalesce(v_inactive_hours,72);

    update public.pos_customer_display_pairings
    set is_active=false,updated_at=now()
    where tenant_id=p_tenant_id and branch_id=p_branch_id and channel='main' and is_active=true
      and device_token_hash is not null
      and (
        device_token_expires_at<=now()
        or (last_seen_at is not null and last_seen_at < now()-(v_inactive_hours||' hours')::interval)
      );

    for v_count in 1..8 loop
      v_rand:=extensions.gen_random_bytes(4);
      v_pairing_code:=lpad(((get_byte(v_rand,0)*16777216 + get_byte(v_rand,1)*65536 + get_byte(v_rand,2)*256 + get_byte(v_rand,3)) % 1000000)::text,6,'0');
      v_pairing_hash:=encode(extensions.digest(v_pairing_code,'sha256'),'hex');
      exit when not exists(
        select 1 from public.pos_customer_display_pairings
        where pair_code_hash=v_pairing_hash and is_active=true and pair_code_used_at is null and pair_code_expires_at>now()
      );
    end loop;
    v_expires:=now()+interval '10 minutes';

    insert into public.pos_customer_display_pairings(
      tenant_id,branch_id,channel,pair_code_hash,pair_code_expires_at,created_by,is_active
    ) values(
      p_tenant_id,p_branch_id,'main',v_pairing_hash,v_expires,v_actor,true
    ) returning id into v_pairing_id;
    v_target_id:=v_pairing_id;
    v_result:=jsonb_build_object('id',v_pairing_id,'channel','main','pairing_code',v_pairing_code,'expires_at',v_expires);

  elsif p_action='display.pairing.disable' then
    v_pairing_id:=nullif(p_payload->>'id','')::uuid;
    if v_pairing_id is null then raise exception using errcode='22023',message='pairing_id_required'; end if;
    update public.pos_customer_display_pairings
    set is_active=false,updated_at=now()
    where tenant_id=p_tenant_id and branch_id=p_branch_id and id=v_pairing_id
    returning * into v_row;
    if not found then raise exception using errcode='P0002',message='pairing_not_found'; end if;
    v_target_id:=v_pairing_id;
    v_result:=jsonb_build_object('id',v_pairing_id,'disabled',true);
  end if;

  insert into public.audit_logs(
    tenant_id,branch_id,actor_user_id,actor_role,action,target_table,target_id,metadata,
    user_id,role,module,entity_type,entity_id,new_value
  ) values(
    p_tenant_id,p_branch_id,v_actor,v_actor_role,
    'customer_portal_'||replace(p_action,'.','_'),
    case
      when p_action like 'floor_plan.%' then 'dining_tables'
      when p_action like 'layout_object.%' then 'table_layout_objects'
      when p_action like 'printer.%' then 'printer_profiles'
      when p_action like 'display.%' then 'pos_customer_display_pairings'
      else 'customer_portal'
    end,
    v_target_id,
    jsonb_build_object('source','customer_portal','payload',coalesce(p_payload,'{}'::jsonb)),
    v_actor,v_actor_role,'customer_portal',split_part(p_action,'.',1),
    v_target_id::text,coalesce(v_result,'{}'::jsonb)
  );

  return coalesce(v_result,'{}'::jsonb);
end
$function$;

CREATE OR REPLACE FUNCTION public.customer_portal_pos_admin_phase2_snapshot(p_tenant_id uuid, p_branch_id uuid, p_module text)
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
  v_policy record;
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
    when 'tables' then v_feature:='table_management'; v_menu:='more.tables';
    when 'kitchen' then v_feature:='kitchen_printing'; v_menu:='more.kitchen_manage';
    when 'printers' then v_feature:='core_pos_sales'; v_menu:='settings.printers';
    when 'display' then v_feature:='customer_facing_display'; v_menu:='settings.display';
    else raise exception using errcode='22023',message='unsupported_pos_admin_module';
  end case;

  if not app.customer_portal_module_allowed(p_tenant_id,p_branch_id,v_feature,v_menu) then
    raise exception using errcode='42501',message='feature_not_enabled';
  end if;

  if p_module='tables' then
    select jsonb_build_object(
      'module','tables',
      'zones',coalesce((
        select jsonb_agg(to_jsonb(z) order by z.display_order,z.zone_name)
        from (
          select id,branch_id,zone_name,color,display_order,is_active,metadata,created_at,updated_at
          from public.table_zones
          where tenant_id=p_tenant_id and branch_id=p_branch_id
        ) z
      ),'[]'::jsonb),
      'tables',coalesce((
        select jsonb_agg(to_jsonb(t) order by t.table_code)
        from (
          select id,branch_id,zone_id,table_code,table_name,capacity,status,shape,
                 position_x,position_y,width,height,rotation,is_active,metadata,created_at,updated_at
          from public.dining_tables
          where tenant_id=p_tenant_id and branch_id=p_branch_id
        ) t
      ),'[]'::jsonb),
      'layout_objects',coalesce((
        select jsonb_agg(to_jsonb(o) order by o.z_index,o.created_at)
        from (
          select id,branch_id,zone_id,object_type,object_name,color,position_x,position_y,
                 width,height,rotation,z_index,is_active,metadata,created_at,updated_at
          from public.table_layout_objects
          where tenant_id=p_tenant_id and branch_id=p_branch_id
        ) o
      ),'[]'::jsonb)
    ) into v_result;

  elsif p_module='kitchen' then
    select jsonb_build_object(
      'module','kitchen',
      'zones',coalesce((
        select jsonb_agg(to_jsonb(z) order by z.display_order,z.zone_name)
        from (
          select id,branch_id,zone_code,zone_name,display_order,is_active,default_printer_id,
                 metadata,kds_enabled,access_code,created_at,updated_at
          from public.kitchen_zones
          where tenant_id=p_tenant_id and branch_id=p_branch_id
        ) z
      ),'[]'::jsonb),
      'routing_rules',coalesce((
        select jsonb_agg(to_jsonb(r) order by r.priority,r.created_at)
        from (
          select id,zone_id,product_id,category_name,priority,is_active,metadata,created_at,updated_at
          from public.kitchen_routing_rules
          where tenant_id=p_tenant_id and branch_id=p_branch_id
        ) r
      ),'[]'::jsonb),
      'printers',coalesce((
        select jsonb_agg(to_jsonb(p) order by p.printer_name)
        from (
          select id,printer_name,printer_role,connection_type,ip_address,port,paper_width_mm,enabled,metadata
          from public.printer_profiles
          where tenant_id=p_tenant_id and branch_id=p_branch_id and enabled=true
        ) p
      ),'[]'::jsonb),
      'categories',coalesce((
        select jsonb_agg(x.category order by x.category)
        from (
          select distinct btrim(category) as category
          from public.products
          where tenant_id=p_tenant_id and branch_id=p_branch_id
            and deleted_at is null and is_active=true and btrim(coalesce(category,''))<>''
        ) x
      ),'[]'::jsonb),
      'products',coalesce((
        select jsonb_agg(to_jsonb(p) order by p.category,p.name)
        from (
          select id,sku,name,category,is_active
          from public.products
          where tenant_id=p_tenant_id and branch_id=p_branch_id
            and deleted_at is null and is_active=true
        ) p
      ),'[]'::jsonb)
    ) into v_result;

  elsif p_module='printers' then
    select jsonb_build_object(
      'module','printers',
      'profiles',coalesce((
        select jsonb_agg(to_jsonb(p) order by p.printer_name)
        from (
          select id,branch_id,printer_name,printer_role,connection_type,ip_address,port,
                 paper_width_mm,enabled,metadata,created_at,updated_at
          from public.printer_profiles
          where tenant_id=p_tenant_id and branch_id=p_branch_id
        ) p
      ),'[]'::jsonb),
      'devices',coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id',d.id,
            'printer_profile_id',d.printer_profile_id,
            'display_name',d.display_name,
            'brand',d.brand,
            'model',d.model,
            'connection_mode',d.connection_mode,
            'paper_width_mm',d.paper_width_mm,
            'device_fingerprint',d.device_fingerprint,
            'runtime_device_code',d.runtime_device_code,
            'status',d.status,
            'capabilities',d.capabilities,
            'last_seen_at',d.last_seen_at,
            'disconnected_at',d.disconnected_at,
            'is_active',d.is_active,
            'metadata',d.metadata,
            'created_at',d.created_at,
            'updated_at',d.updated_at,
            'assignments',coalesce((
              select jsonb_agg(to_jsonb(a) order by a.purpose,a.zone_key)
              from (
                select id,purpose,zone_key,is_enabled,is_default,copies,metadata
                from public.printer_device_assignments
                where tenant_id=p_tenant_id and branch_id=p_branch_id
                  and printer_device_id=d.id
              ) a
            ),'[]'::jsonb)
          ) order by d.display_name
        )
        from public.printer_devices d
        where d.tenant_id=p_tenant_id and d.branch_id=p_branch_id
          and d.printer_profile_id is not null
      ),'[]'::jsonb),
      'kitchen_zones',coalesce((
        select jsonb_agg(to_jsonb(z) order by z.display_order,z.zone_name)
        from (
          select id,zone_code,zone_name,display_order,is_active,default_printer_id
          from public.kitchen_zones
          where tenant_id=p_tenant_id and branch_id=p_branch_id and is_active=true
        ) z
      ),'[]'::jsonb)
    ) into v_result;

  else
    select max_active_devices,inactive_expire_hours,is_active
    into v_policy
    from public.pos_customer_display_policies
    where tenant_id=p_tenant_id and branch_id=p_branch_id and channel='main' and is_active=true
    limit 1;

    select jsonb_build_object(
      'module','display',
      'policy',jsonb_build_object(
        'channel','main',
        'max_active_devices',coalesce(v_policy.max_active_devices,4),
        'inactive_expire_hours',coalesce(v_policy.inactive_expire_hours,72),
        'is_active',coalesce(v_policy.is_active,true),
        'source',case when v_policy.max_active_devices is null then 'default' else 'it_policy' end
      ),
      'pairings',coalesce((
        select jsonb_agg(to_jsonb(x) order by x.updated_at desc)
        from (
          select id,channel,pair_code_expires_at,pair_code_used_at,device_token_expires_at,
                 device_name,is_active,last_seen_at,created_at,updated_at,
                 (device_token_hash is not null) as paired
          from public.pos_customer_display_pairings
          where tenant_id=p_tenant_id and branch_id=p_branch_id
        ) x
      ),'[]'::jsonb)
    ) into v_result;
  end if;

  return coalesce(v_result,'{}'::jsonb);
end
$function$;

revoke all on function public.customer_portal_pos_admin_phase2_snapshot(uuid,uuid,text) from public,anon;
grant execute on function public.customer_portal_pos_admin_phase2_snapshot(uuid,uuid,text) to authenticated;
revoke all on function public.customer_portal_pos_admin_phase2_mutate(uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.customer_portal_pos_admin_phase2_mutate(uuid,uuid,text,jsonb) to authenticated;
