-- 定期清理 30 天前的 usage_logs，防止表无限膨胀
-- 在 Supabase 控制台 Database → Extensions 启用 pg_cron 后执行此语句
-- 或在 Supabase Dashboard → Scheduled Functions 中创建定期任务

-- 手动清理（可在 SQL Editor 执行验证）
-- delete from usage_logs where created_at < now() - interval '30 days';

-- pg_cron 自动清理（需先启用 pg_cron 扩展）
-- select cron.schedule(
--   'cleanup-usage-logs',
--   '0 3 * * *',  -- 每天凌晨 3 点执行
--   $$delete from usage_logs where created_at < now() - interval '30 days'$$
-- );

-- 如不使用 pg_cron，可在应用层定期调用以下清理接口
-- 或通过 Supabase Edge Functions + Scheduled Triggers 实现
