import { LLMProvider, LLMProviderType } from '../types';
import { GeminiProvider } from './GeminiProvider';
import { OpenAIProvider } from './OpenAIProvider';
import { AnthropicProvider } from './AnthropicProvider';

export function createProvider(type: LLMProviderType, apiKey: string): LLMProvider {
  switch (type) {
    case 'openai':
      return new OpenAIProvider(apiKey);
    case 'anthropic':
      return new AnthropicProvider(apiKey);
    case 'gemini':
    default:
      return new GeminiProvider(apiKey);
  }
}

export { GeminiProvider, OpenAIProvider, AnthropicProvider };
