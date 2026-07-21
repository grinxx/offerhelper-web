create table if not exists user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ai_provider text not null default 'siliconflow',
  ai_base_url text not null default 'https://api.siliconflow.cn/v1',
  ai_api_key text not null default '',
  ai_model_fast text not null default 'Qwen/Qwen2.5-7B-Instruct',
  ai_model_smart text not null default 'Pro/claude-sonnet-4-5',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

alter table user_settings enable row level security;

create policy "users can manage own settings"
  on user_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
