-- API Tokens for MCP Server / developer access
create table if not exists api_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null default 'Default Token',
  token_hash  text not null unique,          -- SHA-256 hash of the actual token
  prefix      text not null,                 -- first 8 chars shown in UI, e.g. "oh_abc123"
  created_at  timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at  timestamptz
);

-- Only the token owner can read/delete their tokens
alter table api_tokens enable row level security;

create policy "owner can select" on api_tokens
  for select using (auth.uid() = user_id);

create policy "owner can insert" on api_tokens
  for insert with check (auth.uid() = user_id);

create policy "owner can update" on api_tokens
  for update using (auth.uid() = user_id);

create policy "owner can delete" on api_tokens
  for delete using (auth.uid() = user_id);

create index api_tokens_user_id_idx on api_tokens(user_id);
create index api_tokens_token_hash_idx on api_tokens(token_hash);
