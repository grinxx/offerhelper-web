# OfferHelper 换机部署指南

## 概述
本项目采用 Next.js 16 + Supabase + Vercel 部署方案。换机时只需配置本地开发环境，线上 Vercel 部署不受影响。

---

## 一、线上部署（Vercel）
线上部署绑定的是 GitHub 仓库，**换机不影响线上**。每次推送 main 分支，Vercel 自动构建部署。

如需重新接入 Vercel（如换账号），参考：
1. 登录 vercel.com → Add New Project → 导入 `github.com/grinxx/offerhelper-web`
2. 在 Environment Variables 填入以下变量（见下方「环境变量清单」）
3. 域名在 Domains 里绑定 `offerhelper.cloud`（DNS 记录已配置，无需重配）

---

## 二、本地开发环境配置

### 前提条件
- Node.js 18+（推荐 Node.js 20 LTS）
- Git

### 步骤

```bash
# 1. 克隆仓库
git clone https://github.com/grinxx/offerhelper-web.git
cd offerhelper-web

# 2. 安装依赖
npm install

# 3. 创建本地环境变量文件（见下方清单）
cp .env.local.example .env.local
# 编辑 .env.local，填入对应值

# 4. 启动开发服务器
npm run dev
```

---

## 三、环境变量清单

### `.env.local`（本地开发）

| 变量名 | 说明 | 示例值 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 URL | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 匿名 Key | `eyJ...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 服务端 Key（私密）| `eyJ...` |
| `ANTHROPIC_API_KEY` | 本地用 Hyperspace 代理的 Key | `ed91ce95-...` |
| `ANTHROPIC_BASE_URL` | 本地 AI 代理地址 | `http://localhost:6655/anthropic/` |
| `ENCRYPTION_KEY` | API Key 加密密钥（32字节十六进制）| `82bb4d94...` |
| `SKIP_USAGE_LIMIT` | 本地跳过使用限额（开发用）| `1` |
| `RESEND_API_KEY` | Resend 邮件服务 Key | `re_HXjoFQfW_...` |

> ⚠️ **注意**：
> - `.env.local` 已在 `.gitignore` 中，**不会被提交到 Git**
> - `ENCRYPTION_KEY` 必须与 Vercel 上的值**完全一致**，否则已加密的用户 API Key 无法解密
> - `ANTHROPIC_BASE_URL` 是本地 Hyperspace 代理地址，线上不需要（Vercel 用硅基流动）

### Vercel 环境变量（线上）

| 变量名 | 说明 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 同本地 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 同本地 |
| `SUPABASE_SERVICE_ROLE_KEY` | 同本地 |
| `ANTHROPIC_API_KEY` | 硅基流动 API Key（`sk-sgbzalt...`）|
| `ANTHROPIC_BASE_URL` | `https://api.siliconflow.cn/v1` |
| `ENCRYPTION_KEY` | 与本地相同的加密密钥 |
| `RESEND_API_KEY` | 同本地 |

---

## 四、Supabase 数据库

Supabase 是云端服务，换机不需要迁移数据库。

如需重新执行迁移（如在新的 Supabase 项目上），按顺序执行 `supabase/` 目录下的 SQL 文件：

```
001_create_cases.sql
002_fix_claim_rls.sql
003_interview_tables.sql
004_strength_sessions.sql
005_match_sessions.sql
006_user_settings.sql
007_usage_logs.sql
008_suggestion_feedback.sql
009_applications.sql
010_suggestion_status.sql
011_check_usage_rpc.sql  ← 需执行函数创建
012_case_version_label.sql
013_cases_delete_policy.sql
014_usage_logs_cleanup.sql  ← 可选，配置 pg_cron 清理任务
```

---

## 五、本地 AI 代理（Hyperspace）

本地开发使用 Hyperspace 代理 Anthropic API：
1. 在新机器上安装并启动 Hyperspace
2. 确保代理监听在 `http://localhost:6655/anthropic/`
3. 把 Hyperspace 提供的 API Key 填入 `ANTHROPIC_API_KEY`

如果新机器无法使用 Hyperspace，可以：
- 将 `ANTHROPIC_BASE_URL` 改为 `https://api.siliconflow.cn/v1`
- 将 `ANTHROPIC_API_KEY` 改为硅基流动 Key
- 删除 `SKIP_USAGE_LIMIT=1`（线上有限流，本地调试会被限制）

---

## 六、域名与 SSL

域名 `offerhelper.cloud` 在阿里云管理，DNS 解析记录：

| 类型 | 主机记录 | 记录值 |
|---|---|---|
| A | @ | `216.198.79.1` |
| CNAME | www | `306322fb145aa156.vercel-dns-017.com` |
| TXT | resend._domainkey | `p=MIGfMA0G...`（DKIM）|
| MX | send | `feedback-smtp.ap-northeast-1.amazonses.com`（SPF）|
| TXT | send | `v=spf1 include:amazonses.com ~all` |
| TXT | _dmarc | `v=DMARC1; p=none;` |

---

## 七、快速验证清单

换机后本地开发验证：
- [ ] `npm run dev` 启动无报错
- [ ] 访问 `http://localhost:3000` 首页正常
- [ ] 注册/登录功能正常（Supabase 连接正常）
- [ ] 上传简历能解析（Hyperspace 代理正常）
- [ ] 简历优化功能返回建议（AI 调用正常）
