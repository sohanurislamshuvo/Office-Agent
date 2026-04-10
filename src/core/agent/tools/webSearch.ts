import { GoogleGenAI } from '@google/genai';
import { AgentActionContext } from '../ToolRegistry';
import { useCoreStore } from '../../../integration/store/coreStore';
import { useUiStore } from '../../../integration/store/uiStore';
import { DEFAULT_MODELS } from '../../llm/constants';

export async function webSearch(
  agent: AgentActionContext,
  args: { query: string }
): Promise<boolean> {
  const store = useCoreStore.getState();
  const llmConfig = useUiStore.getState().llmConfig;
  const apiKey = llmConfig.providerKeys?.gemini || llmConfig.apiKey;

  if (!apiKey) {
    agent.appendHistory({
      role: 'tool',
      content: JSON.stringify({ error: 'Gemini API key is required for web search. Please configure it in the API Keys modal.' }),
      name: 'web_search'
    });
    return true;
  }

  try {
    const client = new GoogleGenAI({ apiKey });
    const result = await client.models.generateContent({
      model: DEFAULT_MODELS.text,
      contents: args.query,
      config: {
        tools: [{ googleSearch: {} }],
      } as any,
    });

    const parts = result.candidates?.[0]?.content?.parts || [];
    const text = parts.map((p: any) => p.text).filter(Boolean).join('\n') || 'No results found.';

    store.addLogEntry({
      agentIndex: agent.data.index,
      action: `Web search: "${args.query.slice(0, 60)}${args.query.length > 60 ? '...' : ''}"`,
    });

    agent.appendHistory({
      role: 'tool',
      content: JSON.stringify({ results: text }),
      name: 'web_search'
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    agent.appendHistory({
      role: 'tool',
      content: JSON.stringify({ error: `Web search failed: ${errMsg}` }),
      name: 'web_search'
    });
  }

  return true;
}
