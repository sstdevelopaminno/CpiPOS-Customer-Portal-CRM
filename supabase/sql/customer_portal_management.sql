-- Mirrors the CpiPOS-001 Customer Portal management functions deployed on 2026-10-06.
-- All mutation RPCs validate auth.uid() against Owner/Manager branch scope.
-- anon has no EXECUTE grants on these functions.

CREATE OR REPLACE FUNCTION public.customer_portal_cancel_order(p_tenant_id uuid, p_branch_id uuid, p_order_id uuid, p_reason text DEFAULT 'Cancelled from Customer Portal'::text)
 RETURNS TABLE(order_id uuid, already_cancelled boolean, restored_ingredient_count integer, restored_quantity numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'app'
AS $function$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null or not exists(
    select 1 from public.user_branch_roles ubr
    where ubr.user_id=v_actor and ubr.tenant_id=p_tenant_id
      and (
        ubr.role::text='owner'
        or (ubr.role::text='manager' and ubr.branch_id=p_branch_id)
      )
  ) then
    raise exception using errcode='42501',message='customer_portal_forbidden';
  end if;

  return query
  select *
  from app.void_order_and_restore_stock_tx(
    p_tenant_id,p_branch_id,p_order_id,v_actor,
    left(coalesce(nullif(btrim(p_reason),''),'Cancelled from Customer Portal'),240),
    false
  );
end;
$function$


CREATE OR REPLACE FUNCTION public.customer_portal_delete_ingredient(p_tenant_id uuid, p_branch_id uuid, p_ingredient_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null or not exists(
    select 1 from public.user_branch_roles ubr
    where ubr.user_id=v_actor and ubr.tenant_id=p_tenant_id
      and (
        ubr.role::text='owner'
        or (ubr.role::text='manager' and ubr.branch_id=p_branch_id)
      )
  ) then
    raise exception using errcode='42501',message='customer_portal_forbidden';
  end if;

  if exists(
    select 1 from public.recipes r
    where r.tenant_id=p_tenant_id and r.branch_id=p_branch_id and r.ingredient_id=p_ingredient_id
  ) then
    raise exception using errcode='P0001',message='ingredient_in_use_by_recipe';
  end if;

  if exists(
    select 1 from public.stock_movements sm
    where sm.tenant_id=p_tenant_id and sm.branch_id=p_branch_id and sm.ingredient_id=p_ingredient_id
  ) then
    raise exception using errcode='P0001',message='ingredient_has_stock_history';
  end if;

  delete from public.ingredients
  where id=p_ingredient_id and tenant_id=p_tenant_id and branch_id=p_branch_id;

  if not found then
    raise exception using errcode='P0002',message='ingredient_not_found';
  end if;

  return true;
end;
$function$


CREATE OR REPLACE FUNCTION public.customer_portal_delete_product(p_tenant_id uuid, p_branch_id uuid, p_product_id uuid, p_reason text DEFAULT 'Removed from Customer Portal'::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null or not exists(
    select 1 from public.user_branch_roles ubr
    where ubr.user_id=v_actor and ubr.tenant_id=p_tenant_id
      and (
        ubr.role::text='owner'
        or (ubr.role::text='manager' and ubr.branch_id=p_branch_id)
      )
  ) then
    raise exception using errcode='42501',message='customer_portal_forbidden';
  end if;

  update public.products
  set is_active=false,
      deleted_at=now(),
      deleted_by=v_actor,
      delete_reason=left(coalesce(nullif(btrim(p_reason),''),'Removed from Customer Portal'),240),
      restore_until=now()+interval '30 days',
      updated_at=now()
  where id=p_product_id and tenant_id=p_tenant_id and branch_id=p_branch_id and deleted_at is null;

  if not found then
    raise exception using errcode='P0002',message='product_not_found';
  end if;
  return true;
end;
$function$


CREATE OR REPLACE FUNCTION public.customer_portal_products_v2(p_tenant_id uuid, p_branch_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, branch_id uuid, sku text, name text, category text, price numeric, is_combo boolean, is_active boolean, stock_deduction_mode text, sell_unit text, thumbnail_object_path text, display_object_path text, available_quantity numeric, recipe_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
  v_is_owner boolean := false;
begin
  if v_actor is null then
    raise exception using errcode='42501',message='customer_portal_unauthenticated';
  end if;

  select exists(
    select 1 from public.user_branch_roles ubr
    where ubr.user_id=v_actor and ubr.tenant_id=p_tenant_id and ubr.role::text='owner'
  ) into v_is_owner;

  if not v_is_owner and not exists(
    select 1 from public.user_branch_roles ubr
    where ubr.user_id=v_actor and ubr.tenant_id=p_tenant_id and ubr.role::text='manager'
      and (p_branch_id is null or ubr.branch_id=p_branch_id)
  ) then
    raise exception using errcode='42501',message='customer_portal_forbidden';
  end if;

  return query
  select
    p.id,
    p.branch_id,
    p.sku::text,
    p.name::text,
    p.category::text,
    p.price,
    p.is_combo,
    p.is_active,
    p.stock_deduction_mode::text,
    p.sell_unit::text,
    a.thumbnail_object_path::text,
    a.display_object_path::text,
    case
      when coalesce(rs.recipe_count,0)=0 then null
      else rs.available_quantity
    end as available_quantity,
    coalesce(rs.recipe_count,0)::bigint
  from public.products p
  left join public.product_media_assets a
    on a.tenant_id=p.tenant_id and a.branch_id=p.branch_id and a.product_id=p.id
  left join lateral (
    select
      count(*)::bigint as recipe_count,
      min(
        case
          when r.quantity_per_item > 0
          then floor(coalesce(i.quantity_on_hand,0) / r.quantity_per_item)
          else null
        end
      )::numeric as available_quantity
    from public.recipes r
    join public.ingredients i
      on i.id=r.ingredient_id and i.tenant_id=r.tenant_id and i.branch_id=r.branch_id
    where r.tenant_id=p.tenant_id and r.branch_id=p.branch_id and r.product_id=p.id
  ) rs on true
  where p.tenant_id=p_tenant_id
    and p.deleted_at is null
    and (p_branch_id is null or p.branch_id=p_branch_id)
    and (
      v_is_owner or exists(
        select 1 from public.user_branch_roles actor
        where actor.user_id=v_actor
          and actor.tenant_id=p.tenant_id
          and actor.branch_id=p.branch_id
          and actor.role::text='manager'
      )
    )
  order by p.is_active desc,p.name,p.sku;
end;
$function$


CREATE OR REPLACE FUNCTION public.customer_portal_update_order(p_tenant_id uuid, p_branch_id uuid, p_order_id uuid, p_customer_name text, p_notes text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null or not exists(
    select 1 from public.user_branch_roles ubr
    where ubr.user_id=v_actor and ubr.tenant_id=p_tenant_id
      and (
        ubr.role::text='owner'
        or (ubr.role::text='manager' and ubr.branch_id=p_branch_id)
      )
  ) then
    raise exception using errcode='42501',message='customer_portal_forbidden';
  end if;

  update public.orders
  set customer_name=nullif(btrim(coalesce(p_customer_name,'')),''),
      notes=nullif(left(btrim(coalesce(p_notes,'')),1000),''),
      updated_at=now()
  where id=p_order_id and tenant_id=p_tenant_id and branch_id=p_branch_id;

  if not found then
    raise exception using errcode='P0002',message='order_not_found';
  end if;
  return true;
end;
$function$


CREATE OR REPLACE FUNCTION public.customer_portal_update_staff(p_tenant_id uuid, p_branch_id uuid, p_user_id uuid, p_full_name text, p_employee_code text, p_position_title text, p_branch_role text, p_permission_role text, p_is_active boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
  v_actor_owner boolean := false;
  v_target_role text;
begin
  if v_actor is null then
    raise exception using errcode='42501',message='customer_portal_unauthenticated';
  end if;

  select exists(
    select 1 from public.user_branch_roles ubr
    where ubr.user_id=v_actor and ubr.tenant_id=p_tenant_id and ubr.role::text='owner'
  ) into v_actor_owner;

  if not v_actor_owner and not exists(
    select 1 from public.user_branch_roles ubr
    where ubr.user_id=v_actor and ubr.tenant_id=p_tenant_id
      and ubr.branch_id=p_branch_id and ubr.role::text='manager'
  ) then
    raise exception using errcode='42501',message='customer_portal_forbidden';
  end if;

  select ubr.role::text into v_target_role
  from public.user_branch_roles ubr
  where ubr.user_id=p_user_id and ubr.tenant_id=p_tenant_id and ubr.branch_id=p_branch_id
  limit 1;

  if v_target_role is null then
    raise exception using errcode='P0002',message='staff_not_found';
  end if;

  if not v_actor_owner and v_target_role in ('owner','manager') then
    raise exception using errcode='42501',message='manager_cannot_edit_privileged_staff';
  end if;

  if p_branch_role not in ('owner','manager','staff','kitchen') then
    raise exception using errcode='22023',message='invalid_branch_role';
  end if;

  if not v_actor_owner and p_branch_role in ('owner','manager') then
    raise exception using errcode='42501',message='manager_cannot_grant_privileged_role';
  end if;

  if btrim(coalesce(p_employee_code,''))='' or length(btrim(p_employee_code))>32 then
    raise exception using errcode='22023',message='invalid_employee_code';
  end if;
  if btrim(coalesce(p_full_name,''))='' or length(btrim(p_full_name))>180 then
    raise exception using errcode='22023',message='invalid_full_name';
  end if;

  update public.users_profiles
  set full_name=btrim(p_full_name),
      is_active=coalesce(p_is_active,true),
      archived_at=case when coalesce(p_is_active,true) then null else coalesce(archived_at,now()) end,
      updated_at=now()
  where id=p_user_id;

  update public.pos_user_profiles
  set employee_code=btrim(p_employee_code),
      position_title=left(coalesce(p_position_title,''),120),
      permission_role=left(coalesce(nullif(btrim(p_permission_role),''),'pos_user'),80),
      updated_at=now()
  where tenant_id=p_tenant_id and user_id=p_user_id;

  update public.user_branch_roles
  set role=p_branch_role::public.branch_role
  where tenant_id=p_tenant_id and branch_id=p_branch_id and user_id=p_user_id;

  return true;
exception
  when unique_violation then
    raise exception using errcode='23505',message='duplicate_employee_code';
end;
$function$


CREATE OR REPLACE FUNCTION public.customer_portal_upsert_ingredient(p_tenant_id uuid, p_branch_id uuid, p_ingredient_id uuid, p_name text, p_base_unit text, p_quantity_on_hand numeric, p_reorder_level numeric, p_avg_unit_cost numeric DEFAULT 0, p_last_purchase_unit_cost numeric DEFAULT 0, p_reason text DEFAULT 'Customer Portal stock update'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'app'
AS $function$
declare
  v_actor uuid := (select auth.uid());
  v_id uuid;
  v_current numeric := 0;
  v_delta numeric := 0;
  v_movement_id uuid;
  v_approval_id uuid;
begin
  if v_actor is null or not exists(
    select 1 from public.user_branch_roles ubr
    where ubr.user_id=v_actor and ubr.tenant_id=p_tenant_id
      and (
        ubr.role::text='owner'
        or (ubr.role::text='manager' and ubr.branch_id=p_branch_id)
      )
  ) then
    raise exception using errcode='42501',message='customer_portal_forbidden';
  end if;

  if btrim(coalesce(p_name,''))='' or length(btrim(p_name))>180 then
    raise exception using errcode='22023',message='invalid_ingredient_name';
  end if;
  if btrim(coalesce(p_base_unit,''))='' or length(btrim(p_base_unit))>40 then
    raise exception using errcode='22023',message='invalid_base_unit';
  end if;
  if coalesce(p_quantity_on_hand,0)<0 or coalesce(p_reorder_level,0)<0
     or coalesce(p_avg_unit_cost,0)<0 or coalesce(p_last_purchase_unit_cost,0)<0 then
    raise exception using errcode='22023',message='invalid_stock_value';
  end if;

  if p_ingredient_id is null then
    insert into public.ingredients(
      tenant_id,branch_id,name,base_unit,quantity_on_hand,reorder_level,avg_unit_cost,last_purchase_unit_cost
    )
    values(
      p_tenant_id,p_branch_id,btrim(p_name),btrim(p_base_unit),0,coalesce(p_reorder_level,0),
      coalesce(p_avg_unit_cost,0),coalesce(p_last_purchase_unit_cost,0)
    )
    returning id into v_id;
    v_current := 0;
  else
    select quantity_on_hand into v_current
    from public.ingredients
    where id=p_ingredient_id and tenant_id=p_tenant_id and branch_id=p_branch_id
    for update;

    if not found then
      raise exception using errcode='P0002',message='ingredient_not_found';
    end if;

    update public.ingredients
    set name=btrim(p_name),
        base_unit=btrim(p_base_unit),
        reorder_level=coalesce(p_reorder_level,0),
        avg_unit_cost=coalesce(p_avg_unit_cost,0),
        last_purchase_unit_cost=coalesce(p_last_purchase_unit_cost,0),
        updated_at=now()
    where id=p_ingredient_id and tenant_id=p_tenant_id and branch_id=p_branch_id;
    v_id := p_ingredient_id;
  end if;

  v_delta := coalesce(p_quantity_on_hand,0)-coalesce(v_current,0);

  if v_delta <> 0 then
    if v_current + v_delta < 0 then
      raise exception using errcode='22023',message='insufficient_stock';
    end if;

    v_movement_id := gen_random_uuid();
    v_approval_id := gen_random_uuid();

    insert into public.manager_pin_approvals(
      id,tenant_id,branch_id,action,requested_by,approved_by,target_table,target_id,note,approved_at,expires_at
    )
    values(
      v_approval_id,p_tenant_id,p_branch_id,'stock_adjustment',v_actor,v_actor,
      'stock_movements',v_movement_id,left(coalesce(p_reason,'Customer Portal stock update'),240),
      now(),now()+interval '10 minutes'
    );

    update public.ingredients
    set quantity_on_hand=coalesce(p_quantity_on_hand,0),updated_at=now()
    where id=v_id and tenant_id=p_tenant_id and branch_id=p_branch_id;

    insert into public.stock_movements(
      id,tenant_id,branch_id,ingredient_id,movement_type,quantity_delta,reason,
      approval_id,created_by,request_id
    )
    values(
      v_movement_id,p_tenant_id,p_branch_id,v_id,'manual_adjustment',v_delta,
      left(coalesce(p_reason,'Customer Portal stock update'),240),v_approval_id,v_actor,
      'portal:'||v_movement_id::text
    );

    update public.manager_pin_approvals
    set consumed_at=now()
    where id=v_approval_id;
  end if;

  return v_id;
exception
  when unique_violation then
    raise exception using errcode='23505',message='duplicate_ingredient_name';
end;
$function$


CREATE OR REPLACE FUNCTION public.customer_portal_upsert_product(p_tenant_id uuid, p_branch_id uuid, p_product_id uuid, p_sku text, p_name text, p_category text, p_price numeric, p_is_active boolean, p_sell_unit text DEFAULT 'unit'::text, p_stock_deduction_mode text DEFAULT 'unit_only'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
  v_id uuid;
  v_sell_unit text := btrim(coalesce(p_sell_unit,'unit'));
  v_stock_mode text := btrim(coalesce(p_stock_deduction_mode,'unit_only'));
begin
  if v_actor is null or not exists(
    select 1 from public.user_branch_roles ubr
    where ubr.user_id=v_actor and ubr.tenant_id=p_tenant_id
      and (
        ubr.role::text='owner'
        or (ubr.role::text='manager' and ubr.branch_id=p_branch_id)
      )
  ) then
    raise exception using errcode='42501',message='customer_portal_forbidden';
  end if;

  if btrim(coalesce(p_sku,''))='' or length(btrim(p_sku))>80 then
    raise exception using errcode='22023',message='invalid_sku';
  end if;
  if btrim(coalesce(p_name,''))='' or length(btrim(p_name))>180 then
    raise exception using errcode='22023',message='invalid_product_name';
  end if;
  if btrim(coalesce(p_category,''))='' or length(btrim(p_category))>120 then
    raise exception using errcode='22023',message='invalid_category';
  end if;
  if p_price is null or p_price < 0 or p_price > 100000000 then
    raise exception using errcode='22023',message='invalid_price';
  end if;
  if v_sell_unit='' or length(v_sell_unit)>40 then
    raise exception using errcode='22023',message='invalid_sell_unit';
  end if;
  if v_stock_mode not in ('unit_only','recipe_deduction') then
    raise exception using errcode='22023',message='invalid_stock_deduction_mode';
  end if;

  if p_product_id is null then
    insert into public.products(
      tenant_id,branch_id,sku,name,category,price,is_active,sell_unit,stock_deduction_mode
    )
    values(
      p_tenant_id,p_branch_id,btrim(p_sku),btrim(p_name),btrim(p_category),p_price,
      coalesce(p_is_active,true),v_sell_unit,v_stock_mode
    )
    returning id into v_id;
  else
    update public.products
    set sku=btrim(p_sku),
        name=btrim(p_name),
        category=btrim(p_category),
        price=p_price,
        is_active=coalesce(p_is_active,true),
        sell_unit=v_sell_unit,
        stock_deduction_mode=v_stock_mode,
        updated_at=now()
    where id=p_product_id
      and tenant_id=p_tenant_id
      and branch_id=p_branch_id
      and deleted_at is null
    returning id into v_id;

    if v_id is null then
      raise exception using errcode='P0002',message='product_not_found';
    end if;
  end if;

  return v_id;
exception
  when unique_violation then
    raise exception using errcode='23505',message='duplicate_product_sku';
end;
$function$


-- Grants
revoke all on function public.customer_portal_products_v2(uuid,uuid) from public,anon;
grant execute on function public.customer_portal_products_v2(uuid,uuid) to authenticated;
revoke all on function public.customer_portal_upsert_product(uuid,uuid,uuid,text,text,text,numeric,boolean,text,text) from public,anon;
grant execute on function public.customer_portal_upsert_product(uuid,uuid,uuid,text,text,text,numeric,boolean,text,text) to authenticated;
revoke all on function public.customer_portal_delete_product(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.customer_portal_delete_product(uuid,uuid,uuid,text) to authenticated;
revoke all on function public.customer_portal_upsert_ingredient(uuid,uuid,uuid,text,text,numeric,numeric,numeric,numeric,text) from public,anon;
grant execute on function public.customer_portal_upsert_ingredient(uuid,uuid,uuid,text,text,numeric,numeric,numeric,numeric,text) to authenticated;
revoke all on function public.customer_portal_delete_ingredient(uuid,uuid,uuid) from public,anon;
grant execute on function public.customer_portal_delete_ingredient(uuid,uuid,uuid) to authenticated;
revoke all on function public.customer_portal_update_order(uuid,uuid,uuid,text,text) from public,anon;
grant execute on function public.customer_portal_update_order(uuid,uuid,uuid,text,text) to authenticated;
revoke all on function public.customer_portal_cancel_order(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.customer_portal_cancel_order(uuid,uuid,uuid,text) to authenticated;
revoke all on function public.customer_portal_update_staff(uuid,uuid,uuid,text,text,text,text,text,boolean) from public,anon;
grant execute on function public.customer_portal_update_staff(uuid,uuid,uuid,text,text,text,text,text,boolean) to authenticated;
