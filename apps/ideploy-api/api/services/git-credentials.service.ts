/**
 * An authenticated clone URL for a private repository, when this team has
 * one to use.
 *
 * `applications.git_repository` is always the plain URL GitHub/GitLab's own
 * API returned when the repo was picked — never one with credentials in it,
 * which is correct for a column that gets displayed back to the operator.
 * But a plain `https://github.com/...` clone of a *private* repo has
 * nothing to authenticate with, and `git clone` run non-interactively over
 * SSH from the deployment worker cannot prompt for one either. Verified
 * live: exactly this — `fatal: could not read Username for
 * 'https://github.com': No such device or address`, repeated on every
 * retry, deployment failed. The repository was private and its owner had
 * GitHub connected; nothing before this ever used that connection at clone
 * time.
 *
 * This resolves credentials at the moment they're needed instead of storing
 * them: it asks each member of the deploying team (there is usually one) for
 * a connected token on the repository's own host, and only ever hands back
 * a URL — the token itself goes to the caller separately, to redact from
 * deploy logs, never to persist anywhere.
 */
import pool from '../config/db.config';

export interface GitCredential {
  authenticatedUrl: string;
  /** Redact this from anything that gets logged — it is a live OAuth token. */
  token: string;
}

async function teamUserIds(teamId: number): Promise<number[]> {
  const { rows } = await pool.query('SELECT user_id FROM team_user WHERE team_id = $1', [teamId]);
  return rows.map((r) => Number(r.user_id));
}

function withCredentials(gitUrl: string, username: string, token: string): string {
  const url = new URL(gitUrl);
  url.username = username;
  url.password = token;
  return url.toString();
}

/**
 * `null` means exactly one of two things: the repository isn't hosted on a
 * provider we have OAuth for, or nobody on the team has that provider
 * connected — either way, a plain clone (today's behaviour, correct for a
 * public repository) is the right fallback, not an error.
 */
/** Whether a token is still accepted by its provider; network errors count as "maybe". */
type TokenCheck = 'valid' | 'invalid' | 'unknown';

async function checkToken(provider: 'github' | 'gitlab', token: string): Promise<TokenCheck> {
  const axios = (await import('axios')).default;
  const url =
    provider === 'github'
      ? 'https://api.github.com/user'
      : `${process.env.GITLAB_INSTANCE_URL || 'https://gitlab.com'}/api/v4/user`;
  try {
    const r = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 8000,
      validateStatus: () => true,
    });
    if (r.status === 200) return 'valid';
    return r.status === 401 ? 'invalid' : 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * A working token from one of the team's connected accounts.
 *
 * Every member's token is tried, and each is checked with the provider first:
 * the first one found used to be taken as is, and a revoked or expired one —
 * or one issued by a previous OAuth app — made every clone fail with
 * "Invalid username or token". A token the provider rejects (401) is dropped,
 * so its owner sees GitHub/GitLab as disconnected and reconnects.
 */
export async function resolveGitCredential(teamId: number, gitRepository: string): Promise<GitCredential | null> {
  let host: string;
  try {
    host = new URL(gitRepository).hostname;
  } catch {
    return null;
  }
  const userIds = await teamUserIds(teamId);
  if (userIds.length === 0) return null;

  const gitlabHost = new URL(process.env.GITLAB_INSTANCE_URL || 'https://gitlab.com').hostname;
  const provider = host === 'github.com' ? 'github' : host === gitlabHost ? 'gitlab' : null;
  if (!provider) return null;

  const service = provider === 'github' ? await import('./github.service') : await import('./gitlab.service');
  const username = provider === 'github' ? 'x-access-token' : 'oauth2';
  let fallback: string | null = null;
  for (const userId of userIds) {
    const token = await service.getToken(userId);
    if (!token) continue;
    const check = await checkToken(provider, token);
    if (check === 'valid') return { token, authenticatedUrl: withCredentials(gitRepository, username, token) };
    if (check === 'invalid') await service.disconnect(userId);
    else fallback ??= token; // provider unreachable: still worth trying
  }
  return fallback ? { token: fallback, authenticatedUrl: withCredentials(gitRepository, username, fallback) } : null;
}

/**
 * What git's failure means, in terms the user can act on. The raw message
 * ("Password authentication is not supported for Git operations") reads like
 * a platform bug; it means the repository needs a connected account.
 */
export function explainGitFailure(stderr: string): string {
  const text = stderr.trim();
  if (/Invalid username or token|Authentication failed|could not read Username|terminal prompts disabled/i.test(text)) {
    return (
      'the repository refused access. Connect (or reconnect) the GitHub/GitLab account that can read it ' +
      'in iDeploy, then retry.'
    );
  }
  if (/Repository not found|not found/i.test(text)) {
    return 'the repository was not found, or the connected account cannot read it.';
  }
  if (/couldn't find remote ref|Remote branch .* not found/i.test(text)) {
    return 'that branch or commit does not exist in the repository.';
  }
  return text.slice(0, 300);
}
