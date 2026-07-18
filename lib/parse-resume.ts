export async function parseResume(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer())

  if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
    const { PDFParse } = await import('pdf-parse')
    const parser = new PDFParse({ data: new Uint8Array(buffer) })
    const result = await parser.getText()
    return result.text.trim()
  }

  if (
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    file.name.endsWith('.docx')
  ) {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    return result.value.trim()
  }

  // 纯文本或其他格式直接读
  return buffer.toString('utf-8').trim()
}
