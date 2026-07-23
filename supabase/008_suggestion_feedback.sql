create table if not exists suggestion_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  case_id uuid references cases(id) on delete cascade,
  suggestion_index integer not null,
  rating smallint not null check (rating in (1, -1)),
  created_at timestamptz not null default now(),
  unique (user_id, case_id, suggestion_index)
);

alter table suggestion_feedback enable row level security;

create policy "users can manage own feedback"
  on suggestion_feedback for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
