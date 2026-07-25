-- 补充 cases 表的 DELETE policy，与 dashboard/actions.ts 的 deleteRecord 保持一致
-- 目前 deleteRecord 使用 service role key，但显式 policy 可防止未来误用 session client 时静默失败
create policy "users delete own cases"
  on cases for delete
  using (auth.uid() = user_id);
