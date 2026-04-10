import { AgentActionContext } from '../ToolRegistry';
import { useCoreStore } from '../../../integration/store/coreStore';

export function writeFile(
  agent: AgentActionContext,
  args: { path: string; content: string }
): boolean {
  const store = useCoreStore.getState();
  const isNew = store.virtualFiles[args.path] === undefined;

  store.setVirtualFile(args.path, args.content);

  store.addLogEntry({
    agentIndex: agent.data.index,
    action: `${isNew ? 'Created' : 'Updated'} file: ${args.path}`,
  });

  agent.appendHistory({
    role: 'tool',
    content: JSON.stringify({
      success: true,
      path: args.path,
      action: isNew ? 'created' : 'updated',
      size: args.content.length,
    }),
    name: 'write_file'
  });

  return true;
}
