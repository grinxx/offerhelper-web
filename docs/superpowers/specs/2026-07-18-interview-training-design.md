# 面试训练功能设计文档

## 概述

为 OfferHelper Web 添加一问一答式面试训练模式。用户提供 JD，AI 生成 5 道岗位相关面试题，用户逐题作答，每题获得三维评分（结构、证据、岗位关联）+ 文字点评 + 参考回答框架。训练结束后显示汇总总结，记录保存至数据库。

---

## 数据库

### 新增表：`interview_sessions`

```sql
create table interview_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  case_id      uuid references cases(id) on delete set null,
  jd_text      text not null,
  questions    jsonb not null default '[]',  -- string[]，5 道题
  status       text not null default 'active'
                    check (status in ('active', 'done')),
  created_at   timestamptz not null default now()
);

alter table interview_sessions enable row level security;

create policy "users see own sessions"
  on interview_sessions for select
  using (auth.uid() = user_id);

create policy "users insert own sessions"
  on interview_sessions for insert
  with check (auth.uid() = user_id);

create policy "users update own sessions"
  on interview_sessions for update
  using (auth.uid() = user_id);
```

### 新增表：`interview_turns`

```sql
create table interview_turns (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null references interview_sessions(id) on delete cascade,
  question_index   int not null,   -- 0-4
  question         text not null,
  user_answer      text not null,
  scores           jsonb not null, -- { structure: 1-5, evidence: 1-5, relevance: 1-5 }
  feedback         text not null,
  reference_answer text not null,
  created_at       timestamptz not null default now()
);

alter table interview_turns enable row level security;

create policy "users see own turns"
  on interview_turns for select
  using (
    exists (
      select 1 from interview_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

create policy "users insert own turns"
  on interview_turns for insert
  with check (
    exists (
      select 1 from interview_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );
```

---

## API 端点

所有端点均要求登录态（通过 `createClient` 从 session cookie 读取 user），未登录返回 401。

### `POST /api/interview/start`

**入参：**
```json
{ "jd_text": "string", "case_id": "uuid | null" }
```

**逻辑：**
1. 验证用户已登录
2. 调用 Claude（非流式）生成 5 道面试题，system prompt 要求输出纯 JSON 数组 `string[]`
3. 用 service role key 写入 `interview_sessions`（包含 user_id、jd_text、questions、case_id）
4. 返回第一题和 session_id

**出参：**
```json
{ "session_id": "uuid", "question": "string", "question_index": 0 }
```

**题目生成 prompt：**
- system：你是专业面试官，根据 JD 生成 5 道行为面试题。输出严格 JSON 数组，每项为一个中文问题字符串，不输出其他内容。
- user：JD 内容：`{jd_text}`。如果 JD 内容不足，用通用行为面试题（如 STAR 结构题）补足至 5 道。

---

### `POST /api/interview/answer`（流式，ndjson）

**入参：**
```json
{
  "session_id": "uuid",
  "question_index": 0,
  "question": "string",
  "user_answer": "string"
}
```

**逻辑：**
1. 验证用户已登录且 session 属于该用户
2. 从 `interview_sessions` 查询 `jd_text`（用于评估 prompt）
3. 调用 Claude（流式），从流中提取完整 JSON 对象
4. 完整 JSON 解析后写入 `interview_turns`
5. 流式返回评估结果（ndjson，和 `/api/analyze` 格式一致）

**流式输出格式（最终完整对象）：**
```json
{
  "scores": { "structure": 4, "evidence": 3, "relevance": 5 },
  "feedback": "string",
  "reference_answer": "string"
}
```

**评估 prompt：**
- system：你是面试评估专家。对用户的面试回答进行评估，输出严格 JSON，格式：`{ "scores": { "structure": 1-5, "evidence": 1-5, "relevance": 1-5 }, "feedback": "string（50-100字，指出最重要的一个问题和改进方向）", "reference_answer": "string（100-150字，给出这道题的参考回答框架，使用 STAR 结构）" }`。不输出任何其他内容。
- user：面试题：`{question}`\n用户回答：`{user_answer}`\n目标 JD：`{jd_text}`

---

### `POST /api/interview/finish`

**入参：**
```json
{ "session_id": "uuid" }
```

**逻辑：**
1. 验证用户已登录且 session 属于该用户
2. 将 session status 更新为 `done`
3. 查询该 session 所有 turns，计算汇总数据

**出参：**
```json
{
  "turns": [ { "question_index": 0, "question": "...", "scores": {...}, "feedback": "...", "reference_answer": "..." } ],
  "avg_scores": { "structure": 3.6, "evidence": 2.8, "relevance": 4.2 },
  "weakest_dimension": "evidence"
}
```

---

## 前端页面：`/interview`

Client Component，URL 参数：`?case_id=uuid`（从 dashboard 进入时携带，预填 JD）。

### 状态机

```
idle → loading_questions → questioning → evaluating → summary
```

**`idle`**
- 如果 URL 有 `case_id`，在客户端用 `useEffect` + Supabase 客户端 SDK 获取对应 case 的 `jd_text` 预填文本框
- 显示 JD 文本框（可编辑）+ 「开始面试训练」按钮
- 未登录则显示提示文案并渲染登录按钮（点击弹出 AuthModal），训练必须登录

**`loading_questions`**
- 调用 `/api/interview/start`
- 显示「正在生成题目...」加载动画

**`questioning`**
- 顶部：`InterviewProgress`（第 N 题 / 共 5 题）
- 中部：当前题目文本
- 下部：用户回答文本框 + 「提交回答」按钮 + 「结束训练」按钮

**`evaluating`**
- 流式展示 `ScoreCard`（评分 + 点评 + 参考框架）
- 加载完成后：如果 `question_index < 4`，显示「下一题」；否则显示「查看总结」
- 同时显示「结束训练」按钮

**`summary`**
- 调用 `/api/interview/finish`
- 展示每题得分表格（题目 + 三维分）
- 展示平均分 + 最弱维度提示（如「你在「证据」维度平均 2.8 分，建议多用具体数据和经历支撑回答」）
- 「再来一次」按钮（重置状态回 idle）
- 「返回首页」链接

---

## 组件

### `ScoreCard`

Props：`{ scores: { structure: number, evidence: number, relevance: number }, feedback: string, reference_answer: string, loading?: boolean }`

展示三个维度的评分（1-5 分，数字 + 简单进度条）、文字点评、参考回答框架。`loading=true` 时显示骨架屏。

### `InterviewProgress`

Props：`{ current: number, total: number }`

顶部进度条，显示「第 2 题 / 共 5 题」和填充进度。

---

## 入口

**首页（`app/page.tsx`）：**
- 现有「查看历史记录」按钮旁边，新增「面试训练」按钮
- 未登录时点击弹出 AuthModal（defaultTab='login'）
- 已登录时跳转 `/interview`

**详情页（`app/dashboard/[id]/page.tsx`）：**
- 建议列表底部新增「基于此 JD 开始面试训练」按钮
- 跳转 `/interview?case_id={id}`

---

## 类型定义（新增到 `types/index.ts`）

```typescript
export interface InterviewScores {
  structure: number   // 1-5
  evidence: number    // 1-5
  relevance: number   // 1-5
}

export interface InterviewTurn {
  id: string
  session_id: string
  question_index: number
  question: string
  user_answer: string
  scores: InterviewScores
  feedback: string
  reference_answer: string
  created_at: string
}

export interface InterviewSession {
  id: string
  user_id: string
  case_id: string | null
  jd_text: string
  questions: string[]
  status: 'active' | 'done'
  created_at: string
}
```

---

## 文件清单

| 操作 | 路径 |
|------|------|
| 新增 | `supabase/migrations/003_interview_tables.sql` |
| 新增 | `app/api/interview/start/route.ts` |
| 新增 | `app/api/interview/answer/route.ts` |
| 新增 | `app/api/interview/finish/route.ts` |
| 新增 | `app/interview/page.tsx` |
| 新增 | `components/ScoreCard.tsx` |
| 新增 | `components/InterviewProgress.tsx` |
| 修改 | `app/page.tsx`（新增入口按钮） |
| 修改 | `app/dashboard/[id]/page.tsx`（新增入口按钮） |
| 修改 | `types/index.ts`（新增类型） |
| 修改 | `lib/prompts.ts`（新增面试相关 prompt） |
