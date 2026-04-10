import { AgentActionContext } from '../ToolRegistry';
import { useCoreStore } from '../../../integration/store/coreStore';
import { useUiStore } from '../../../integration/store/uiStore';

export async function checkBuild(
  agent: AgentActionContext,
  _args: Record<string, unknown>
): Promise<boolean> {
  const core = useCoreStore.getState();
  const ui = useUiStore.getState();

  if (!core.githubRepo) {
    agent.appendHistory({
      role: 'tool',
      content: JSON.stringify({ error: 'No repository info found. Create a repo first.' }),
      name: 'check_build'
    });
    return true;
  }

  const pat = ui.githubConfig?.pat?.trim();
  if (!pat) {
    agent.appendHistory({
      role: 'tool',
      content: JSON.stringify({ error: 'No GitHub PAT configured.' }),
      name: 'check_build'
    });
    return true;
  }

  const { owner, repo } = core.githubRepo;

  core.addLogEntry({
    agentIndex: agent.data.index,
    action: `Checking build status for ${owner}/${repo}...`,
  });

  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/runs?per_page=1`,
      {
        headers: {
          'Authorization': `Bearer ${pat}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    );

    if (!res.ok) {
      agent.appendHistory({
        role: 'tool',
        content: JSON.stringify({ error: `GitHub API returned ${res.status} ${res.statusText}` }),
        name: 'check_build'
      });
      return true;
    }

    const data = await res.json();

    if (!data.workflow_runs || data.workflow_runs.length === 0) {
      agent.appendHistory({
        role: 'tool',
        content: JSON.stringify({
          status: 'no_workflows',
          message: 'No GitHub Actions workflow runs found. The repo may not have CI/CD configured. Consider this a pass and proceed to deliver.'
        }),
        name: 'check_build'
      });
      return true;
    }

    const run = data.workflow_runs[0];

    agent.appendHistory({
      role: 'tool',
      content: JSON.stringify({
        status: run.status,
        conclusion: run.conclusion,
        name: run.name,
        url: run.html_url,
      }),
      name: 'check_build'
    });
    return true;
  } catch (e: any) {
    agent.appendHistory({
      role: 'tool',
      content: JSON.stringify({ error: e?.message || String(e) }),
      name: 'check_build'
    });
    return true;
  }
}
