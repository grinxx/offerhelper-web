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

create policy "users can read own usage"
  on usage_logs for select
  using (auth.uid() = user_id);
