import { AgentActionContext } from '../ToolRegistry';
import { useCoreStore } from '../../../integration/store/coreStore';
import { useUiStore } from '../../../integration/store/uiStore';
import { commitFiles, GithubError, GithubFile } from '../../integrations/github';

export interface PushFixArgs {
  files: GithubFile[];
  message: string;
}

export async function pushFix(
  agent: AgentActionContext,
  args: PushFixArgs
): Promise<boolean> {
  const core = useCoreStore.getState();
  const ui = useUiStore.getState();

  if (!core.githubRepo) {
    agent.appendHistory({
      role: 'tool',
      content: JSON.stringify({ error: 'No repository has been created yet. Use create_github_repo first.' }),
      name: 'push_fix'
    });
    return true;
  }

  if (!args?.files || args.files.length === 0) {
    agent.appendHistory({
      role: 'tool',
      content: JSON.stringify({ error: 'push_fix requires a non-empty files array.' }),
      name: 'push_fix'
    });
    return true;
  }

  const pat = ui.githubConfig?.pat?.trim();
  if (!pat) {
    ui.setGitHubModalOpen(true, 'GitHub PAT required to push fixes.');
    agent.appendHistory({
      role: 'tool',
      content: JSON.stringify({ error: 'No GitHub PAT configured. User has been prompted.' }),
      name: 'push_fix'
    });
    return true;
  }

  const { owner, repo, branch } = core.githubRepo;
  const message = args.message || 'Fix: updated files from Office-Agent';

  core.addLogEntry({
    agentIndex: agent.data.index,
    action: `Pushing fix to ${owner}/${repo} (${args.files.length} files)...`,
  });

  try {
    const result = await commitFiles(pat, {
      owner, repo, branch,
      files: args.files,
      message,
    });

    core.addLogEntry({
      agentIndex: agent.data.index,
      action: `Fix pushed: commit ${result.commitSha.slice(0, 7)}, ${result.fileCount} files`,
    });

    agent.appendHistory({
      role: 'tool',
      content: JSON.stringify({
        success: true,
        commit: result.commitSha.slice(0, 7),
        filesUpdated: result.fileCount,
        repo: `${owner}/${repo}`,
      }),
      name: 'push_fix'
    });
    return true;
  } catch (e: any) {
    const isGhErr = e instanceof GithubError;
    const status = isGhErr ? (e as GithubError).status : 0;
    const msg = e?.message || String(e);

    core.addLogEntry({
      agentIndex: agent.data.index,
      action: `Push fix failed${status ? ` (HTTP ${status})` : ''}: ${msg}`,
    });

    if (status === 401 || status === 403) {
      ui.setGitHubModalOpen(true, msg);
    }

    agent.appendHistory({
      role: 'tool',
      content: JSON.stringify({ error: `Push failed${status ? ` (HTTP ${status})` : ''}: ${msg}` }),
      name: 'push_fix'
    });
    return true;
  }
}
