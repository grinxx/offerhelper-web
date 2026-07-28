export const runtime = 'nodejs'

async function getBaiduAccessToken(): Promise<string> {
  const res = await fetch(
    `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${process.env.BAIDU_OCR_API_KEY}&client_secret=${process.env.BAIDU_OCR_SECRET_KEY}`,
    { method: 'POST' }
  )
  const data = await res.json()
  if (!data.access_token) throw new Error('获取百度 token 失败')
  return data.access_token
}

export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get('image') as File | null

  if (!file) {
    return Response.json({ error: '未收到图片' }, { status: 400 })
  }

  const MAX_SIZE = 4 * 1024 * 1024 // 百度 OCR 限制 4MB
  if (file.size > MAX_SIZE) {
    return Response.json({ error: '图片大小不能超过 4MB' }, { status: 400 })
  }

  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/bmp', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    return Response.json({ error: '仅支持 JPG、PNG、BMP、WebP 格式' }, { status: 400 })
  }

  try {
    const accessToken = await getBaiduAccessToken()

    // 转 base64
    const buffer = await file.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')

    const ocrRes = await fetch(
      `https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic?access_token=${accessToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `image=${encodeURIComponent(base64)}`,
      }
    )

    const ocrData = await ocrRes.json()

    if (ocrData.error_code) {
      return Response.json({ error: `OCR 识别失败：${ocrData.error_msg}` }, { status: 500 })
    }

    const text = (ocrData.words_result as Array<{ words: string }>)
      ?.map(item => item.words)
      .join('\n') ?? ''

    if (!text.trim()) {
      return Response.json({ error: '未能识别出文字，请确保图片清晰' }, { status: 400 })
    }

    return Response.json({ text })
  } catch (e) {
    return Response.json({ error: 'OCR 服务暂时不可用，请稍后重试' }, { status: 500 })
  }
}
