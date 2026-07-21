import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'

async function formatResumeWithAI(rawText: string): Promise<string> {
  const rawBase = process.env.ANTHROPIC_BASE_URL ?? ''
  const isLocal = rawBase.includes('localhost')
  const apiKey = process.env.ANTHROPIC_API_KEY || ''

  const prompt = `将以下简历原始文本整理成结构清晰的 Markdown 格式。

要求：
- 用 ## 标记主要章节（如教育背景、工作经历、专业技能等）
- 用 **加粗** 标记公司名、学校名、职位名
- 用 - 列表展示技能、职责、成就
- 保留所有原始内容，不增删，不改写
- 只输出 Markdown，不加任何说明

简历原文：
${rawText}`

  try {
    if (isLocal) {
      const client = new Anthropic({ baseURL: rawBase, apiKey })
      const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      })
      const text = message.content[0]?.type === 'text' ? message.content[0].text : rawText
      return text.trim()
    } else {
      const client = new OpenAI({ baseURL: 'https://api.siliconflow.cn/v1', apiKey })
      const message = await client.chat.completions.create({
        model: 'Qwen/Qwen2.5-7B-Instruct',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      })
      return (message.choices[0]?.message?.content ?? rawText).trim()
    }
  } catch {
    return rawText
  }
}

export async function parseResume(file: File, formatWithAI = false): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer())
  let text = ''

  if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
    const { extractText } = await import('unpdf')
    const { text: extracted } = await extractText(new Uint8Array(buffer), { mergePages: true })
    text = extracted.trim()
  } else if (
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    file.name.endsWith('.docx')
  ) {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    text = result.value.trim()
  } else {
    text = buffer.toString('utf-8').trim()
  }

  if (formatWithAI && text) {
    return formatResumeWithAI(text)
  }
  return text
}
