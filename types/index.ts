export interface Suggestion {
  original: string
  suggestion: string
  reason: string
  needs_proof: boolean
}

export interface Case {
  id: string
  user_id: string | null
  resume_text: string
  jd_text: string
  result_json: Suggestion[]
  status: 'pending' | 'done' | 'error'
  created_at: string
  version_label?: string | null
}

export interface InterviewScores {
  structure: number
  evidence: number
  relevance: number
}

export interface InterviewTurn {
  id: string
  session_id: string
  question_index: number
  question: string
  user_answer: string
  scores: InterviewScores
  feedback: string
  reference_answer: string
  created_at: string
}

export interface InterviewSession {
  id: string
  user_id: string
  case_id: string | null
  jd_text: string
  questions: string[]
  status: 'active' | 'done'
  created_at: string
}

export interface StrengthItem {
  label: string
  evidence: string
}

export interface StrengthsResult {
  strengths: StrengthItem[]
  summary: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface StrengthSession {
  id: string
  user_id: string | null
  jd_text: string | null
  messages: ChatMessage[]
  result: StrengthsResult | null
  status: 'active' | 'done'
  created_at: string
}

export interface JdItem {
  title?: string
  content: string
}

export interface MatchResult {
  jd_index: number
  score: number
  level: '强烈推荐' | '可以投' | '不建议'
  reason: string
  strengths: string[]
  gaps: string[]
}

export interface MatchSession {
  id: string
  user_id: string | null
  resume_text: string
  jd_list: JdItem[]
  results: MatchResult[]
  summary: string | null
  status: 'active' | 'done'
  created_at: string
}
