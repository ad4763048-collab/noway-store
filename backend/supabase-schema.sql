-- Arquivo unificado do banco do NoWay Store.
-- Execute este arquivo uma vez no Supabase: SQL Editor > New query.
create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id text primary key,
  email text unique not null,
  full_name text not null default '',
  avatar_url text,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('scripts', 'bases', 'bots')),
  name text not null check (char_length(name) between 3 and 120),
  description text not null check (char_length(description) between 3 and 1000),
  price numeric(12,2) not null check (price > 0),
  old_price numeric(12,2) check (old_price is null or old_price > price),
  tag text not null default '',
  badge text not null default '',
  storage_path text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profiles(id),
  user_email text not null,
  total numeric(12,2) not null check (total > 0),
  status text not null default 'pending_payment' check (status in ('pending_payment', 'paid', 'failed', 'refunded')),
  fulfillment_status text not null default 'pending' check (fulfillment_status in ('pending', 'fulfilled', 'refunded')),
  payment_reference text unique,
  payment_id text unique,
  idempotency_key uuid not null default gen_random_uuid(),
  checkout_url text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id),
  product_name text not null,
  quantity integer not null check (quantity between 1 and 10),
  unit_price numeric(12,2) not null check (unit_price > 0)
);

create table if not exists public.consent_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text references public.profiles(id),
  categories jsonb not null,
  policy_version text not null,
  ip_address inet,
  user_agent text not null default '',
  created_at timestamptz not null default now()
);

alter table public.orders add column if not exists idempotency_key uuid;
alter table public.orders add column if not exists checkout_url text;
update public.orders set idempotency_key = gen_random_uuid() where idempotency_key is null;
alter table public.orders alter column idempotency_key set not null;

create unique index if not exists orders_user_id_idempotency_unique_idx on public.orders(user_id, idempotency_key);
create index if not exists orders_user_id_created_at_idx on public.orders(user_id, created_at desc);
create index if not exists products_active_category_idx on public.products(is_active, category);

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.consent_logs enable row level security;

insert into public.products (category, name, description, price, old_price, tag, badge) values
  ('scripts', 'Sistema de Faccoes v3', 'Territorios, guerra de gangues e recompensas configuraveis.', 39.90, 49.90, 'ESX/QB', 'Atualizado'),
  ('scripts', 'Garagem Avancada', 'Multiplas garagens, seguro de veiculos e reboque automatico.', 24.90, null, 'QBCore', 'Popular'),
  ('scripts', 'HUD Minimalista', 'Interface leve com fome, sede, stamina e dinheiro em tempo real.', 14.90, null, 'Standalone', 'Leve'),
  ('scripts', 'Sistema de Empregos', 'Seis empregos prontos para seu servidor.', 29.90, null, 'ESX', ''),
  ('bases', 'Base RP Completa - Cidade X', 'Mapa customizado, economia balanceada e 20 scripts inclusos.', 149.90, 199.90, 'QBCore', 'Mais vendida'),
  ('bases', 'Base Economica Starter', 'Base leve e estavel para comecar um servidor.', 79.90, null, 'ESX', ''),
  ('bots', 'Bot de Whitelist Discord', 'Formulario automatico, aprovacao por staff e cargo automatico.', 19.90, null, 'Discord.js', ''),
  ('bots', 'Site de Loja Integrado', 'Loja web com login Discord e entrega automatica de pacotes.', 59.90, null, 'Node + React', 'Novo')
on conflict do nothing;

insert into storage.buckets (id, name, public) values ('downloads', 'downloads', false)
on conflict (id) do nothing;

create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9-]{2,40}$'),
  name text not null check (char_length(name) between 2 and 60),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.product_categories (slug, name, sort_order) values
  ('scripts', 'Scripts', 10), ('bases', 'Bases completas', 20), ('bots', 'Bots e sites', 30)
on conflict (slug) do nothing;

alter table public.products drop constraint if exists products_category_check;

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text unique not null check (code ~ '^[A-Z0-9-]{3,32}$'),
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  discount_value numeric(12,2) not null check (discount_value > 0),
  minimum_order numeric(12,2) not null default 0 check (minimum_order >= 0),
  max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  redemptions_count integer not null default 0 check (redemptions_count >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_by text references public.profiles(id),
  created_at timestamptz not null default now(),
  check (discount_type <> 'percent' or discount_value <= 100),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

alter table public.orders add column if not exists coupon_id uuid references public.coupons(id);
alter table public.orders add column if not exists coupon_code text;
alter table public.orders add column if not exists discount_amount numeric(12,2) not null default 0;

create table if not exists public.staff_roles (
  id uuid primary key default gen_random_uuid(),
  name text unique not null check (char_length(name) between 2 and 50),
  description text not null default '',
  permissions jsonb not null default '[]'::jsonb,
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.staff_members (
  user_id text primary key references public.profiles(id) on delete cascade,
  role_id uuid not null references public.staff_roles(id),
  is_active boolean not null default true,
  assigned_by text references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.staff_roles (name, description, permissions, is_system) values
  ('Gerente', 'Opera produtos, pedidos, cupons e equipe.', '["admin.access","catalog.manage","orders.view","orders.fulfill","coupons.manage","team.manage","logs.view"]', true),
  ('Catalogo', 'Gerencia produtos, categorias e cupons.', '["admin.access","catalog.manage","coupons.manage"]', true),
  ('Suporte', 'Consulta pedidos e confirma entregas.', '["admin.access","orders.view","orders.fulfill"]', true),
  ('Financeiro', 'Consulta pedidos e pagamentos.', '["admin.access","orders.view","logs.view"]', true)
on conflict (name) do nothing;

create table if not exists public.secure_settings (
  key text primary key,
  encrypted_value text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.store_settings (
  key text primary key,
  value jsonb not null,
  updated_by text references public.profiles(id),
  updated_at timestamptz not null default now()
);

insert into public.store_settings (key, value) values
  ('branding', '{"storeName":"NoWay","developer":"Desenvolvido por Arthur Davi","copyright":"Todos os direitos reservados - NoWay Group"}'::jsonb)
on conflict (key) do nothing;

create table if not exists public.discord_webhooks (
  id uuid primary key default gen_random_uuid(),
  name text unique not null check (char_length(name) between 2 and 60),
  event_type text not null,
  encrypted_url text not null,
  is_active boolean not null default true,
  created_by text references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  event_type text not null,
  actor_id text references public.profiles(id),
  target_type text,
  target_id text,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_at_idx on public.audit_logs(created_at desc);
create index if not exists audit_logs_event_type_idx on public.audit_logs(event_type, created_at desc);
create index if not exists coupons_active_idx on public.coupons(is_active, starts_at, ends_at);

alter table public.product_categories enable row level security;
alter table public.coupons enable row level security;
alter table public.staff_roles enable row level security;
alter table public.staff_members enable row level security;
alter table public.secure_settings enable row level security;
alter table public.store_settings enable row level security;
alter table public.discord_webhooks enable row level security;
alter table public.audit_logs enable row level security;