import { AgentActionContext } from '../ToolRegistry';
import { useCoreStore } from '../../../integration/store/coreStore';

export function createSubtask(
  agent: AgentActionContext,
  args: { title: string; description: string }
): boolean {
  const store = useCoreStore.getState();

  const task = store.addTask({
    title: args.title,
    description: args.description,
    assignedAgentId: agent.data.index,
    status: 'scheduled',
    requiresUserApproval: false,
  });

  store.addLogEntry({
    agentIndex: agent.data.index,
    action: `Created subtask: "${args.title}" (self-assigned)`,
    taskId: task.id,
  });

  agent.appendHistory({
    role: 'tool',
    content: JSON.stringify({
      success: true,
      taskId: task.id,
      title: args.title,
      assignedTo: agent.data.name,
    }),
    name: 'create_subtask'
  });

  return true;
}
