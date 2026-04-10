import { AgentActionContext } from '../ToolRegistry';
import { useCoreStore } from '../../../integration/store/coreStore';

export function readFile(
  agent: AgentActionContext,
  args: { path: string }
): boolean {
  const store = useCoreStore.getState();
  const content = store.virtualFiles[args.path];

  if (content === undefined) {
    const files = Object.keys(store.virtualFiles);
    agent.appendHistory({
      role: 'tool',
      content: JSON.stringify({
        error: `File not found: ${args.path}`,
        available_files: files.length > 0 ? files : 'No files in virtual filesystem.'
      }),
      name: 'read_file'
    });
  } else {
    store.addLogEntry({
      agentIndex: agent.data.index,
      action: `Read file: ${args.path}`,
    });

    agent.appendHistory({
      role: 'tool',
      content: JSON.stringify({ path: args.path, content }),
      name: 'read_file'
    });
  }

  return true;
}
