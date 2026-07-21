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
