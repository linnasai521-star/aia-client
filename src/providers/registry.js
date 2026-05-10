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
};

export const PRESETS = {
  openai:      { name: 'OpenAI',      apiUrl: 'https://api.openai.com',            model: 'gpt-4o' },
  claude:      { name: 'Claude',      apiUrl: 'https://api.anthropic.com',          model: 'claude-3-sonnet-20240229' },
  gemini:      { name: 'Gemini',      apiUrl: 'https://generativelanguage.googleapis.com', model: 'gemini-pro' },
  deepseek:    { name: 'DeepSeek',    apiUrl: 'https://api.deepseek.com',           model: 'deepseek-chat' },
  openrouter:  { name: 'OpenRouter',  apiUrl: 'https://openrouter.ai/api',          model: 'openai/gpt-4o' },
  siliconflow: { name: 'SiliconFlow', apiUrl: 'https://api.siliconflow.cn',         model: 'deepseek-ai/DeepSeek-V3' },
};

export function createProvider(type, cfg) {
  const Cls = PROVIDERS[type] || BaseProvider;
  return new Cls(cfg);
}

export function getProviderList() {
  return Object.entries(PRESETS).map(([id, p]) => ({ id, ...p }));
}