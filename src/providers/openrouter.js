import { BaseProvider } from './baseProvider.js';

export class OpenRouterProvider extends BaseProvider {
  name = 'openrouter';
  _headers() {
    return {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + this.key,
      'HTTP-Referer': 'https://ai-aggregator.local',
      'X-Title': 'AI Aggregator',
    };
  }
}