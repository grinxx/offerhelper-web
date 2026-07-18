-- supabase/migrations/003_interview_tables.sql

create table interview_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  case_id      uuid references cases(id) on delete set null,
  jd_text      text not null,
  questions    jsonb not null default '[]',
  status       text not null default 'active'
                    check (status in ('active', 'done')),
  created_at   timestamptz not null default now()
);

alter table interview_sessions enable row level security;

create policy "users see own sessions"
  on interview_sessions for select
  using (auth.uid() = user_id);

create policy "users insert own sessions"
  on interview_sessions for insert
  with check (auth.uid() = user_id);

create policy "users update own sessions"
  on interview_sessions for update
  using (auth.uid() = user_id);

create table interview_turns (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null references interview_sessions(id) on delete cascade,
  question_index   int not null,
  question         text not null,
  user_answer      text not null,
  scores           jsonb not null,
  feedback         text not null,
  reference_answer text not null,
  created_at       timestamptz not null default now()
);

alter table interview_turns enable row level security;

create policy "users see own turns"
  on interview_turns for select
  using (
    exists (
      select 1 from interview_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

create policy "users insert own turns"
  on interview_turns for insert
  with check (
    exists (
      select 1 from interview_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );
