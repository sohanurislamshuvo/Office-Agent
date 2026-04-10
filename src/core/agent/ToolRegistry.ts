import { LLMMessage } from '../llm/types';
import { setUserBrief } from './tools/setUserBrief';
import { proposeTask } from './tools/proposeTask';
import { completeTask } from './tools/completeTask';
import { deliverProject } from './tools/deliverProject';
import { createGithubRepo } from './tools/createGithubRepo';
import { webSearch } from './tools/webSearch';
import { readFile } from './tools/readFile';
import { writeFile } from './tools/writeFile';
import { runCode } from './tools/runCode';
import { callApi } from './tools/callApi';
import { agentChat } from './tools/agentChat';
import { createSubtask } from './tools/createSubtask';

export interface ToolCall {
  name: string;
  args: any;
}

/**
 * Interface that decouples the ToolRegistry from the 3D Simulation (AgentHost).
 * This allows the tool logic to be tested and used independently of the simulation.
 */
export interface AgentActionContext {
  data: { index: number; name: string, subagents?: any[], humanInTheLoop?: boolean, provider?: string, model?: string, description?: string };
  setState: (state: 'idle' | 'moving' | 'working' | 'on_hold' | 'talking') => void;
  appendHistory: (message: LLMMessage) => void;
  simulation?: {
    getAllAgents: () => any[];
  };
}

export class ToolRegistry {
  /**
   * Processes a tool call by dispatching it to the appropriate tool handler.
   * Returns a promise so async tools can be awaited.
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
      case 'web_search':
        return await webSearch(agent, args);
      case 'read_file':
        return readFile(agent, args);
      case 'write_file':
        return writeFile(agent, args);
      case 'run_code':
        return await runCode(agent, args);
      case 'call_api':
        return await callApi(agent, args);
      case 'agent_to_agent_chat':
        return await agentChat(agent, args);
      case 'create_subtask':
        return createSubtask(agent, args);
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

      // Engineering Team only: create_github_repo (lead only)
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

      // ── New Tools (available to all agents in working phase) ──

      tools.push({
        type: 'function',
        function: {
          name: 'web_search',
          description: 'Search the web for information. Uses Google Search via Gemini. Returns relevant results as text.',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'The search query.' }
            },
            required: ['query']
          }
        }
      });

      tools.push({
        type: 'function',
        function: {
          name: 'read_file',
          description: 'Read a file from the virtual project filesystem.',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'File path, e.g. src/index.ts' }
            },
            required: ['path']
          }
        }
      });

      tools.push({
        type: 'function',
        function: {
          name: 'write_file',
          description: 'Write or update a file in the virtual project filesystem.',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'File path, e.g. src/index.ts' },
              content: { type: 'string', description: 'Full file contents.' }
            },
            required: ['path', 'content']
          }
        }
      });

      tools.push({
        type: 'function',
        function: {
          name: 'run_code',
          description: 'Execute JavaScript code in a sandboxed environment. Returns console output and the return value. 5-second timeout.',
          parameters: {
            type: 'object',
            properties: {
              code: { type: 'string', description: 'JavaScript code to execute.' },
              language: { type: 'string', description: 'Programming language. Only "javascript" is supported.' }
            },
            required: ['code']
          }
        }
      });

      tools.push({
        type: 'function',
        function: {
          name: 'call_api',
          description: 'Make an HTTP request to an external API. Returns the response status and body. 15-second timeout.',
          parameters: {
            type: 'object',
            properties: {
              url: { type: 'string', description: 'The full URL to request.' },
              method: { type: 'string', description: 'HTTP method: GET, POST, PUT, DELETE, PATCH. Defaults to GET.' },
              headers: {
                type: 'object',
                description: 'Request headers as key-value pairs.'
              },
              body: { type: 'string', description: 'Request body (for POST/PUT/PATCH). Send JSON as a string.' }
            },
            required: ['url']
          }
        }
      });

      tools.push({
        type: 'function',
        function: {
          name: 'agent_to_agent_chat',
          description: 'Send a direct message to another agent and get their response. Useful for collaboration, asking questions, or requesting input from a teammate.',
          parameters: {
            type: 'object',
            properties: {
              agentId: { type: 'integer', description: 'Target agent index.' },
              message: { type: 'string', description: 'The message to send.' }
            },
            required: ['agentId', 'message']
          }
        }
      });

      tools.push({
        type: 'function',
        function: {
          name: 'create_subtask',
          description: 'Break your current work into a smaller subtask assigned to yourself. Useful for decomposing complex work.',
          parameters: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Subtask title.' },
              description: { type: 'string', description: 'What needs to be done.' }
            },
            required: ['title', 'description']
          }
        }
      });
    }

    return tools;
  }
}
