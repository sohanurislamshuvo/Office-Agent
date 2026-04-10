import { LLMProviderType } from './types';

export const DEFAULT_MODELS = {
  text: 'gemini-3-flash-preview',
  image: 'gemini-3.1-flash-image-preview',
  music: 'lyria-3-clip-preview',
  video: 'veo-3.1-lite-generate-preview'
} as const;

export const AVAILABLE_MODELS = {
  text: [
    'gemini-3-flash-preview',
    'gemini-3.1-pro-preview',
    'gemini-3.1-flash-lite-preview'
  ],
  image: [
    'gemini-3.1-flash-image-preview',
    'gemini-3-pro-image-preview',
    'gemini-2.5-flash-image'
  ],
  music: [
    'lyria-3-clip-preview',
    'lyria-3-pro-preview'
  ],
  video: [
    'veo-3.1-lite-generate-preview',
    'veo-3.1-fast-generate-preview',
    'veo-3.1-generate-preview'
  ]
} as const;

export type ModelType = keyof typeof AVAILABLE_MODELS;

export const DEFAULT_PROVIDER: LLMProviderType = 'gemini';

export const PROVIDER_TEXT_MODELS: Record<LLMProviderType, string[]> = {
  gemini: [
    'gemini-3-flash-preview',
    'gemini-3.1-pro-preview',
    'gemini-3.1-flash-lite-preview',
  ],
  openai: [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4.1',
    'gpt-4.1-mini',
    'o4-mini',
  ],
  anthropic: [
    'claude-sonnet-4-20250514',
    'claude-haiku-4-20250414',
  ],
};

export const ALL_TEXT_MODELS: string[] = Object.values(PROVIDER_TEXT_MODELS).flat();

export const PROVIDER_LABELS: Record<LLMProviderType, string> = {
  gemini: 'Google Gemini',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
};

export function getProviderForModel(modelName: string): LLMProviderType {
  for (const [provider, models] of Object.entries(PROVIDER_TEXT_MODELS)) {
    if (models.includes(modelName)) return provider as LLMProviderType;
  }
  return 'gemini';
}
