const SECTION_HEADERS = [
  '教育背景', '教育经历', '学历背景',
  '工作经历', '工作经验', '实习经历', '项目实习经历', '实习经验',
  '项目经历', '项目经验', '项目',
  '专业技能', '技能', '技术技能', '核心技能',
  '奖学金', '荣誉奖项', '获奖情况', '奖项',
  '社会活动', '学生工作', '社会活动和学生工作', '课外活动',
  '自我评价', '个人简介', '个人总结', '关于我',
  '证书', '资格证书', '语言能力',
  '科研经历', '论文发表',
]

// 把 PDF 解析出的单行文本按章节标题和日期条目切分为多行
function normalizeResumeText(raw: string): string {
  // 如果已经有换行符，只做轻量清理
  if (/\n/.test(raw)) {
    return raw.replace(/\n{3,}/g, '\n\n').trim()
  }

  // 构建章节标题正则：在标题前插入换行
  const headerPattern = new RegExp(
    `(${SECTION_HEADERS.map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
    'g'
  )

  // 在章节标题前插入双换行
  let text = raw.replace(headerPattern, '\n\n$1')

  // 在日期条目前插入换行（❖/◆/●/⚫ 开头，或 年份.月 格式独立出现）
  text = text.replace(/\s+(❖|◆|●|⚫|※|★)\s*/g, '\n$1 ')
  text = text.replace(/\s+(\d{4}[.\-/年]\d{1,2})/g, '\n$1')

  // 清理多余空行
  return text.replace(/\n{3,}/g, '\n\n').trim()
}

export async function parseResume(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer())

  if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
    const { extractText } = await import('unpdf')
    const { text } = await extractText(new Uint8Array(buffer), { mergePages: true })
    return normalizeResumeText(text.trim())
  }

  if (
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    file.name.endsWith('.docx')
  ) {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    return normalizeResumeText(result.value.trim())
  }

  return buffer.toString('utf-8').trim()
}
