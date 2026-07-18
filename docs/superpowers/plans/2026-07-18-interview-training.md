# 面试训练功能实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 OfferHelper Web 添加一问一答式面试训练模式，用户提供 JD，AI 生成 5 道题，逐题评分并给出参考框架，训练记录存入数据库。

**Architecture:** 两阶段 API（start 生成题目、answer 流式评估、finish 汇总），前端状态机驱动（idle→loading_questions→questioning→evaluating→summary），数据存储在 `interview_sessions` + `interview_turns` 两张表。

**Tech Stack:** Next.js 16 App Router, Supabase (PostgreSQL + RLS + Auth), @supabase/ssr, Anthropic SDK (claude-sonnet-4-6), Tailwind CSS

## Global Constraints

- Next.js 版本为 16，使用 `proxy.ts` 而非 `middleware.ts`，Route Handler 位于 `app/api/` 下
- Supabase 客户端：浏览器端用 `@/lib/supabase/client`（`createBrowserClient`），服务端 Route Handler 用 `@/lib/supabase/server`（`createServerClient` + cookies），service role 用 `createClient` from `@supabase/supabase-js` + `SUPABASE_SERVICE_ROLE_KEY`
- 所有 Claude 调用使用 `model: 'claude-sonnet-4-6'`，`apiKey: process.env.ANTHROPIC_API_KEY`，`baseURL: process.env.ANTHROPIC_BASE_URL`
- 流式 API 返回 ndjson（每行一个 JSON，`Content-Type: text/event-stream`），与现有 `/api/analyze` 格式一致
- 所有新组件和页面使用 Tailwind CSS dark mode（`dark:` variants，zinc 色阶），参照现有组件风格
- 训练功能必须登录才能使用（未登录返回 401 或前端显示提示）
- 所有新文件使用 TypeScript，`'use client'` 只在 Client Component 顶部添加
- 评分维度名称：`structure`（结构）、`evidence`（证据）、`relevance`（岗位关联）

---

## 文件清单

| 操作 | 路径 | 职责 |
|------|------|------|
| 新增 | `supabase/migrations/003_interview_tables.sql` | 建表 + RLS |
| 修改 | `types/index.ts` | 新增 InterviewScores / InterviewTurn / InterviewSession |
| 修改 | `lib/prompts.ts` | 新增题目生成和评估两套 prompt |
| 新增 | `app/api/interview/start/route.ts` | 生成题目、建 session |
| 新增 | `app/api/interview/answer/route.ts` | 流式评估单题 |
| 新增 | `app/api/interview/finish/route.ts` | 关闭 session、返回汇总 |
| 新增 | `components/InterviewProgress.tsx` | 顶部进度条 |
| 新增 | `components/ScoreCard.tsx` | 三维评分 + 点评 + 参考框架 |
| 新增 | `app/interview/page.tsx` | 面试训练主页面（Client Component） |
| 修改 | `app/page.tsx` | 新增「面试训练」入口按钮 |
| 修改 | `app/dashboard/[id]/page.tsx` | 新增「基于此 JD 开始面试训练」按钮 |

---

### Task 1: 数据库迁移 + 类型定义

**Files:**
- Create: `supabase/migrations/003_interview_tables.sql`
- Modify: `types/index.ts`

**Interfaces:**
- Produces:
  - `InterviewScores`: `{ structure: number; evidence: number; relevance: number }`
  - `InterviewTurn`: `{ id, session_id, question_index, question, user_answer, scores: InterviewScores, feedback, reference_answer, created_at }`
  - `InterviewSession`: `{ id, user_id, case_id: string | null, jd_text, questions: string[], status: 'active' | 'done', created_at }`

- [ ] **Step 1: 创建迁移文件**

```sql
-- supabase/migrations/003_interview_tables.sql

create table interview_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  case_id      uuid references cases(id) on delete set null,
  jd_text      text not null,
  questions    jsonb not null default '[]',
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

create table interview_turns (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null references interview_sessions(id) on delete cascade,
  question_index   int not null,
  question         text not null,
  user_answer      text not null,
  scores           jsonb not null,
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

- [ ] **Step 2: 在 Supabase 控制台执行迁移 SQL**

打开 Supabase Dashboard → SQL Editor，粘贴 `003_interview_tables.sql` 全部内容并执行。
期望：无错误，两张新表出现在 Table Editor 中。

- [ ] **Step 3: 新增类型到 `types/index.ts`**

在文件末尾追加：

```typescript
export interface InterviewScores {
  structure: number
  evidence: number
  relevance: number
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

- [ ] **Step 4: 验证类型文件无 TS 错误**

```bash
cd /Users/i758469/offerhelper-web
npx tsc --noEmit 2>&1 | head -20
```

期望：无输出（或只有与本任务无关的已有错误）。

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/003_interview_tables.sql types/index.ts
git commit -m "feat: add interview tables migration and TypeScript types"
```

---

### Task 2: Prompt 函数

**Files:**
- Modify: `lib/prompts.ts`

**Interfaces:**
- Consumes: 无外部依赖
- Produces:
  - `INTERVIEW_QUESTION_SYSTEM`: `string` — 题目生成 system prompt
  - `buildInterviewQuestionPrompt(jdText: string): string` — 题目生成 user prompt
  - `INTERVIEW_EVAL_SYSTEM`: `string` — 评估 system prompt
  - `buildInterviewEvalPrompt(question: string, userAnswer: string, jdText: string): string` — 评估 user prompt

- [ ] **Step 1: 在 `lib/prompts.ts` 末尾追加以下内容**

```typescript
export const INTERVIEW_QUESTION_SYSTEM = `你是专业面试官。根据提供的 JD，生成 5 道针对性的行为面试题。
规则：
1. 优先生成与 JD 岗位要求直接相关的行为问题（如「请描述一次你主导复杂项目的经历」）
2. 如果 JD 内容不足，用通用 STAR 结构行为题补足至恰好 5 道
3. 输出严格的 JSON 数组，每项为一个中文问题字符串，格式：["题目1","题目2","题目3","题目4","题目5"]
4. 不输出任何其他内容，不加 markdown 代码块`

export function buildInterviewQuestionPrompt(jdText: string): string {
  return `JD 内容：\n${jdText}\n\n请生成 5 道面试题 JSON 数组。`
}

export const INTERVIEW_EVAL_SYSTEM = `你是面试评估专家。对应聘者的面试回答进行结构化评估。
规则：
1. 从三个维度评分（各 1-5 分）：
   - structure（结构）：回答是否有清晰的 STAR 结构（背景、任务、行动、结果）
   - evidence（证据）：是否引用了具体数据、案例或可验证的事实
   - relevance（岗位关联）：回答内容是否扣住了 JD 中的关键要求
2. feedback：50-100 字，指出最重要的一个问题和改进方向
3. reference_answer：100-150 字，给出这道题的参考回答框架，使用 STAR 结构
4. 输出严格 JSON，格式：{"scores":{"structure":N,"evidence":N,"relevance":N},"feedback":"...","reference_answer":"..."}
5. 不输出任何其他内容，不加 markdown 代码块`

export function buildInterviewEvalPrompt(question: string, userAnswer: string, jdText: string): string {
  return `面试题：${question}\n\n应聘者回答：${userAnswer}\n\n目标 JD：\n${jdText}`
}
```

- [ ] **Step 2: 验证 TS 无错误**

```bash
npx tsc --noEmit 2>&1 | head -20
```

期望：无新增错误。

- [ ] **Step 3: Commit**

```bash
git add lib/prompts.ts
git commit -m "feat: add interview question generation and evaluation prompts"
```

---

### Task 3: `/api/interview/start` 路由

**Files:**
- Create: `app/api/interview/start/route.ts`

**Interfaces:**
- Consumes:
  - `createClient` from `@/lib/supabase/server`
  - `createClient as createServiceClient` from `@supabase/supabase-js`
  - `INTERVIEW_QUESTION_SYSTEM`, `buildInterviewQuestionPrompt` from `@/lib/prompts`
  - `Anthropic` from `@anthropic-ai/sdk`
- Produces: `POST /api/interview/start` → `{ session_id: string, question: string, question_index: 0 }`

- [ ] **Step 1: 创建文件**

```typescript
// app/api/interview/start/route.ts
import Anthropic from '@anthropic-ai/sdk'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { INTERVIEW_QUESTION_SYSTEM, buildInterviewQuestionPrompt } from '@/lib/prompts'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const sessionSupabase = await createClient()
  const { data: { user } } = await sessionSupabase.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ error: '未登录' }), { status: 401 })
  }

  let body: { jd_text?: string; case_id?: string | null } = {}
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400 })
  }

  const { jd_text, case_id } = body
  if (!jd_text?.trim()) {
    return new Response(JSON.stringify({ error: 'jd_text 为必填项' }), { status: 400 })
  }

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL,
  })

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: INTERVIEW_QUESTION_SYSTEM,
    messages: [{ role: 'user', content: buildInterviewQuestionPrompt(jd_text) }],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text : ''
  let questions: string[] = []
  try {
    questions = JSON.parse(raw)
    if (!Array.isArray(questions) || questions.length === 0) throw new Error('invalid')
  } catch {
    return new Response(JSON.stringify({ error: '题目生成失败，请重试' }), { status: 500 })
  }

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const insertData: Record<string, unknown> = {
    user_id: user.id,
    jd_text,
    questions,
    status: 'active',
  }
  if (case_id) insertData.case_id = case_id

  const { data: session, error } = await supabase
    .from('interview_sessions')
    .insert(insertData)
    .select('id')
    .single()

  if (error || !session) {
    return new Response(JSON.stringify({ error: '创建训练失败', detail: error?.message }), { status: 500 })
  }

  return new Response(
    JSON.stringify({ session_id: session.id, question: questions[0], question_index: 0 }),
    { headers: { 'Content-Type': 'application/json' } }
  )
}
```

- [ ] **Step 2: 验证 TS 无错误**

```bash
npx tsc --noEmit 2>&1 | head -20
```

期望：无新增错误。

- [ ] **Step 3: 手动测试（需先登录获取 cookie）**

在浏览器开发者工具 Console 中（已登录状态）执行：

```javascript
fetch('/api/interview/start', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ jd_text: '前端工程师，熟悉 React，有跨团队协作经验' })
}).then(r => r.json()).then(console.log)
```

期望：返回 `{ session_id: "uuid", question: "请描述...", question_index: 0 }`。

- [ ] **Step 4: Commit**

```bash
git add app/api/interview/start/route.ts
git commit -m "feat: add /api/interview/start route"
```

---

### Task 4: `/api/interview/answer` 流式路由

**Files:**
- Create: `app/api/interview/answer/route.ts`

**Interfaces:**
- Consumes:
  - `createClient` from `@/lib/supabase/server`
  - `createClient as createServiceClient` from `@supabase/supabase-js`
  - `INTERVIEW_EVAL_SYSTEM`, `buildInterviewEvalPrompt` from `@/lib/prompts`
  - `Anthropic` from `@anthropic-ai/sdk`
  - `InterviewScores` from `@/types`
- Produces: `POST /api/interview/answer` → ndjson 流，最终行为 `{ scores: InterviewScores, feedback: string, reference_answer: string }`

- [ ] **Step 1: 创建文件**

```typescript
// app/api/interview/answer/route.ts
import Anthropic from '@anthropic-ai/sdk'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { INTERVIEW_EVAL_SYSTEM, buildInterviewEvalPrompt } from '@/lib/prompts'
import type { InterviewScores } from '@/types'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const sessionSupabase = await createClient()
  const { data: { user } } = await sessionSupabase.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ error: '未登录' }), { status: 401 })
  }

  let body: { session_id?: string; question_index?: number; question?: string; user_answer?: string } = {}
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400 })
  }

  const { session_id, question_index, question, user_answer } = body
  if (!session_id || question_index === undefined || !question || !user_answer?.trim()) {
    return new Response(JSON.stringify({ error: '缺少必填字段' }), { status: 400 })
  }

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: sessionRow } = await supabase
    .from('interview_sessions')
    .select('jd_text, user_id')
    .eq('id', session_id)
    .single()

  if (!sessionRow || sessionRow.user_id !== user.id) {
    return new Response(JSON.stringify({ error: '无权访问' }), { status: 403 })
  }

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL,
  })

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      let buffer = ''
      let result: { scores: InterviewScores; feedback: string; reference_answer: string } | null = null

      try {
        const response = await client.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: INTERVIEW_EVAL_SYSTEM,
          messages: [{
            role: 'user',
            content: buildInterviewEvalPrompt(question, user_answer, sessionRow.jd_text),
          }],
          stream: true,
        })

        for await (const event of response) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            buffer += event.delta.text
          }
        }

        result = JSON.parse(buffer)
        if (!result?.scores || !result.feedback || !result.reference_answer) {
          throw new Error('invalid response')
        }

        await supabase.from('interview_turns').insert({
          session_id,
          question_index,
          question,
          user_answer,
          scores: result.scores,
          feedback: result.feedback,
          reference_answer: result.reference_answer,
        })

        controller.enqueue(encoder.encode(JSON.stringify(result) + '\n'))
      } catch {
        controller.enqueue(encoder.encode(JSON.stringify({ error: 'AI 评估失败，请重试' }) + '\n'))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  })
}
```

- [ ] **Step 2: 验证 TS 无错误**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add app/api/interview/answer/route.ts
git commit -m "feat: add /api/interview/answer streaming route"
```

---

### Task 5: `/api/interview/finish` 路由

**Files:**
- Create: `app/api/interview/finish/route.ts`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase/server`, `createServiceClient` from `@supabase/supabase-js`
- Produces: `POST /api/interview/finish` → `{ turns, avg_scores: InterviewScores, weakest_dimension: 'structure'|'evidence'|'relevance' }`

- [ ] **Step 1: 创建文件**

```typescript
// app/api/interview/finish/route.ts
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { InterviewScores } from '@/types'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const sessionSupabase = await createClient()
  const { data: { user } } = await sessionSupabase.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ error: '未登录' }), { status: 401 })
  }

  let body: { session_id?: string } = {}
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400 })
  }

  const { session_id } = body
  if (!session_id) {
    return new Response(JSON.stringify({ error: '缺少 session_id' }), { status: 400 })
  }

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: sessionRow } = await supabase
    .from('interview_sessions')
    .select('user_id')
    .eq('id', session_id)
    .single()

  if (!sessionRow || sessionRow.user_id !== user.id) {
    return new Response(JSON.stringify({ error: '无权访问' }), { status: 403 })
  }

  await supabase
    .from('interview_sessions')
    .update({ status: 'done' })
    .eq('id', session_id)

  const { data: turns } = await supabase
    .from('interview_turns')
    .select('question_index, question, scores, feedback, reference_answer')
    .eq('session_id', session_id)
    .order('question_index', { ascending: true })

  const safeTurns = turns ?? []
  const count = safeTurns.length

  const avg_scores: InterviewScores = { structure: 0, evidence: 0, relevance: 0 }
  if (count > 0) {
    for (const t of safeTurns) {
      const s = t.scores as InterviewScores
      avg_scores.structure += s.structure
      avg_scores.evidence += s.evidence
      avg_scores.relevance += s.relevance
    }
    avg_scores.structure = Math.round((avg_scores.structure / count) * 10) / 10
    avg_scores.evidence = Math.round((avg_scores.evidence / count) * 10) / 10
    avg_scores.relevance = Math.round((avg_scores.relevance / count) * 10) / 10
  }

  const weakest_dimension = (
    Object.entries(avg_scores) as [keyof InterviewScores, number][]
  ).reduce((a, b) => (b[1] < a[1] ? b : a))[0]

  return new Response(
    JSON.stringify({ turns: safeTurns, avg_scores, weakest_dimension }),
    { headers: { 'Content-Type': 'application/json' } }
  )
}
```

- [ ] **Step 2: 验证 TS 无错误**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add app/api/interview/finish/route.ts
git commit -m "feat: add /api/interview/finish route"
```

---

### Task 6: `InterviewProgress` 和 `ScoreCard` 组件

**Files:**
- Create: `components/InterviewProgress.tsx`
- Create: `components/ScoreCard.tsx`

**Interfaces:**
- Produces:
  - `InterviewProgress`: props `{ current: number; total: number }`
  - `ScoreCard`: props `{ scores: InterviewScores; feedback: string; reference_answer: string; loading?: boolean }`

- [ ] **Step 1: 创建 `components/InterviewProgress.tsx`**

```typescript
// components/InterviewProgress.tsx
interface Props {
  current: number
  total: number
}

export default function InterviewProgress({ current, total }: Props) {
  const pct = Math.round((current / total) * 100)
  return (
    <div className="mb-6">
      <div className="flex justify-between text-xs text-zinc-400 dark:text-zinc-500 mb-1">
        <span>第 {current} 题 / 共 {total} 题</span>
        <span>{pct}%</span>
      </div>
      <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-1.5">
        <div
          className="bg-zinc-900 dark:bg-zinc-100 h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 创建 `components/ScoreCard.tsx`**

```typescript
// components/ScoreCard.tsx
import type { InterviewScores } from '@/types'

interface Props {
  scores: InterviewScores
  feedback: string
  reference_answer: string
  loading?: boolean
}

const DIMENSION_LABELS: Record<keyof InterviewScores, string> = {
  structure: '结构',
  evidence: '证据',
  relevance: '岗位关联',
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-zinc-500 dark:text-zinc-400 w-14 shrink-0">{label}</span>
      <div className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded-full h-2">
        <div
          className="bg-zinc-900 dark:bg-zinc-100 h-2 rounded-full transition-all duration-500"
          style={{ width: `${(score / 5) * 100}%` }}
        />
      </div>
      <span className="text-sm font-medium w-6 text-right">{score}</span>
    </div>
  )
}

export default function ScoreCard({ scores, feedback, reference_answer, loading }: Props) {
  if (loading) {
    return (
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 space-y-4 animate-pulse">
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-3 w-14 bg-zinc-100 dark:bg-zinc-800 rounded" />
              <div className="flex-1 h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full" />
            </div>
          ))}
        </div>
        <div className="h-16 bg-zinc-100 dark:bg-zinc-800 rounded" />
        <div className="h-24 bg-zinc-100 dark:bg-zinc-800 rounded" />
      </div>
    )
  }

  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 space-y-4">
      <div className="space-y-2.5">
        {(Object.keys(DIMENSION_LABELS) as (keyof InterviewScores)[]).map(key => (
          <ScoreBar key={key} label={DIMENSION_LABELS[key]} score={scores[key]} />
        ))}
      </div>

      <div>
        <p className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-1">点评</p>
        <p className="text-sm text-zinc-700 dark:text-zinc-300">{feedback}</p>
      </div>

      <div>
        <p className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-1">参考回答框架</p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">{reference_answer}</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 验证 TS 无错误**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add components/InterviewProgress.tsx components/ScoreCard.tsx
git commit -m "feat: add InterviewProgress and ScoreCard components"
```

---

### Task 7: `/interview` 页面

**Files:**
- Create: `app/interview/page.tsx`

**Interfaces:**
- Consumes:
  - `InterviewProgress` from `@/components/InterviewProgress`
  - `ScoreCard` from `@/components/ScoreCard`
  - `AuthModal` from `@/components/AuthModal`
  - `createClient` from `@/lib/supabase/client`
  - `InterviewScores` from `@/types`
- Produces: `/interview?case_id=uuid` 页面，实现完整状态机

- [ ] **Step 1: 创建 `app/interview/page.tsx`**

```typescript
// app/interview/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import InterviewProgress from '@/components/InterviewProgress'
import ScoreCard from '@/components/ScoreCard'
import AuthModal from '@/components/AuthModal'
import type { InterviewScores } from '@/types'

type Stage = 'idle' | 'loading_questions' | 'questioning' | 'evaluating' | 'summary'

interface TurnResult {
  question_index: number
  question: string
  scores: InterviewScores
  feedback: string
  reference_answer: string
}

interface CurrentEval {
  scores: InterviewScores
  feedback: string
  reference_answer: string
}

interface SummaryData {
  turns: TurnResult[]
  avg_scores: InterviewScores
  weakest_dimension: keyof InterviewScores
}

const WEAKEST_LABEL: Record<keyof InterviewScores, string> = {
  structure: '结构',
  evidence: '证据',
  relevance: '岗位关联',
}

const TOTAL_QUESTIONS = 5

export default function InterviewPage() {
  const searchParams = useSearchParams()
  const caseId = searchParams.get('case_id')

  const [user, setUser] = useState<User | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [jdText, setJdText] = useState('')
  const [stage, setStage] = useState<Stage>('idle')
  const [sessionId, setSessionId] = useState('')
  const [questions, setQuestions] = useState<string[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [userAnswer, setUserAnswer] = useState('')
  const [currentEval, setCurrentEval] = useState<CurrentEval | null>(null)
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  useEffect(() => {
    if (!caseId) return
    const supabase = createClient()
    supabase.from('cases').select('jd_text').eq('id', caseId).single()
      .then(({ data }) => { if (data?.jd_text) setJdText(data.jd_text) })
  }, [caseId])

  async function handleStart() {
    if (!jdText.trim()) return
    setStage('loading_questions')
    setError('')

    const res = await fetch('/api/interview/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jd_text: jdText, case_id: caseId }),
    })
    const data = await res.json()

    if (!res.ok || data.error) {
      setError(data.error || '启动失败，请重试')
      setStage('idle')
      return
    }

    setSessionId(data.session_id)
    // Fetch all questions to track progress; questions[0] is already returned
    // We re-fetch the session questions from client — or store locally.
    // Since start only returns question[0], we fetch the session to get all questions.
    const supabase = createClient()
    const { data: sessionRow } = await supabase
      .from('interview_sessions')
      .select('questions')
      .eq('id', data.session_id)
      .single()

    const qs: string[] = sessionRow?.questions ?? [data.question]
    setQuestions(qs)
    setCurrentIndex(0)
    setUserAnswer('')
    setCurrentEval(null)
    setStage('questioning')
  }

  async function handleSubmitAnswer() {
    if (!userAnswer.trim()) return
    setStage('evaluating')
    setCurrentEval(null)

    const res = await fetch('/api/interview/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        question_index: currentIndex,
        question: questions[currentIndex],
        user_answer: userAnswer,
      }),
    })

    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const obj = JSON.parse(line)
          if (obj.scores) setCurrentEval(obj as CurrentEval)
          if (obj.error) setError(obj.error)
        } catch {}
      }
    }
  }

  async function handleFinish() {
    const res = await fetch('/api/interview/finish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId }),
    })
    const data = await res.json()
    setSummary(data)
    setStage('summary')
  }

  function handleNext() {
    if (currentIndex < TOTAL_QUESTIONS - 1) {
      setCurrentIndex(i => i + 1)
      setUserAnswer('')
      setCurrentEval(null)
      setStage('questioning')
    } else {
      handleFinish()
    }
  }

  function handleReset() {
    setStage('idle')
    setJdText('')
    setSessionId('')
    setQuestions([])
    setCurrentIndex(0)
    setUserAnswer('')
    setCurrentEval(null)
    setSummary(null)
    setError('')
  }

  if (!user) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-10">
        <header className="flex items-center justify-between mb-8">
          <Link href="/" className="text-xl font-semibold">OfferHelper</Link>
        </header>
        <div className="text-center py-16">
          <p className="text-zinc-500 dark:text-zinc-400 mb-4">面试训练需要登录后使用</p>
          <button
            onClick={() => setModalOpen(true)}
            className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-6 py-2 rounded-lg text-sm hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
          >
            登录
          </button>
        </div>
        <AuthModal
          isOpen={modalOpen}
          defaultTab="login"
          onClose={() => setModalOpen(false)}
          onAuthSuccess={(userId) => {
            setModalOpen(false)
            const supabase = createClient()
            supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
          }}
        />
      </main>
    )
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <header className="flex items-center justify-between mb-8">
        <Link href="/" className="text-xl font-semibold">OfferHelper</Link>
        <Link href="/dashboard" className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
          历史记录
        </Link>
      </header>

      <h2 className="text-2xl font-bold mb-6">面试训练</h2>

      {error && (
        <p className="text-red-500 dark:text-red-400 text-sm mb-4 bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded">{error}</p>
      )}

      {/* idle */}
      {stage === 'idle' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              目标 JD <span className="text-red-500">*</span>
            </label>
            <textarea
              className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded p-3 text-sm h-40 resize-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600"
              placeholder="粘贴目标岗位的 JD，AI 将根据它生成针对性面试题..."
              value={jdText}
              onChange={e => setJdText(e.target.value)}
            />
          </div>
          <button
            onClick={handleStart}
            disabled={!jdText.trim()}
            className="w-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 py-3 rounded-lg font-medium disabled:opacity-40 hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
          >
            开始面试训练
          </button>
        </div>
      )}

      {/* loading_questions */}
      {stage === 'loading_questions' && (
        <div className="text-center py-16">
          <p className="text-zinc-500 dark:text-zinc-400 animate-pulse">正在生成题目...</p>
        </div>
      )}

      {/* questioning */}
      {stage === 'questioning' && questions.length > 0 && (
        <div className="space-y-4">
          <InterviewProgress current={currentIndex + 1} total={TOTAL_QUESTIONS} />
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-5">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 leading-relaxed">
              {questions[currentIndex]}
            </p>
          </div>
          <textarea
            className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded p-3 text-sm h-40 resize-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600"
            placeholder="请用 STAR 结构作答：背景（Situation）、任务（Task）、行动（Action）、结果（Result）..."
            value={userAnswer}
            onChange={e => setUserAnswer(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              onClick={handleSubmitAnswer}
              disabled={!userAnswer.trim()}
              className="flex-1 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 py-2.5 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
            >
              提交回答
            </button>
            <button
              onClick={handleFinish}
              className="border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 px-4 py-2.5 rounded-lg text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              结束训练
            </button>
          </div>
        </div>
      )}

      {/* evaluating */}
      {stage === 'evaluating' && (
        <div className="space-y-4">
          <InterviewProgress current={currentIndex + 1} total={TOTAL_QUESTIONS} />
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 bg-zinc-50 dark:bg-zinc-900/50">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{questions[currentIndex]}</p>
          </div>
          {currentEval ? (
            <ScoreCard
              scores={currentEval.scores}
              feedback={currentEval.feedback}
              reference_answer={currentEval.reference_answer}
            />
          ) : (
            <ScoreCard scores={{ structure: 0, evidence: 0, relevance: 0 }} feedback="" reference_answer="" loading />
          )}
          {currentEval && (
            <div className="flex gap-2">
              <button
                onClick={handleNext}
                className="flex-1 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 py-2.5 rounded-lg text-sm font-medium hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
              >
                {currentIndex < TOTAL_QUESTIONS - 1 ? '下一题' : '查看总结'}
              </button>
              <button
                onClick={handleFinish}
                className="border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 px-4 py-2.5 rounded-lg text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                结束训练
              </button>
            </div>
          )}
        </div>
      )}

      {/* summary */}
      {stage === 'summary' && summary && (
        <div className="space-y-6">
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-5">
            <h3 className="text-sm font-medium mb-3">本次训练总结</h3>
            <div className="space-y-2 mb-4">
              {(['structure', 'evidence', 'relevance'] as (keyof InterviewScores)[]).map(dim => (
                <div key={dim} className="flex items-center gap-3">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 w-14">{WEAKEST_LABEL[dim]}</span>
                  <div className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded-full h-2">
                    <div
                      className="bg-zinc-900 dark:bg-zinc-100 h-2 rounded-full"
                      style={{ width: `${(summary.avg_scores[dim] / 5) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-8 text-right">{summary.avg_scores[dim]}</span>
                </div>
              ))}
            </div>
            <p className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded text-xs">
              你在「{WEAKEST_LABEL[summary.weakest_dimension]}」维度平均 {summary.avg_scores[summary.weakest_dimension]} 分，建议重点加强
            </p>
          </div>

          <div className="space-y-3">
            {summary.turns.map((turn) => (
              <div key={turn.question_index} className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-1">第 {turn.question_index + 1} 题</p>
                <p className="text-sm text-zinc-700 dark:text-zinc-300 mb-2">{turn.question}</p>
                <div className="flex gap-4 text-xs text-zinc-500 dark:text-zinc-400">
                  <span>结构 {turn.scores.structure}/5</span>
                  <span>证据 {turn.scores.evidence}/5</span>
                  <span>岗位关联 {turn.scores.relevance}/5</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleReset}
              className="flex-1 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 py-2.5 rounded-lg text-sm font-medium hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
            >
              再来一次
            </button>
            <Link
              href="/"
              className="border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 px-4 py-2.5 rounded-lg text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-center"
            >
              返回首页
            </Link>
          </div>
        </div>
      )}
    </main>
  )
}
```

- [ ] **Step 2: 验证 TS 无错误**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add app/interview/page.tsx
git commit -m "feat: add /interview page with full state machine"
```

---

### Task 8: 首页和详情页入口

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/dashboard/[id]/page.tsx`

**Interfaces:**
- Consumes: 现有 `user` state（`app/page.tsx`），现有 `caseData.id`（详情页）
- Produces: 首页新增「面试训练」按钮；详情页新增「基于此 JD 开始面试训练」Link

- [ ] **Step 1: 修改 `app/page.tsx` — 在 header 导航中新增「面试训练」按钮**

在 `app/page.tsx` 的 header 已登录分支，`历史记录` 按钮后面追加「面试训练」入口：

```typescript
// 将原来的已登录 header：
<div className="flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
  <button onClick={() => router.push('/dashboard')} className="hover:text-zinc-900 dark:hover:text-zinc-100">历史记录</button>
  <span>|</span>
  <button onClick={handleSignOut} className="hover:text-zinc-900 dark:hover:text-zinc-100">退出</button>
</div>

// 改为：
<div className="flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
  <button onClick={() => router.push('/dashboard')} className="hover:text-zinc-900 dark:hover:text-zinc-100">历史记录</button>
  <span>|</span>
  <button onClick={() => router.push('/interview')} className="hover:text-zinc-900 dark:hover:text-zinc-100">面试训练</button>
  <span>|</span>
  <button onClick={handleSignOut} className="hover:text-zinc-900 dark:hover:text-zinc-100">退出</button>
</div>
```

同时，在未登录 header 的 `登录 / 历史记录` 按钮旁新增「面试训练」入口（点击弹出登录框）：

```typescript
// 将原来的未登录 header：
<button onClick={() => openModal('login')} className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
  登录 / 历史记录
</button>

// 改为：
<div className="flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
  <button onClick={() => openModal('login')} className="hover:text-zinc-900 dark:hover:text-zinc-100">登录</button>
  <span>|</span>
  <button onClick={() => openModal('login')} className="hover:text-zinc-900 dark:hover:text-zinc-100">面试训练</button>
</div>
```

- [ ] **Step 2: 修改 `app/dashboard/[id]/page.tsx` — 在建议列表底部新增按钮**

在 `app/dashboard/[id]/page.tsx` 的建议列表（`caseData.status === 'done'` 分支）末尾，`</div>` 前追加：

```typescript
// 在 {caseData.result_json.map(...)} 之后，同级追加：
<div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 mt-2">
  <Link
    href={`/interview?case_id=${caseData.id}`}
    className="block w-full text-center border border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100 px-6 py-2.5 rounded-lg text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
  >
    基于此 JD 开始面试训练
  </Link>
</div>
```

- [ ] **Step 3: 验证 TS 无错误**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: 启动开发服务器，手动验证两个入口**

```bash
npm run dev
```

验证：
- 已登录用户在首页 header 能看到「面试训练」，点击跳转 `/interview`
- 未登录用户点击「面试训练」弹出登录框
- 详情页底部出现「基于此 JD 开始面试训练」，点击跳转 `/interview?case_id=xxx`，JD 自动预填

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx app/dashboard/\[id\]/page.tsx
git commit -m "feat: add interview training entry points on homepage and case detail page"
```

---

## 自审清单

### Spec 覆盖检查

| Spec 需求 | 对应 Task |
|-----------|-----------|
| interview_sessions 表 + RLS | Task 1 |
| interview_turns 表 + RLS | Task 1 |
| InterviewScores / InterviewTurn / InterviewSession 类型 | Task 1 |
| 题目生成 prompt | Task 2 |
| 评估 prompt | Task 2 |
| POST /api/interview/start | Task 3 |
| POST /api/interview/answer（流式） | Task 4 |
| POST /api/interview/finish | Task 5 |
| InterviewProgress 组件 | Task 6 |
| ScoreCard 组件（骨架屏 + 三维评分 + 点评 + 参考框架） | Task 6 |
| /interview 页面，全状态机 | Task 7 |
| 首页入口（已登录/未登录两分支） | Task 8 |
| 详情页入口 + case_id 预填 JD | Task 7 + Task 8 |
| 必须登录才能使用 | Task 3-5（API 401）+ Task 7（前端提示） |
| 最弱维度提示 | Task 5 + Task 7 |
| 5 题 + 结束训练随时可用 | Task 7 |
