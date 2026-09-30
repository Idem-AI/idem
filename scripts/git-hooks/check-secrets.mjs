#!/usr/bin/env node
/**
 * Pre-commit secret scan.
 *
 * Blocks a commit when the STAGED changes expose a secret: a sensitive file
 * (`.env`, private key, service-account JSON…) or a line that looks like a
 * credential (API key, token, private key, password in a URL…).
 *
 * Only ADDED lines are scanned: a commit is never blocked by an old line it
 * does not touch. When gitleaks is installed it runs as well, as a second
 * opinion.
 *
 * False positive? Put `idem-secrets:allow` in a comment on that line.
 * Rules: the RULES array below. Tests: scripts/git-hooks/check-secrets.test.mjs.
 */
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// ── Rules ────────────────────────────────────────────────────────────────────

/** Files that must never be committed, whatever their content. */
export const FORBIDDEN_FILES = [
  { id: 'env-file', test: (p) => /(^|\/)\.env(\.[^/]*)?$/.test(p) && !/\.example$/.test(p), why: 'environment file' },
  { id: 'private-key-file', test: (p) => /\.(pem|key|p12|pfx|jks|keystore)$/i.test(p), why: 'private key / certificate' },
  { id: 'ssh-key', test: (p) => /(^|\/)id_(rsa|dsa|ecdsa|ed25519)(\.[^/]*)?$/.test(p) && !/\.pub$/.test(p), why: 'SSH private key' },
  { id: 'service-account', test: (p) => /(service[-_]?account|-secrets|credentials)[^/]*\.json$/i.test(p), why: 'service-account / credentials JSON' },
];

/** Line rules. `re` must match on the added line itself. */
export const RULES = [
  { id: 'private-key', re: /-----BEGIN ((RSA|DSA|EC|OPENSSH|ENCRYPTED|PGP) )?PRIVATE KEY( BLOCK)?-----(\\n|\s)*[A-Za-z0-9+/=]{40,}/, why: 'private key' },
  { id: 'gcp-service-account', re: /"private_key"\s*:\s*"-----BEGIN/, why: 'Google service-account key' },
  { id: 'google-api-key', re: /AIza[0-9A-Za-z_-]{35}/, why: 'Google API key' },
  { id: 'aws-access-key', re: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/, why: 'AWS access key' },
  { id: 'github-token', re: /\b(gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,})\b/, why: 'GitHub token' },
  { id: 'gitlab-token', re: /\bglpat-[A-Za-z0-9_-]{20,}\b/, why: 'GitLab token' },
  { id: 'slack-token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/, why: 'Slack token' },
  { id: 'stripe-key', re: /\b(sk|rk)_live_[A-Za-z0-9]{20,}\b/, why: 'Stripe live key' },
  { id: 'openai-key', re: /\bsk-(proj-)?[A-Za-z0-9_-]{32,}\b/, why: 'OpenAI-style API key' },
  { id: 'anthropic-key', re: /\bsk-ant-[A-Za-z0-9_-]{32,}\b/, why: 'Anthropic API key' },
  { id: 'netlify-token', re: /\bnfp_[A-Za-z0-9]{30,}\b/, why: 'Netlify token' },
  { id: 'laravel-app-key', re: /APP_KEY["']?\s*[:=]\s*["'`]?base64:[A-Za-z0-9+/]{42,}={0,2}/, why: 'Laravel APP_KEY' },
  { id: 'sanctum-token', re: /["'`]\d+\|[A-Za-z0-9]{40}["'`]/, why: 'Laravel Sanctum personal access token' },
  { id: 'jwt', re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{20,}\b/, why: 'JSON Web Token' },
  {
    id: 'url-credentials',
    re: /\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@"'`]+:([^\s:/@"'`$]{6,})@([^\s/"'`:]+)/i,
    why: 'password embedded in a URL',
    // Local development URLs (docker defaults) are not production secrets.
    ignore: (m) => /^(localhost|127\.0\.0\.1|0\.0\.0\.0|host\.docker\.internal|mongodb|postgres|redis|minio|example\.(com|org))$/i.test(m[2]) || isPlaceholder(m[1]),
  },
  {
    // Code: a quoted literal assigned to a credential-like name.
    id: 'generic-secret',
    re: /\b[A-Za-z0-9_]*(?:password|passwd|secret|token|api[_-]?key|private[_-]?key|access[_-]?key|client[_-]?secret)[A-Za-z0-9_]*["']?\s*[:=]\s*(["'`])([^"'`\s]{16,})\1/i,
    why: 'hard-coded credential',
    ignore: (m) => !looksLikeSecret(m[2]),
  },
  {
    // .env style: UPPER_CASE_NAME=value (unquoted), the whole line.
    id: 'env-secret',
    re: /^\s*(?:export\s+)?[A-Z0-9_]*(?:PASSWORD|PASSWD|SECRET|TOKEN|API_KEY|PRIVATE_KEY|ACCESS_KEY|CLIENT_SECRET|ENCRYPTION_KEY)[A-Z0-9_]*\s*=\s*["']?([^\s"'#]{16,})["']?\s*$/,
    why: 'credential in an environment assignment',
    ignore: (m) => !looksLikeSecret(m[1]),
  },
];

const ALLOW_PRAGMA = 'idem-secrets:allow';

export function isPlaceholder(value) {
  const v = String(value).replace(/^["'`]|["'`]$/g, '');
  return (
    v === '' ||
    /^(your|my|example|sample|dummy|fake|test|changeme|change[-_]?me|placeholder|xxx+|redacted|none|null|undefined|todo)/i.test(v) ||
    /change[-_]?(this|in[-_]?production)/i.test(v) ||
    /^<.*>$/.test(v) ||
    /^\$\{?[A-Z0-9_]+\}?$/.test(v) ||
    /^%[A-Z0-9_]+%$/.test(v) ||
    /^\*+$/.test(v) ||
    /^(.)\1{7,}$/.test(v)
  );
}

/** A value that could be a real secret: long, mixed, random-looking, not a reference. */
function looksLikeSecret(value) {
  return (
    value.length >= 16 &&
    !isPlaceholder(value) &&
    !looksLikeCode(value) &&
    !/\$\{|:\/\/|^\/|\s/.test(value) &&
    /[A-Za-z]/.test(value) &&
    /[0-9]/.test(value) &&
    entropy(value) >= 3.5
  );
}

/** References to a value rather than the value itself: `process.env.X`, `config.token`, `req.body.password`… */
function looksLikeCode(value) {
  return (
    /^(process\.env|import\.meta\.env|env\.|this\.|req\.|res\.|config\.|options\.|opts\.|settings\.|params\.|args\.|data\.|body\.|user\.|ctx\.|window\.|environment\.)/.test(value) ||
    /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)+$/.test(value) ||
    /^[A-Za-z_$][\w$.]*\(/.test(value) ||
    /^(true|false|null|undefined)$/i.test(value) ||
    /^[a-z]+([A-Z][a-z]+)+$/.test(value) // camelCaseIdentifier (letters only: random strings mix digits)
  );
}

/** Shannon entropy in bits per character. Random secrets are high, words are low. */
export function entropy(value) {
  const counts = new Map();
  for (const c of value) counts.set(c, (counts.get(c) || 0) + 1);
  let h = 0;
  for (const n of counts.values()) {
    const p = n / value.length;
    h -= p * Math.log2(p);
  }
  return h;
}

// ── Scan ─────────────────────────────────────────────────────────────────────

/** Lines of one file that expose a secret. */
export function scanLines(file, lines) {
  const findings = [];
  for (const { line, text } of lines) {
    if (text.includes(ALLOW_PRAGMA)) continue;
    for (const rule of RULES) {
      const m = rule.re.exec(text);
      if (!m) continue;
      if (rule.ignore && rule.ignore(m)) continue;
      findings.push({ file, line, rule: rule.id, why: rule.why, excerpt: mask(m[0]) });
      break;
    }
  }
  return findings;
}

function mask(value) {
  const v = value.trim();
  return v.length <= 12 ? `${v.slice(0, 3)}…` : `${v.slice(0, 8)}…${'*'.repeat(6)}`;
}

function git(args) {
  const r = spawnSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(r.stderr || `git ${args.join(' ')} failed`);
  return r.stdout;
}

/** Added lines of the staged diff, grouped by file. */
export function stagedAddedLines(diffText) {
  const files = new Map();
  let current = null;
  let lineNo = 0;
  for (const raw of diffText.split('\n')) {
    if (raw.startsWith('+++ ')) {
      const p = raw.slice(4);
      current = p === '/dev/null' ? null : p.replace(/^b\//, '');
      if (current && !files.has(current)) files.set(current, []);
      continue;
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
    if (hunk) {
      lineNo = Number(hunk[1]);
      continue;
    }
    if (!current) continue;
    if (raw.startsWith('+')) {
      files.get(current).push({ line: lineNo, text: raw.slice(1) });
      lineNo++;
    } else if (!raw.startsWith('-') && !raw.startsWith('\\')) {
      lineNo++;
    }
  }
  return files;
}

function runGitleaks() {
  const probe = spawnSync('gitleaks', ['version'], { encoding: 'utf8' });
  if (probe.status !== 0) return null;
  // gitleaks ≥ 8.19: `git --staged`; older: `protect --staged`.
  let r = spawnSync('gitleaks', ['git', '--pre-commit', '--staged', '--redact', '--no-banner'], { encoding: 'utf8' });
  if (/unknown (command|flag)/i.test(r.stderr || '')) {
    r = spawnSync('gitleaks', ['protect', '--staged', '--redact', '--no-banner'], { encoding: 'utf8' });
  }
  return { ok: r.status === 0, output: `${r.stdout || ''}${r.stderr || ''}`.trim() };
}

// ── Main ─────────────────────────────────────────────────────────────────────

const RED = '\x1b[31m', YELLOW = '\x1b[33m', GREEN = '\x1b[32m', BOLD = '\x1b[1m', RESET = '\x1b[0m';

function main() {
  const staged = git(['diff', '--cached', '--name-only', '--diff-filter=ACMR'])
    .split('\n')
    .filter(Boolean);
  if (staged.length === 0) return 0;

  const forbidden = [];
  for (const file of staged) {
    const rule = FORBIDDEN_FILES.find((r) => r.test(file));
    if (rule) forbidden.push({ file, why: rule.why });
  }

  const diff = git(['diff', '--cached', '--unified=0', '--no-color', '--no-ext-diff', '--diff-filter=ACMR', '--text']);
  const findings = [];
  for (const [file, lines] of stagedAddedLines(diff)) {
    if (/(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/.test(file)) continue;
    findings.push(...scanLines(file, lines));
  }

  const gitleaks = runGitleaks();

  if (forbidden.length === 0 && findings.length === 0 && (!gitleaks || gitleaks.ok)) {
    console.log(`${GREEN}✔ Secret scan: no exposed secret in ${staged.length} staged file(s).${RESET}`);
    return 0;
  }

  const bar = '═'.repeat(76);
  console.error(`\n${RED}${bar}\n${BOLD} ✖ COMMIT BLOCKED — possible secret exposed${RESET}\n${RED}${bar}${RESET}\n`);
  console.error(' This repository is PUBLIC: anything committed here can be read by anyone,');
  console.error(' forever (even if you delete it in a later commit).\n');

  if (forbidden.length > 0) {
    console.error(`${BOLD} Sensitive files staged:${RESET}`);
    for (const f of forbidden) console.error(`   ${RED}✖${RESET} ${f.file}  (${f.why})`);
    console.error(`   → Unstage them: ${BOLD}git restore --staged <file>${RESET}, and add them to .gitignore.\n`);
  }

  if (findings.length > 0) {
    console.error(`${BOLD} Suspicious values in staged lines:${RESET}`);
    for (const f of findings) {
      console.error(`   ${RED}✖${RESET} ${f.file}:${f.line}  ${f.why} [${f.rule}]  ${YELLOW}${f.excerpt}${RESET}`);
    }
    console.error('');
  }

  if (gitleaks && !gitleaks.ok) {
    console.error(`${BOLD} gitleaks also reported findings:${RESET}\n${gitleaks.output}\n`);
  }

  console.error(`${BOLD} How to fix:${RESET}`);
  console.error('   1. Remove the secret from the code and read it from the environment instead.');
  console.error('      Production secrets live in Infisical: npm run secrets -- plan');
  console.error('   2. If the secret was real, consider it leaked locally and ROTATE it.');
  console.error(`   3. False positive? Add a comment containing ${BOLD}${ALLOW_PRAGMA}${RESET} on that line.\n`);
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exit(main());
  } catch (error) {
    console.error(`${RED}✖ Secret scan failed to run: ${error.message}${RESET}`);
    console.error('  The commit is blocked because the check could not complete.');
    process.exit(1);
  }
}
