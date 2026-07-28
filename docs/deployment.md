# OfferHelper 换机部署指南

## 概述
本项目采用 Next.js 16 + Supabase + Vercel 部署方案。换机时只需配置本地开发环境，线上 Vercel 部署不受影响。

---

## 一、新机器前置准备

### 1. 安装 Node.js

推荐使用 nvm 管理 Node.js 版本：

```bash
# macOS / Linux
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
# 重启终端后
nvm install 20
nvm use 20

# Windows：下载 nvm-windows
# https://github.com/coreybutler/nvm-windows/releases
```

或直接从官网下载 Node.js 20 LTS：https://nodejs.org

验证安装：
```bash
node -v  # 应显示 v20.x.x
npm -v   # 应显示 10.x.x
```

### 2. 配置 Git

```bash
# 设置用户信息
git config --global user.name "你的名字"
git config --global user.email "你的邮箱"

# 生成 SSH Key（如果要用 SSH 推送代码）
ssh-keygen -t ed25519 -C "你的邮箱"
cat ~/.ssh/id_ed25519.pub
# 复制输出内容，添加到 GitHub → Settings → SSH Keys
```

也可以用 HTTPS 方式克隆，推送时输入 GitHub 用户名和 Personal Access Token（Settings → Developer settings → Personal access tokens）。

---

## 二、获取旧机器上的关键值

换机前，**先在旧机器上复制以下值**，存到安全的地方（如密码管理器）：

```bash
# 在旧机器上执行，查看 .env.local 内容
cat /path/to/offerhelper-web/.env.local
```

重点保存：
- `ENCRYPTION_KEY`（32字节十六进制，**绝对不能重新生成**，否则所有用户的加密 API Key 失效）
- `ANTHROPIC_API_KEY`（Hyperspace 代理 Key）
- `SUPABASE_SERVICE_ROLE_KEY`（Supabase 服务端 Key）
- `RESEND_API_KEY`（邮件服务 Key）

其余值可以从对应平台重新获取：
- `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_ANON_KEY`：登录 supabase.com → Project Settings → API
- `RESEND_API_KEY`：登录 resend.com → API Keys

---

## 三、线上部署（Vercel）

线上部署绑定的是 GitHub 仓库，**换机不影响线上**。每次推送 main 分支，Vercel 自动构建部署。

如需重新接入 Vercel（如换账号），参考：
1. 登录 vercel.com → Add New Project → 导入 `github.com/grinxx/offerhelper-web`
2. 在 Environment Variables 填入以下变量（见下方「环境变量清单」）
3. 域名在 Domains 里绑定 `offerhelper.cloud`（DNS 记录已配置，无需重配）

---

## 四、本地开发环境配置

```bash
# 1. 克隆仓库
git clone https://github.com/grinxx/offerhelper-web.git
cd offerhelper-web

# 2. 安装依赖
npm install

# 3. 创建本地环境变量文件
cp .env.local.example .env.local
# 用编辑器打开 .env.local，填入对应值（参考下方「环境变量清单」）

# 4. 启动开发服务器
npm run dev
# 访问 http://localhost:3000
```

---

## 五、环境变量清单

### `.env.local`（本地开发）

| 变量名 | 说明 | 从哪里获取 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 URL | supabase.com → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 匿名 Key | 同上 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 服务端 Key（私密）| 同上（service_role） |
| `ANTHROPIC_API_KEY` | 本地 Hyperspace 代理 Key | 旧机器 `.env.local` |
| `ANTHROPIC_BASE_URL` | 本地 AI 代理地址 | 固定值：`http://localhost:6655/anthropic/` |
| `ENCRYPTION_KEY` | API Key 加密密钥（**必须用旧值**）| 旧机器 `.env.local` |
| `SKIP_USAGE_LIMIT` | 本地跳过使用限额 | 固定值：`1` |
| `RESEND_API_KEY` | Resend 邮件服务 Key | resend.com → API Keys |
| `BAIDU_OCR_API_KEY` | 百度 OCR API Key | ai.baidu.com → 文字识别应用 |
| `BAIDU_OCR_SECRET_KEY` | 百度 OCR Secret Key | 同上 |

> ⚠️ **重要**：
> - `.env.local` 已在 `.gitignore` 中，**不会被提交到 Git**
> - `ENCRYPTION_KEY` **必须与旧机器完全一致**，不能重新生成
> - `ANTHROPIC_BASE_URL` 是本地 Hyperspace 代理地址，线上 Vercel 不需要

### Vercel 环境变量（线上）

| 变量名 | 值 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 同本地 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 同本地 |
| `SUPABASE_SERVICE_ROLE_KEY` | 同本地 |
| `ANTHROPIC_API_KEY` | 硅基流动 API Key（`sk-sgbzalt...`）|
| `ANTHROPIC_BASE_URL` | `https://api.siliconflow.cn/v1` |
| `ENCRYPTION_KEY` | 与本地相同的加密密钥 |
| `RESEND_API_KEY` | 同本地 |
| `BAIDU_OCR_API_KEY` | 百度 OCR API Key（同本地）|
| `BAIDU_OCR_SECRET_KEY` | 百度 OCR Secret Key（同本地）|

---

## 六、本地 AI 代理（Hyperspace）

本地开发使用 Hyperspace 代理 Anthropic Claude API。

**安装 Hyperspace：**
- 官网/内部渠道下载 Hyperspace 客户端
- 安装后启动，确保代理监听在 `http://localhost:6655/anthropic/`
- 在 Hyperspace 设置中获取 API Key，填入 `ANTHROPIC_API_KEY`

**如果新机器无法使用 Hyperspace：**
```bash
# .env.local 中改为直接使用硅基流动
ANTHROPIC_API_KEY=sk-sgbzalt...  # 硅基流动 Key
ANTHROPIC_BASE_URL=https://api.siliconflow.cn/v1
# SKIP_USAGE_LIMIT=1  # 可保留，不影响线上限流
```

> 注意：使用硅基流动本地调试会消耗硅基流动的 API 额度。

---

## 七、Supabase 数据库

Supabase 是云端服务，换机**不需要迁移数据库**，数据都在云端。

如需重建 Supabase 项目（如更换 Supabase 账号），在新项目的 SQL Editor 中按顺序执行：

```
# 注意：001-005 在 supabase/migrations/ 子目录
supabase/migrations/001_create_cases.sql
supabase/migrations/002_fix_claim_rls.sql
supabase/migrations/003_interview_tables.sql
supabase/migrations/004_strength_sessions.sql
supabase/migrations/005_match_sessions.sql

# 006 以后在 supabase/ 根目录
supabase/006_user_settings.sql
supabase/007_usage_logs.sql
supabase/008_suggestion_feedback.sql
supabase/009_applications.sql
supabase/010_suggestion_status.sql
supabase/011_check_usage_rpc.sql     ← 创建使用量统计 RPC 函数
supabase/012_case_version_label.sql
supabase/013_cases_delete_policy.sql
supabase/014_usage_logs_cleanup.sql  ← 可选，配置 pg_cron 定期清理
```

同时在 Supabase → Authentication → URL Configuration 中设置：
- Site URL：`https://offerhelper.cloud`
- Redirect URLs：`https://offerhelper.cloud/**`

---

## 八、域名与 DNS 记录

域名 `offerhelper.cloud` 在**阿里云**管理。以下为当前 DNS 解析记录备份：

| 类型 | 主机记录 | 记录值 | 用途 |
|---|---|---|---|
| A | @ | `216.198.79.1` | Vercel 根域名 |
| CNAME | www | `306322fb145aa156.vercel-dns-017.com` | Vercel www 子域名 |
| TXT | resend._domainkey | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQ...` | Resend DKIM |
| MX | send | `feedback-smtp.ap-northeast-1.amazonses.com`（优先级 10）| Resend SPF |
| TXT | send | `v=spf1 include:amazonses.com ~all` | Resend SPF |
| TXT | _dmarc | `v=DMARC1; p=none;` | DMARC |

---

## 九、快速验证清单

换机后本地开发验证：
- [ ] `node -v` 显示 v18+ 版本
- [ ] `git clone` 成功，`npm install` 无报错
- [ ] `.env.local` 已创建并填入所有必要值
- [ ] `npm run dev` 启动无报错，`http://localhost:3000` 首页正常
- [ ] 注册/登录功能正常（Supabase 连接正常）
- [ ] 上传简历能解析（Hyperspace 或硅基流动代理正常）
- [ ] 简历优化功能返回建议（AI 调用正常）
- [ ] `git push origin main` 能推送（Git 权限配置正常）
