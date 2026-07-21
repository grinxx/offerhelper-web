import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export interface AIConfig {
  baseURL: string
  apiKey: string
  modelFast: string
  modelSmart: string
}

export const PROVIDERS = [
  {
    id: 'siliconflow',
    label: '硅基流动',
    baseURL: 'https://api.siliconflow.cn/v1',
    models: [
      { id: 'Pro/claude-sonnet-4-5', label: 'Claude Sonnet 4.5（推荐）' },
      { id: 'Pro/claude-haiku-4-5', label: 'Claude Haiku 4.5（快速）' },
      { id: 'deepseek-ai/DeepSeek-V3', label: 'DeepSeek V3' },
      { id: 'Qwen/Qwen2.5-72B-Instruct', label: 'Qwen2.5 72B' },
      { id: 'Qwen/Qwen2.5-7B-Instruct', label: 'Qwen2.5 7B（快速）' },
    ],
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    baseURL: 'https://api.deepseek.com/v1',
    models: [
      { id: 'deepseek-chat', label: 'DeepSeek Chat（推荐）' },
      { id: 'deepseek-reasoner', label: 'DeepSeek Reasoner' },
    ],
  },
  {
    id: 'aliyun',
    label: '阿里云百炼',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: [
      { id: 'qwen-max', label: 'Qwen Max（推荐）' },
      { id: 'qwen-plus', label: 'Qwen Plus' },
      { id: 'qwen-turbo', label: 'Qwen Turbo（快速）' },
    ],
  },
  {
    id: 'custom',
    label: '自定义',
    baseURL: '',
    models: [],
  },
]

const DEFAULT_CONFIG: AIConfig = {
  baseURL: process.env.ANTHROPIC_BASE_URL?.replace('/anthropic/', '') || 'https://api.siliconflow.cn/v1',
  apiKey: process.env.ANTHROPIC_API_KEY || '',
  modelFast: 'Qwen/Qwen2.5-7B-Instruct',
  modelSmart: 'Pro/claude-sonnet-4-5',
}

export async function getAIConfig(userId: string | null): Promise<AIConfig> {
  if (!userId) return DEFAULT_CONFIG

  try {
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data } = await supabase
      .from('user_settings')
      .select('ai_base_url, ai_api_key, ai_model_fast, ai_model_smart')
      .eq('user_id', userId)
      .single()

    if (data?.ai_api_key) {
      return {
        baseURL: data.ai_base_url,
        apiKey: data.ai_api_key,
        modelFast: data.ai_model_fast,
        modelSmart: data.ai_model_smart,
      }
    }
  } catch {}

  return DEFAULT_CONFIG
}

export function createAIClient(config: AIConfig): OpenAI {
  return new OpenAI({
    baseURL: config.baseURL,
    apiKey: config.apiKey,
  })
}

export async function getAIClientForRequest(): Promise<{ client: OpenAI; config: AIConfig }> {
  const sessionSupabase = await createClient()
  const { data: { user } } = await sessionSupabase.auth.getUser()
  const config = await getAIConfig(user?.id ?? null)
  const client = createAIClient(config)
  return { client, config }
}
