# OfferHelper 架构深度分析

> 面试讲解材料——理解系统设计决策，而不只是背代码

---

## 1. 系统全景（文字架构图）

```
┌─────────────────────────────────────────────────────────────┐
│  浏览器层（Client）                                           │
│  app/page.tsx            — 'use client'，React 状态驱动      │
│  app/dashboard/page.tsx  — async Server Component，无状态    │
└───────────────────┬─────────────────────────────────────────┘
                    │ HTTP POST / fetch stream
┌───────────────────▼─────────────────────────────────────────┐
│  Next.js App Router（Server）                                │
│  app/api/analyze/route.ts          简历分析 + 评分           │
│  app/api/match/analyze/route.ts    多 JD 并发匹配            │
│  app/api/strengths/message/route.ts 优势挖掘对话             │
│                                                              │
│  lib/usage.ts     — 限流 + 配额检查（调 Supabase RPC）       │
│  lib/ai-client.ts — 双 SDK 抽象层（OpenAI / Anthropic）      │
│  lib/crypto.ts    — AES-256-GCM 加解密用户 API Key           │
└──────────┬────────────────────┬───────────────────────────-──┘
           │                    │
┌──────────▼───────┐   ┌────────▼────────────────────────────┐
│  AI 服务层        │   │  Supabase（数据层）                   │
│  SiliconFlow/     │   │  PostgreSQL                          │
│  DeepSeek（默认） │   │  ├── cases / match_sessions 等表     │
│  or               │   │  ├── usage_logs（配额记录）           │
│  Anthropic Claude │   │  ├── user_settings（加密 Key）        │
│  （本地开发）     │   │  └── RLS + RPC 函数（安全层）         │
└──────────────────┘   └─────────────────────────────────────┘
```

### 简历分析完整数据流

用户点击「开始分析」→ AI 返回建议的完整路径：

1. 浏览器 POST `/api/analyze`，携带 `resume_text` + `jd_text`
2. `checkAndRecordUsage('analyze')` 调用 Supabase RPC，**一次数据库往返**完成：身份识别 → 速率检查 → 配额检查 → 原子插入日志，返回 `{allowed, remaining, own_key}`
3. 若不允许，立即返回 429，**AI 费用不产生**
4. `getAIClientForRequest(userId)` 查询 `user_settings`，若有自定义 Key 则解密后构建对应 Client，否则复用默认单例
5. 构造 `ReadableStream`，在其 `start()` 回调中启动 AI 流式调用
6. AI 逐块返回 token，服务端实时用大括号深度匹配解析 JSON 对象，每解析出一条 `Suggestion` 就立即 `controller.enqueue()` 推给浏览器
7. 全部完成后，再用 `modelFast` 同步生成评分，追加到流末尾
8. `controller.close()` 关闭，浏览器端检测到结束

---

## 2. 核心设计决策（重点讲「为什么」）

### 为什么用 Next.js App Router 而非其他框架

App Router 同时支持 Server Components 和 Route Handlers，两种渲染模式在同一仓库内无缝共存。`dashboard/page.tsx` 是纯 async 服务端组件，可以直接 `await supabase.auth.getUser()` 再 `redirect('/')`，零 JS 下发到浏览器，SEO 友好。`app/page.tsx` 则是 `'use client'`，处理交互逻辑。这种**按页面粒度混用**的能力，是传统 SPA 框架做不到的。

### 为什么 AI 调用在服务端而非客户端直接调用

三个理由：
1. **API Key 安全**：不能暴露给浏览器
2. **配额强制执行**：服务端才能在调用 AI **之前**做原子配额扣减，防止客户端绕过
3. **CSP 防护**：`next.config.ts` 的 `connect-src` 只允许白名单域，浏览器即使想直接调用 AI API 也会被同源策略拦截

### 双 SDK 设计的架构动机

`lib/ai-client.ts` 定义 `ChatClient` 接口，`OpenAIChatClient` 和 `AnthropicChatClient` 各自实现 `complete()` 和 `stream()` 方法。切换逻辑只有一处：根据 `baseURL` 是否包含 `anthropic.com` 决定用哪个 SDK。

**动机**：本地开发跑 Claude（更强、反馈质量高），生产默认用 DeepSeek-V3（成本低），用户可配置任意 OpenAI-compatible endpoint。业务代码只依赖 `ChatClient` 接口，完全解耦。

### 流式响应为什么这样实现

Route Handler 返回 `new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } })`，这是标准的 Streaming HTTP Response。服务端逐行推送 JSON 对象（NDJSON 格式），客户端按 `\n` 切割后 `JSON.parse`。

比 SSE 的 `data:` 格式更轻，比 WebSocket 更简单——无握手、无状态维护，天然适配 Serverless 环境。

### Supabase RLS 的设计思路

- **查询**用 `createClient()`（session client，受 RLS 约束），数据库自动隔离
- **写入**用 `createServiceClient()`（Service Role Key，绕过 RLS），服务端完全可信

应用层 + 数据库层双重保护，即使代码 Bug 忘写 `.eq('user_id', user.id)`，数据库也不会泄露其他用户数据。

---

## 3. 最值得讲的技术亮点（面试 STAR 结构）

### 亮点一：双 SDK 环境切换

| 维度 | 内容 |
|------|------|
| **背景** | 开发需要 Anthropic Claude（质量高），生产用 SiliconFlow（成本低），用户还可能自带 Key |
| **问题** | 如果 SDK 判断散落在每个 API Route，每次新增接口都要重复，维护成本高 |
| **方案** | 抽象 `ChatClient` 接口（`lib/ai-client.ts` 第97行），工厂函数 `getAIClientForRequest()` 封装所有判断 |
| **效果** | 新增 `match/analyze/route.ts` 时完全不需要写 SDK 判断，开发/生产行为对称 |

### 亮点二：原子性使用量控制

| 维度 | 内容 |
|------|------|
| **背景** | 每次 AI 调用前需要检查配额并扣减 |
| **问题** | 分两次 DB 请求（SELECT + INSERT）存在竞态：两个并发请求可能都通过检查，实际消耗两倍额度 |
| **方案** | 将「速率检查 → 配额检查 → INSERT」写入单个 PostgreSQL 函数 `check_and_record_usage`（`011_check_usage_rpc.sql`），在事务中原子执行 |
| **效果** | 消除竞态条件，减少一次网络往返，RPC 失败时明确拒绝请求，杜绝配额绕过 |

### 亮点三：流式 AI 响应的前后端协议

| 维度 | 内容 |
|------|------|
| **背景** | 简历分析需要 AI 逐条输出建议，用户希望看到第一条就展示 |
| **问题** | AI 返回的是连续 token 流，不是结构化对象；等全部返回再解析，用户等待10-30秒 |
| **方案** | 服务端维护 `buffer` 字符串（`analyze/route.ts` 第55行），用大括号深度匹配从 token 流实时提取 JSON，每提取一条立即 `enqueue` 给客户端 |
| **效果** | 用户看到第一条建议延迟从「等全部」降至约2-4秒，同时流末尾复用同一连接传递 `{score, case_id}` 控制信息 |

---

## 4. 面试官最可能追问的难点

### Q: 流式响应怎么实现的？

**服务端**：`new ReadableStream({ async start(controller) { ... } })`，在 `start` 回调里 `for await` AI SDK 的 AsyncIterable，每次 `yield` 一个 chunk 就 `controller.enqueue(encoder.encode(text))`。返回带 `Content-Type: text/event-stream` 和 `X-Accel-Buffering: no`（告诉 Nginx 不缓冲）。

**客户端**：`const reader = response.body.getReader()`，循环 `reader.read()`，用 `TextDecoder` 解码，按 `\n` 切割，逐个 `JSON.parse`，更新 React state。

### Q: RLS 怎么防止越权访问？

RLS 是 PostgreSQL 层面的策略，不是应用层代码。使用带 JWT 的普通客户端查询时，数据库自动给每条 SQL 追加 `WHERE user_id = auth.uid()` 的等价条件。即使代码忘写过滤条件，数据库也不返回其他用户数据。这是「防御纵深」——应用层和数据库层双重保护。

### Q: 为什么用 ReadableStream 而不是 WebSocket？

WebSocket 是双向持久连接，在 Serverless 环境实现复杂甚至不支持。这个场景是**单向推送**——客户端发一次请求，服务端持续推送。标准 HTTP Streaming 完全满足，且天然支持 CDN 缓存、负载均衡，浏览器原生支持 `ReadableStream`，无需额外库。

### Q: AI Key 加密存储的实现细节？

`lib/crypto.ts` 使用 AES-256-GCM：
- 加密：生成12字节随机 IV，加密后提取16字节 GCM 认证标签（防篡改），拼接 `IV(12) + Tag(16) + Ciphertext` 后 Base64 存入数据库
- 解密：按固定偏移量切割三段，用认证标签验证完整性，任何篡改导致解密失败返回空字符串
- 加密密钥 `ENCRYPTION_KEY` 是服务端环境变量，永远不进数据库

### Q: 竞态条件怎么处理的？

两处设计：
1. 配额扣减用原子 RPC，PostgreSQL 函数在同一事务内执行，并发请求串行化
2. 多 JD 匹配（`match/analyze/route.ts`）使用 `firstUsage.userId` 而非循环中的值，保证同一请求内所有 JD 使用同一 AI 配置

---

## 5. 类比解释最难理解的部分

### ReadableStream + 流式响应

把它想象成**外卖单据打印机**。传统方式是厨师做完所有菜，一次性打印完整账单。流式方式是厨师每做好一道菜就立刻打印一行，你看到第一行就知道「有宫保鸡丁了」，不用等满桌菜做完。

`controller.enqueue()` 就是往打印机里送纸，`reader.read()` 就是顾客在前台接收纸条。打印机（ReadableStream）持续工作，两端之间的「管道」就是 HTTP 连接本身。

### Supabase RLS

类比**银行柜台系统**。没有 RLS 时，任何人拿着柜台账号都能查所有客户数据——防越权完全靠程序员写对代码。有了 RLS 后，账户数据库自己会核验「你的工号是否有权看这个客户的数据」，即使柜员操作失误，数据库也不返回无权限数据。这个核验写在数据库里，无法被应用层绕过。

### 原子 RPC vs 非原子操作

比作**演唱会抢票**。非原子方式：系统先查「还剩1张」，你看到有票，然后执行「卖出」。两个人同时查到「还剩1张」，系统超卖2张。

原子 RPC 方式：把「查剩余 + 锁定 + 售出」打包成一个数据库事务，就像在票仓门口装了旋转门，一次只进一个人，进去之后当场完成所有操作再出来，后面的人等。`check_and_record_usage` 就是这个旋转门。

---

## 关键文件定位速查

| 话题 | 文件 | 关键行 |
|------|------|--------|
| 双 SDK 抽象接口 | `lib/ai-client.ts` | 97-151 |
| 工厂函数 + 单例缓存 | `lib/ai-client.ts` | 62-86 |
| 原子配额 RPC | `supabase/011_check_usage_rpc.sql` | 全文 |
| 限流调用入口 | `lib/usage.ts` | 47-67 |
| AES-GCM 加密 | `lib/crypto.ts` | 全文 |
| 流式 JSON 解析 | `app/api/analyze/route.ts` | 55-85 |
| 多 JD 并发 + 超时 | `app/api/match/analyze/route.ts` | 66-87 |
| 服务端组件查询 | `app/dashboard/page.tsx` | 78-113 |
| CSP 安全头 | `next.config.ts` | 13-24 |
