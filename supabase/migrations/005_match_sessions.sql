-- supabase/migrations/005_match_sessions.sql

create table match_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade,
  resume_text  text not null,
  jd_list      jsonb not null default '[]',
  results      jsonb not null default '[]',
  summary      text not null default '',
  status       text not null default 'active'
                    check (status in ('active', 'done')),
  created_at   timestamptz not null default now()
);

alter table match_sessions enable row level security;

create policy "users see own match sessions"
  on match_sessions for select
  using (auth.uid() = user_id);

create policy "users insert own match sessions"
  on match_sessions for insert
  with check (auth.uid() = user_id);

create policy "users update own match sessions"
  on match_sessions for update
  using (auth.uid() = user_id);
