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
export async function resolveGitCredential(teamId: number, gitRepository: string): Promise<GitCredential | null> {
  let host: string;
  try {
    host = new URL(gitRepository).hostname;
  } catch {
    // Not an http(s) URL — e.g. an SSH remote (git@host:owner/repo.git).
    // Deploy keys are that form's own answer to authentication; nothing to add here.
    return null;
  }

  const userIds = await teamUserIds(teamId);
  if (userIds.length === 0) return null;

  if (host === 'github.com') {
    const { getToken } = await import('./github.service');
    for (const userId of userIds) {
      const token = await getToken(userId);
      if (token) return { token, authenticatedUrl: withCredentials(gitRepository, 'x-access-token', token) };
    }
    return null;
  }

  const gitlabHost = new URL(process.env.GITLAB_INSTANCE_URL || 'https://gitlab.com').hostname;
  if (host === gitlabHost) {
    const { getToken } = await import('./gitlab.service');
    for (const userId of userIds) {
      const token = await getToken(userId);
      if (token) return { token, authenticatedUrl: withCredentials(gitRepository, 'oauth2', token) };
    }
    return null;
  }

  return null;
}
