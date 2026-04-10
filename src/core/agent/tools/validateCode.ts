import { AgentActionContext } from '../ToolRegistry';
import { useCoreStore } from '../../../integration/store/coreStore';

interface ValidateCodeArgs {
  files: { path: string; content: string }[];
}

function validateInWorker(files: { path: string; content: string }[]): Promise<string> {
  return new Promise((resolve) => {
    const workerCode = `
      self.onmessage = function(e) {
        const files = e.data;
        const results = [];
        for (const f of files) {
          const ext = f.path.split('.').pop()?.toLowerCase() || '';
          try {
            if (['js', 'jsx', 'mjs', 'cjs'].includes(ext)) {
              new Function(f.content);
              results.push({ path: f.path, valid: true });
            } else if (ext === 'json') {
              JSON.parse(f.content);
              results.push({ path: f.path, valid: true });
            } else if (['ts', 'tsx'].includes(ext)) {
              results.push({ path: f.path, valid: true, skipped: true, note: 'TypeScript — syntax check not available in browser' });
            } else {
              results.push({ path: f.path, valid: true, skipped: true });
            }
          } catch (err) {
            results.push({ path: f.path, valid: false, error: err.message });
          }
        }
        self.postMessage(results);
      };
    `;

    try {
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      const worker = new Worker(url);

      const timeout = setTimeout(() => {
        worker.terminate();
        URL.revokeObjectURL(url);
        resolve(JSON.stringify({ error: 'Validation timed out (10s limit)' }));
      }, 10000);

      worker.onmessage = (e) => {
        clearTimeout(timeout);
        worker.terminate();
        URL.revokeObjectURL(url);
        resolve(JSON.stringify(e.data));
      };

      worker.onerror = (e) => {
        clearTimeout(timeout);
        worker.terminate();
        URL.revokeObjectURL(url);
        resolve(JSON.stringify({ error: e.message }));
      };

      worker.postMessage(files);
    } catch (e) {
      resolve(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }));
    }
  });
}

export async function validateCode(
  agent: AgentActionContext,
  args: ValidateCodeArgs
): Promise<boolean> {
  const store = useCoreStore.getState();

  if (!args?.files || args.files.length === 0) {
    agent.appendHistory({
      role: 'tool',
      content: JSON.stringify({ error: 'No files provided to validate.' }),
      name: 'validate_code'
    });
    return true;
  }

  store.addLogEntry({
    agentIndex: agent.data.index,
    action: `Validating ${args.files.length} file(s)...`,
  });

  const output = await validateInWorker(args.files);

  agent.appendHistory({
    role: 'tool',
    content: output,
    name: 'validate_code'
  });

  return true;
}
