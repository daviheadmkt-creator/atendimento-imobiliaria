begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
create temporary table test_results (
  test_name text primary key,
  rows_affected integer not null
);
grant select, insert on pg_temp.test_results to authenticated, anon;

select plan(24);

insert into auth.users (
  id, aud, role, email, encrypted_password, confirmed_at,
  raw_app_meta_data, raw_user_meta_data
)
values
  ('10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'owner-a@example.test', '', now(), '{}', '{"full_name":"Owner A"}'),
  ('10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'owner-b@example.test', '', now(), '{}', '{"full_name":"Owner B"}'),
  ('10000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'agent-a@example.test', '', now(), '{}', '{"full_name":"Agent A"}'),
  ('10000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'agent-b@example.test', '', now(), '{}', '{"full_name":"Agent B"}'),
  ('10000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'admin-a@example.test', '', now(), '{}', '{"full_name":"Admin A"}'),
  ('10000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'manager-a@example.test', '', now(), '{}', '{"full_name":"Manager A"}');

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select public.create_organization('Empresa A');
reset role;

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select public.create_organization('Empresa B');
reset role;

insert into public.memberships (organization_id, user_id, role, created_by)
select organization.id, member.id, member.role, organization.created_by
from public.organizations as organization
cross join (values
  ('10000000-0000-0000-0000-000000000003'::uuid, 'agent'::text),
  ('10000000-0000-0000-0000-000000000005'::uuid, 'admin'::text)
) as member(id, role)
where organization.created_by = '10000000-0000-0000-0000-000000000001';

insert into public.memberships (organization_id, user_id, role, created_by)
select organization.id, '10000000-0000-0000-0000-000000000004', 'agent', organization.created_by
from public.organizations as organization
where organization.created_by = '10000000-0000-0000-0000-000000000002';

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select count(*)::integer from public.organizations where created_by = '10000000-0000-0000-0000-000000000001'),
  1,
  'first organization is created for its authenticated owner'
);
select is(
  (select role from public.memberships where user_id = (select auth.uid())),
  'owner',
  'organization creator receives the owner role'
);
select throws_ok(
  $$select public.create_organization('Empresa extra')$$,
  '42501',
  'An organization membership already exists for this user',
  'an owner cannot create a second organization through onboarding'
);
select is((select count(*)::integer from public.organizations), 1, 'owner A can read company A');
select is(
  (select count(*)::integer from public.organizations where created_by = '10000000-0000-0000-0000-000000000002'),
  0,
  'owner A cannot read company B'
);
with changed as (
  update public.organizations set name = 'Empresa A Atualizada'
  where created_by = '10000000-0000-0000-0000-000000000001'
  returning 1
)
insert into pg_temp.test_results
select 'owner_update_company_a', count(*)::integer from changed;
select is(
  (select rows_affected from pg_temp.test_results where test_name = 'owner_update_company_a'),
  1,
  'owner A can update company A'
);
with changed as (
  update public.organizations set name = 'Empresa B Invadida'
  where created_by = '10000000-0000-0000-0000-000000000002'
  returning 1
)
insert into pg_temp.test_results
select 'owner_update_company_b', count(*)::integer from changed;
select is(
  (select rows_affected from pg_temp.test_results where test_name = 'owner_update_company_b'),
  0,
  'owner A cannot update company B with a forged request filter'
);
select is(
  (select count(*)::integer
   from public.memberships
   where organization_id in (select id from public.organizations where created_by = '10000000-0000-0000-0000-000000000002')),
  0,
  'owner A cannot read company B memberships'
);
with changed as (
  update public.memberships set status = 'suspended'
  where user_id = '10000000-0000-0000-0000-000000000004'
  returning 1
)
insert into pg_temp.test_results
select 'owner_update_membership_b', count(*)::integer from changed;
select is(
  (select rows_affected from pg_temp.test_results where test_name = 'owner_update_membership_b'),
  0,
  'owner A cannot update a membership in company B'
);
with removed as (
  delete from public.memberships where user_id = '10000000-0000-0000-0000-000000000004'
  returning 1
)
insert into pg_temp.test_results
select 'owner_delete_membership_b', count(*)::integer from removed;
select is(
  (select rows_affected from pg_temp.test_results where test_name = 'owner_delete_membership_b'),
  0,
  'owner A cannot delete a membership in company B'
);
select throws_ok(
  $$insert into public.memberships (organization_id, user_id, role)
    values ((select id from public.organizations where created_by = '10000000-0000-0000-0000-000000000002'),
            '10000000-0000-0000-0000-000000000001', 'owner')$$,
  '42501',
  'new row violates row-level security policy for table "memberships"',
  'forged organization_id cannot grant owner membership'
);
select is(
  (select count(*)::integer from public.profiles where id = (select auth.uid())),
  1,
  'users can read their own profile'
);
with removed as (
  delete from public.memberships where user_id = (select auth.uid())
  returning 1
)
insert into pg_temp.test_results
select 'owner_remove_self', count(*)::integer from removed;
select is(
  (select rows_affected from pg_temp.test_results where test_name = 'owner_remove_self'),
  0,
  'owner cannot remove the last owner membership'
);
select is(
  (select count(*)::integer from public.profiles where id = '10000000-0000-0000-0000-000000000002'),
  0,
  'users cannot read another user profile'
);
reset role;

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000005', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$update public.memberships set role = 'admin'
    where user_id = '10000000-0000-0000-0000-000000000003'$$,
  '42501',
  'new row violates row-level security policy for table "memberships"',
  'admin cannot promote an agent to admin'
);
reset role;

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
with changed as (
  update public.organizations set name = 'Agent mudou empresa'
  where created_by = '10000000-0000-0000-0000-000000000001'
  returning 1
)
insert into pg_temp.test_results
select 'agent_update_company_a', count(*)::integer from changed;
select is(
  (select rows_affected from pg_temp.test_results where test_name = 'agent_update_company_a'),
  0,
  'agent cannot perform owner-only organization updates'
);
select throws_ok(
  $$select public.create_organization('Outra empresa')$$,
  '42501',
  'An organization membership already exists for this user',
  'an agent cannot create a second organization to gain owner privileges'
);
reset role;

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
with added as (
  insert into public.memberships (organization_id, user_id, role)
  values ((select id from public.organizations where created_by = '10000000-0000-0000-0000-000000000001'),
          '10000000-0000-0000-0000-000000000006', 'manager')
  returning 1
)
insert into pg_temp.test_results
select 'owner_add_manager', count(*)::integer from added;
select is(
  (select rows_affected from pg_temp.test_results where test_name = 'owner_add_manager'),
  1,
  'owner can add a manager to their own organization'
);
with changed as (
  update public.memberships set status = 'suspended'
  where user_id = '10000000-0000-0000-0000-000000000003'
  returning 1
)
insert into pg_temp.test_results
select 'owner_suspend_agent', count(*)::integer from changed;
select is(
  (select rows_affected from pg_temp.test_results where test_name = 'owner_suspend_agent'),
  1,
  'owner can suspend an agent in their own organization'
);
reset role;

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::integer from public.organizations), 0, 'suspended user cannot access organization data');
select is((select count(*)::integer from public.memberships), 1, 'suspended user can only see their own suspended membership');
reset role;

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
delete from public.memberships where user_id = '10000000-0000-0000-0000-000000000003';
reset role;

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::integer from public.organizations), 0, 'removed user cannot access any organization');
select is((select count(*)::integer from public.memberships), 0, 'removed user cannot see the removed membership');
reset role;

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select is((select count(*)::integer from public.organizations), 0, 'unauthenticated users cannot read organizations');
reset role;

select * from finish();
rollback;