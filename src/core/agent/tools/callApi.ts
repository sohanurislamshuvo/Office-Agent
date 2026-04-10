import { AgentActionContext } from '../ToolRegistry';
import { useCoreStore } from '../../../integration/store/coreStore';

const TIMEOUT_MS = 15000;
const MAX_RESPONSE_SIZE = 50000;

export async function callApi(
  agent: AgentActionContext,
  args: { url: string; method?: string; headers?: Record<string, string>; body?: string }
): Promise<boolean> {
  const store = useCoreStore.getState();
  const method = (args.method || 'GET').toUpperCase();

  store.addLogEntry({
    agentIndex: agent.data.index,
    action: `API ${method} ${args.url.slice(0, 80)}`,
  });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const fetchOptions: RequestInit = {
      method,
      headers: args.headers || {},
      signal: controller.signal,
    };

    if (args.body && method !== 'GET' && method !== 'HEAD') {
      fetchOptions.body = args.body;
    }

    const response = await fetch(args.url, fetchOptions);
    clearTimeout(timeout);

    let responseBody = await response.text();
    if (responseBody.length > MAX_RESPONSE_SIZE) {
      responseBody = responseBody.slice(0, MAX_RESPONSE_SIZE) + '\n...(truncated)';
    }

    agent.appendHistory({
      role: 'tool',
      content: JSON.stringify({
        status: response.status,
        statusText: response.statusText,
        body: responseBody,
      }),
      name: 'call_api'
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    agent.appendHistory({
      role: 'tool',
      content: JSON.stringify({
        error: errMsg.includes('abort') ? `Request timed out (${TIMEOUT_MS / 1000}s limit)` : errMsg,
      }),
      name: 'call_api'
    });
  }

  return true;
}
