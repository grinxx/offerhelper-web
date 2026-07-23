-- 原子性检查并记录使用次数，同时返回是否有自定义 Key
create or replace function check_and_record_usage(
  p_user_id uuid,
  p_ip text,
  p_action text,
  p_daily_limit int,
  p_guest_limit int,
  p_rate_limit int,
  p_rate_window_seconds int
) returns jsonb language plpgsql security definer as $$
declare
  v_has_own_key boolean := false;
  v_count_today int := 0;
  v_count_recent int := 0;
  v_limit int;
  v_since_today timestamptz := date_trunc('day', now());
  v_since_window timestamptz := now() - (p_rate_window_seconds || ' seconds')::interval;
begin
  -- 检查是否有自定义 Key
  if p_user_id is not null then
    select (ai_api_key is not null and ai_api_key != '') into v_has_own_key
    from user_settings where user_id = p_user_id;
    if v_has_own_key then
      return jsonb_build_object('allowed', true, 'remaining', 999, 'own_key', true);
    end if;
  end if;

  -- 速率限制检查（按 IP）
  select count(*) into v_count_recent from usage_logs
  where ip = p_ip and created_at >= v_since_window;
  if v_count_recent >= p_rate_limit then
    return jsonb_build_object('allowed', false, 'remaining', 0, 'own_key', false, 'rate_limited', true);
  end if;

  -- 今日用量检查
  v_limit := case when p_user_id is not null then p_daily_limit else p_guest_limit end;
  if p_user_id is not null then
    select count(*) into v_count_today from usage_logs
    where user_id = p_user_id and created_at >= v_since_today;
  else
    select count(*) into v_count_today from usage_logs
    where ip = p_ip and user_id is null and created_at >= v_since_today;
  end if;

  if v_count_today >= v_limit then
    return jsonb_build_object('allowed', false, 'remaining', 0, 'own_key', false, 'rate_limited', false);
  end if;

  -- 原子插入
  insert into usage_logs(user_id, ip, action)
  values(p_user_id, case when p_user_id is not null then null else p_ip end, p_action);

  return jsonb_build_object('allowed', true, 'remaining', v_limit - v_count_today - 1, 'own_key', false);
end;
$$;
