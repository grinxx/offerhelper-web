create table if not exists cases (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  resume_text text not null,
  jd_text     text not null,
  result_json jsonb not null default '[]',
  status      text not null default 'pending'
                   check (status in ('pending', 'done', 'error')),
  created_at  timestamptz not null default now()
);

-- 未登录用户也可以插入（user_id 为 null）
alter table cases enable row level security;

-- 登录用户只能看自己的记录
create policy "users see own cases"
  on cases for select
  using (auth.uid() = user_id);

-- 任何人都可以插入（含匿名）
create policy "anyone can insert"
  on cases for insert
  with check (true);

-- 登录用户可以更新自己的记录
create policy "users update own cases"
  on cases for update
  using (auth.uid() = user_id);
