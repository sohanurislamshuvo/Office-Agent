import { AgentActionContext } from '../ToolRegistry';
import { useCoreStore } from '../../../integration/store/coreStore';

const TIMEOUT_MS = 5000;

function executeInWorker(code: string): Promise<string> {
  return new Promise((resolve) => {
    const workerCode = `
      const logs = [];
      const console = {
        log: (...args) => logs.push(args.map(String).join(' ')),
        error: (...args) => logs.push('ERROR: ' + args.map(String).join(' ')),
        warn: (...args) => logs.push('WARN: ' + args.map(String).join(' ')),
        info: (...args) => logs.push(args.map(String).join(' ')),
      };
      try {
        const __result = (function() { ${code} })();
        const output = logs.join('\\n');
        const resultStr = __result !== undefined ? String(__result) : '';
        self.postMessage({ success: true, output, result: resultStr });
      } catch (e) {
        const output = logs.join('\\n');
        self.postMessage({ success: false, output, error: e.message || String(e) });
      }
    `;
    try {
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      const worker = new Worker(url);

      const timeout = setTimeout(() => {
        worker.terminate();
        URL.revokeObjectURL(url);
        resolve('Execution timed out (5s limit).');
      }, TIMEOUT_MS);

      worker.onmessage = (e) => {
        clearTimeout(timeout);
        worker.terminate();
        URL.revokeObjectURL(url);
        const { success, output, result, error } = e.data;
        const parts = [output, success ? result : `Error: ${error}`].filter(Boolean);
        resolve(parts.join('\n').trim() || '(no output)');
      };

      worker.onerror = (e) => {
        clearTimeout(timeout);
        worker.terminate();
        URL.revokeObjectURL(url);
        resolve(`Worker error: ${e.message}`);
      };
    } catch (e) {
      resolve(`Failed to create sandbox: ${e instanceof Error ? e.message : String(e)}`);
    }
  });
}

export async function runCode(
  agent: AgentActionContext,
  args: { code: string; language?: string }
): Promise<boolean> {
  const store = useCoreStore.getState();

  if (args.language && args.language !== 'javascript' && args.language !== 'js') {
    agent.appendHistory({
      role: 'tool',
      content: JSON.stringify({ error: `Only JavaScript is supported for code execution. Got: ${args.language}` }),
      name: 'run_code'
    });
    return true;
  }

  store.addLogEntry({
    agentIndex: agent.data.index,
    action: `Running code (${args.code.length} chars)`,
  });

  const output = await executeInWorker(args.code);

  agent.appendHistory({
    role: 'tool',
    content: JSON.stringify({ output }),
    name: 'run_code'
  });

  return true;
}
