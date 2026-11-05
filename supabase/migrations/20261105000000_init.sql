-- Chrise — schema inicial
-- Convenções: dinheiro em centavos (bigint), um dono por linha (user_id), RLS em tudo.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

create table public.categories (
  user_id    uuid not null references auth.users (id) on delete cascade,
  slug       text not null,
  name       text not null,
  group_name text not null,
  kind       text not null check (kind in ('income', 'expense')),
  nature     text not null check (nature in ('fixed', 'variable')),
  color      text not null,
  icon       text,
  primary key (user_id, slug)
);

create table public.accounts (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name                  text not null,
  type                  text not null check (type in ('checking', 'savings', 'credit_card', 'investment', 'cash')),
  opening_balance_cents bigint not null default 0,
  created_at            timestamptz not null default now(),
  unique (id, user_id)
);

create table public.transactions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id          uuid not null,
  category_id         text not null,
  kind                text not null check (kind in ('income', 'expense')),
  amount_cents        bigint not null check (amount_cents > 0),
  description         text not null default '',
  date                date not null,
  status              text not null default 'paid' check (status in ('paid', 'pending')),
  recurrence          text not null default 'none' check (recurrence in ('none', 'monthly', 'yearly')),
  is_business_revenue boolean not null default false,
  tags                text[],
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  -- FKs compostos: impedem apontar para conta/categoria de OUTRO usuário.
  foreign key (account_id, user_id) references public.accounts (id, user_id) on delete restrict,
  foreign key (user_id, category_id) references public.categories (user_id, slug) on update cascade
);

create index transactions_user_date_idx on public.transactions (user_id, date desc);

create table public.budgets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category_id text not null,
  month       text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  limit_cents bigint not null check (limit_cents >= 0),
  unique (user_id, category_id, month),
  foreign key (user_id, category_id) references public.categories (user_id, slug) on update cascade
);

create table public.tax_profiles (
  user_id            uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  regime             text not null default 'simples',
  activity           text not null default 'ti_fator_r',
  pro_labore_cents   bigint not null default 151800,
  extra_reserve_rate numeric(5, 4) not null default 0.03 check (extra_reserve_rate between 0 and 1),
  updated_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security: cada usuário só enxerga e altera as próprias linhas
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['categories', 'accounts', 'transactions', 'budgets', 'tax_profiles'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "%1$s_owner" on public.%1$I for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger transactions_touch before update on public.transactions
  for each row execute function public.touch_updated_at();

-- Novo usuário: categorias padrão (mesmos slugs de packages/data/src/categories.ts),
-- contas iniciais e perfil fiscal.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare uid uuid := new.id;
begin
  insert into public.categories (user_id, slug, name, group_name, kind, nature, color, icon) values
    (uid, 'nf-servicos', 'Nota fiscal (PJ)', 'receita', 'income', 'fixed', 'hsl(var(--success))', 'FileText'),
    (uid, 'freelance', 'Freelance', 'receita', 'income', 'variable', 'hsl(var(--chart-5))', 'Laptop'),
    (uid, 'rendimentos', 'Rendimentos', 'receita', 'income', 'variable', 'hsl(var(--chart-1))', 'PiggyBank'),
    (uid, 'aluguel', 'Aluguel', 'moradia', 'expense', 'fixed', 'hsl(var(--chart-1))', 'Home'),
    (uid, 'condominio', 'Condomínio', 'moradia', 'expense', 'fixed', 'hsl(var(--chart-1))', 'Building'),
    (uid, 'energia', 'Energia', 'moradia', 'expense', 'fixed', 'hsl(var(--chart-1))', 'Zap'),
    (uid, 'internet', 'Internet e celular', 'moradia', 'expense', 'fixed', 'hsl(var(--chart-1))', 'Wifi'),
    (uid, 'mercado', 'Mercado', 'alimentacao', 'expense', 'variable', 'hsl(var(--chart-2))', 'ShoppingCart'),
    (uid, 'delivery', 'Delivery', 'alimentacao', 'expense', 'variable', 'hsl(var(--chart-2))', 'Bike'),
    (uid, 'restaurante', 'Restaurantes', 'alimentacao', 'expense', 'variable', 'hsl(var(--chart-2))', 'UtensilsCrossed'),
    (uid, 'pet-racao', 'Ração e petiscos', 'pets', 'expense', 'fixed', 'hsl(var(--chart-4))', 'Bone'),
    (uid, 'pet-veterinario', 'Veterinário', 'pets', 'expense', 'variable', 'hsl(var(--chart-4))', 'Stethoscope'),
    (uid, 'pet-banho', 'Banho e tosa', 'pets', 'expense', 'variable', 'hsl(var(--chart-4))', 'PawPrint'),
    (uid, 'transporte', 'Transporte', 'transporte', 'expense', 'variable', 'hsl(var(--chart-5))', 'Car'),
    (uid, 'plano-saude', 'Plano de saúde', 'saude', 'expense', 'fixed', 'hsl(var(--info))', 'HeartPulse'),
    (uid, 'farmacia', 'Farmácia', 'saude', 'expense', 'variable', 'hsl(var(--info))', 'Pill'),
    (uid, 'academia', 'Academia', 'saude', 'expense', 'fixed', 'hsl(var(--info))', 'Dumbbell'),
    (uid, 'lazer', 'Lazer', 'lazer', 'expense', 'variable', 'hsl(var(--chart-3))', 'PartyPopper'),
    (uid, 'assinaturas', 'Assinaturas', 'assinaturas', 'expense', 'fixed', 'hsl(var(--chart-3))', 'Tv'),
    (uid, 'cursos', 'Cursos e livros', 'educacao', 'expense', 'variable', 'hsl(var(--chart-5))', 'GraduationCap'),
    (uid, 'das', 'DAS (Simples)', 'impostos', 'expense', 'fixed', 'hsl(var(--danger))', 'Landmark'),
    (uid, 'inss', 'INSS pró-labore', 'impostos', 'expense', 'fixed', 'hsl(var(--danger))', 'Landmark'),
    (uid, 'contador', 'Contador', 'impostos', 'expense', 'fixed', 'hsl(var(--danger))', 'Calculator'),
    (uid, 'outros', 'Outros', 'outros', 'expense', 'variable', 'hsl(var(--muted-foreground))', 'Package');

  insert into public.accounts (user_id, name, type) values
    (uid, 'Conta PJ', 'checking'),
    (uid, 'Conta PF', 'checking'),
    (uid, 'Cartão de crédito', 'credit_card');

  insert into public.tax_profiles (user_id) values (uid);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
