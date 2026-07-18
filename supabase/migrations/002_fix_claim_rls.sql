drop policy if exists "users update own cases" on cases;

-- allow claiming an unclaimed case, or updating your own case
create policy "users update own cases"
  on cases for update
  using (auth.uid() IS NOT NULL AND (auth.uid() = user_id OR user_id IS NULL))
  with check (auth.uid() = user_id);
