import { AgentActionContext } from '../ToolRegistry';
import { useCoreStore } from '../../../integration/store/coreStore';
import { createProvider } from '../../llm/providers';
import { PromptBuilder } from '../PromptBuilder';
import { DEFAULT_PROVIDER } from '../../llm/constants';
import { useUiStore } from '../../../integration/store/uiStore';
import { LLMProviderType } from '../../llm/types';

export async function agentChat(
  agent: AgentActionContext,
  args: { agentId: number; message: string }
): Promise<boolean> {
  const store = useCoreStore.getState();

  if (args.agentId === agent.data.index) {
    agent.appendHistory({
      role: 'tool',
      content: JSON.stringify({ error: 'Cannot send a message to yourself.' }),
      name: 'agent_to_agent_chat'
    });
    return true;
  }

  if (args.agentId === 0) {
    agent.appendHistory({
      role: 'tool',
      content: JSON.stringify({ error: 'Cannot send a message to the user. Use chat for that.' }),
      name: 'agent_to_agent_chat'
    });
    return true;
  }

  // Find target agent via simulation
  const allAgents = agent.simulation?.getAllAgents() || [];
  const targetHost = allAgents.find((a: any) => a.data.index === args.agentId);

  if (!targetHost) {
    agent.appendHistory({
      role: 'tool',
      content: JSON.stringify({ error: `Agent ${args.agentId} not found.` }),
      name: 'agent_to_agent_chat'
    });
    return true;
  }

  // Check if target is busy
  if (targetHost.isThinking) {
    agent.appendHistory({
      role: 'tool',
      content: JSON.stringify({ error: `Agent ${targetHost.data.name} is currently busy. Try again later.` }),
      name: 'agent_to_agent_chat'
    });
    return true;
  }

  store.addLogEntry({
    agentIndex: agent.data.index,
    action: `Chat with ${targetHost.data.name}: "${args.message.slice(0, 50)}${args.message.length > 50 ? '...' : ''}"`,
  });

  try {
    // Make a single LLM call using the target agent's persona (no tools to prevent recursion)
    const llmConfig = useUiStore.getState().llmConfig;
    const targetProvider: LLMProviderType = targetHost.data.provider || DEFAULT_PROVIDER;
    const providerKey = llmConfig.providerKeys?.[targetProvider] || (targetProvider === 'gemini' ? llmConfig.apiKey : undefined);

    if (!providerKey) {
      agent.appendHistory({
        role: 'tool',
        content: JSON.stringify({ error: `No API key configured for ${targetProvider}. Cannot reach ${targetHost.data.name}.` }),
        name: 'agent_to_agent_chat'
      });
      return true;
    }

    const provider = createProvider(targetProvider, providerKey);
    const model = targetHost.data.model || llmConfig.model;
    const systemPrompt = PromptBuilder.buildSystemPrompt(
      targetHost.data,
      store.phase,
      store.userBrief,
      allAgents
    );

    const messages = [
      { role: 'user' as const, content: `Message from ${agent.data.name}: ${args.message}` }
    ];

    // No tools — single response, no recursion risk
    const response = await provider.generateCompletion(messages, undefined, systemPrompt, model);
    const reply = response.content || '(no response)';

    agent.appendHistory({
      role: 'tool',
      content: JSON.stringify({ from: targetHost.data.name, reply }),
      name: 'agent_to_agent_chat'
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    agent.appendHistory({
      role: 'tool',
      content: JSON.stringify({ error: `Failed to reach ${targetHost.data.name}: ${errMsg}` }),
      name: 'agent_to_agent_chat'
    });
  }

  return true;
}
