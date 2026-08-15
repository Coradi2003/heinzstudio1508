-- ============================================================
-- Patricia Heinz Nail Designer — Supabase Schema
-- Rode este script no SQL Editor do seu projeto:
--   https://rcrcigxmegnsrvpspkfi.supabase.co → SQL Editor → New query
-- ============================================================

-- Lançamentos (rendas e despesas)
-- amount/paid/total_amount são armazenados em CENTAVOS (inteiro).
create table if not exists public.entries (
  id                  text primary key,
  type                text not null check (type in ('income', 'expense')),
  scope               text not null check (scope in ('empresa', 'pessoal')),
  category_id         text not null,
  description         text not null default '',
  amount              bigint not null,
  paid                bigint not null default 0,
  date                text not null,
  fixed               boolean not null default false,
  installment_index   integer,
  installment_count   integer,
  total_amount        bigint,
  group_id            text,
  from_reserve        boolean not null default false,
  paid_upfront        boolean not null default false,
  created_at          text not null default now()::text
);

create index if not exists entries_date_idx on public.entries (date);
create index if not exists entries_scope_idx on public.entries (scope);

-- Categorias
create table if not exists public.categories (
  id    text primary key,
  name  text not null,
  color text not null default '#34d399',
  icon  text not null default 'Tag'
);

-- Meta (por enquanto: reserva)
create table if not exists public.meta (
  id      integer primary key check (id = 1),
  reserve bigint not null default 0
);

-- ============================================================
-- Usuários e permissões
-- Todo novo usuário começa como viewer. A promoção para admin deve
-- ser feita manualmente por um administrador no SQL Editor.
-- ============================================================

create table if not exists public.profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  name       text,
  role       text not null default 'viewer' check (role in ('admin', 'viewer')),
  created_at timestamptz not null default now()
);

-- Cria automaticamente o perfil quando uma conta nasce no Supabase Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    'viewer'
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Função usada pelas policies sem provocar recursão na tabela profiles.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- ============================================================
-- Row Level Security
-- Usuários autenticados leem. Apenas admin altera os dados.
-- ============================================================

alter table public.entries enable row level security;
alter table public.categories enable row level security;
alter table public.meta enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "entries_select" on public.entries;
create policy "entries_select" on public.entries
  for select to authenticated using (true);

drop policy if exists "entries_insert" on public.entries;
create policy "entries_insert" on public.entries
  for insert to authenticated with check (public.is_admin());

drop policy if exists "entries_update" on public.entries;
create policy "entries_update" on public.entries
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "entries_delete" on public.entries;
create policy "entries_delete" on public.entries
  for delete to authenticated using (public.is_admin());

drop policy if exists "categories_select" on public.categories;
create policy "categories_select" on public.categories
  for select to authenticated using (true);

drop policy if exists "categories_insert" on public.categories;
create policy "categories_insert" on public.categories
  for insert to authenticated with check (public.is_admin());

drop policy if exists "categories_update" on public.categories;
create policy "categories_update" on public.categories
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "categories_delete" on public.categories;
create policy "categories_delete" on public.categories
  for delete to authenticated using (public.is_admin());

drop policy if exists "meta_select" on public.meta;
create policy "meta_select" on public.meta
  for select to authenticated using (true);

drop policy if exists "meta_insert" on public.meta;
create policy "meta_insert" on public.meta
  for insert to authenticated with check (public.is_admin());

drop policy if exists "meta_update" on public.meta;
create policy "meta_update" on public.meta
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "meta_delete" on public.meta;
create policy "meta_delete" on public.meta
  for delete to authenticated using (public.is_admin());

-- Cada usuário pode visualizar somente o próprio perfil.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (user_id = auth.uid());

-- Garante o perfil de usuários que tenham sido criados antes do trigger.
insert into public.profiles (user_id, name, role)
select
  id,
  coalesce(raw_user_meta_data ->> 'name', split_part(email, '@', 1)),
  'viewer'
from auth.users
on conflict (user_id) do nothing;
