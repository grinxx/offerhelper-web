-- supabase/migrations/004_strength_sessions.sql

create table strength_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade,
  jd_text      text,
  messages     jsonb not null default '[]',
  result       jsonb,
  status       text not null default 'active'
                    check (status in ('active', 'done')),
  created_at   timestamptz not null default now()
);

alter table strength_sessions enable row level security;

create policy "users see own strength sessions"
  on strength_sessions for select
  using (auth.uid() = user_id);

create policy "users insert own strength sessions"
  on strength_sessions for insert
  with check (auth.uid() = user_id);

create policy "users update own strength sessions"
  on strength_sessions for update
  using (auth.uid() = user_id);
