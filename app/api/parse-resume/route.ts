import { parseResume } from '@/lib/parse-resume'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return Response.json({ error: '未收到文件' }, { status: 400 })
  }

  try {
    const text = await parseResume(file)
    return Response.json({ text })
  } catch {
    return Response.json({ error: '文件解析失败，请尝试粘贴文本' }, { status: 422 })
  }
}
