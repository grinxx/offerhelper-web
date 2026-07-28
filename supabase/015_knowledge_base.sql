-- supabase/015_knowledge_base.sql

create table if not exists user_experiences (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  source     text not null check (source in ('strengths', 'interview', 'manual')),
  source_id  uuid,
  content    text not null,
  created_at timestamptz not null default now()
);

alter table user_experiences enable row level security;

create policy "users manage own experiences"
  on user_experiences for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index user_experiences_user_id_created_at
  on user_experiences(user_id, created_at desc);

create table if not exists resume_versions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  resume_text text not null,
  label       text not null default '',
  created_at  timestamptz not null default now()
);

alter table resume_versions enable row level security;

create policy "users manage own resume versions"
  on resume_versions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index resume_versions_user_id_created_at
  on resume_versions(user_id, created_at desc);
