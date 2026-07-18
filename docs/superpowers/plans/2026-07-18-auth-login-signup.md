# Auth Login/Signup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add email+password and Magic Link auth to OfferHelper Web, with a Modal UI and anonymous case claiming on login.

**Architecture:** Client-side AuthModal component manages login/signup state and listens to Supabase `onAuthStateChange`. On success it optionally calls `/api/claim-case` to associate the current anonymous case with the new user, then redirects to `/dashboard`. Magic Link uses `/auth/callback` route to exchange the token and establish a session.

**Tech Stack:** Next.js 16 App Router, Supabase Auth (`@supabase/supabase-js`, `@supabase/ssr`), Tailwind CSS, TypeScript strict mode.

## Global Constraints

- TypeScript strict mode throughout
- All user-visible copy in Simplified Chinese
- Next.js 16 App Router only — no Pages Router
- Supabase free tier — no paid features
- No third-party auth providers (Google, GitHub)
- No email verification gate before use
- Working directory: `/Users/i758469/offerhelper-web`

---

## File Map

```
components/
  AuthModal.tsx        # Modal container — tab switching, onAuthStateChange listener
  LoginForm.tsx        # Email+password login + Magic Link tab
  SignupForm.tsx        # Email+password signup form
app/
  auth/callback/
    route.ts           # Magic Link token exchange → redirect to /
  api/claim-case/
    route.ts           # POST: update cases.user_id for anonymous case
  page.tsx             # Modified: auth state, modal trigger, header, claim on success
  api/analyze/
    route.ts           # Modified: read session cookie, insert with user_id if present
```

---

## Task 1: Magic Link callback route + claim-case API

**Files:**
- Create: `app/auth/callback/route.ts`
- Create: `app/api/claim-case/route.ts`

**Interfaces:**
- Consumes: `createClient()` from `lib/supabase/server.ts`
- Produces:
  - GET `/auth/callback?code=<code>` → exchanges code, sets session cookie, redirects to `/`
  - POST `/api/claim-case` with body `{ case_id: string }` + session cookie → updates `cases.user_id`, returns `{ success: true }` or `{ error: string }`

- [ ] **Step 1: Create Magic Link callback route**

Create `app/auth/callback/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(`${origin}/`)
}
```

- [ ] **Step 2: Create claim-case API route**

Create `app/api/claim-case/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const { case_id } = await request.json()

  if (!case_id) {
    return Response.json({ error: 'case_id is required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { error } = await supabase
    .from('cases')
    .update({ user_id: user.id })
    .eq('id', case_id)
    .is('user_id', null)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ success: true })
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/i758469/offerhelper-web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/auth/callback/route.ts app/api/claim-case/route.ts
git commit -m "feat: add auth callback and claim-case API routes"
```

---

## Task 2: SignupForm component

**Files:**
- Create: `components/SignupForm.tsx`

**Interfaces:**
- Consumes: `createClient()` from `lib/supabase/client.ts`
- Produces:
  - `SignupForm` props: `{ onSuccess: () => void; onSwitchToLogin: (message?: string) => void }`
  - Calls `supabase.auth.signUp({ email, password })` on submit
  - On success: calls `onSwitchToLogin('注册成功，请登录')`
  - On error: shows error message inline

- [ ] **Step 1: Create SignupForm**

Create `components/SignupForm.tsx`:

```typescript
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  onSuccess: () => void
  onSwitchToLogin: (message?: string) => void
}

export default function SignupForm({ onSwitchToLogin }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({ email, password })

    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      onSwitchToLogin('注册成功，请登录')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">邮箱</label>
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full border rounded px-3 py-2 text-sm"
          placeholder="example@email.com"
          disabled={loading}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">密码</label>
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full border rounded px-3 py-2 text-sm"
          placeholder="至少 6 位"
          disabled={loading}
        />
      </div>
      {error && <p className="text-red-500 text-xs">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-black text-white py-2 rounded-lg text-sm disabled:opacity-40"
      >
        {loading ? '处理中...' : '注册'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/SignupForm.tsx
git commit -m "feat: add SignupForm component"
```

---

## Task 3: LoginForm component

**Files:**
- Create: `components/LoginForm.tsx`

**Interfaces:**
- Consumes: `createClient()` from `lib/supabase/client.ts`
- Produces:
  - `LoginForm` props: `{ onSuccess: () => void; successMessage?: string }`
  - Email+password: calls `supabase.auth.signInWithPassword({ email, password })`, on success calls `onSuccess()`
  - Magic Link: calls `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + '/auth/callback' } })`, on success shows "邮件已发送，请查收"
  - On error: shows error message inline

- [ ] **Step 1: Create LoginForm**

Create `components/LoginForm.tsx`:

```typescript
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  onSuccess: () => void
  successMessage?: string
}

export default function LoginForm({ onSuccess, successMessage }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [magicLinkSent, setMagicLinkSent] = useState(false)

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      onSuccess()
    }
  }

  async function handleMagicLink() {
    if (!email) { setError('请先填写邮箱'); return }
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + '/auth/callback' },
    })

    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setMagicLinkSent(true)
    }
  }

  if (magicLinkSent) {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-gray-600">邮件已发送，请查收</p>
        <p className="text-xs text-gray-400 mt-1">点击邮件中的链接完成登录</p>
      </div>
    )
  }

  return (
    <form onSubmit={handlePasswordLogin} className="space-y-4">
      {successMessage && (
        <p className="text-green-600 text-xs bg-green-50 px-3 py-2 rounded">{successMessage}</p>
      )}
      <div>
        <label className="block text-sm font-medium mb-1">邮箱</label>
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full border rounded px-3 py-2 text-sm"
          placeholder="example@email.com"
          disabled={loading}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">密码</label>
        <input
          type="password"
          required
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full border rounded px-3 py-2 text-sm"
          placeholder="••••••••"
          disabled={loading}
        />
      </div>
      {error && <p className="text-red-500 text-xs">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-black text-white py-2 rounded-lg text-sm disabled:opacity-40"
      >
        {loading ? '处理中...' : '登录'}
      </button>
      <div className="flex items-center gap-2 my-1">
        <div className="flex-1 border-t" />
        <span className="text-xs text-gray-400">或者</span>
        <div className="flex-1 border-t" />
      </div>
      <button
        type="button"
        onClick={handleMagicLink}
        disabled={loading}
        className="w-full border py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
      >
        {loading ? '处理中...' : '发送 Magic Link 邮件'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/LoginForm.tsx
git commit -m "feat: add LoginForm component with password and magic link"
```

---

## Task 4: AuthModal component

**Files:**
- Create: `components/AuthModal.tsx`

**Interfaces:**
- Consumes:
  - `LoginForm` props: `{ onSuccess: () => void; successMessage?: string }`
  - `SignupForm` props: `{ onSuccess: () => void; onSwitchToLogin: (message?: string) => void }`
  - `createClient()` from `lib/supabase/client.ts`
- Produces:
  - `AuthModal` props: `{ isOpen: boolean; defaultTab?: 'login' | 'signup'; caseId?: string | null; onClose: () => void; onAuthSuccess: (userId: string) => void }`
  - On login success: calls `onAuthSuccess(user.id)`
  - Listens to `supabase.auth.onAuthStateChange` — when `SIGNED_IN` fires, calls `onAuthSuccess`

- [ ] **Step 1: Create AuthModal**

Create `components/AuthModal.tsx`:

```typescript
'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import LoginForm from './LoginForm'
import SignupForm from './SignupForm'

interface Props {
  isOpen: boolean
  defaultTab?: 'login' | 'signup'
  onClose: () => void
  onAuthSuccess: (userId: string) => void
}

export default function AuthModal({ isOpen, defaultTab = 'login', onClose, onAuthSuccess }: Props) {
  const [tab, setTab] = useState<'login' | 'signup'>(defaultTab)
  const [switchMessage, setSwitchMessage] = useState<string | undefined>()

  useEffect(() => {
    setTab(defaultTab)
    setSwitchMessage(undefined)
  }, [defaultTab, isOpen])

  useEffect(() => {
    if (!isOpen) return
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        onAuthSuccess(session.user.id)
      }
    })
    return () => subscription.unsubscribe()
  }, [isOpen, onAuthSuccess])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-black text-lg leading-none"
        >
          ✕
        </button>

        <div className="flex gap-1 mb-6 border-b">
          <button
            onClick={() => { setTab('login'); setSwitchMessage(undefined) }}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === 'login' ? 'border-black text-black' : 'border-transparent text-gray-400'}`}
          >
            登录
          </button>
          <button
            onClick={() => { setTab('signup'); setSwitchMessage(undefined) }}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === 'signup' ? 'border-black text-black' : 'border-transparent text-gray-400'}`}
          >
            注册
          </button>
        </div>

        {tab === 'login' ? (
          <LoginForm
            onSuccess={() => {}}
            successMessage={switchMessage}
          />
        ) : (
          <SignupForm
            onSuccess={() => {}}
            onSwitchToLogin={(msg) => { setTab('login'); setSwitchMessage(msg) }}
          />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/AuthModal.tsx
git commit -m "feat: add AuthModal component"
```

---

## Task 5: Update homepage — auth state + modal integration

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes:
  - `AuthModal` props: `{ isOpen: boolean; defaultTab?: 'login' | 'signup'; onClose: () => void; onAuthSuccess: (userId: string) => void }`
  - `createClient()` from `lib/supabase/client.ts`
  - POST `/api/claim-case` with `{ case_id: string }`
  - `User` type from `@supabase/supabase-js`
- Produces: Updated `app/page.tsx` with full auth flow

**Key behaviors:**
- On mount: check current session with `supabase.auth.getUser()`
- `onAuthSuccess(userId)`: if `caseId` exists, POST `/api/claim-case`, then `router.push('/dashboard')`
- Header: if logged in show "历史记录 | 退出", else show "登录 / 历史记录" (opens modal)
- "注册保存" button: if logged in show "查看历史记录", else opens modal with `defaultTab='signup'`
- "登录 / 历史记录" link: opens modal with `defaultTab='login'`
- 退出: calls `supabase.auth.signOut()`, sets user to null

- [ ] **Step 1: Replace app/page.tsx**

Replace full content of `app/page.tsx`:

```typescript
'use client'
import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import ResumeUploader from '@/components/ResumeUploader'
import JdInput from '@/components/JdInput'
import AnalyzeButton from '@/components/AnalyzeButton'
import ResultStream from '@/components/ResultStream'
import AuthModal from '@/components/AuthModal'
import type { Suggestion } from '@/types'

export default function HomePage() {
  const router = useRouter()
  const [resumeText, setResumeText] = useState('')
  const [jdText, setJdText] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [caseId, setCaseId] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalTab, setModalTab] = useState<'login' | 'signup'>('login')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  const handleAuthSuccess = useCallback(async (userId: string) => {
    setModalOpen(false)
    if (caseId) {
      await fetch('/api/claim-case', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: caseId }),
      })
    }
    router.push('/dashboard')
  }, [caseId, router])

  const handleSignOut = useCallback(async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setUser(null)
  }, [])

  const handleAnalyze = useCallback(async () => {
    if (!resumeText || !jdText) return
    setLoading(true)
    setSuggestions([])
    setCaseId(null)

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume_text: resumeText, jd_text: jdText }),
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
            if (obj.case_id) {
              setCaseId(obj.case_id)
            } else if (obj.original) {
              setSuggestions(prev => [...prev, obj as Suggestion])
            }
          } catch {}
        }
      }
    } finally {
      setLoading(false)
    }
  }, [resumeText, jdText])

  function openModal(tab: 'login' | 'signup') {
    setModalTab(tab)
    setModalOpen(true)
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-xl font-semibold">OfferHelper</h1>
        {user ? (
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <button onClick={() => router.push('/dashboard')} className="hover:text-black">历史记录</button>
            <span>|</span>
            <button onClick={handleSignOut} className="hover:text-black">退出</button>
          </div>
        ) : (
          <button onClick={() => openModal('login')} className="text-sm text-gray-500 hover:text-black">
            登录 / 历史记录
          </button>
        )}
      </header>

      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-1">把真实经历变成可投递的简历</h2>
        <p className="text-gray-500 text-sm">不编造，不包装，只优化表达</p>
      </div>

      <div className="space-y-4 mb-6">
        <ResumeUploader onTextReady={setResumeText} />
        <JdInput value={jdText} onChange={setJdText} />
        <AnalyzeButton
          loading={loading}
          disabled={!resumeText || !jdText}
          onClick={handleAnalyze}
        />
      </div>

      <ResultStream suggestions={suggestions} loading={loading} />

      {caseId && !loading && suggestions.length > 0 && (
        <div className="mt-8 border-t pt-6 text-center">
          <p className="text-sm text-gray-500 mb-3">保存结果，下次继续优化</p>
          {user ? (
            <button
              onClick={() => router.push('/dashboard')}
              className="border border-black text-black px-6 py-2 rounded-lg text-sm hover:bg-gray-50"
            >
              查看历史记录
            </button>
          ) : (
            <button
              onClick={() => openModal('signup')}
              className="border border-black text-black px-6 py-2 rounded-lg text-sm hover:bg-gray-50"
            >
              注册保存
            </button>
          )}
        </div>
      )}

      <AuthModal
        isOpen={modalOpen}
        defaultTab={modalTab}
        onClose={() => setModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />
    </main>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Manual smoke test**

Start dev server (`npm run dev`), open `http://localhost:3000`:
1. Click "登录 / 历史记录" — modal opens with 登录 tab
2. Click 注册 tab — switches to signup form
3. Close modal with ✕ — modal closes
4. Run an analysis, then click "注册保存" — modal opens with 注册 tab

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat: integrate AuthModal into homepage with auth state management"
```

---

## Task 6: Update analyze route to attach user_id from session

**Files:**
- Modify: `app/api/analyze/route.ts`

**Interfaces:**
- Consumes: `createClient()` from `lib/supabase/server.ts` (for reading session)
- Produces: same POST `/api/analyze` but now reads the session cookie and includes `user_id` in the insert if the user is logged in

- [ ] **Step 1: Update analyze route**

Modify `app/api/analyze/route.ts` — add these imports at the top and update the insert:

```typescript
import Anthropic from '@anthropic-ai/sdk'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient as createSessionClient } from '@/lib/supabase/server'
import { SYSTEM_PROMPT, buildUserPrompt } from '@/lib/prompts'
import type { Suggestion } from '@/types'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  let body: { resume_text?: string; jd_text?: string } = {}
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400 })
  }
  const { resume_text, jd_text } = body

  if (!resume_text || !jd_text) {
    return new Response(JSON.stringify({ error: '简历和 JD 均为必填项' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // read session to get user_id if logged in
  const sessionSupabase = await createSessionClient()
  const { data: { user } } = await sessionSupabase.auth.getUser()

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const insertData: Record<string, unknown> = { resume_text, jd_text, status: 'pending' }
  if (user) insertData.user_id = user.id

  const { data: caseRow, error: insertError } = await supabase
    .from('cases')
    .insert(insertData)
    .select('id')
    .single()

  if (insertError || !caseRow) {
    return new Response(JSON.stringify({ error: '创建案例失败', detail: insertError?.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const caseId = caseRow.id
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL,
  })

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const suggestions: Suggestion[] = []
      let buffer = ''

      try {
        const response = await client.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: buildUserPrompt(resume_text, jd_text) }],
          stream: true,
        })

        for await (const event of response) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            buffer += event.delta.text

            let startIdx = buffer.indexOf('{')
            while (startIdx !== -1) {
              let depth = 0
              let endIdx = -1
              for (let i = startIdx; i < buffer.length; i++) {
                if (buffer[i] === '{') depth++
                if (buffer[i] === '}') {
                  depth--
                  if (depth === 0) { endIdx = i; break }
                }
              }
              if (endIdx === -1) break

              try {
                const obj = JSON.parse(buffer.slice(startIdx, endIdx + 1)) as Suggestion
                if (obj.original && obj.suggestion) {
                  suggestions.push(obj)
                  controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))
                }
              } catch {}

              buffer = buffer.slice(endIdx + 1)
              startIdx = buffer.indexOf('{')
            }
          }
        }

        await supabase
          .from('cases')
          .update({ result_json: suggestions, status: 'done' })
          .eq('id', caseId)

        controller.enqueue(encoder.encode(JSON.stringify({ case_id: caseId }) + '\n'))
      } catch {
        await supabase
          .from('cases')
          .update({ status: 'error' })
          .eq('id', caseId)
        controller.enqueue(encoder.encode(JSON.stringify({ error: 'AI 分析失败，请重试' }) + '\n'))
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

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/analyze/route.ts
git commit -m "feat: attach user_id to case on analyze when session exists"
```

---

## Self-Review

**Spec coverage:**
- ✅ 邮箱+密码注册 → SignupForm (Task 2)
- ✅ 邮箱+密码登录 → LoginForm (Task 3)
- ✅ Magic Link → LoginForm + /auth/callback (Tasks 1, 3)
- ✅ AuthModal with tab switching → Task 4
- ✅ 首页 header 未登录/已登录状态 → Task 5
- ✅ 注册保存 opens modal with signup tab → Task 5
- ✅ 登录成功后 claim-case + redirect → Tasks 1, 5
- ✅ 已登录分析时关联 user_id → Task 6

**Placeholder scan:** None found.

**Type consistency:**
- `onAuthSuccess: (userId: string) => void` — defined in Task 4, consumed in Task 5 ✅
- `onSuccess: () => void` / `onSwitchToLogin: (message?: string) => void` — defined in Tasks 2/3, consumed in Task 4 ✅
