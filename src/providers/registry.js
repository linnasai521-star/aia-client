import { OpenAIProvider } from './openai.js';
import { ClaudeProvider } from './claude.js';
import { GeminiProvider } from './gemini.js';
import { DeepSeekProvider } from './deepseek.js';
import { OpenRouterProvider } from './openrouter.js';
import { BaseProvider } from './baseProvider.js';

const PROVIDERS = {
  openai: OpenAIProvider,
  claude: ClaudeProvider,
  gemini: GeminiProvider,
  deepseek: DeepSeekProvider,
  openrouter: OpenRouterProvider,
  siliconflow: BaseProvider,
  custom: BaseProvider,
};

export const PRESETS = {
  openai:      { name: 'OpenAI',      apiUrl: 'https://api.openai.com',       model: 'gpt-4o' },
  claude:      { name: 'Claude',      apiUrl: 'https://api.anthropic.com',    model: 'claude-3-5-sonnet-20241022' },
  gemini:      { name: 'Gemini',      apiUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.0-flash' },
  deepseek:    { name: 'DeepSeek',    apiUrl: 'https://api.deepseek.com',    model: 'deepseek-chat' },
  openrouter:  { name: 'OpenRouter',  apiUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o' },
  siliconflow: { name: 'SiliconFlow', apiUrl: 'https://api.siliconflow.cn/v1', model: 'deepseek-ai/DeepSeek-V3' },
  custom:      { name: '自定义 OpenAI Compatible', apiUrl: '', model: '' },
};

export function createProvider(type, cfg) {
  const Cls = PROVIDERS[type] || PROVIDERS.custom;
  return new Cls(cfg);
}

export function getProviderList() {
  return Object.entries(PRESETS).map(([id, p]) => ({ id, ...p }));
}
