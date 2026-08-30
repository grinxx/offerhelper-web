import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient as createSessionClient } from '@/lib/supabase/server'
import { validateBearerToken } from '@/lib/auth/token'
import { getAIClientForRequest } from '@/lib/ai-client'
import { checkAndRecordUsage } from '@/lib/usage'
import { SYSTEM_PROMPT, buildUserPrompt, RESUME_SCORE_SYSTEM, buildResumeScorePrompt } from '@/lib/prompts'
import type { Suggestion } from '@/types'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  let body: { resume_text?: string; jd_text?: string; strengths_context?: string } = {}
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400 })
  }
  const { resume_text: rawResume, jd_text: rawJd, strengths_context } = body
  const resume_text = rawResume?.slice(0, 8000)
  const jd_text = rawJd?.slice(0, 4000)

  if (!resume_text || !jd_text) {
    return new Response(JSON.stringify({ error: '简历和 JD 均为必填项' }), { status: 400 })
  }

  // 先鉴权拿到用户身份（MCP Bearer Token 或 Session Cookie），再计费
  const tokenUser = await validateBearerToken(request)
  let user = tokenUser
  if (!user) {
    const sessionSupabase = await createSessionClient()
    const { data: { user: sessionUser } } = await sessionSupabase.auth.getUser()
    user = sessionUser ? { id: sessionUser.id } : null
  }

  const usage = await checkAndRecordUsage('analyze', user?.id ?? null)
  if (!usage.allowed) {
    return new Response(JSON.stringify({ error: `${usage.limitMessage}`, code: 'LIMIT_EXCEEDED' }), { status: 429 })
  }

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 查询用户经历库并保存简历版本（仅登录用户）
  let knowledgeContext: string | undefined
  if (user) {
    const [expRes, versionsRes] = await Promise.all([
      supabase
        .from('user_experiences')
        .select('source, content')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('resume_versions')
        .select('resume_text, label')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(3),
    ])

    if (expRes.data && expRes.data.length > 0) {
      const SOURCE_LABEL: Record<string, string> = { strengths: '优势挖掘', interview: '面试训练', manual: '手动添加' }
      const lines = expRes.data.map((e: { source: string; content: string }) =>
        `[${SOURCE_LABEL[e.source] ?? e.source}] ${e.content}`
      )
      knowledgeContext = lines.join('\n').slice(0, 1000)
    }

    if (versionsRes.data && versionsRes.data.length > 0) {
      const labels = versionsRes.data.map((v: { label: string }) => v.label).filter(Boolean).join('、')
      if (labels) {
        const versionPart = `\n历史简历版本：${labels}`
        knowledgeContext = knowledgeContext ? (knowledgeContext + versionPart).slice(0, 1000) : versionPart.slice(0, 1000)
      }
    }

    // 保存简历版本（去重）
    const latestText = versionsRes.data?.[0]?.resume_text
    if (latestText !== resume_text) {
      const { count: versionCount } = await supabase
        .from('resume_versions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)

      if ((versionCount ?? 0) >= 20) {
        const { data: oldest } = await supabase
          .from('resume_versions')
          .select('id')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true })
          .limit(1)
        if (oldest?.[0]) {
          await supabase.from('resume_versions').delete().eq('id', oldest[0].id)
        }
      }

      const { count: newCount } = await supabase
        .from('resume_versions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)

      await supabase.from('resume_versions').insert({
        user_id: user.id,
        resume_text,
        label: `版本 ${(newCount ?? 0) + 1}`,
      })
    }
  }

  const insertData: Record<string, unknown> = { resume_text, jd_text, status: 'pending' }
  if (user) insertData.user_id = user.id

  const { data: caseRow, error: insertError } = await supabase
    .from('cases').insert(insertData).select('id').single()

  if (insertError || !caseRow) {
    return new Response(JSON.stringify({ error: '创建案例失败' }), { status: 500 })
  }

  const caseId = caseRow.id
  const { chat, config } = await getAIClientForRequest(user?.id ?? null)

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const suggestions: Suggestion[] = []
      let buffer = ''

      try {
        for await (const chunk of chat.stream(
          [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: buildUserPrompt(resume_text, jd_text, strengths_context, knowledgeContext) },
          ],
          config.modelSmart,
          4096
        )) {
          buffer += chunk.text

          let startIdx = buffer.indexOf('{')
          while (startIdx !== -1) {
            let depth = 0, endIdx = -1
            for (let i = startIdx; i < buffer.length; i++) {
              if (buffer[i] === '{') depth++
              if (buffer[i] === '}') { depth--; if (depth === 0) { endIdx = i; break } }
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

        if (suggestions.length === 0) {
          await supabase.from('cases').update({ status: 'error' }).eq('id', caseId)
          controller.enqueue(encoder.encode(JSON.stringify({ error: 'AI 未能生成建议，请检查简历和 JD 内容后重试' }) + '\n'))
          return
        }

        await supabase.from('cases').update({ result_json: suggestions, status: 'done' }).eq('id', caseId)

        // 额外生成整体评分
        try {
          const scoreRaw = await chat.complete(
            [
              { role: 'system', content: RESUME_SCORE_SYSTEM },
              { role: 'user', content: buildResumeScorePrompt(resume_text, jd_text) },
            ],
            config.modelFast, 256
          )
          const cleaned = scoreRaw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
          const scoreData = JSON.parse(cleaned)
          if (typeof scoreData.score === 'number') {
            controller.enqueue(encoder.encode(JSON.stringify({ score: scoreData.score, score_summary: scoreData.summary }) + '\n'))
          }
        } catch {}

        controller.enqueue(encoder.encode(JSON.stringify({ case_id: caseId }) + '\n'))
      } catch {
        await supabase.from('cases').update({ status: 'error' }).eq('id', caseId)
        controller.enqueue(encoder.encode(JSON.stringify({ error: 'AI 分析失败，请重试' }) + '\n'))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no' },
  })
}
