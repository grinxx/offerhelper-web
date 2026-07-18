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
