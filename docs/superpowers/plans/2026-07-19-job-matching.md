# 岗位匹配功能实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 OfferHelper Web 添加岗位匹配模式，用户填入简历 + 最多 5 个 JD，AI 流式逐个评估匹配度并输出评分、推荐等级、理由、优势差距和总结。

**Architecture:** 一个流式 ndjson API 端点串行评估每个 JD（每完成一个立刻 flush），前端状态机（idle→analyzing→done）逐条追加渲染 MatchCard。登录用户结果写入 `match_sessions` 表，未登录可用但不保存。

**Tech Stack:** Next.js 16 App Router, Supabase (PostgreSQL + RLS + Auth), @supabase/ssr, Anthropic SDK (claude-sonnet-4-6), Tailwind CSS

## Global Constraints

- Next.js 16：`useSearchParams()` 必须在 `<Suspense>` 内使用；但本功能页面无 URL 参数，`<Suspense>` 仍需包裹以防构建报错，与现有 `/interview`、`/strengths` 页面保持一致
- Supabase 客户端：浏览器端 `@/lib/supabase/client`，服务端 Route Handler `@/lib/supabase/server`（async），service role `createClient` from `@supabase/supabase-js` + `SUPABASE_SERVICE_ROLE_KEY`
- 所有 Claude 调用：`model: 'claude-sonnet-4-6'`，`apiKey: process.env.ANTHROPIC_API_KEY`，`baseURL: process.env.ANTHROPIC_BASE_URL`
- 流式 API：`Content-Type: text/event-stream`，`Cache-Control: no-cache`，`X-Accel-Buffering: no`，ndjson 格式
- Route Handlers 顶部必须有 `export const runtime = 'nodejs'`
- 所有新组件和页面使用 Tailwind zinc 色阶 + `dark:` 变体
- `MatchResult.level` 字符串值：`'强烈推荐'` / `'可以投'` / `'不建议'`（与 prompt 和类型定义保持完全一致）
- DB 写入使用 service role client，且 update 操作必须加 `.eq('user_id', user.id)` 防越权

---

## 文件清单

| 操作 | 路径 | 职责 |
|------|------|------|
| 新增 | `supabase/migrations/005_match_sessions.sql` | 建表 + RLS |
| 修改 | `types/index.ts` | 新增 JdItem / MatchResult / MatchSession |
| 修改 | `lib/prompts.ts` | 新增 MATCH_EVAL_SYSTEM / MATCH_SUMMARY_SYSTEM / 两个 builder |
| 新增 | `app/api/match/analyze/route.ts` | 流式逐个评估 JD，生成总结，写库 |
| 新增 | `components/JdListInput.tsx` | 多条 JD 增删输入 |
| 新增 | `components/MatchCard.tsx` | 单个 JD 匹配结果卡片 |
| 新增 | `app/match/page.tsx` | 岗位匹配主页面（Client Component + Suspense） |
| 修改 | `app/page.tsx` | 新增「岗位匹配」header 入口 |

---

### Task 1: 数据库迁移 + 类型定义

**Files:**
- Create: `supabase/migrations/005_match_sessions.sql`
- Modify: `types/index.ts`

**Interfaces:**
- Produces:
  - `JdItem`: `{ title?: string; content: string }`
  - `MatchResult`: `{ jd_index: number; score: number; level: '强烈推荐' | '可以投' | '不建议'; reason: string; strengths: string[]; gaps: string[] }`
  - `MatchSession`: `{ id, user_id: string|null, resume_text, jd_list: JdItem[], results: MatchResult[], summary: string, status: 'active'|'done', created_at }`

- [ ] **Step 1: 创建迁移文件**

```sql
-- supabase/migrations/005_match_sessions.sql

create table match_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade,
  resume_text  text not null,
  jd_list      jsonb not null default '[]',
  results      jsonb not null default '[]',
  summary      text not null default '',
  status       text not null default 'active'
                    check (status in ('active', 'done')),
  created_at   timestamptz not null default now()
);

alter table match_sessions enable row level security;

create policy "users see own match sessions"
  on match_sessions for select
  using (auth.uid() = user_id);

create policy "users insert own match sessions"
  on match_sessions for insert
  with check (auth.uid() = user_id);

create policy "users update own match sessions"
  on match_sessions for update
  using (auth.uid() = user_id);
```

- [ ] **Step 2: 在 Supabase 控制台执行迁移**

打开 Supabase Dashboard → SQL Editor，粘贴 `005_match_sessions.sql` 全部内容并执行。
期望：无错误，`match_sessions` 表出现在 Table Editor 中。

- [ ] **Step 3: 追加类型到 `types/index.ts`**

在文件末尾追加：

```typescript
export interface JdItem {
  title?: string
  content: string
}

export interface MatchResult {
  jd_index: number
  score: number
  level: '强烈推荐' | '可以投' | '不建议'
  reason: string
  strengths: string[]
  gaps: string[]
}

export interface MatchSession {
  id: string
  user_id: string | null
  resume_text: string
  jd_list: JdItem[]
  results: MatchResult[]
  summary: string
  status: 'active' | 'done'
  created_at: string
}
```

- [ ] **Step 4: 验证 TS 无错误**

```bash
cd /Users/i758469/offerhelper-web
npx tsc --noEmit 2>&1 | head -20
```

期望：无输出。

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/005_match_sessions.sql types/index.ts
git commit -m "feat: add match_sessions migration and TypeScript types"
```

---

### Task 2: Prompt 函数

**Files:**
- Modify: `lib/prompts.ts`

**Interfaces:**
- Consumes: `import type { MatchResult, JdItem } from '@/types'`（需在文件顶部追加此 import）
- Produces:
  - `MATCH_EVAL_SYSTEM`: `string`
  - `buildMatchEvalPrompt(resumeText: string, jdContent: string, jdTitle: string | null): string`
  - `MATCH_SUMMARY_SYSTEM`: `string`
  - `buildMatchSummaryPrompt(results: MatchResult[], jdList: JdItem[]): string`

- [ ] **Step 1: 在 `lib/prompts.ts` 顶部追加 import，末尾追加以下内容**

在文件**顶部**第一行追加（文件目前没有 import）：
```typescript
import type { MatchResult, JdItem } from '@/types'
```

在文件**末尾**追加：

```typescript
export const MATCH_EVAL_SYSTEM = `你是职业顾问，评估应聘者简历与目标 JD 的匹配程度。

规则：
1. score：0-100 的整数，代表匹配程度
2. level：根据 score 判断 —— score>=75 为「强烈推荐」，50-74 为「可以投」，<50 为「不建议」
3. reason：100-150 字，说明匹配或不匹配的核心原因
4. strengths：2-4 条简历中与 JD 最相关的优势，每条一句话
5. gaps：1-3 条简历与 JD 要求的主要差距，每条一句话；若无明显差距可为空数组
6. 严格输出 JSON，格式：{"score":N,"level":"...","reason":"...","strengths":["..."],"gaps":["..."]}
7. 不加 markdown 代码块，不输出其他内容`

export function buildMatchEvalPrompt(resumeText: string, jdContent: string, jdTitle: string | null): string {
  const titleLine = jdTitle ? `岗位名称：${jdTitle}\n\n` : ''
  return `${titleLine}目标 JD：\n${jdContent}\n\n简历内容：\n${resumeText}`
}

export const MATCH_SUMMARY_SYSTEM = `你是职业顾问，根据多个岗位的匹配评估结果给出投递策略建议。

规则：
1. 100-150 字，说明应优先投哪些岗位及理由
2. 如有明显最佳选择，明确指出；如都适合/都不适合，给出相应建议
3. 直接输出文字，不加任何格式标记`

export function buildMatchSummaryPrompt(results: MatchResult[], jdList: JdItem[]): string {
  const lines = results.map((r, i) => {
    const title = jdList[i]?.title ? `「${jdList[i].title}」` : `岗位${i + 1}`
    return `${title}：${r.score}分（${r.level}）- ${r.reason}`
  })
  return `以下是各岗位匹配评估结果，请给出投递策略建议：\n\n${lines.join('\n')}`
}
```

- [ ] **Step 2: 验证 TS 无错误**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add lib/prompts.ts
git commit -m "feat: add job matching eval and summary prompts"
```

---

### Task 3: `/api/match/analyze` 流式路由

**Files:**
- Create: `app/api/match/analyze/route.ts`

**Interfaces:**
- Consumes:
  - `createClient` from `@/lib/supabase/server`
  - `createClient as createServiceClient` from `@supabase/supabase-js`
  - `MATCH_EVAL_SYSTEM`, `buildMatchEvalPrompt`, `MATCH_SUMMARY_SYSTEM`, `buildMatchSummaryPrompt` from `@/lib/prompts`
  - `Anthropic` from `@anthropic-ai/sdk`
  - `MatchResult`, `JdItem` from `@/types`
- Produces: `POST /api/match/analyze` → ndjson 流

- [ ] **Step 1: 创建文件**

```typescript
// app/api/match/analyze/route.ts
import Anthropic from '@anthropic-ai/sdk'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import {
  MATCH_EVAL_SYSTEM,
  buildMatchEvalPrompt,
  MATCH_SUMMARY_SYSTEM,
  buildMatchSummaryPrompt,
} from '@/lib/prompts'
import type { MatchResult, JdItem } from '@/types'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  let body: { resume_text?: string; jd_list?: JdItem[]; session_id?: string | null } = {}
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400 })
  }

  const { resume_text, jd_list = [], session_id = null } = body

  if (!resume_text?.trim()) {
    return new Response(JSON.stringify({ error: '简历内容不能为空' }), { status: 400 })
  }
  if (jd_list.length === 0 || jd_list.length > 5) {
    return new Response(JSON.stringify({ error: 'JD 数量需在 1-5 条之间' }), { status: 400 })
  }

  const sessionSupabase = await createClient()
  const { data: { user } } = await sessionSupabase.auth.getUser()

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL,
  })

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      let currentSessionId = session_id
      const results: MatchResult[] = []

      try {
        // Create session for logged-in users
        if (user && !currentSessionId) {
          const supabase = createServiceClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          )
          const { data: newSession } = await supabase
            .from('match_sessions')
            .insert({ user_id: user.id, resume_text, jd_list })
            .select('id')
            .single()
          if (newSession) currentSessionId = newSession.id
        }

        // Evaluate each JD serially
        for (let i = 0; i < jd_list.length; i++) {
          const jd = jd_list[i]
          try {
            const message = await client.messages.create({
              model: 'claude-sonnet-4-6',
              max_tokens: 1024,
              system: MATCH_EVAL_SYSTEM,
              messages: [{
                role: 'user',
                content: buildMatchEvalPrompt(resume_text, jd.content, jd.title ?? null),
              }],
            })

            const raw = message.content[0]?.type === 'text' ? message.content[0].text : ''
            const parsed = JSON.parse(raw) as Omit<MatchResult, 'jd_index'>
            const result: MatchResult = { jd_index: i, ...parsed }
            results.push(result)
            controller.enqueue(encoder.encode(
              JSON.stringify({ type: 'result', ...result }) + '\n'
            ))
          } catch {
            controller.enqueue(encoder.encode(
              JSON.stringify({ type: 'error', jd_index: i, message: '该岗位评估失败，请重试' }) + '\n'
            ))
          }
        }

        // Generate summary
        let summary = ''
        if (results.length > 0) {
          try {
            const summaryMessage = await client.messages.create({
              model: 'claude-sonnet-4-6',
              max_tokens: 512,
              system: MATCH_SUMMARY_SYSTEM,
              messages: [{
                role: 'user',
                content: buildMatchSummaryPrompt(results, jd_list),
              }],
            })
            summary = summaryMessage.content[0]?.type === 'text' ? summaryMessage.content[0].text : ''
            controller.enqueue(encoder.encode(
              JSON.stringify({ type: 'summary', text: summary }) + '\n'
            ))
          } catch {
            controller.enqueue(encoder.encode(
              JSON.stringify({ type: 'summary', text: '' }) + '\n'
            ))
          }
        }

        // Persist results for logged-in users
        if (user && currentSessionId) {
          const supabase = createServiceClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          )
          const { error: updateError } = await supabase
            .from('match_sessions')
            .update({ results, summary, status: 'done' })
            .eq('id', currentSessionId)
            .eq('user_id', user.id)
          if (updateError) {
            console.error('Failed to persist match session:', updateError.message)
          }
        }

        controller.enqueue(encoder.encode(
          JSON.stringify({ type: 'done', session_id: currentSessionId }) + '\n'
        ))
      } catch {
        controller.enqueue(encoder.encode(
          JSON.stringify({ type: 'error', jd_index: -1, message: '分析失败，请重试' }) + '\n'
        ))
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
git add app/api/match/analyze/route.ts
git commit -m "feat: add /api/match/analyze streaming route"
```

---

### Task 4: `JdListInput` 和 `MatchCard` 组件

**Files:**
- Create: `components/JdListInput.tsx`
- Create: `components/MatchCard.tsx`

**Interfaces:**
- Consumes: `JdItem`, `MatchResult` from `@/types`
- Produces:
  - `JdListInput`: props `{ value: JdItem[]; onChange: (v: JdItem[]) => void }`
  - `MatchCard`: props `{ result: MatchResult; title?: string; loading?: boolean }`

- [ ] **Step 1: 创建 `components/JdListInput.tsx`**

```typescript
// components/JdListInput.tsx
'use client'
import type { JdItem } from '@/types'

interface Props {
  value: JdItem[]
  onChange: (v: JdItem[]) => void
}

const MAX_JDS = 5

export default function JdListInput({ value, onChange }: Props) {
  function update(index: number, field: keyof JdItem, text: string) {
    const next = value.map((item, i) =>
      i === index ? { ...item, [field]: text } : item
    )
    onChange(next)
  }

  function add() {
    if (value.length >= MAX_JDS) return
    onChange([...value, { title: '', content: '' }])
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3">
      {value.map((item, i) => (
        <div key={i} className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <input
              type="text"
              placeholder="岗位名称，选填"
              value={item.title ?? ''}
              onChange={e => update(i, 'title', e.target.value)}
              className="flex-1 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded px-3 py-1.5 text-sm placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600"
            />
            {value.length > 1 && (
              <button
                onClick={() => remove(i)}
                className="text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 text-sm transition-colors shrink-0"
              >
                删除
              </button>
            )}
          </div>
          <textarea
            placeholder="粘贴 JD 内容..."
            value={item.content}
            onChange={e => update(i, 'content', e.target.value)}
            className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded px-3 py-2 text-sm h-32 resize-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600"
          />
        </div>
      ))}
      {value.length < MAX_JDS && (
        <button
          onClick={add}
          className="w-full border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 py-2.5 rounded-lg text-sm hover:border-zinc-400 dark:hover:border-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
        >
          ＋ 添加岗位
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 创建 `components/MatchCard.tsx`**

```typescript
// components/MatchCard.tsx
import type { MatchResult } from '@/types'

interface Props {
  result: MatchResult
  title?: string
  loading?: boolean
}

const LEVEL_STYLES: Record<MatchResult['level'], string> = {
  '强烈推荐': 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400',
  '可以投': 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400',
  '不建议': 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400',
}

export default function MatchCard({ result, title, loading }: Props) {
  if (loading) {
    return (
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 space-y-3 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="h-8 w-16 bg-zinc-100 dark:bg-zinc-800 rounded" />
          <div className="h-6 w-20 bg-zinc-100 dark:bg-zinc-800 rounded-full" />
        </div>
        <div className="h-16 bg-zinc-100 dark:bg-zinc-800 rounded" />
        <div className="space-y-1.5">
          <div className="h-4 w-3/4 bg-zinc-100 dark:bg-zinc-800 rounded" />
          <div className="h-4 w-2/3 bg-zinc-100 dark:bg-zinc-800 rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        {title && (
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{title}</span>
        )}
        <span className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">{result.score}</span>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${LEVEL_STYLES[result.level]}`}>
          {result.level}
        </span>
      </div>

      <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{result.reason}</p>

      {result.strengths.length > 0 && (
        <div>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-1.5">匹配优势</p>
          <ul className="space-y-1">
            {result.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <span className="text-green-500 dark:text-green-400 mt-0.5 shrink-0">✓</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.gaps.length > 0 && (
        <div>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-1.5">主要差距</p>
          <ul className="space-y-1">
            {result.gaps.map((g, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <span className="text-red-500 dark:text-red-400 mt-0.5 shrink-0">✕</span>
                <span>{g}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
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
git add components/JdListInput.tsx components/MatchCard.tsx
git commit -m "feat: add JdListInput and MatchCard components"
```

---

### Task 5: `/match` 页面

**Files:**
- Create: `app/match/page.tsx`

**Interfaces:**
- Consumes:
  - `JdListInput` from `@/components/JdListInput`
  - `MatchCard` from `@/components/MatchCard`
  - `ResumeUploader` from `@/components/ResumeUploader`
  - `AuthModal` from `@/components/AuthModal`
  - `createClient` from `@/lib/supabase/client`
  - `JdItem`, `MatchResult` from `@/types`
- Produces: `/match` 页面，实现 `idle → analyzing → done` 状态机

- [ ] **Step 1: 创建 `app/match/page.tsx`**

```typescript
// app/match/page.tsx
'use client'
import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import ResumeUploader from '@/components/ResumeUploader'
import JdListInput from '@/components/JdListInput'
import MatchCard from '@/components/MatchCard'
import AuthModal from '@/components/AuthModal'
import type { JdItem, MatchResult } from '@/types'

type Stage = 'idle' | 'analyzing' | 'done'

function MatchPageInner() {
  const [user, setUser] = useState<User | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [resumeText, setResumeText] = useState('')
  const [jdList, setJdList] = useState<JdItem[]>([{ title: '', content: '' }, { title: '', content: '' }])
  const [stage, setStage] = useState<Stage>('idle')
  const [results, setResults] = useState<MatchResult[]>([])
  const [summary, setSummary] = useState('')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [currentJdIndex, setCurrentJdIndex] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  const validJds = jdList.filter(j => j.content.trim())
  const canStart = resumeText.trim() && validJds.length > 0

  async function handleStart() {
    setStage('analyzing')
    setResults([])
    setSummary('')
    setCurrentJdIndex(0)
    setError('')

    try {
      const res = await fetch('/api/match/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resume_text: resumeText,
          jd_list: validJds,
          session_id: sessionId,
        }),
      })

      if (!res.body) {
        setError('请求失败，请重试')
        setStage('idle')
        return
      }

      const reader = res.body.getReader()
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
            if (obj.type === 'result') {
              const { type: _, ...result } = obj
              setResults(prev => [...prev, result as MatchResult])
              setCurrentJdIndex(result.jd_index + 1)
            } else if (obj.type === 'summary') {
              setSummary(obj.text)
            } else if (obj.type === 'done') {
              if (obj.session_id) setSessionId(obj.session_id)
              setStage('done')
            } else if (obj.type === 'error' && obj.jd_index === -1) {
              setError(obj.message)
            }
          } catch {}
        }
      }
    } catch {
      setError('请求失败，请重试')
      setStage('idle')
    }
  }

  function handleReset() {
    setStage('idle')
    setResults([])
    setSummary('')
    setCurrentJdIndex(0)
    setError('')
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <header className="flex items-center justify-between mb-8">
        <Link href="/" className="text-xl font-semibold">OfferHelper</Link>
        <Link href="/dashboard" className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
          历史记录
        </Link>
      </header>

      <h2 className="text-2xl font-bold mb-6">岗位匹配</h2>

      {error && (
        <p className="text-red-500 dark:text-red-400 text-sm mb-4 bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded">{error}</p>
      )}

      {/* idle */}
      {stage === 'idle' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-medium mb-2">简历</h3>
            <ResumeUploader onTextReady={setResumeText} />
          </div>
          <div>
            <h3 className="text-sm font-medium mb-2">目标岗位 JD（最多 5 个）</h3>
            <JdListInput value={jdList} onChange={setJdList} />
          </div>
          {!user && (
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              <button onClick={() => setModalOpen(true)} className="underline hover:text-zinc-700 dark:hover:text-zinc-300">登录</button>
              {' '}后可保存记录
            </p>
          )}
          <button
            onClick={handleStart}
            disabled={!canStart}
            className="w-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 py-3 rounded-lg font-medium disabled:opacity-40 hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
          >
            开始匹配
          </button>
        </div>
      )}

      {/* analyzing */}
      {stage === 'analyzing' && (
        <div className="space-y-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400 animate-pulse">
            正在评估 第 {Math.min(currentJdIndex + 1, validJds.length)} 个 / 共 {validJds.length} 个岗位...
          </p>
          {results.map((r) => (
            <MatchCard
              key={r.jd_index}
              result={r}
              title={validJds[r.jd_index]?.title || undefined}
            />
          ))}
          {currentJdIndex < validJds.length && (
            <MatchCard
              result={{ jd_index: currentJdIndex, score: 0, level: '可以投', reason: '', strengths: [], gaps: [] }}
              loading
            />
          )}
        </div>
      )}

      {/* done */}
      {stage === 'done' && (
        <div className="space-y-4">
          {results.map((r) => (
            <MatchCard
              key={r.jd_index}
              result={r}
              title={validJds[r.jd_index]?.title || undefined}
            />
          ))}
          {summary && (
            <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4">
              <p className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-2">投递建议</p>
              <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">{summary}</p>
            </div>
          )}
          <button
            onClick={handleReset}
            className="w-full border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 py-2.5 rounded-lg text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            重新匹配
          </button>
        </div>
      )}

      <AuthModal
        isOpen={modalOpen}
        defaultTab="login"
        onClose={() => setModalOpen(false)}
        onAuthSuccess={() => {
          setModalOpen(false)
          const supabase = createClient()
          supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
        }}
      />
    </main>
  )
}

export default function MatchPage() {
  return (
    <Suspense>
      <MatchPageInner />
    </Suspense>
  )
}
```

- [ ] **Step 2: 验证 TS 无错误**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: 验证 build 通过**

```bash
npm run build 2>&1 | tail -20
```

期望：build 成功，`/match` 显示为 `○ static`。

- [ ] **Step 4: Commit**

```bash
git add app/match/page.tsx
git commit -m "feat: add /match page with job matching state machine"
```

---

### Task 6: 首页入口

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: 现有 `user` state / `router` / `openModal`

- [ ] **Step 1: 修改 `app/page.tsx` — 已登录 header 新增「岗位匹配」**

将已登录 header 从：
```tsx
<div className="flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
  <button onClick={() => router.push('/dashboard')} className="hover:text-zinc-900 dark:hover:text-zinc-100">历史记录</button>
  <span>|</span>
  <button onClick={() => router.push('/interview')} className="hover:text-zinc-900 dark:hover:text-zinc-100">面试训练</button>
  <span>|</span>
  <button onClick={() => router.push('/strengths')} className="hover:text-zinc-900 dark:hover:text-zinc-100">优势挖掘</button>
  <span>|</span>
  <button onClick={handleSignOut} className="hover:text-zinc-900 dark:hover:text-zinc-100">退出</button>
</div>
```

改为：
```tsx
<div className="flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
  <button onClick={() => router.push('/dashboard')} className="hover:text-zinc-900 dark:hover:text-zinc-100">历史记录</button>
  <span>|</span>
  <button onClick={() => router.push('/interview')} className="hover:text-zinc-900 dark:hover:text-zinc-100">面试训练</button>
  <span>|</span>
  <button onClick={() => router.push('/strengths')} className="hover:text-zinc-900 dark:hover:text-zinc-100">优势挖掘</button>
  <span>|</span>
  <button onClick={() => router.push('/match')} className="hover:text-zinc-900 dark:hover:text-zinc-100">岗位匹配</button>
  <span>|</span>
  <button onClick={handleSignOut} className="hover:text-zinc-900 dark:hover:text-zinc-100">退出</button>
</div>
```

- [ ] **Step 2: 修改 `app/page.tsx` — 未登录 header 新增「岗位匹配」**

将未登录 header 从：
```tsx
<div className="flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
  <button onClick={() => openModal('login')} className="hover:text-zinc-900 dark:hover:text-zinc-100">登录</button>
  <span>|</span>
  <button onClick={() => openModal('login')} className="hover:text-zinc-900 dark:hover:text-zinc-100">面试训练</button>
  <span>|</span>
  <button onClick={() => router.push('/strengths')} className="hover:text-zinc-900 dark:hover:text-zinc-100">优势挖掘</button>
</div>
```

改为：
```tsx
<div className="flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
  <button onClick={() => openModal('login')} className="hover:text-zinc-900 dark:hover:text-zinc-100">登录</button>
  <span>|</span>
  <button onClick={() => openModal('login')} className="hover:text-zinc-900 dark:hover:text-zinc-100">面试训练</button>
  <span>|</span>
  <button onClick={() => router.push('/strengths')} className="hover:text-zinc-900 dark:hover:text-zinc-100">优势挖掘</button>
  <span>|</span>
  <button onClick={() => router.push('/match')} className="hover:text-zinc-900 dark:hover:text-zinc-100">岗位匹配</button>
</div>
```

注：岗位匹配未登录可用，直接跳转 `/match`，不弹登录框。

- [ ] **Step 3: 验证 TS 无错误 + build 通过**

```bash
npx tsc --noEmit 2>&1 | head -20
npm run build 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add job matching entry point in homepage header"
```

---

## 自审清单

### Spec 覆盖检查

| Spec 需求 | 对应 Task |
|-----------|-----------|
| `match_sessions` 表 + RLS | Task 1 |
| JdItem / MatchResult / MatchSession 类型 | Task 1 |
| MATCH_EVAL_SYSTEM + buildMatchEvalPrompt | Task 2 |
| MATCH_SUMMARY_SYSTEM + buildMatchSummaryPrompt | Task 2 |
| `lib/prompts.ts` import MatchResult / JdItem | Task 2 |
| POST /api/match/analyze（流式，串行评估） | Task 3 |
| 单个 JD 失败不中断其他 | Task 3 |
| 总结段落生成 + flush | Task 3 |
| DB 写入 user_id 守卫 | Task 3 |
| JdListInput 组件（最多 5 条，增删） | Task 4 |
| MatchCard 组件（三档颜色，骨架屏） | Task 4 |
| /match 页面，完整状态机，Suspense 包裹 | Task 5 |
| analyzing 阶段逐条追加渲染 | Task 5 |
| 未登录可用 + 登录提示 | Task 5 |
| 首页已登录/未登录入口 | Task 6 |
