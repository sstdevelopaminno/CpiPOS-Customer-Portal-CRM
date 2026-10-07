-- Customer Portal POS administration phase 4: secure remote print queue.

CREATE OR REPLACE FUNCTION app.customer_portal_printer_matches_agent(p_metadata jsonb, p_agent_id uuid, p_device_code text)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
declare
  m jsonb := coalesce(p_metadata,'{}'::jsonb);
  has_ids boolean := false;
  has_devices boolean := false;
  singular_id text;
  singular_device text;
  match_ids boolean := false;
  match_devices boolean := false;
begin
  singular_id := coalesce(nullif(btrim(m->>'assigned_agent_id'),''),nullif(btrim(m->>'agent_id'),''));
  singular_device := upper(coalesce(nullif(btrim(m->>'agent_device_code'),''),nullif(btrim(m->>'device_code'),''),''));

  has_ids := singular_id is not null
    or jsonb_typeof(m->'assigned_agent_ids')='array'
    or jsonb_typeof(m->'agent_ids')='array';
  has_devices := singular_device<>''
    or jsonb_typeof(m->'agent_device_codes')='array'
    or jsonb_typeof(m->'device_codes')='array';

  if has_ids then
    match_ids := singular_id=p_agent_id::text
      or case when jsonb_typeof(m->'assigned_agent_ids')='array'
        then exists(select 1 from jsonb_array_elements_text(m->'assigned_agent_ids') x(v) where x.v=p_agent_id::text)
        else false end
      or case when jsonb_typeof(m->'agent_ids')='array'
        then exists(select 1 from jsonb_array_elements_text(m->'agent_ids') x(v) where x.v=p_agent_id::text)
        else false end;
    return match_ids;
  end if;

  if has_devices then
    match_devices := singular_device=upper(coalesce(p_device_code,''))
      or case when jsonb_typeof(m->'agent_device_codes')='array'
        then exists(select 1 from jsonb_array_elements_text(m->'agent_device_codes') x(v) where upper(x.v)=upper(coalesce(p_device_code,'')))
        else false end
      or case when jsonb_typeof(m->'device_codes')='array'
        then exists(select 1 from jsonb_array_elements_text(m->'device_codes') x(v) where upper(x.v)=upper(coalesce(p_device_code,'')))
        else false end;
    return match_devices;
  end if;

  return true;
end
$function$;

CREATE OR REPLACE FUNCTION public.customer_portal_pos_admin_phase4_print_state(p_tenant_id uuid, p_branch_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'app'
AS $function$
declare
  v_role text;
  v_receipts boolean;
  v_tax boolean;
begin
  v_role:=app.customer_portal_actor_role(p_tenant_id,p_branch_id);
  if v_role is null then
    raise exception using errcode='42501',message='customer_portal_forbidden';
  end if;
  v_receipts:=app.customer_portal_module_allowed(p_tenant_id,p_branch_id,'receipt_reprint_history','more.receipts');
  v_tax:=app.customer_portal_module_allowed(p_tenant_id,p_branch_id,'core_pos_sales','more.tax_invoices');
  if not v_receipts and not v_tax then
    raise exception using errcode='42501',message='feature_not_enabled';
  end if;

  return jsonb_build_object(
    'branch_id',p_branch_id,
    'receipt_print_allowed',v_receipts,
    'tax_print_allowed',v_tax,
    'online_agents',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',a.id,'agent_name',a.agent_name,'device_code',a.device_code,'status',a.status,
        'last_seen_at',a.last_seen_at,'app_version',a.app_version,
        'online',(a.status='active' and a.last_seen_at is not null and a.last_seen_at>=now()-interval '5 minutes')
      ) order by a.agent_name)
      from public.print_agents a
      where a.tenant_id=p_tenant_id and a.branch_id=p_branch_id and a.status='active'
    ),'[]'::jsonb),
    'printers',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',p.id,'printer_name',p.printer_name,'printer_role',p.printer_role::text,
        'connection_type',p.connection_type::text,'paper_width_mm',p.paper_width_mm,'enabled',p.enabled,
        'online_agent_count',(
          select count(*) from public.print_agents a
          where a.tenant_id=p_tenant_id and a.branch_id=p_branch_id and a.status='active'
            and a.last_seen_at is not null and a.last_seen_at>=now()-interval '5 minutes'
            and app.customer_portal_printer_matches_agent(p.metadata,a.id,a.device_code)
        ),
        'last_agent_seen_at',(
          select max(a.last_seen_at) from public.print_agents a
          where a.tenant_id=p_tenant_id and a.branch_id=p_branch_id and a.status='active'
            and app.customer_portal_printer_matches_agent(p.metadata,a.id,a.device_code)
        ),
        'ready',exists(
          select 1 from public.print_agents a
          where a.tenant_id=p_tenant_id and a.branch_id=p_branch_id and a.status='active'
            and a.last_seen_at is not null and a.last_seen_at>=now()-interval '5 minutes'
            and app.customer_portal_printer_matches_agent(p.metadata,a.id,a.device_code)
        )
      ) order by p.printer_name)
      from public.printer_profiles p
      where p.tenant_id=p_tenant_id and p.branch_id=p_branch_id
        and p.enabled=true and p.printer_role::text='receipt'
    ),'[]'::jsonb),
    'recent_jobs',coalesce((
      select jsonb_agg(to_jsonb(j) order by j.created_at desc)
      from (
        select pj.id,pj.order_id,pj.printer_id,p.printer_name,pj.status::text as status,
               pj.payload_json->>'document_type' as document_type,
               pj.retry_count,pj.last_error,pj.printed_at,pj.failed_at,pj.created_at,
               pj.claimed_by_agent_id,pj.claimed_at,pj.claim_expires_at
        from public.print_jobs pj
        left join public.printer_profiles p on p.id=pj.printer_id
        where pj.tenant_id=p_tenant_id and pj.branch_id=p_branch_id
          and pj.metadata->>'request_source'='customer_portal_remote_print'
        order by pj.created_at desc
        limit 30
      ) j
    ),'[]'::jsonb)
  );
end
$function$;

CREATE OR REPLACE FUNCTION public.customer_portal_pos_admin_phase4_queue_print(p_tenant_id uuid, p_branch_id uuid, p_document_type text, p_document_id uuid, p_printer_id uuid, p_manager_pin text, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'app'
AS $function$
declare
  v_actor uuid:=auth.uid();
  v_role text;
  v_approver uuid;
  v_approver_role text;
  v_printer record;
  v_order record;
  v_invoice record;
  v_items text:='';
  v_payload text;
  v_job record;
  v_idempotency text;
  v_document_type text:=lower(btrim(coalesce(p_document_type,'')));
  v_feature text;
  v_menu text;
begin
  if v_actor is null then raise exception using errcode='42501',message='customer_portal_unauthenticated'; end if;
  v_role:=app.customer_portal_actor_role(p_tenant_id,p_branch_id);
  if v_role is null then raise exception using errcode='42501',message='customer_portal_forbidden'; end if;
  if p_document_id is null or p_printer_id is null or p_request_id is null then
    raise exception using errcode='22023',message='remote_print_payload_invalid';
  end if;

  if v_document_type='receipt' then
    v_feature:='receipt_reprint_history';v_menu:='more.receipts';
  elsif v_document_type='tax_invoice' then
    v_feature:='core_pos_sales';v_menu:='more.tax_invoices';
  else
    raise exception using errcode='22023',message='remote_print_document_invalid';
  end if;
  if not app.customer_portal_module_allowed(p_tenant_id,p_branch_id,v_feature,v_menu) then
    raise exception using errcode='42501',message='feature_not_enabled';
  end if;

  select x.user_id,x.role into v_approver,v_approver_role
  from app.customer_portal_verify_manager_pin(p_tenant_id,p_branch_id,p_manager_pin) x limit 1;
  if v_approver is null then
    raise exception using errcode='42501',message='pin_rejected';
  end if;

  select p.* into v_printer
  from public.printer_profiles p
  where p.id=p_printer_id and p.tenant_id=p_tenant_id and p.branch_id=p_branch_id
    and p.enabled=true and p.printer_role::text='receipt';
  if not found then raise exception using errcode='P0002',message='receipt_printer_not_configured'; end if;

  if not exists(
    select 1 from public.print_agents a
    where a.tenant_id=p_tenant_id and a.branch_id=p_branch_id and a.status='active'
      and a.last_seen_at is not null and a.last_seen_at>=now()-interval '5 minutes'
      and app.customer_portal_printer_matches_agent(v_printer.metadata,a.id,a.device_code)
  ) then
    raise exception using errcode='P0001',message='print_agent_offline';
  end if;

  if v_document_type='receipt' then
    select o.* into v_order from public.orders o
    where o.id=p_document_id and o.tenant_id=p_tenant_id and o.branch_id=p_branch_id;
    if not found then raise exception using errcode='P0002',message='order_not_found'; end if;

    select coalesce(string_agg(
      coalesce(oi.name,p.name,'สินค้า')||' x'||trim(to_char(coalesce(oi.quantity,0),'FM999999990.##'))||
      '  '||trim(to_char(coalesce(oi.line_total,0),'FM999999990.00')),
      E'\n' order by oi.created_at
    ),'') into v_items
    from public.order_items oi
    left join public.products p on p.id=oi.product_id
    where oi.tenant_id=p_tenant_id and oi.branch_id=p_branch_id and oi.order_id=v_order.id;

    v_payload:=
      coalesce((select coalesce(nullif(btrim(t.display_name),''),t.name) from public.tenants t where t.id=p_tenant_id),'CpiPOS')||E'\n'||
      'ใบเสร็จ / RECEIPT'||E'\n'||
      'เลขที่: '||coalesce(v_order.order_no,'-')||E'\n'||
      'วันที่: '||to_char(v_order.created_at at time zone 'Asia/Bangkok','DD/MM/YYYY HH24:MI')||E'\n'||
      repeat('-',32)||E'\n'||v_items||E'\n'||repeat('-',32)||E'\n'||
      'ส่วนลด: '||trim(to_char(coalesce(v_order.discount_amount,0),'FM999999990.00'))||E'\n'||
      'ภาษี: '||trim(to_char(coalesce(v_order.tax_total,0),'FM999999990.00'))||E'\n'||
      'ยอดสุทธิ: '||trim(to_char(coalesce(v_order.grand_total,v_order.total_amount,0),'FM999999990.00'))||E'\n'||
      'ชำระแล้ว: '||trim(to_char(coalesce(v_order.paid_total,0),'FM999999990.00'))||E'\n'||
      'ขอบคุณที่ใช้บริการ';
  else
    select pi.* into v_invoice from public.pos_tax_invoices pi
    where pi.id=p_document_id and pi.tenant_id=p_tenant_id and pi.branch_id=p_branch_id;
    if not found then raise exception using errcode='P0002',message='tax_invoice_not_found'; end if;

    select coalesce(string_agg(
      coalesce(i.value->>'name','สินค้า')||' x'||coalesce(i.value->>'quantity','0')||
      '  '||coalesce(i.value->>'line_total','0'),
      E'\n'
    ),'') into v_items
    from jsonb_array_elements(coalesce(v_invoice.items_snapshot,'[]'::jsonb)) i(value);

    v_payload:=
      'ใบกำกับภาษี / TAX INVOICE'||E'\n'||
      'เลขที่: '||coalesce(v_invoice.invoice_no,'-')||E'\n'||
      'วันที่: '||to_char(v_invoice.issued_at at time zone 'Asia/Bangkok','DD/MM/YYYY HH24:MI')||E'\n'||
      repeat('-',32)||E'\n'||
      coalesce(v_invoice.seller_snapshot->>'display_name','')||E'\n'||
      'เลขผู้เสียภาษี: '||coalesce(v_invoice.seller_snapshot->>'tax_id','')||E'\n'||
      coalesce(v_invoice.seller_snapshot->>'address','')||E'\n'||
      repeat('-',32)||E'\n'||
      'ผู้ซื้อ: '||coalesce(v_invoice.buyer_snapshot->>'display_name','')||E'\n'||
      'เลขผู้เสียภาษี: '||coalesce(v_invoice.buyer_snapshot->>'tax_id','')||E'\n'||
      coalesce(v_invoice.buyer_snapshot->>'address_line','')||' '||
      coalesce(v_invoice.buyer_snapshot->>'subdistrict','')||' '||
      coalesce(v_invoice.buyer_snapshot->>'district','')||' '||
      coalesce(v_invoice.buyer_snapshot->>'province','')||' '||
      coalesce(v_invoice.buyer_snapshot->>'postal_code','')||E'\n'||
      repeat('-',32)||E'\n'||v_items||E'\n'||repeat('-',32)||E'\n'||
      'ยอดสุทธิ: '||coalesce(v_invoice.order_snapshot->>'grand_total','0')||E'\n'||
      'ภาษี: '||coalesce(v_invoice.tax_snapshot->>'tax_total','0')||E'\n'||
      'เอกสารอ้างอิงจากข้อมูล CpIPOS';
    v_order.id:=v_invoice.order_id;
  end if;

  v_idempotency:=left('crm:'||v_document_type||':'||p_document_id::text||':'||p_printer_id::text||':'||p_request_id::text,180);
  insert into public.print_jobs(
    tenant_id,branch_id,order_id,printer_id,printer_role,connection_type,status,
    payload_text,payload_json,max_retry_count,created_by,idempotency_key,metadata
  ) values(
    p_tenant_id,p_branch_id,v_order.id,p_printer_id,'receipt',v_printer.connection_type,'pending',
    v_payload,
    jsonb_build_object(
      'document_type',v_document_type,'document_id',p_document_id,'printer_name',v_printer.printer_name,
      'paper_width_mm',v_printer.paper_width_mm,'source','customer_portal'
    ),
    3,v_actor,v_idempotency,
    jsonb_build_object(
      'request_source','customer_portal_remote_print',
      'document_type',v_document_type,
      'document_id',p_document_id,
      'paper_width_mm',v_printer.paper_width_mm,
      'render_policy','escpos_text_fast_v1',
      'fast_text_mode',true,
      'requested_by',v_actor,
      'approved_by',v_approver,
      'approved_role',v_approver_role
    )
  )
  on conflict(tenant_id,branch_id,idempotency_key) where idempotency_key is not null
  do update set updated_at=public.print_jobs.updated_at
  returning * into v_job;

  if v_document_type='tax_invoice' then
    update public.pos_tax_invoices
    set print_count=coalesce(print_count,0)+1,last_printed_at=now(),updated_at=now()
    where id=v_invoice.id and tenant_id=p_tenant_id and branch_id=p_branch_id;
  end if;

  insert into public.audit_logs(
    tenant_id,branch_id,actor_user_id,actor_role,action,target_table,target_id,
    metadata,user_id,role,module,entity_type,entity_id,override_by_user_id
  ) values(
    p_tenant_id,p_branch_id,v_actor,v_role,'customer_portal_remote_print_queued',
    'print_jobs',v_job.id,
    jsonb_build_object(
      'document_type',v_document_type,'document_id',p_document_id,'printer_id',p_printer_id,
      'printer_name',v_printer.printer_name,'request_id',p_request_id,'source','customer_portal'
    ),
    v_actor,v_role,'customer_portal','print_job',v_job.id::text,v_approver
  );

  return jsonb_build_object(
    'job_id',v_job.id,'status',v_job.status::text,'printer_id',p_printer_id,
    'printer_name',v_printer.printer_name,'document_type',v_document_type,'queued_at',v_job.created_at
  );
end
$function$;

revoke all on function app.customer_portal_printer_matches_agent(jsonb,uuid,text) from public,anon,authenticated;
grant execute on function app.customer_portal_printer_matches_agent(jsonb,uuid,text) to service_role;
revoke all on function public.customer_portal_pos_admin_phase4_print_state(uuid,uuid) from public,anon;
grant execute on function public.customer_portal_pos_admin_phase4_print_state(uuid,uuid) to authenticated;
revoke all on function public.customer_portal_pos_admin_phase4_queue_print(uuid,uuid,text,uuid,uuid,text,uuid) from public,anon;
grant execute on function public.customer_portal_pos_admin_phase4_queue_print(uuid,uuid,text,uuid,uuid,text,uuid) to authenticated;
