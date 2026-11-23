begin;

create table if not exists public.kfood_user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  language text not null default 'en' check (language in ('en','ko')),
  allergens text[] not null default '{}' check (cardinality(allergens) <= 100 and length(array_to_string(allergens, ',')) <= 10000),
  other varchar(120) not null default '',
  completed boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.kfood_user_profiles enable row level security;
revoke all on public.kfood_user_profiles from public, anon, authenticated;
grant select, insert, update, delete on public.kfood_user_profiles to authenticated;

drop policy if exists kfood_profile_read on public.kfood_user_profiles;
create policy kfood_profile_read on public.kfood_user_profiles for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists kfood_profile_insert on public.kfood_user_profiles;
create policy kfood_profile_insert on public.kfood_user_profiles for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists kfood_profile_update on public.kfood_user_profiles;
create policy kfood_profile_update on public.kfood_user_profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists kfood_profile_delete on public.kfood_user_profiles;
create policy kfood_profile_delete on public.kfood_user_profiles for delete to authenticated using ((select auth.uid()) = user_id);

-- No user ID argument: callers can only delete the account identified by their verified JWT.
create or replace function public.kfood_delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare caller uuid := auth.uid();
begin
  if caller is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  delete from auth.users where id = caller;
end;
$$;
revoke all on function public.kfood_delete_my_account() from public, anon, authenticated;
grant execute on function public.kfood_delete_my_account() to authenticated;

commit;
