# Dashboard 历史记录扩展实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 扩展 Dashboard 为四类功能的统一时间线，并新增面试训练、优势挖掘、岗位匹配三个详情页。

**Architecture:** Server Component 直查数据库，`Promise.all` 并行查四张表后合并排序；三个新详情页均为 Server Component，复用现有 UI 组件，无新 API 端点，无数据库变更。

**Tech Stack:** Next.js 16 App Router, Supabase (@supabase/ssr), Tailwind CSS, TypeScript

## Global Constraints

- 所有页面为 Server Component（无 `'use client'`），通过 `import { createClient } from '@/lib/supabase/server'`（async）查数据库
- 未登录用户 `redirect('/')`，与现有 dashboard 行为一致
- 所有颜色使用 zinc 色阶 + dark: 变体；类型标签使用 spec 中指定的四套颜色
- 数据查询需要 `.eq('user_id', user.id)` 确保只读自己的记录
- 复用现有组件：`ScoreCard`、`ChatBubble`、`StrengthsResult`、`MatchCard`、`SuggestionCard`
- `ScoreCard` props: `{ scores: InterviewScores, feedback: string, reference_answer: string, loading?: boolean }`
- `StrengthsResult` props: `{ strengths: StrengthItem[], summary: string }`
- `MatchCard` props: `{ result: MatchResult, title?: string, loading?: boolean }`
- `ChatBubble` props: `{ role: 'user'|'assistant', content: string }`

---

## 文件清单

| 操作 | 路径 |
|------|------|
| 修改 | `app/dashboard/page.tsx` |
| 新增 | `app/dashboard/interview/[id]/page.tsx` |
| 新增 | `app/dashboard/strengths/[id]/page.tsx` |
| 新增 | `app/dashboard/match/[id]/page.tsx` |

---

### Task 1: Dashboard 列表页 — 统一时间线

**Files:**
- Modify: `app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase/server`, types `InterviewSession`, `StrengthSession`, `MatchSession`, `JdItem` from `@/types`
- Produces: `/dashboard` 显示四类记录的统一时间线

- [ ] **Step 1: 完整替换 `app/dashboard/page.tsx`**

```typescript
// app/dashboard/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { JdItem } from '@/types'

type RecordType = 'analysis' | 'interview' | 'strengths' | 'match'

interface TimelineRecord {
  id: string
  type: RecordType
  summary: string
  created_at: string
  href: string
}

const TYPE_CONFIG: Record<RecordType, { label: string; className: string }> = {
  analysis: {
    label: '简历分析',
    className: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400',
  },
  interview: {
    label: '面试训练',
    className: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400',
  },
  strengths: {
    label: '优势挖掘',
    className: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400',
  },
  match: {
    label: '岗位匹配',
    className: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400',
  },
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const [casesRes, interviewRes, strengthsRes, matchRes] = await Promise.all([
    supabase
      .from('cases')
      .select('id, jd_text, created_at')
      .eq('user_id', user.id)
      .eq('status', 'done')
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('interview_sessions')
      .select('id, jd_text, created_at')
      .eq('user_id', user.id)
      .eq('status', 'done')
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('strength_sessions')
      .select('id, summary, created_at')
      .eq('user_id', user.id)
      .eq('status', 'done')
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('match_sessions')
      .select('id, jd_list, created_at')
      .eq('user_id', user.id)
      .eq('status', 'done')
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const records: TimelineRecord[] = [
    ...(casesRes.data ?? []).map(r => ({
      id: r.id,
      type: 'analysis' as RecordType,
      summary: r.jd_text?.slice(0, 60) ?? '简历分析',
      created_at: r.created_at,
      href: `/dashboard/${r.id}`,
    })),
    ...(interviewRes.data ?? []).map(r => ({
      id: r.id,
      type: 'interview' as RecordType,
      summary: r.jd_text ? r.jd_text.slice(0, 60) : '面试训练',
      created_at: r.created_at,
      href: `/dashboard/interview/${r.id}`,
    })),
    ...(strengthsRes.data ?? []).map(r => ({
      id: r.id,
      type: 'strengths' as RecordType,
      summary: r.summary ? (r.summary as string).slice(0, 60) : '优势挖掘',
      created_at: r.created_at,
      href: `/dashboard/strengths/${r.id}`,
    })),
    ...(matchRes.data ?? []).map(r => ({
      id: r.id,
      type: 'match' as RecordType,
      summary: (() => {
        const list = r.jd_list as JdItem[] | null
        return list?.[0]?.title || list?.[0]?.content?.slice(0, 40) || '岗位匹配'
      })(),
      created_at: r.created_at,
      href: `/dashboard/match/${r.id}`,
    })),
  ]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 50)

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <header className="flex items-center justify-between mb-8">
        <Link href="/" className="text-xl font-semibold">OfferHelper</Link>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">{user.email}</span>
      </header>

      <h2 className="text-xl font-bold mb-4">历史记录</h2>

      {records.length === 0 ? (
        <p className="text-zinc-500 dark:text-zinc-400 text-sm">
          暂无记录，<Link href="/" className="underline">开始第一次分析</Link>
        </p>
      ) : (
        <ul className="space-y-3">
          {records.map(r => {
            const config = TYPE_CONFIG[r.type]
            return (
              <li key={`${r.type}-${r.id}`}>
                <Link
                  href={r.href}
                  className="block border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded shrink-0 ${config.className}`}>
                        {config.label}
                      </span>
                      <p className="text-sm text-zinc-700 dark:text-zinc-300 line-clamp-1 min-w-0">{r.summary}</p>
                    </div>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 shrink-0">
                      {new Date(r.created_at).toLocaleString('zh-CN')}
                    </p>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
```

- [ ] **Step 2: 验证 TS 无错误**

```bash
cd /Users/i758469/offerhelper-web
npx tsc --noEmit 2>&1 | head -20
```

期望：无输出。

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "feat: expand dashboard to unified timeline of all record types"
```

---

### Task 2: 面试训练详情页

**Files:**
- Create: `app/dashboard/interview/[id]/page.tsx`

**Interfaces:**
- Consumes:
  - `createClient` from `@/lib/supabase/server`
  - `ScoreCard` from `@/components/ScoreCard`
  - `InterviewScores`, `InterviewTurn` from `@/types`
- Produces: `/dashboard/interview/[id]` 展示面试记录，含题目、回答、评分卡

- [ ] **Step 1: 创建文件**

```typescript
// app/dashboard/interview/[id]/page.tsx
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ScoreCard from '@/components/ScoreCard'
import Link from 'next/link'
import type { InterviewScores } from '@/types'

interface Props {
  params: Promise<{ id: string }>
}

interface TurnRow {
  question_index: number
  question: string
  user_answer: string
  scores: InterviewScores
  feedback: string
  reference_answer: string
}

export default async function InterviewDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: session } = await supabase
    .from('interview_sessions')
    .select('id, jd_text, questions, status, created_at, case_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!session) notFound()

  const { data: turns } = await supabase
    .from('interview_turns')
    .select('question_index, question, user_answer, scores, feedback, reference_answer')
    .eq('session_id', id)
    .order('question_index', { ascending: true })

  const turnRows = (turns ?? []) as TurnRow[]

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <header className="flex items-center justify-between mb-8">
        <Link href="/" className="text-xl font-semibold">OfferHelper</Link>
        <Link href="/dashboard" className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
          ← 返回记录
        </Link>
      </header>

      <div className="mb-6">
        <h2 className="text-xl font-bold mb-1">面试训练记录</h2>
        <p className="text-xs text-zinc-400 dark:text-zinc-500">{new Date(session.created_at).toLocaleString('zh-CN')}</p>
      </div>

      {session.jd_text && (
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 mb-6">
          <p className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-1">目标 JD</p>
          <p className="text-sm text-zinc-700 dark:text-zinc-300 line-clamp-4">{session.jd_text}</p>
        </div>
      )}

      {turnRows.length === 0 ? (
        <p className="text-zinc-500 dark:text-zinc-400 text-sm">该训练暂无回答记录。</p>
      ) : (
        <div className="space-y-6">
          {turnRows.map((turn) => (
            <div key={turn.question_index} className="space-y-3">
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-1">第 {turn.question_index + 1} 题</p>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{turn.question}</p>
              </div>
              <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-1">你的回答</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">{turn.user_answer}</p>
              </div>
              <ScoreCard
                scores={turn.scores}
                feedback={turn.feedback}
                reference_answer={turn.reference_answer}
              />
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 pt-6 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
        {session.case_id ? (
          <>
            <Link
              href={`/interview?case_id=${session.case_id}`}
              className="block w-full text-center bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-6 py-2.5 rounded-lg text-sm hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
            >
              再次面试训练（基于此 JD）
            </Link>
            <Link
              href={`/dashboard/${session.case_id}`}
              className="block w-full text-center border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 px-6 py-2.5 rounded-lg text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              查看关联简历分析
            </Link>
          </>
        ) : (
          <Link
            href="/interview"
            className="block w-full text-center bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-6 py-2.5 rounded-lg text-sm hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
          >
            再次面试训练
          </Link>
        )}
      </div>
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
git add "app/dashboard/interview/[id]/page.tsx"
git commit -m "feat: add interview session detail page"
```

---

### Task 3: 优势挖掘详情页

**Files:**
- Create: `app/dashboard/strengths/[id]/page.tsx`

**Interfaces:**
- Consumes:
  - `createClient` from `@/lib/supabase/server`
  - `ChatBubble` from `@/components/ChatBubble`
  - `StrengthsResult` from `@/components/StrengthsResult`
  - `ChatMessage`, `StrengthsResult as StrengthsResultType`, `StrengthItem` from `@/types`

- [ ] **Step 1: 创建文件**

```typescript
// app/dashboard/strengths/[id]/page.tsx
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ChatBubble from '@/components/ChatBubble'
import StrengthsResultComponent from '@/components/StrengthsResult'
import Link from 'next/link'
import type { ChatMessage, StrengthsResult } from '@/types'

interface Props {
  params: Promise<{ id: string }>
}

export default async function StrengthsDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: session } = await supabase
    .from('strength_sessions')
    .select('id, jd_text, messages, result, status, created_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!session) notFound()

  const messages = (session.messages ?? []) as ChatMessage[]
  const result = session.result as StrengthsResult | null

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <header className="flex items-center justify-between mb-8">
        <Link href="/" className="text-xl font-semibold">OfferHelper</Link>
        <Link href="/dashboard" className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
          ← 返回记录
        </Link>
      </header>

      <div className="mb-6">
        <h2 className="text-xl font-bold mb-1">优势挖掘记录</h2>
        <p className="text-xs text-zinc-400 dark:text-zinc-500">{new Date(session.created_at).toLocaleString('zh-CN')}</p>
      </div>

      {session.jd_text && (
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 mb-6">
          <p className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-1">目标 JD</p>
          <p className="text-sm text-zinc-700 dark:text-zinc-300 line-clamp-4">{session.jd_text}</p>
        </div>
      )}

      {messages.length > 0 && (
        <div className="space-y-3 mb-6">
          <p className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">对话记录</p>
          {messages.map((m, i) => (
            <ChatBubble key={i} role={m.role} content={m.content} />
          ))}
        </div>
      )}

      <div className="mb-6">
        <p className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-3">优势结果</p>
        {result ? (
          <StrengthsResultComponent strengths={result.strengths} summary={result.summary} />
        ) : (
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">该记录未完成优势提炼。</p>
        )}
      </div>

      <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800">
        <Link
          href="/strengths"
          className="block w-full text-center bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-6 py-2.5 rounded-lg text-sm hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
        >
          重新挖掘优势
        </Link>
      </div>
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
git add "app/dashboard/strengths/[id]/page.tsx"
git commit -m "feat: add strengths session detail page"
```

---

### Task 4: 岗位匹配详情页

**Files:**
- Create: `app/dashboard/match/[id]/page.tsx`

**Interfaces:**
- Consumes:
  - `createClient` from `@/lib/supabase/server`
  - `MatchCard` from `@/components/MatchCard`
  - `JdItem`, `MatchResult` from `@/types`

- [ ] **Step 1: 创建文件**

```typescript
// app/dashboard/match/[id]/page.tsx
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MatchCard from '@/components/MatchCard'
import Link from 'next/link'
import type { JdItem, MatchResult } from '@/types'

interface Props {
  params: Promise<{ id: string }>
}

export default async function MatchDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: session } = await supabase
    .from('match_sessions')
    .select('id, jd_list, results, summary, status, created_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!session) notFound()

  const jdList = (session.jd_list ?? []) as JdItem[]
  const results = (session.results ?? []) as MatchResult[]

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <header className="flex items-center justify-between mb-8">
        <Link href="/" className="text-xl font-semibold">OfferHelper</Link>
        <Link href="/dashboard" className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
          ← 返回记录
        </Link>
      </header>

      <div className="mb-6">
        <h2 className="text-xl font-bold mb-1">岗位匹配记录</h2>
        <p className="text-xs text-zinc-400 dark:text-zinc-500">{new Date(session.created_at).toLocaleString('zh-CN')}</p>
      </div>

      {results.length === 0 ? (
        <p className="text-zinc-500 dark:text-zinc-400 text-sm">该记录暂无匹配结果。</p>
      ) : (
        <div className="space-y-4 mb-6">
          {results.map((r) => (
            <MatchCard
              key={r.jd_index}
              result={r}
              title={jdList[r.jd_index]?.title || undefined}
            />
          ))}
        </div>
      )}

      {session.summary && (
        <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4 mb-6">
          <p className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-2">投递建议</p>
          <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">{session.summary}</p>
        </div>
      )}

      <div className="pt-2">
        <Link
          href="/match"
          className="block w-full text-center bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-6 py-2.5 rounded-lg text-sm hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
        >
          重新匹配
        </Link>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: 验证 TS 无错误**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: 验证 build 通过**

```bash
npm run build 2>&1 | tail -15
```

期望：build 成功，四个新路由均出现（`/dashboard`、`/dashboard/interview/[id]`、`/dashboard/strengths/[id]`、`/dashboard/match/[id]`）。

- [ ] **Step 4: Commit**

```bash
git add "app/dashboard/match/[id]/page.tsx"
git commit -m "feat: add match session detail page"
```

---

## 自审清单

### Spec 覆盖检查

| Spec 需求 | 对应 Task |
|-----------|-----------|
| Promise.all 并行查四张表 | Task 1 |
| 按 created_at 倒序排列，取前 50 条 | Task 1 |
| 四种类型标签（颜色 + 文字） | Task 1 |
| 各类型摘要文字提取规则 | Task 1 |
| 点击跳转对应详情页 | Task 1 |
| 面试训练详情：题目 + 回答 + ScoreCard | Task 2 |
| 面试训练详情：case_id 决定底部按钮 | Task 2 |
| 优势挖掘详情：ChatBubble 对话记录 | Task 3 |
| 优势挖掘详情：result 为 null 时兜底 | Task 3 |
| 优势挖掘详情：StrengthsResult 展示结果 | Task 3 |
| 岗位匹配详情：MatchCard 列表 | Task 4 |
| 岗位匹配详情：summary 段落 | Task 4 |
| 所有详情页：「再次开始」入口 | Task 2, 3, 4 |
