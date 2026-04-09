/**
 * GitHub REST API client.
 *
 * Pure browser-friendly TypeScript: no external dependencies, no Node.js APIs.
 * Used by the Engineering Team's `create_github_repo` agent tool to ship code
 * to a real GitHub repository directly from the browser.
 *
 * Authentication: Personal Access Token (PAT) with `repo` scope.
 *   https://github.com/settings/tokens/new?scopes=repo&description=Office-Agent
 */

const GITHUB_API = 'https://api.github.com';

export interface GithubFile {
  /** Repo-relative path, e.g. `src/App.tsx`. Forward slashes only. */
  path: string;
  /** Full file contents as a UTF-8 string. */
  content: string;
}

export interface GithubUser {
  login: string;
  name: string | null;
  avatarUrl: string;
}

export interface GithubRepo {
  htmlUrl: string;
  fullName: string;
  defaultBranch: string;
  owner: string;
  name: string;
}

export interface CommitFilesResult {
  commitSha: string;
  treeSha: string;
  fileCount: number;
}

class GithubError extends Error {
  constructor(public status: number, message: string, public response?: any) {
    super(message);
    this.name = 'GithubError';
  }
}

async function gh<T>(
  pat: string,
  method: string,
  path: string,
  body?: any
): Promise<T> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${pat}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!res.ok) {
    let detail: any = null;
    try { detail = await res.json(); } catch {}
    const message = detail?.message || `${method} ${path} failed: ${res.status} ${res.statusText}`;
    throw new GithubError(res.status, message, detail);
  }

  // GET ref returns JSON; PATCH ref returns JSON; some endpoints return empty
  if (res.status === 204) return null as T;
  return res.json() as Promise<T>;
}

/**
 * Validate a PAT and return the authenticated user's info.
 * Throws if the token is invalid or lacks required scopes.
 */
export async function getAuthenticatedUser(pat: string): Promise<GithubUser> {
  const data = await gh<any>(pat, 'GET', '/user');
  return {
    login: data.login,
    name: data.name,
    avatarUrl: data.avatar_url
  };
}

/**
 * Check whether a repo already exists under the given owner.
 * Returns true if it exists, false on 404, throws on other errors.
 */
export async function repoExists(pat: string, owner: string, repo: string): Promise<boolean> {
  try {
    await gh<any>(pat, 'GET', `/repos/${owner}/${repo}`);
    return true;
  } catch (e) {
    if (e instanceof GithubError && e.status === 404) return false;
    throw e;
  }
}

/**
 * Create a new repository under the authenticated user.
 * Initialized with a README so we have a base commit to build on top of.
 */
export async function createRepo(
  pat: string,
  opts: { name: string; description: string; isPrivate?: boolean }
): Promise<GithubRepo> {
  const data = await gh<any>(pat, 'POST', '/user/repos', {
    name: opts.name,
    description: opts.description,
    private: !!opts.isPrivate,
    auto_init: true,
    has_issues: true,
    has_wiki: false,
    has_projects: false
  });
  return {
    htmlUrl: data.html_url,
    fullName: data.full_name,
    defaultBranch: data.default_branch,
    owner: data.owner.login,
    name: data.name
  };
}

/**
 * UTF-8 safe base64 encoder. `btoa` only handles Latin-1, so we encode to bytes first.
 */
function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/**
 * Commit a batch of files to a repo via the Git Data API.
 *
 * Algorithm:
 *   1. Read the latest commit + tree on `branch`
 *   2. Create a blob for each file (base64-encoded)
 *   3. Create a new tree referencing the new blobs (with `base_tree` so existing
 *      files are preserved)
 *   4. Create a new commit pointing to the new tree, parented to the latest commit
 *   5. Move the branch ref to the new commit
 */
export async function commitFiles(
  pat: string,
  opts: {
    owner: string;
    repo: string;
    branch: string;
    files: GithubFile[];
    message: string;
  }
): Promise<CommitFilesResult> {
  const { owner, repo, branch, files, message } = opts;
  if (files.length === 0) throw new Error('commitFiles: no files provided');

  // 1. Latest commit
  const ref = await gh<any>(pat, 'GET', `/repos/${owner}/${repo}/git/ref/heads/${branch}`);
  const latestCommitSha: string = ref.object.sha;
  const latestCommit = await gh<any>(pat, 'GET', `/repos/${owner}/${repo}/git/commits/${latestCommitSha}`);
  const baseTreeSha: string = latestCommit.tree.sha;

  // 2. Create a blob per file
  const blobs = await Promise.all(files.map(async (f) => {
    const blob = await gh<any>(pat, 'POST', `/repos/${owner}/${repo}/git/blobs`, {
      content: utf8ToBase64(f.content),
      encoding: 'base64'
    });
    return { path: f.path, sha: blob.sha as string };
  }));

  // 3. Create a tree on top of the existing one
  const tree = await gh<any>(pat, 'POST', `/repos/${owner}/${repo}/git/trees`, {
    base_tree: baseTreeSha,
    tree: blobs.map(b => ({
      path: b.path,
      mode: '100644',
      type: 'blob',
      sha: b.sha
    }))
  });

  // 4. Create the commit
  const commit = await gh<any>(pat, 'POST', `/repos/${owner}/${repo}/git/commits`, {
    message,
    tree: tree.sha,
    parents: [latestCommitSha]
  });

  // 5. Move the branch ref forward
  await gh<any>(pat, 'PATCH', `/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
    sha: commit.sha,
    force: false
  });

  return {
    commitSha: commit.sha,
    treeSha: tree.sha,
    fileCount: files.length
  };
}

/**
 * High-level helper: create a fresh repo and commit all files in one go.
 * If `name` collides with an existing repo, appends `-2`, `-3`, ... until it finds a free slot.
 */
export async function createRepoWithFiles(
  pat: string,
  opts: { name: string; description: string; isPrivate?: boolean; files: GithubFile[] }
): Promise<{ repo: GithubRepo; commit: CommitFilesResult }> {
  const user = await getAuthenticatedUser(pat);

  // Sanitize name: lowercase, hyphens, no spaces or weird characters
  const baseName = opts.name
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'office-agent-project';

  let name = baseName;
  let suffix = 1;
  while (await repoExists(pat, user.login, name)) {
    suffix += 1;
    name = `${baseName}-${suffix}`;
    if (suffix > 50) throw new Error(`Could not find a free repo name starting from "${baseName}"`);
  }

  const repo = await createRepo(pat, {
    name,
    description: opts.description,
    isPrivate: opts.isPrivate
  });

  const commit = await commitFiles(pat, {
    owner: repo.owner,
    repo: repo.name,
    branch: repo.defaultBranch,
    files: opts.files,
    message: 'Initial commit from Office-Agent Engineering Team'
  });

  return { repo, commit };
}

export { GithubError };
