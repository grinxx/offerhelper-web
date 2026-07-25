create table if not exists usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  ip text,
  action text not null,
  created_at timestamptz not null default now()
);

create index if not exists usage_logs_user_date on usage_logs (user_id, created_at);
create index if not exists usage_logs_ip_date on usage_logs (ip, created_at);

alter table usage_logs enable row level security;

-- 注意：INSERT/DELETE 无 policy 是有意设计
-- 所有写入通过 security definer RPC（check_and_record_usage）执行，绕过 RLS
-- 直接用 session client 写入会失败，这是正确行为
create policy "users can read own usage"
  on usage_logs for select
  using (auth.uid() = user_id);
