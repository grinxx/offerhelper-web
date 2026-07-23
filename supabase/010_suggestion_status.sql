create table if not exists suggestion_status (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id uuid not null references cases(id) on delete cascade,
  suggestion_index integer not null,
  status text not null check (status in ('applied', 'pending')),
  created_at timestamptz not null default now(),
  unique (user_id, case_id, suggestion_index)
);

alter table suggestion_status enable row level security;

create policy "users can manage own suggestion status"
  on suggestion_status for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
