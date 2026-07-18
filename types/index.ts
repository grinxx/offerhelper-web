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
