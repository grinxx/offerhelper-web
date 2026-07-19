# 优势挖掘功能设计文档

## 概述

为 OfferHelper Web 添加「优势挖掘」模式。AI 通过最多 3 轮动态追问引导用户讲述经历，根据回答决定下一个问题方向（不固定问题），最终输出结构化优势列表（标签 + 证据句）+ 综合点评段落。JD 可选填，有 JD 时结合岗位进行针对性分析。登录用户的记录保存至数据库，未登录可使用但不保存。

---

## 数据库

### 新增表：`strength_sessions`

```sql
create table strength_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade,
  jd_text      text,
  messages     jsonb not null default '[]',
  result       jsonb,
  status       text not null default 'active'
                    check (status in ('active', 'done')),
  created_at   timestamptz not null default now()
);

alter table strength_sessions enable row level security;

create policy "users see own strength sessions"
  on strength_sessions for select
  using (auth.uid() = user_id);

create policy "users insert own strength sessions"
  on strength_sessions for insert
  with check (auth.uid() = user_id);

create policy "users update own strength sessions"
  on strength_sessions for update
  using (auth.uid() = user_id);
```

注：`user_id` 可为 null（未登录用户在前端使用，不写库）。RLS 策略只允许登录用户读写自己的记录。

---

## API 端点

### `POST /api/strengths/message`（流式）

**入参：**
```json
{
  "session_id": "uuid | null",
  "messages": [{ "role": "user|assistant", "content": "string" }],
  "jd_text": "string | null",
  "turn_index": 0
}
```

`turn_index` 为 AI 即将发出的第几问（0-based，0 = 第一问，2 = 第三问也是最后一问）。

**逻辑：**
1. 读取 session user（可未登录，未登录跳过数据库操作）
2. 调用 Claude（流式），传入完整 `messages` 历史，system prompt 指导 AI：
   - `turn_index < 2`：根据用户上一条回答，动态生成下一个追问（聚焦最有价值的方向）
   - `turn_index === 2`：告知用户这是最后一个问题，问完后会整理优势
3. 流式返回 AI 文字回复（ndjson，每行一个 `{ text: string }` chunk）
4. 流结束后追加最后一行：`{ session_id: string|null, turn_index: number, is_final: boolean }`
   - `is_final: true` 表示这是第 3 轮 AI 追问（用户还需回答一次，回答后前端调 `/api/strengths/result`）
5. 如果用户已登录：
   - 无 `session_id`：用 service role 新建 `strength_sessions`（写入 `user_id`、`jd_text`、当前 `messages`），返回新 `session_id`
   - 有 `session_id`：更新 `messages` 字段

**出参（ndjson）：**
```
{ "text": "..." }
{ "text": "..." }
...
{ "session_id": "uuid|null", "turn_index": 0, "is_final": false }
```

---

### `POST /api/strengths/result`（非流式）

**入参：**
```json
{
  "session_id": "uuid | null",
  "messages": [{ "role": "user|assistant", "content": "string" }],
  "jd_text": "string | null"
}
```

**逻辑：**
1. 读取 session user（可未登录）
2. 调用 Claude（非流式），传入完整对话历史，system prompt 要求输出严格 JSON：
   ```json
   {
     "strengths": [
       { "label": "跨团队沟通", "evidence": "在 X 项目中协调了 3 个部门，按时交付" }
     ],
     "summary": "string（综合点评，100-150 字）"
   }
   ```
3. 如果用户已登录且有 `session_id`：将结果写入 `strength_sessions.result`，status 改为 `done`，并更新最终 `messages`
4. 返回解析后的结果

**出参：**
```json
{
  "strengths": [{ "label": "string", "evidence": "string" }],
  "summary": "string"
}
```

---

## Prompt 设计

### `STRENGTHS_CHAT_SYSTEM`

```
你是职业顾问，帮助用户挖掘真实的职业优势。通过动态追问引导用户讲述具体经历。

规则：
1. 每次只问一个问题，问题开放且具体（避免「你有什么优点」这类泛问题）
2. turn_index === 0（第一问）：用开场白问法，引导用户讲述一件有成就感或有挑战的工作/学习经历，不要追问，直接开场
3. turn_index > 0（追问）：根据用户上一条回答，聚焦最有价值的方向追问（如细节、数据、挑战、结果）
4. 问题简短，不超过 50 字
5. 不评价、不总结，只追问
6. 如果提供了 JD，追问方向优先贴合岗位要求
```

`buildStrengthsChatPrompt(messages, jdText, turnIndex)` — 构建 user 消息，包含当前 `turn_index` 提示（传给 AI 知道自己在第几轮）和可选 JD。

### `STRENGTHS_RESULT_SYSTEM`

```
你是职业顾问，根据用户讲述的经历提炼结构化优势列表。

规则：
1. 每条优势必须有真实经历支撑，不编造
2. label：2-6 字的能力标签（如「数据驱动决策」「跨部门协作」）
3. evidence：一句话，直接引用用户描述中的具体事实、数据或结果
4. 提炼 3-6 条优势
5. summary：100-150 字综合点评，说明这些优势组合起来的竞争力
6. 如果提供了 JD，label 和 evidence 优先体现与岗位的匹配
7. 输出严格 JSON，不加 markdown 代码块
```

`buildStrengthsResultPrompt(messages, jdText)` — 构建生成结果的 user 消息。

---

## 前端页面：`/strengths`

Client Component，URL 参数：`?case_id=uuid`（从 dashboard 进入时携带，预填 JD）。

### 状态机

```
idle → chatting → generating_result → done
```

**`idle`**
- 可选 JD 文本框（如有 `case_id`，用 `useEffect` + Supabase 客户端预填）
- 提示文案：「AI 将通过 3 个问题了解你的经历，帮你整理有证据的优势」
- 未登录用户：可以使用，底部显示「登录后可保存记录」提示
- 「开始挖掘」按钮，点击后立即调用 `/api/strengths/message`（`turn_index: 0`，`messages: []`）进入 `chatting`

**`chatting`**
- 对话气泡界面，`ChatBubble` 组件渲染每条消息
- 顶部显示轮次进度：「第 N 问 / 共 3 问」
- AI 回复流式渲染（逐字显示）
- 用户文本框 + 「发送」按钮
- 用户提交第 3 条回答后（`turn_index === 2` 的用户回答），自动进入 `generating_result`

**`generating_result`**
- 显示「正在整理你的优势...」加载动画（animate-pulse）
- 调用 `/api/strengths/result`

**`done`**
- 渲染 `StrengthsResult`
- 「重新开始」按钮（重置回 `idle`）
- 「返回首页」链接

### 对话轮次逻辑

```
前端调 /message(messages=[], turn_index=0)           → AI 发第1问（开场白）
用户回答后，前端调 /message(messages=[ai问1, 用户答1], turn_index=1)  → AI 发第2问（追问，is_final=false）
用户回答后，前端调 /message(messages=[ai问1, 用户答1, ai问2, 用户答2], turn_index=2) → AI 发第3问（追问，is_final=true）
用户回答后，前端调 /result(messages=[全部6条])        → 生成优势列表
```

`turn_index` 含义：AI 即将发出第几问（0-based）。`is_final: turn_index === 2`，前端收到 `is_final=true` 后，用户提交回答即触发 `/result`。

---

## 组件

### `ChatBubble`

Props：`{ role: 'user' | 'assistant'; content: string }`

- `assistant`：左对齐，浅色背景气泡
- `user`：右对齐，深色背景气泡
- 支持流式渲染（content 增量更新时自然扩展）

### `StrengthsResult`

Props：`{ strengths: { label: string; evidence: string }[]; summary: string }`

- 每条优势：标签 chip + 证据句
- 底部综合点评段落

---

## 入口

**首页（`app/page.tsx`）：**
- 已登录 header：「历史记录 | 面试训练 | **优势挖掘** | 退出」
- 未登录 header：「登录 | 面试训练 | **优势挖掘**」（点击弹出 AuthModal）

**详情页（`app/dashboard/[id]/page.tsx`）：**
- 「基于此 JD 开始面试训练」按钮旁新增「优势挖掘」Link → `/strengths?case_id={id}`

---

## 类型定义（新增到 `types/index.ts`）

```typescript
export interface StrengthItem {
  label: string
  evidence: string
}

export interface StrengthsResult {
  strengths: StrengthItem[]
  summary: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface StrengthSession {
  id: string
  user_id: string | null
  jd_text: string | null
  messages: ChatMessage[]
  result: StrengthsResult | null
  status: 'active' | 'done'
  created_at: string
}
```

---

## 文件清单

| 操作 | 路径 |
|------|------|
| 新增 | `supabase/migrations/004_strength_sessions.sql` |
| 修改 | `types/index.ts` |
| 修改 | `lib/prompts.ts` |
| 新增 | `app/api/strengths/message/route.ts` |
| 新增 | `app/api/strengths/result/route.ts` |
| 新增 | `components/ChatBubble.tsx` |
| 新增 | `components/StrengthsResult.tsx` |
| 新增 | `app/strengths/page.tsx` |
| 修改 | `app/page.tsx` |
| 修改 | `app/dashboard/[id]/page.tsx` |
