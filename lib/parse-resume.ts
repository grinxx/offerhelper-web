import type { AIConfig } from '@/lib/ai-client'

// 简历常见章节标题关键词（长的在前，避免「专业技能」被「技能」抢先匹配）
const SECTION_KEYWORDS = [
  '项目实习经历', '个人资料', '个人信息', '基本信息',
  '教育背景', '教育经历', '专业技能', '技能特长',
  '项目经历', '实习经历', '工作经历', '实践经历',
  '荣誉奖项', '获奖经历', '荣誉证书', '奖学金',
  '自我评价', '个人评价', '求职意向',
]

// 联系方式脱敏：简历优化不需要，检测到手机号/邮箱直接替换为占位符
function stripSensitive(text: string): string {
  return text
    .replace(/1[3-9]\d{9}/g, '[电话]')
    .replace(/[\w.+-]+@[\w-]+\.[a-z]{2,}/gi, '[邮箱]')
}

// 判断一行是否是章节标题（必须整行就是关键词，避免正文误判）
function isSectionTitle(line: string): boolean {
  const trimmed = line.trim().replace(/[:：\s]/g, '')
  return SECTION_KEYWORDS.includes(trimmed)
}

// 用规则将简历原文格式化为 Markdown（不依赖 AI，快速、保真、免费）
function formatResumeByRules(rawText: string): string {
  const text = stripSensitive(rawText)

  // PDF 提取常是一整行，先做结构化换行；DOCX 已有换行也会再规整一遍
  let normalized = text
  // 只在「章节关键词作为独立标题出现」时换行：关键词后跟空格+另一个章节内容
  // 用边界标记：关键词前后是空格或行首行尾
  for (const kw of SECTION_KEYWORDS) {
    // 仅当关键词独立出现（前后有空格/边界）才当标题换行
    normalized = normalized.replace(new RegExp(`(^|\\s)(${kw})(\\s|$)`, 'g'), `\n$2\n`)
  }
  // 日期段（2024.09-至今 / 2020.10-2024.06）前换行
  normalized = normalized.replace(/\s(\d{4}\.\d{1,2})/g, '\n$1')
  // 列表符号 ❖ • · 前换行
  normalized = normalized.replace(/([❖•·])/g, '\n$1')

  const lines = normalized.split('\n').map(l => l.trim()).filter(Boolean)
  const out: string[] = []
  let sectionSeen = false

  for (const line of lines) {
    if (isSectionTitle(line)) {
      // 「奖学金」等词可能在正文出现，只有首次或明显独立时才当标题
      out.push('', `## ${line.replace(/[:：]/g, '')}`, '')
      sectionSeen = true
    } else if (/^[❖•·]/.test(line)) {
      out.push(`- ${line.replace(/^[❖•·]\s*/, '')}`)
    } else if (/^\d{4}\.\d{1,2}/.test(line)) {
      out.push(`- ${line}`)
    } else if (!sectionSeen && /^[一-龥A-Za-z]{1,6}[:：]/.test(line)) {
      // 个人资料区的 key：value（姓名：xxx 年龄：xxx 挤在一行时也拆开）
      const parts = line.split(/\s+(?=[一-龥A-Za-z]{1,6}[:：])/)
      for (const p of parts) {
        const m = p.match(/^([一-龥A-Za-z]{1,6})[:：](.*)$/)
        if (m) out.push(`- **${m[1].trim()}**：${m[2].trim()}`)
        else out.push(p)
      }
    } else {
      out.push(line)
    }
  }

  return out.join('\n')
    .replace(/^- *$/gm, '')      // 删掉空列表项
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function parseResume(file: File, formatWithAI = false, _aiConfig?: AIConfig): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer())
  let text = ''

  if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
    // 使用 pdfjs-serverless：专为 serverless 环境设计，无 canvas/native 依赖
    const { configureUnPDF, extractText } = await import('unpdf')
    await configureUnPDF({
      pdfjs: () => import('pdfjs-serverless'),
    })
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

  // 用规则格式化为 Markdown（不再调用 AI，避免慢、贵、截断、识别错误）
  if (formatWithAI && text) {
    return formatResumeByRules(text)
  }
  return text
}
