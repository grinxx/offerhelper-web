import Anthropic from '@anthropic-ai/sdk'
import { MATCH_RECOMMEND_SYSTEM, buildMatchRecommendPrompt } from '@/lib/prompts'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  let body: { resume_text?: string } = {}
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'invalid json' }, { status: 400 })
  }

  const { resume_text } = body
  if (!resume_text?.trim()) {
    return Response.json({ error: '请先上传简历' }, { status: 400 })
  }

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL,
  })

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: MATCH_RECOMMEND_SYSTEM,
      messages: [{ role: 'user', content: buildMatchRecommendPrompt(resume_text) }],
    })

    const raw = message.content[0]?.type === 'text' ? message.content[0].text : ''
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const recommendations = JSON.parse(cleaned)

    if (!Array.isArray(recommendations)) throw new Error('invalid format')
    return Response.json({ recommendations })
  } catch {
    return Response.json({ error: '推荐失败，请重试' }, { status: 500 })
  }
}
