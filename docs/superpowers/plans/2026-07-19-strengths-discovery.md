# 优势挖掘功能实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 OfferHelper Web 添加优势挖掘模式，AI 通过最多 3 轮动态追问引导用户讲述经历，最终输出结构化优势列表（标签 + 证据句）+ 综合点评。

**Architecture:** 两阶段 API（`/api/strengths/message` 流式追问、`/api/strengths/result` 非流式生成结果），前端状态机驱动（idle→chatting→generating_result→done），对话历史由前端维护并在每次请求时完整传入。登录用户的 session 写入 `strength_sessions` 表，未登录可用但不保存。

**Tech Stack:** Next.js 16 App Router, Supabase (PostgreSQL + RLS + Auth), @supabase/ssr, Anthropic SDK (claude-sonnet-4-6), Tailwind CSS

## Global Constraints

- Next.js 版本为 16，所有使用 `useSearchParams()` 的页面必须用 `<Suspense>` 包裹（参见 `node_modules/next/dist/docs/` 中的升级指南）
- Supabase 客户端：浏览器端用 `@/lib/supabase/client`（`createBrowserClient`），服务端 Route Handler 用 `@/lib/supabase/server`（async `createClient()`），service role 用 `createClient` from `@supabase/supabase-js` + `SUPABASE_SERVICE_ROLE_KEY`
- 所有 Claude 调用使用 `model: 'claude-sonnet-4-6'`，`apiKey: process.env.ANTHROPIC_API_KEY`，`baseURL: process.env.ANTHROPIC_BASE_URL`
- 流式 API 返回 ndjson（每行一个 JSON），`Content-Type: text/event-stream`，与现有 `/api/analyze` 格式一致
- 所有新组件和页面使用 Tailwind CSS dark mode（`dark:` variants，zinc 色阶）
- 所有新文件使用 TypeScript，`'use client'` 只在 Client Component 顶部添加
- Route Handlers 顶部必须有 `export const runtime = 'nodejs'`
- `turn_index`：AI 即将发出第几问，0-based，范围 0-2；`is_final: turn_index === 2`

---

## 文件清单

| 操作 | 路径 | 职责 |
|------|------|------|
| 新增 | `supabase/migrations/004_strength_sessions.sql` | 建表 + RLS |
| 修改 | `types/index.ts` | 新增 StrengthItem / StrengthsResult / ChatMessage / StrengthSession |
| 修改 | `lib/prompts.ts` | 新增 STRENGTHS_CHAT_SYSTEM / STRENGTHS_RESULT_SYSTEM / 两个 builder |
| 新增 | `app/api/strengths/message/route.ts` | 流式追问，维护 session |
| 新增 | `app/api/strengths/result/route.ts` | 非流式生成优势列表，写库 |
| 新增 | `components/ChatBubble.tsx` | 单条对话气泡 |
| 新增 | `components/StrengthsResult.tsx` | 优势列表 + 综合点评 |
| 新增 | `app/strengths/page.tsx` | 优势挖掘主页面（Client Component + Suspense） |
| 修改 | `app/page.tsx` | 新增「优势挖掘」入口 |
| 修改 | `app/dashboard/[id]/page.tsx` | 新增「优势挖掘」Link |

---

### Task 1: 数据库迁移 + 类型定义

**Files:**
- Create: `supabase/migrations/004_strength_sessions.sql`
- Modify: `types/index.ts`

**Interfaces:**
- Produces:
  - `StrengthItem`: `{ label: string; evidence: string }`
  - `StrengthsResult`: `{ strengths: StrengthItem[]; summary: string }`
  - `ChatMessage`: `{ role: 'user' | 'assistant'; content: string }`
  - `StrengthSession`: `{ id, user_id: string|null, jd_text: string|null, messages: ChatMessage[], result: StrengthsResult|null, status: 'active'|'done', created_at: string }`

- [ ] **Step 1: 创建迁移文件**

```sql
-- supabase/migrations/004_strength_sessions.sql

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

- [ ] **Step 2: 在 Supabase 控制台执行迁移 SQL**

打开 Supabase Dashboard → SQL Editor，粘贴 `004_strength_sessions.sql` 全部内容并执行。
期望：无错误，`strength_sessions` 表出现在 Table Editor 中。

- [ ] **Step 3: 追加类型到 `types/index.ts`**

在文件末尾追加：

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

- [ ] **Step 4: 验证 TS 无错误**

```bash
cd /Users/i758469/offerhelper-web
npx tsc --noEmit 2>&1 | head -20
```

期望：无输出（或只有与本任务无关的已有错误）。

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/004_strength_sessions.sql types/index.ts
git commit -m "feat: add strength_sessions migration and TypeScript types"
```

---

### Task 2: Prompt 函数

**Files:**
- Modify: `lib/prompts.ts`

**Interfaces:**
- Consumes: 无外部依赖
- Produces:
  - `STRENGTHS_CHAT_SYSTEM`: `string`
  - `buildStrengthsChatPrompt(messages: ChatMessage[], jdText: string | null, turnIndex: number): string`
  - `STRENGTHS_RESULT_SYSTEM`: `string`
  - `buildStrengthsResultPrompt(messages: ChatMessage[], jdText: string | null): string`

- [ ] **Step 1: 在 `lib/prompts.ts` 末尾追加以下内容**

```typescript
export const STRENGTHS_CHAT_SYSTEM = `你是职业顾问，帮助用户挖掘真实的职业优势。通过动态追问引导用户讲述具体经历。

规则：
1. 每次只问一个问题，问题开放且具体（避免「你有什么优点」这类泛问题）
2. turn_index === 0（第一问）：用开场白问法，引导用户讲述一件有成就感或有挑战的工作/学习经历，不要追问，直接开场
3. turn_index > 0（追问）：根据用户上一条回答，聚焦最有价值的方向追问（如细节、数据、挑战、结果）
4. 问题简短，不超过 50 字
5. 不评价、不总结，只追问
6. 如果提供了 JD，追问方向优先贴合岗位要求`

export function buildStrengthsChatPrompt(
  messages: { role: string; content: string }[],
  jdText: string | null,
  turnIndex: number
): string {
  const parts: string[] = [`当前是第 ${turnIndex + 1} 问（turn_index=${turnIndex}）。`]
  if (jdText) parts.push(`目标 JD：\n${jdText}`)
  if (messages.length === 0) {
    parts.push('这是对话开始，请直接提第一个开场问题。')
  } else {
    parts.push('对话历史已在 messages 中，请根据用户最新回答提下一个问题。')
  }
  return parts.join('\n\n')
}

export const STRENGTHS_RESULT_SYSTEM = `你是职业顾问，根据用户讲述的经历提炼结构化优势列表。

规则：
1. 每条优势必须有真实经历支撑，不编造
2. label：2-6 字的能力标签（如「数据驱动决策」「跨部门协作」）
3. evidence：一句话，直接引用用户描述中的具体事实、数据或结果
4. 提炼 3-6 条优势
5. summary：100-150 字综合点评，说明这些优势组合起来的竞争力
6. 如果提供了 JD，label 和 evidence 优先体现与岗位的匹配
7. 输出严格 JSON，格式：{"strengths":[{"label":"...","evidence":"..."}],"summary":"..."}
8. 不加 markdown 代码块`

export function buildStrengthsResultPrompt(
  messages: { role: string; content: string }[],
  jdText: string | null
): string {
  const parts: string[] = ['以下是完整对话记录，请根据用户讲述的经历提炼优势列表。']
  if (jdText) parts.push(`目标 JD：\n${jdText}`)
  parts.push(`对话记录：\n${messages.map(m => `${m.role === 'user' ? '用户' : 'AI'}：${m.content}`).join('\n')}`)
  return parts.join('\n\n')
}
```

- [ ] **Step 2: 验证 TS 无错误**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add lib/prompts.ts
git commit -m "feat: add strengths discovery chat and result prompts"
```

---

### Task 3: `/api/strengths/message` 流式路由

**Files:**
- Create: `app/api/strengths/message/route.ts`

**Interfaces:**
- Consumes:
  - `createClient` from `@/lib/supabase/server`
  - `createClient as createServiceClient` from `@supabase/supabase-js`
  - `STRENGTHS_CHAT_SYSTEM`, `buildStrengthsChatPrompt` from `@/lib/prompts`
  - `Anthropic` from `@anthropic-ai/sdk`
- Produces:
  - `POST /api/strengths/message` → ndjson 流，文字 chunks `{ text: string }`，最终行 `{ session_id: string|null, turn_index: number, is_final: boolean }`

- [ ] **Step 1: 创建文件**

```typescript
// app/api/strengths/message/route.ts
import Anthropic from '@anthropic-ai/sdk'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { STRENGTHS_CHAT_SYSTEM, buildStrengthsChatPrompt } from '@/lib/prompts'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  let body: {
    session_id?: string | null
    messages?: { role: string; content: string }[]
    jd_text?: string | null
    turn_index?: number
  } = {}
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400 })
  }

  const { session_id, messages = [], jd_text = null, turn_index = 0 } = body

  const sessionSupabase = await createClient()
  const { data: { user } } = await sessionSupabase.auth.getUser()

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL,
  })

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      let aiText = ''
      let currentSessionId = session_id ?? null

      try {
        const response = await client.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 512,
          system: STRENGTHS_CHAT_SYSTEM,
          messages: [
            ...messages.map(m => ({
              role: m.role as 'user' | 'assistant',
              content: m.content,
            })),
            {
              role: 'user',
              content: buildStrengthsChatPrompt(messages, jd_text, turn_index),
            },
          ],
          stream: true,
        })

        for await (const event of response) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            aiText += event.delta.text
            controller.enqueue(encoder.encode(JSON.stringify({ text: event.delta.text }) + '\n'))
          }
        }

        // Persist to DB if logged in
        if (user) {
          const updatedMessages = [
            ...messages,
            { role: 'assistant', content: aiText },
          ]
          if (!currentSessionId) {
            const { data: newSession } = await supabase
              .from('strength_sessions')
              .insert({ user_id: user.id, jd_text, messages: updatedMessages })
              .select('id')
              .single()
            if (newSession) currentSessionId = newSession.id
          } else {
            await supabase
              .from('strength_sessions')
              .update({ messages: updatedMessages })
              .eq('id', currentSessionId)
          }
        }

        const isFinal = turn_index === 2
        controller.enqueue(encoder.encode(
          JSON.stringify({ session_id: currentSessionId, turn_index, is_final: isFinal }) + '\n'
        ))
      } catch {
        controller.enqueue(encoder.encode(JSON.stringify({ error: '生成问题失败，请重试' }) + '\n'))
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
git add app/api/strengths/message/route.ts
git commit -m "feat: add /api/strengths/message streaming route"
```

---

### Task 4: `/api/strengths/result` 非流式路由

**Files:**
- Create: `app/api/strengths/result/route.ts`

**Interfaces:**
- Consumes:
  - `createClient` from `@/lib/supabase/server`
  - `createClient as createServiceClient` from `@supabase/supabase-js`
  - `STRENGTHS_RESULT_SYSTEM`, `buildStrengthsResultPrompt` from `@/lib/prompts`
  - `Anthropic` from `@anthropic-ai/sdk`
  - `StrengthsResult` from `@/types`
- Produces: `POST /api/strengths/result` → `{ strengths: StrengthItem[], summary: string }`

- [ ] **Step 1: 创建文件**

```typescript
// app/api/strengths/result/route.ts
import Anthropic from '@anthropic-ai/sdk'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { STRENGTHS_RESULT_SYSTEM, buildStrengthsResultPrompt } from '@/lib/prompts'
import type { StrengthsResult } from '@/types'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  let body: {
    session_id?: string | null
    messages?: { role: string; content: string }[]
    jd_text?: string | null
  } = {}
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400 })
  }

  const { session_id, messages = [], jd_text = null } = body

  const sessionSupabase = await createClient()
  const { data: { user } } = await sessionSupabase.auth.getUser()

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL,
  })

  let result: StrengthsResult
  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: STRENGTHS_RESULT_SYSTEM,
      messages: [{ role: 'user', content: buildStrengthsResultPrompt(messages, jd_text) }],
    })

    const raw = message.content[0]?.type === 'text' ? message.content[0].text : ''
    result = JSON.parse(raw)
    if (!Array.isArray(result.strengths) || !result.summary) throw new Error('invalid')
  } catch {
    return new Response(JSON.stringify({ error: '优势提炼失败，请重试' }), { status: 500 })
  }

  // Persist if logged in and session exists
  if (user && session_id) {
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    await supabase
      .from('strength_sessions')
      .update({ result, messages, status: 'done' })
      .eq('id', session_id)
  }

  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' },
  })
}
```

- [ ] **Step 2: 验证 TS 无错误**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add app/api/strengths/result/route.ts
git commit -m "feat: add /api/strengths/result route"
```

---

### Task 5: `ChatBubble` 和 `StrengthsResult` 组件

**Files:**
- Create: `components/ChatBubble.tsx`
- Create: `components/StrengthsResult.tsx`

**Interfaces:**
- Produces:
  - `ChatBubble`: props `{ role: 'user' | 'assistant'; content: string }`
  - `StrengthsResult`: props `{ strengths: StrengthItem[]; summary: string }`

- [ ] **Step 1: 创建 `components/ChatBubble.tsx`**

```typescript
// components/ChatBubble.tsx
interface Props {
  role: 'user' | 'assistant'
  content: string
}

export default function ChatBubble({ role, content }: Props) {
  const isUser = role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-br-sm'
            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-bl-sm'
        }`}
      >
        {content}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 创建 `components/StrengthsResult.tsx`**

```typescript
// components/StrengthsResult.tsx
import type { StrengthItem } from '@/types'

interface Props {
  strengths: StrengthItem[]
  summary: string
}

export default function StrengthsResult({ strengths, summary }: Props) {
  return (
    <div className="space-y-5">
      <div className="space-y-3">
        {strengths.map((s, i) => (
          <div key={i} className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
            <span className="inline-block bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium px-2.5 py-1 rounded-full mb-2">
              {s.label}
            </span>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{s.evidence}</p>
          </div>
        ))}
      </div>
      <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4">
        <p className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-2">综合点评</p>
        <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">{summary}</p>
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
git add components/ChatBubble.tsx components/StrengthsResult.tsx
git commit -m "feat: add ChatBubble and StrengthsResult components"
```

---

### Task 6: `/strengths` 页面

**Files:**
- Create: `app/strengths/page.tsx`

**Interfaces:**
- Consumes:
  - `ChatBubble` from `@/components/ChatBubble`
  - `StrengthsResult` from `@/components/StrengthsResult`
  - `AuthModal` from `@/components/AuthModal`
  - `createClient` from `@/lib/supabase/client`
  - `ChatMessage`, `StrengthsResult as StrengthsResultType`, `StrengthItem` from `@/types`
- Produces: `/strengths?case_id=uuid` 页面，实现完整状态机

- [ ] **Step 1: 创建 `app/strengths/page.tsx`**

```typescript
// app/strengths/page.tsx
'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import ChatBubble from '@/components/ChatBubble'
import StrengthsResultComponent from '@/components/StrengthsResult'
import AuthModal from '@/components/AuthModal'
import type { ChatMessage, StrengthItem } from '@/types'

type Stage = 'idle' | 'chatting' | 'generating_result' | 'done'

interface StrengthsResultData {
  strengths: StrengthItem[]
  summary: string
}

const TOTAL_TURNS = 3

function StrengthsPageInner() {
  const searchParams = useSearchParams()
  const caseId = searchParams.get('case_id')

  const [user, setUser] = useState<User | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [jdText, setJdText] = useState('')
  const [stage, setStage] = useState<Stage>('idle')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streamingText, setStreamingText] = useState('')
  const [turnIndex, setTurnIndex] = useState(0)
  const [isFinal, setIsFinal] = useState(false)
  const [userInput, setUserInput] = useState('')
  const [result, setResult] = useState<StrengthsResultData | null>(null)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  async function callMessage(msgs: ChatMessage[], ti: number, sid: string | null) {
    setStreamingText('')
    setError('')

    try {
      const res = await fetch('/api/strengths/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sid,
          messages: msgs,
          jd_text: jdText || null,
          turn_index: ti,
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
      let aiText = ''

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
            if (obj.text) {
              aiText += obj.text
              setStreamingText(aiText)
            } else if ('is_final' in obj) {
              if (obj.session_id) setSessionId(obj.session_id)
              setIsFinal(obj.is_final)
            } else if (obj.error) {
              setError(obj.error)
            }
          } catch {}
        }
      }

      if (aiText) {
        const aiMsg: ChatMessage = { role: 'assistant', content: aiText }
        setMessages(prev => [...prev, aiMsg])
        setStreamingText('')
      }
    } catch {
      setError('请求失败，请重试')
      setStage('idle')
    }
  }

  async function handleStart() {
    setStage('chatting')
    setMessages([])
    setTurnIndex(0)
    setIsFinal(false)
    setSessionId(null)
    await callMessage([], 0, null)
  }

  async function handleSend() {
    if (!userInput.trim()) return
    const userMsg: ChatMessage = { role: 'user', content: userInput.trim() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setUserInput('')

    // After user's 3rd answer (responding to turn_index=2 AI question), generate result
    if (isFinal) {
      setStage('generating_result')
      await generateResult(newMessages)
    } else {
      const nextTurnIndex = turnIndex + 1
      setTurnIndex(nextTurnIndex)
      await callMessage(newMessages, nextTurnIndex, sessionId)
    }
  }

  async function generateResult(msgs: ChatMessage[]) {
    setError('')
    try {
      const res = await fetch('/api/strengths/result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          messages: msgs,
          jd_text: jdText || null,
        }),
      })
      if (!res.ok) {
        setError('优势提炼失败，请重试')
        setStage('chatting')
        return
      }
      const data = await res.json()
      setResult(data)
      setStage('done')
    } catch {
      setError('优势提炼失败，请重试')
      setStage('chatting')
    }
  }

  function handleReset() {
    setStage('idle')
    setMessages([])
    setStreamingText('')
    setTurnIndex(0)
    setIsFinal(false)
    setUserInput('')
    setResult(null)
    setSessionId(null)
    setError('')
  }

  // Compute answered turns count for progress display
  const answeredTurns = messages.filter(m => m.role === 'user').length

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <header className="flex items-center justify-between mb-8">
        <Link href="/" className="text-xl font-semibold">OfferHelper</Link>
        <Link href="/dashboard" className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
          历史记录
        </Link>
      </header>

      <h2 className="text-2xl font-bold mb-6">优势挖掘</h2>

      {error && (
        <p className="text-red-500 dark:text-red-400 text-sm mb-4 bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded">{error}</p>
      )}

      {/* idle */}
      {stage === 'idle' && (
        <div className="space-y-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">AI 将通过 3 个问题了解你的经历，帮你整理有证据的优势</p>
          <div>
            <label className="block text-sm font-medium mb-1">目标 JD（选填）</label>
            <textarea
              className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded p-3 text-sm h-32 resize-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600"
              placeholder="粘贴目标 JD（可选，填写后优势分析会更有针对性）..."
              value={jdText}
              onChange={e => setJdText(e.target.value)}
            />
          </div>
          {!user && (
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              <button onClick={() => setModalOpen(true)} className="underline hover:text-zinc-700 dark:hover:text-zinc-300">登录</button>
              {' '}后可保存记录
            </p>
          )}
          <button
            onClick={handleStart}
            className="w-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 py-3 rounded-lg font-medium hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
          >
            开始挖掘
          </button>
        </div>
      )}

      {/* chatting */}
      {stage === 'chatting' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center text-xs text-zinc-400 dark:text-zinc-500">
            <span>第 {Math.min(answeredTurns + 1, TOTAL_TURNS)} 问 / 共 {TOTAL_TURNS} 问</span>
          </div>
          <div className="space-y-3 min-h-[200px]">
            {messages.map((m, i) => (
              <ChatBubble key={i} role={m.role} content={m.content} />
            ))}
            {streamingText && (
              <ChatBubble role="assistant" content={streamingText} />
            )}
            <div ref={bottomRef} />
          </div>
          {!streamingText && messages.length > 0 && messages[messages.length - 1].role === 'assistant' && (
            <div className="space-y-2">
              <textarea
                className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded p-3 text-sm h-28 resize-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600"
                placeholder="请详细描述你的经历..."
                value={userInput}
                onChange={e => setUserInput(e.target.value)}
              />
              <button
                onClick={handleSend}
                disabled={!userInput.trim()}
                className="w-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 py-2.5 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
              >
                {isFinal ? '提交并生成优势' : '发送'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* generating_result */}
      {stage === 'generating_result' && (
        <div className="text-center py-16">
          <p className="text-zinc-500 dark:text-zinc-400 animate-pulse">正在整理你的优势...</p>
        </div>
      )}

      {/* done */}
      {stage === 'done' && result && (
        <div className="space-y-6">
          <StrengthsResultComponent strengths={result.strengths} summary={result.summary} />
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleReset}
              className="flex-1 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 py-2.5 rounded-lg text-sm font-medium hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
            >
              重新开始
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

export default function StrengthsPage() {
  return (
    <Suspense>
      <StrengthsPageInner />
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

期望：build 成功，`/strengths` 显示为 `○ static`。

- [ ] **Step 4: Commit**

```bash
git add app/strengths/page.tsx
git commit -m "feat: add /strengths page with full state machine"
```

---

### Task 7: 首页和详情页入口

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/dashboard/[id]/page.tsx`

**Interfaces:**
- Consumes: 现有 `user` state / `openModal` / `router`（首页），现有 `caseData.id`（详情页）
- Produces: 首页 header 新增「优势挖掘」按钮；详情页新增「优势挖掘」Link

- [ ] **Step 1: 修改 `app/page.tsx` — 已登录 header 新增「优势挖掘」**

将已登录 header 从：
```tsx
<div className="flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
  <button onClick={() => router.push('/dashboard')} className="hover:text-zinc-900 dark:hover:text-zinc-100">历史记录</button>
  <span>|</span>
  <button onClick={() => router.push('/interview')} className="hover:text-zinc-900 dark:hover:text-zinc-100">面试训练</button>
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
  <button onClick={handleSignOut} className="hover:text-zinc-900 dark:hover:text-zinc-100">退出</button>
</div>
```

- [ ] **Step 2: 修改 `app/page.tsx` — 未登录 header 新增「优势挖掘」**

将未登录 header 从：
```tsx
<div className="flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
  <button onClick={() => openModal('login')} className="hover:text-zinc-900 dark:hover:text-zinc-100">登录</button>
  <span>|</span>
  <button onClick={() => openModal('login')} className="hover:text-zinc-900 dark:hover:text-zinc-100">面试训练</button>
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
</div>
```

注：优势挖掘未登录也可使用，所以未登录 header 中直接跳转 `/strengths`，不弹登录框。

- [ ] **Step 3: 修改 `app/dashboard/[id]/page.tsx` — 在面试训练按钮旁新增优势挖掘**

将详情页底部 `<div className="pt-4 border-t ...">` 块从：
```tsx
<div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 mt-2">
  <Link
    href={`/interview?case_id=${caseData.id}`}
    className="block w-full text-center border border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100 px-6 py-2.5 rounded-lg text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
  >
    基于此 JD 开始面试训练
  </Link>
</div>
```

改为：
```tsx
<div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 mt-2 space-y-2">
  <Link
    href={`/interview?case_id=${caseData.id}`}
    className="block w-full text-center border border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100 px-6 py-2.5 rounded-lg text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
  >
    基于此 JD 开始面试训练
  </Link>
  <Link
    href={`/strengths?case_id=${caseData.id}`}
    className="block w-full text-center border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 px-6 py-2.5 rounded-lg text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
  >
    优势挖掘
  </Link>
</div>
```

- [ ] **Step 4: 验证 TS 无错误 + build 通过**

```bash
npx tsc --noEmit 2>&1 | head -20
npm run build 2>&1 | tail -10
```

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx app/dashboard/\[id\]/page.tsx
git commit -m "feat: add strengths discovery entry points on homepage and case detail page"
```

---

## 自审清单

### Spec 覆盖检查

| Spec 需求 | 对应 Task |
|-----------|-----------|
| `strength_sessions` 表 + RLS | Task 1 |
| StrengthItem / StrengthsResult / ChatMessage / StrengthSession 类型 | Task 1 |
| STRENGTHS_CHAT_SYSTEM + buildStrengthsChatPrompt | Task 2 |
| STRENGTHS_RESULT_SYSTEM + buildStrengthsResultPrompt | Task 2 |
| POST /api/strengths/message（流式，维护 session） | Task 3 |
| POST /api/strengths/result（非流式，写库） | Task 4 |
| ChatBubble 组件（user/assistant 两种气泡） | Task 5 |
| StrengthsResult 组件（标签 chip + 证据 + 点评） | Task 5 |
| /strengths 页面，完整状态机，Suspense 包裹 | Task 6 |
| case_id 预填 JD | Task 6 |
| 未登录可用，登录后保存提示 | Task 6 |
| 首页已登录/未登录入口 | Task 7 |
| 详情页「优势挖掘」Link | Task 7 |
| is_final 逻辑（turn_index===2 时前端触发 result） | Task 3 + Task 6 |
