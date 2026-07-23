import { parseResume } from '@/lib/parse-resume'
import { checkAndRecordUsage } from '@/lib/usage'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const usage = await checkAndRecordUsage('parse_resume')
  if (!usage.allowed) {
    return Response.json({ error: usage.limitMessage }, { status: 429 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return Response.json({ error: '未收到文件' }, { status: 400 })
  }

  const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  const allowedExts = ['.pdf', '.docx']
  const ext = '.' + file.name.split('.').pop()?.toLowerCase()
  if (!allowedTypes.includes(file.type) && !allowedExts.includes(ext)) {
    return Response.json({ error: '仅支持 PDF 和 DOCX 格式' }, { status: 400 })
  }

  try {
    const text = await parseResume(file, true)
    return Response.json({ text })
  } catch {
    return Response.json({ error: '文件解析失败，请尝试粘贴文本' }, { status: 422 })
  }
}
