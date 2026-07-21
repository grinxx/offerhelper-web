import { getAIClientForRequest } from '@/lib/ai-client'
import { MATCH_RECOMMEND_SYSTEM, buildMatchRecommendPrompt } from '@/lib/prompts'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  let body: { resume_text?: string } = {}
  try { body = await request.json() } catch {
    return Response.json({ error: 'invalid json' }, { status: 400 })
  }

  const { resume_text } = body
  if (!resume_text?.trim()) return Response.json({ error: '请先上传简历' }, { status: 400 })

  const { chat, config } = await getAIClientForRequest()

  try {
    const raw = await chat.complete(
      [
        { role: 'system', content: MATCH_RECOMMEND_SYSTEM },
        { role: 'user', content: buildMatchRecommendPrompt(resume_text) },
      ],
      config.modelFast, 1024
    )
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const recommendations = JSON.parse(cleaned)
    if (!Array.isArray(recommendations)) throw new Error('invalid format')
    return Response.json({ recommendations })
  } catch {
    return Response.json({ error: '推荐失败，请重试' }, { status: 500 })
  }
}
