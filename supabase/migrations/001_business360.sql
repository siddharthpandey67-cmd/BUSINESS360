-- BUSINESS360 initial multi-tenant database.
-- Run this file in Supabase SQL Editor. Never disable RLS in production.
create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  owner_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','manager','accountant','sales','inventory','viewer')),
  created_at timestamptz not null default now(),
  unique (organization_id,user_id)
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 180),
  sku text,
  selling_price numeric(12,2) not null default 0 check (selling_price >= 0),
  stock_quantity numeric(12,3) not null default 0 check (stock_quantity >= 0),
  created_at timestamptz not null default now()
);
create index if not exists products_org_idx on public.products(organization_id);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists customers_org_idx on public.customers(organization_id);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_number text not null,
  customer_id uuid references public.customers(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','issued','paid','partially_paid','cancelled')),
  subtotal numeric(12,2) not null default 0,
  tax_total numeric(12,2) not null default 0,
  grand_total numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (organization_id,invoice_number)
);
create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  description text not null,
  quantity numeric(12,3) not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  line_total numeric(12,2) not null check (line_total >= 0)
);
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  description text not null,
  amount numeric(12,2) not null check (amount >= 0),
  expense_date date not null default current_date,
  created_at timestamptz not null default now()
);
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  created_at timestamptz not null default now()
);

create or replace function public.is_org_member(org_id uuid)
returns boolean language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.organization_id = org_id and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_org_owner(org_id uuid)
returns boolean language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.organization_id = org_id and m.user_id = auth.uid() and m.role = 'owner'
  );
$$;

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.expenses enable row level security;
alter table public.audit_logs enable row level security;

-- A signed-in user can create their own business; no platform admin approval.
drop policy if exists org_select on public.organizations;
create policy org_select on public.organizations for select to authenticated
using (public.is_org_member(id) or owner_id = auth.uid());
drop policy if exists org_insert on public.organizations;
create policy org_insert on public.organizations for insert to authenticated
with check (owner_id = auth.uid());
drop policy if exists org_update on public.organizations;
create policy org_update on public.organizations for update to authenticated
using (public.is_org_owner(id)) with check (public.is_org_owner(id));
drop policy if exists org_delete on public.organizations;
create policy org_delete on public.organizations for delete to authenticated
using (public.is_org_owner(id));

-- Automatically make the creator the owner of the new organization.
create or replace function public.add_org_creator_membership()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.memberships(organization_id,user_id,role)
  values(new.id,new.owner_id,'owner');
  return new;
end;
$$;
drop trigger if exists organization_creator_membership on public.organizations;
create trigger organization_creator_membership
after insert on public.organizations
for each row execute function public.add_org_creator_membership();

drop policy if exists membership_select on public.memberships;
create policy membership_select on public.memberships for select to authenticated
using (user_id = auth.uid() or public.is_org_owner(organization_id));
drop policy if exists membership_insert on public.memberships;
create policy membership_insert on public.memberships for insert to authenticated
with check (public.is_org_owner(organization_id));
drop policy if exists membership_update on public.memberships;
create policy membership_update on public.memberships for update to authenticated
using (public.is_org_owner(organization_id)) with check (public.is_org_owner(organization_id));
drop policy if exists membership_delete on public.memberships;
create policy membership_delete on public.memberships for delete to authenticated
using (public.is_org_owner(organization_id) and role <> 'owner');

-- Owner-only initial product write permissions. Fine-grained staff roles are added in a later migration.
drop policy if exists products_select on public.products;
create policy products_select on public.products for select to authenticated using (public.is_org_member(organization_id));
drop policy if exists products_insert on public.products;
create policy products_insert on public.products for insert to authenticated with check (public.is_org_member(organization_id));
drop policy if exists products_update on public.products;
create policy products_update on public.products for update to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
drop policy if exists products_delete on public.products;
create policy products_delete on public.products for delete to authenticated using (public.is_org_member(organization_id));

drop policy if exists customers_select on public.customers;
create policy customers_select on public.customers for select to authenticated using (public.is_org_member(organization_id));
drop policy if exists customers_insert on public.customers;
create policy customers_insert on public.customers for insert to authenticated with check (public.is_org_member(organization_id));
drop policy if exists customers_update on public.customers;
create policy customers_update on public.customers for update to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
drop policy if exists customers_delete on public.customers;
create policy customers_delete on public.customers for delete to authenticated using (public.is_org_member(organization_id));

drop policy if exists invoices_select on public.invoices;
create policy invoices_select on public.invoices for select to authenticated using (public.is_org_member(organization_id));
drop policy if exists invoices_insert on public.invoices;
create policy invoices_insert on public.invoices for insert to authenticated with check (public.is_org_member(organization_id));
drop policy if exists invoices_update on public.invoices;
create policy invoices_update on public.invoices for update to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
drop policy if exists invoices_delete on public.invoices;
create policy invoices_delete on public.invoices for delete to authenticated using (public.is_org_member(organization_id) and status = 'draft');

drop policy if exists invoice_items_select on public.invoice_items;
create policy invoice_items_select on public.invoice_items for select to authenticated
using (exists(select 1 from public.invoices i where i.id=invoice_id and public.is_org_member(i.organization_id)));
drop policy if exists invoice_items_insert on public.invoice_items;
create policy invoice_items_insert on public.invoice_items for insert to authenticated
with check (exists(select 1 from public.invoices i where i.id=invoice_id and public.is_org_member(i.organization_id)));
drop policy if exists invoice_items_update on public.invoice_items;
create policy invoice_items_update on public.invoice_items for update to authenticated
using (exists(select 1 from public.invoices i where i.id=invoice_id and public.is_org_member(i.organization_id)));
drop policy if exists invoice_items_delete on public.invoice_items;
create policy invoice_items_delete on public.invoice_items for delete to authenticated
using (exists(select 1 from public.invoices i where i.id=invoice_id and public.is_org_member(i.organization_id)));

drop policy if exists expenses_select on public.expenses;
create policy expenses_select on public.expenses for select to authenticated using (public.is_org_member(organization_id));
drop policy if exists expenses_insert on public.expenses;
create policy expenses_insert on public.expenses for insert to authenticated with check (public.is_org_member(organization_id));
drop policy if exists expenses_update on public.expenses;
create policy expenses_update on public.expenses for update to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
drop policy if exists expenses_delete on public.expenses;
create policy expenses_delete on public.expenses for delete to authenticated using (public.is_org_member(organization_id));

drop policy if exists audit_select on public.audit_logs;
create policy audit_select on public.audit_logs for select to authenticated using (public.is_org_member(organization_id));
drop policy if exists audit_insert on public.audit_logs;
create policy audit_insert on public.audit_logs for insert to authenticated with check (public.is_org_member(organization_id) and actor_id = auth.uid());

-- Do not grant anon access to business data. Supabase default grants are constrained by RLS.
