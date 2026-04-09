import { LLMMessage } from '../llm/types';
import { setUserBrief } from './tools/setUserBrief';
import { proposeTask } from './tools/proposeTask';
import { completeTask } from './tools/completeTask';
import { deliverProject } from './tools/deliverProject';
import { createGithubRepo } from './tools/createGithubRepo';

export interface ToolCall {
  name: string;
  args: any;
}

/**
 * Interface that decuples the ToolRegistry from the 3D Simulation (AgentHost).
 * This allows the tool logic to be tested and used independently of the simulation.
 */
export interface AgentActionContext {
  data: { index: number; name: string, subagents?: any[], humanInTheLoop?: boolean };
  setState: (state: 'idle' | 'moving' | 'working' | 'on_hold' | 'talking') => void;
  appendHistory: (message: LLMMessage) => void;
}

export class ToolRegistry {
  /**
   * Processes a tool call by dispatching it to the appropriate tool handler.
   * Returns a promise so async tools (like create_github_repo) can be awaited.
   */
  public static async process(agent: AgentActionContext, toolCall: ToolCall): Promise<boolean> {
    const { name, args } = toolCall;

    switch (name) {
      case 'set_user_brief':
        return setUserBrief(agent, args);
      case 'propose_task':
        return proposeTask(agent, args);
      case 'complete_task':
        return completeTask(agent, args);
      case 'deliver_project':
        return deliverProject(agent, args);
      case 'create_github_repo':
        return await createGithubRepo(agent, args);
      default:
        console.warn(`[ToolRegistry] Unknown tool: ${name}`);
        return false;
    }
  }

  public static getDefinitions(
    agentIndex: number,
    phase: string,
    subagentsCount: number = 0,
    teamId?: string
  ): any[] {
    const isLead = agentIndex === 1;
    const isManager = subagentsCount > 0;
    const isEngineeringTeam = teamId === 'engineering-team';
    const tools: any[] = [];

    // 1. Idle Phase: Only Lead can set the brief
    if (phase === 'idle') {
      if (isLead) {
        tools.push({
          type: 'function',
          function: {
            name: 'set_user_brief',
            description: 'Start project with brief.',
            parameters: {
              type: 'object',
              properties: { brief: { type: 'string' } },
              required: ['brief']
            }
          }
        });
      }
      return tools;
    }

    // 2. Working Phase: Common tools for everyone
    if (phase === 'working') {
      if (isLead || isManager) {
        tools.push({
          type: 'function',
          function: {
            name: 'propose_task',
            description: 'Assign task to agent.',
            parameters: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                description: { type: 'string' },
                agentId: { type: 'integer', description: 'Agent index' },
                requiresApproval: { type: 'boolean' }
              },
              required: ['title', 'description', 'agentId']
            }
          }
        });
      }

      tools.push(
        {
          type: 'function',
          function: {
            name: 'complete_task',
            description: 'Finish task. Output must be raw content, no introductions or credit for the work.',
            parameters: {
              type: 'object',
              properties: {
                taskId: { type: 'string' },
                output: { type: 'string', description: 'Task result in Markdown (e.g. code blocks, text, or research).' }
              },
              required: ['taskId', 'output']
            }
          }
        },
      );

      if (isLead) {
        tools.push({
          type: 'function',
          function: {
            name: 'deliver_project',
            description: 'Final delivery of the full project results.',
            parameters: {
              type: 'object',
              properties: {
                output: {
                  type: 'string',
                  description: 'Full project document in Markdown. NO attribution needed.'
                }
              },
              required: ['output']
            }
          }
        });
      }

      // 3. Engineering Team only: create_github_repo (lead only)
      if (isLead && isEngineeringTeam) {
        tools.push({
          type: 'function',
          function: {
            name: 'create_github_repo',
            description: 'Create a real GitHub repository and push the project files. Use ONLY at the end of the project, AFTER all engineers have completed their tasks. Parse every code block from every completed task into the files array.',
            parameters: {
              type: 'object',
              properties: {
                repoName: {
                  type: 'string',
                  description: 'Repo name. Lowercase letters, digits, and hyphens only. No spaces.'
                },
                description: {
                  type: 'string',
                  description: 'Short one-line description of the project.'
                },
                isPrivate: {
                  type: 'boolean',
                  description: 'Whether the repo should be private. Defaults to false (public).'
                },
                files: {
                  type: 'array',
                  description: 'Every project file. Each file has a repo-relative path and full string contents. Always include README.md and .gitignore.',
                  items: {
                    type: 'object',
                    properties: {
                      path: {
                        type: 'string',
                        description: 'Repo-relative path with forward slashes, e.g. src/App.tsx or package.json.'
                      },
                      content: {
                        type: 'string',
                        description: 'Full file contents as a UTF-8 string.'
                      }
                    },
                    required: ['path', 'content']
                  }
                }
              },
              required: ['repoName', 'description', 'files']
            }
          }
        });
      }
    }

    return tools;
  }
}
