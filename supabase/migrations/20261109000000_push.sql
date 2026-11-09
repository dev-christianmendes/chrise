-- Web Push: subscriptions and the reminders calculated by the client.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id) where enabled;

create table public.push_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  reminder_id text not null,
  title text not null,
  body text not null,
  url text not null,
  send_on date not null,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, reminder_id)
);

create index push_reminders_due_idx on public.push_reminders (send_on, sent_at) where sent_at is null;

alter table public.push_subscriptions enable row level security;
alter table public.push_reminders enable row level security;

create policy "push_subscriptions_owner" on public.push_subscriptions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "push_reminders_owner" on public.push_reminders
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create trigger push_subscriptions_touch before update on public.push_subscriptions
  for each row execute function public.touch_updated_at();
