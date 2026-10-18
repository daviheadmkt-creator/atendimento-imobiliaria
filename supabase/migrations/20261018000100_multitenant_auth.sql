begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete restrict,
  role text not null check (role in ('owner', 'admin', 'manager', 'agent')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index memberships_user_status_organization_idx
  on public.memberships (user_id, status, organization_id);
create index memberships_organization_role_status_idx
  on public.memberships (organization_id, role, status);

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;

create function private.current_org_role(p_organization_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $function$
  select membership.role
  from public.memberships as membership
  where membership.organization_id = p_organization_id
    and membership.user_id = (select auth.uid())
    and membership.status = 'active'
  limit 1;
$function$;

create function private.has_org_role(p_organization_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.memberships as membership
    where membership.organization_id = p_organization_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
      and membership.role = any (p_roles)
  );
$function$;

create function private.can_manage_membership(
  p_organization_id uuid,
  p_target_user_id uuid,
  p_target_role text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce((
    select case
      when actor.role = 'owner' then p_target_role in ('admin', 'manager', 'agent')
      when actor.role = 'admin' then p_target_role in ('manager', 'agent')
      else false
    end
    from public.memberships as actor
    where actor.organization_id = p_organization_id
      and actor.user_id = (select auth.uid())
      and actor.status = 'active'
      and p_target_user_id is distinct from actor.user_id
    limit 1
  ), false);
$function$;

revoke all on function private.current_org_role(uuid) from public, anon, authenticated;
revoke all on function private.has_org_role(uuid, text[]) from public, anon, authenticated;
revoke all on function private.can_manage_membership(uuid, uuid, text) from public, anon, authenticated;
grant execute on function private.current_org_role(uuid) to authenticated;
grant execute on function private.has_org_role(uuid, text[]) to authenticated;
grant execute on function private.can_manage_membership(uuid, uuid, text) to authenticated;

create function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 120), '')
  )
  on conflict (id) do nothing;

  return new;
end;
$function$;

revoke all on function private.handle_new_auth_user() from public, anon, authenticated;

insert into public.profiles (id, display_name)
select
  auth_user.id,
  nullif(left(btrim(coalesce(auth_user.raw_user_meta_data ->> 'full_name', '')), 120), '')
from auth.users as auth_user
on conflict (id) do nothing;

create trigger on_auth_user_created_create_profile
  after insert on auth.users
  for each row execute function private.handle_new_auth_user();

create function public.create_organization(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_name text := nullif(btrim(p_name), '');
  v_organization_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication is required to create an organization'
      using errcode = '42501';
  end if;

  perform 1
  from auth.users as auth_user
  where auth_user.id = v_user_id
  for update;

  if not found then
    raise exception 'Authenticated user no longer exists'
      using errcode = '42501';
  end if;

  if v_name is null or char_length(v_name) > 120 then
    raise exception 'Organization name must contain between 1 and 120 characters'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.memberships as membership
    where membership.user_id = v_user_id
  ) then
    raise exception 'An organization membership already exists for this user'
      using errcode = '42501';
  end if;

  insert into public.organizations (name, created_by)
  values (v_name, v_user_id)
  returning id into v_organization_id;

  insert into public.memberships (organization_id, user_id, role, created_by)
  values (v_organization_id, v_user_id, 'owner', v_user_id);

  return v_organization_id;
end;
$function$;

revoke all on function public.create_organization(text) from public, anon, authenticated;
grant execute on function public.create_organization(text) to authenticated;

create policy organizations_select_members
  on public.organizations for select to authenticated
  using (private.current_org_role(id) is not null);

create policy organizations_update_owners_and_admins
  on public.organizations for update to authenticated
  using (private.has_org_role(id, array['owner', 'admin']))
  with check (private.has_org_role(id, array['owner', 'admin']));

create policy profiles_select_self
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_update_self
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy memberships_select_self_or_managers
  on public.memberships for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.has_org_role(organization_id, array['owner', 'admin'])
  );

create policy memberships_insert_managed_roles
  on public.memberships for insert to authenticated
  with check (
    status = 'active'
    and created_by = (select auth.uid())
    and private.can_manage_membership(organization_id, user_id, role)
  );

create policy memberships_update_managed_roles
  on public.memberships for update to authenticated
  using (private.can_manage_membership(organization_id, user_id, role))
  with check (
    private.can_manage_membership(organization_id, user_id, role)
    and status in ('active', 'suspended')
  );

create policy memberships_delete_managed_roles
  on public.memberships for delete to authenticated
  using (private.can_manage_membership(organization_id, user_id, role));

revoke all on public.organizations, public.profiles, public.memberships from anon, authenticated;
grant select on public.organizations to anon;
grant select on public.organizations, public.profiles, public.memberships to authenticated;
grant update (name) on public.organizations to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant insert (organization_id, user_id, role) on public.memberships to authenticated;
grant update (role, status) on public.memberships to authenticated;
grant delete on public.memberships to authenticated;

commit;