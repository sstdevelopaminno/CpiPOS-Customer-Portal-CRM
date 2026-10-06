-- CpiPOS Customer Portal Phase 2
-- Applied to CpiPOS-001 on 2026-10-06.

create or replace function public.customer_portal_dashboard_v2(
  p_tenant_id uuid,
  p_branch_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_authorized boolean := false;
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

  select exists (
    select 1
    from public.user_branch_roles ubr
    where ubr.user_id = (select auth.uid())
      and ubr.tenant_id = p_tenant_id
      and ubr.role::text in ('owner','manager')
      and (p_branch_id is null or ubr.branch_id = p_branch_id)
  ) into v_authorized;

  if not v_authorized then
    raise exception using errcode='42501', message='customer_portal_forbidden';
  end if;

  select coalesce(sum(coalesce(o.grand_total,o.total_amount,0)),0),count(*)
  into v_sales,v_orders
  from public.orders o
  where o.tenant_id=p_tenant_id
    and (p_branch_id is null or o.branch_id=p_branch_id)
    and o.status::text='completed'
    and o.created_at>=p_from
    and o.created_at<p_to;

  select count(*) into v_products
  from public.products p
  where p.tenant_id=p_tenant_id
    and (p_branch_id is null or p.branch_id=p_branch_id)
    and p.is_active=true
    and p.deleted_at is null;

  select count(*) into v_branches
  from public.branches b
  where b.tenant_id=p_tenant_id
    and (p_branch_id is null or b.id=p_branch_id)
    and b.is_active=true;

  select count(*) into v_low_stock
  from public.ingredients i
  where i.tenant_id=p_tenant_id
    and (p_branch_id is null or i.branch_id=p_branch_id)
    and i.reorder_level is not null
    and i.quantity_on_hand<=i.reorder_level;

  select count(*) into v_open_shifts
  from public.shifts s
  where s.tenant_id=p_tenant_id
    and (p_branch_id is null or s.branch_id=p_branch_id)
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
$$;

revoke all on function public.customer_portal_dashboard_v2(uuid,uuid,timestamptz,timestamptz) from public,anon;
grant execute on function public.customer_portal_dashboard_v2(uuid,uuid,timestamptz,timestamptz) to authenticated;

create or replace function public.customer_portal_staff(
  p_tenant_id uuid,
  p_branch_id uuid default null
)
returns table(
  user_id uuid,
  full_name text,
  employee_code text,
  position_title text,
  permission_role text,
  branch_id uuid,
  branch_name text,
  branch_role text,
  is_active boolean
)
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_is_owner boolean:=false;
  v_authorized boolean:=false;
begin
  select exists (
    select 1 from public.user_branch_roles actor
    where actor.user_id=(select auth.uid())
      and actor.tenant_id=p_tenant_id
      and actor.role::text='owner'
  ) into v_is_owner;

  select (
    v_is_owner or exists (
      select 1 from public.user_branch_roles actor
      where actor.user_id=(select auth.uid())
        and actor.tenant_id=p_tenant_id
        and actor.role::text='manager'
        and (p_branch_id is null or actor.branch_id=p_branch_id)
    )
  ) into v_authorized;

  if not v_authorized then
    raise exception using errcode='42501',message='customer_portal_forbidden';
  end if;

  return query
  select distinct
    up.id,
    up.full_name::text,
    pup.employee_code::text,
    pup.position_title::text,
    pup.permission_role::text,
    ubr.branch_id,
    b.name::text,
    ubr.role::text,
    up.is_active
  from public.user_branch_roles ubr
  join public.users_profiles up on up.id=ubr.user_id and up.archived_at is null
  left join public.pos_user_profiles pup on pup.user_id=up.id and pup.tenant_id=ubr.tenant_id
  join public.branches b on b.id=ubr.branch_id and b.tenant_id=ubr.tenant_id
  where ubr.tenant_id=p_tenant_id
    and (p_branch_id is null or ubr.branch_id=p_branch_id)
    and (
      v_is_owner or exists (
        select 1 from public.user_branch_roles actor
        where actor.user_id=(select auth.uid())
          and actor.tenant_id=p_tenant_id
          and actor.branch_id=ubr.branch_id
          and actor.role::text='manager'
      )
    )
  order by b.name,up.full_name,pup.employee_code;
end;
$$;

revoke all on function public.customer_portal_staff(uuid,uuid) from public,anon;
grant execute on function public.customer_portal_staff(uuid,uuid) to authenticated;
