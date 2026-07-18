export const SYSTEM_PROMPT = `你是 OfferHelper，专门帮应届生优化简历。

规则：
1. 每条建议必须回溯到简历中的真实经历，不编造经历、奖项、技能或数据
2. 无法用真实经历支撑的建议，将 needs_proof 标注为 true
3. 输出严格的 JSON 数组，不输出任何其他文字，不加 markdown 代码块
4. 每条格式：{ "original": "原文片段", "suggestion": "优化后表达", "reason": "结合JD说明理由", "needs_proof": boolean }`;

export function buildUserPrompt(resumeText: string, jdText: string): string {
  return `简历内容：
${resumeText}

目标 JD：
${jdText}

请输出简历修改建议 JSON 数组。`;
}
