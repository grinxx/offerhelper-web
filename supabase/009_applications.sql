create table if not exists applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company text not null,
  position text not null,
  platform text,
  applied_at date not null default current_date,
  status text not null default 'submitted' check (status in ('submitted','viewed','interview_scheduled','interviewed','offer','rejected','withdrawn')),
  note text,
  case_id uuid references cases(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists applications_user_id on applications (user_id, applied_at desc);

alter table applications enable row level security;

create policy "users can manage own applications"
  on applications for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
