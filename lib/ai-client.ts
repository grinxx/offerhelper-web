import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { decrypt } from '@/lib/crypto'
export { PROVIDERS } from '@/lib/ai-providers'

export interface AIConfig {
  baseURL: string
  apiKey: string
  modelFast: string
  modelSmart: string
  isAnthropic: boolean
}

const rawBase = process.env.ANTHROPIC_BASE_URL ?? ''
const isLocal = rawBase.includes('localhost')

const DEFAULT_CONFIG: AIConfig = {
  baseURL: rawBase || 'https://api.siliconflow.cn/v1',
  apiKey: process.env.ANTHROPIC_API_KEY || '',
  modelFast: isLocal ? 'claude-haiku-4-5-20251001' : 'deepseek-ai/DeepSeek-V3',
  modelSmart: isLocal ? 'claude-sonnet-4-6' : 'deepseek-ai/DeepSeek-V3',
  isAnthropic: isLocal,
}

export async function getAIConfig(userId: string | null): Promise<AIConfig> {
  if (!userId || isLocal) return DEFAULT_CONFIG

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
        apiKey: decrypt(data.ai_api_key) || data.ai_api_key, // 兼容旧的明文 Key
        modelFast: data.ai_model_fast,
        modelSmart: data.ai_model_smart,
        isAnthropic: false,
      }
    }
  } catch {}

  return DEFAULT_CONFIG
}

export async function getAIClientForRequest(userId?: string | null): Promise<{ config: AIConfig; chat: ChatClient }> {
  let resolvedUserId = userId
  if (resolvedUserId === undefined) {
    const sessionSupabase = await createClient()
    const { data: { user } } = await sessionSupabase.auth.getUser()
    resolvedUserId = user?.id ?? null
  }
  const config = await getAIConfig(resolvedUserId)
  const chat = config.isAnthropic ? new AnthropicChatClient(config) : new OpenAIChatClient(config)
  return { config, chat }
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface StreamChunk {
  text: string
}

export interface ChatClient {
  complete(messages: ChatMessage[], model: string, maxTokens: number): Promise<string>
  stream(messages: ChatMessage[], model: string, maxTokens: number): AsyncIterable<StreamChunk>
}

class OpenAIChatClient implements ChatClient {
  private client: OpenAI
  constructor(config: AIConfig) {
    this.client = new OpenAI({ baseURL: config.baseURL, apiKey: config.apiKey })
  }

  async complete(messages: ChatMessage[], model: string, maxTokens: number): Promise<string> {
    const res = await this.client.chat.completions.create({ model, max_tokens: maxTokens, messages })
    return res.choices[0]?.message?.content ?? ''
  }

  async *stream(messages: ChatMessage[], model: string, maxTokens: number): AsyncIterable<StreamChunk> {
    const res = await this.client.chat.completions.create({ model, max_tokens: maxTokens, messages, stream: true })
    for await (const chunk of res) {
      const text = chunk.choices[0]?.delta?.content ?? ''
      if (text) yield { text }
    }
  }
}

class AnthropicChatClient implements ChatClient {
  private client: Anthropic
  constructor(config: AIConfig) {
    this.client = new Anthropic({ baseURL: config.baseURL, apiKey: config.apiKey })
  }

  async complete(messages: ChatMessage[], model: string, maxTokens: number): Promise<string> {
    const system = messages.find(m => m.role === 'system')?.content
    const rest = messages.filter(m => m.role !== 'system').map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))
    const res = await this.client.messages.create({ model, max_tokens: maxTokens, system, messages: rest })
    return res.content[0]?.type === 'text' ? res.content[0].text : ''
  }

  async *stream(messages: ChatMessage[], model: string, maxTokens: number): AsyncIterable<StreamChunk> {
    const system = messages.find(m => m.role === 'system')?.content
    const rest = messages.filter(m => m.role !== 'system').map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))
    const res = await this.client.messages.create({ model, max_tokens: maxTokens, system, messages: rest, stream: true })
    for await (const event of res) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield { text: event.delta.text }
      }
    }
  }
}
