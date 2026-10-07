-- Customer Portal billing status follows canonical current entitlement due state.

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
    'runtime',(
      select to_jsonb(r) from (
        select lifecycle_status,access_locked,lock_reason,expires_at,payment_review_status,updated_at
        from public.tenant_subscription_runtime
        where tenant_id=p_tenant_id
        limit 1
      ) r
    ),
    'currentDue',app.subscription_billing_due_state(p_tenant_id,now()),
    'contract',(
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
    'billingCycles',case when v_role='owner' then coalesce((
      select jsonb_agg(to_jsonb(c) order by c.period_end desc)
      from (
        select id,package_id,period_start,period_end,amount_due,amount_paid,status,created_at
        from public.tenant_billing_cycles
        where tenant_id=p_tenant_id
        order by period_end desc
        limit 36
      ) c
    ),'[]'::jsonb) else '[]'::jsonb end,
    'requests',case when v_role='owner' then coalesce((
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
    'issuer',case when v_role='owner' then (
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

revoke all on function public.customer_portal_billing_overview(uuid) from public,anon;
grant execute on function public.customer_portal_billing_overview(uuid) to authenticated;
