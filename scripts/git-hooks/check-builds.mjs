#!/usr/bin/env node
/**
 * Pre-push build check.
 *
 * Builds every application touched by the commits being pushed, and refuses
 * the push when one of them does not build. A broken build never reaches the
 * remote, and the developer is told exactly which app failed and why.
 *
 * As a git hook, git passes the refs being pushed on stdin
 * (`<local ref> <local sha> <remote ref> <remote sha>` per line).
 * Manual run: `npm run check:builds` (compares with origin/dev), or
 * `npm run check:builds -- --base origin/main`, `--all`, `--only api,landing`,
 * `--list` (show what would be built, build nothing).
 */
import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');

/**
 * What to build for which changes. `paths` mirrors the path filters of
 * .github/workflows/ci.yml: a shared package change rebuilds its consumers.
 * Order matters: shared packages first, their consumers after.
 */
const TARGETS = [
  { name: 'shared-models', dir: 'packages/shared-models', paths: ['packages/shared-models/'], cmd: 'npm run build' },
  { name: 'shared-auth-client', dir: 'packages/shared-auth-client', paths: ['packages/shared-auth-client/'], cmd: 'npm run build' },
  { name: 'shared-tour', dir: 'packages/shared-tour', paths: ['packages/shared-tour/'], cmd: 'npm run build' },
  { name: 'api', dir: 'apps/api', paths: ['apps/api/', 'packages/'], cmd: 'npm run build' },
  { name: 'ideploy-api', dir: 'apps/ideploy-api', paths: ['apps/ideploy-api/', 'packages/shared-models/', 'packages/shared-auth-client/'], cmd: 'npm run build' },
  { name: 'appgen-server', dir: 'apps/appgen/apps/we-dev-next', paths: ['apps/appgen/apps/we-dev-next/'], cmd: 'npm run build', ownDeps: true },
  { name: 'appgen-client', dir: 'apps/appgen/apps/we-dev-client', paths: ['apps/appgen/apps/we-dev-client/', 'packages/shared-styles/'], cmd: 'npm run build', ownDeps: true },
  { name: 'main-dashboard', dir: 'apps/main-dashboard', paths: ['apps/main-dashboard/', 'packages/'], cmd: 'npm run build' },
  { name: 'landing', dir: 'apps/landing', paths: ['apps/landing/', 'packages/'], cmd: 'npm run build' },
  { name: 'simulation', dir: 'apps/simulation', paths: ['apps/simulation/', 'packages/'], cmd: 'npm run build', ownDeps: true },
  { name: 'ideploy-web', dir: 'apps/ideploy-web', paths: ['apps/ideploy-web/', 'packages/shared-models/'], cmd: 'npm run build' },
  { name: 'chart', dir: 'apps/chart', paths: ['apps/chart/'], cmd: 'pnpm run build', ownDeps: true },
];

const ZERO = /^0+$/;
const RED = '\x1b[31m', GREEN = '\x1b[32m', YELLOW = '\x1b[33m', BOLD = '\x1b[1m', DIM = '\x1b[2m', RESET = '\x1b[0m';

function git(args) {
  const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  return r.status === 0 ? r.stdout.trim() : null;
}

/** True when the git command succeeds (for commands that print nothing). */
function gitOk(args) {
  return spawnSync('git', args, { cwd: ROOT, stdio: 'ignore' }).status === 0;
}

function option(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** Base to compare with when the remote branch does not exist yet. */
function defaultBase() {
  for (const ref of ['origin/dev', 'origin/main', 'origin/HEAD']) {
    if (gitOk(['rev-parse', '--verify', '--quiet', ref])) return ref;
  }
  return null;
}

function changedFilesFromStdin(stdin) {
  const files = new Set();
  for (const line of stdin.split('\n').filter(Boolean)) {
    const [, localSha, , remoteSha] = line.trim().split(/\s+/);
    if (!localSha || ZERO.test(localSha)) continue; // branch deletion: nothing to build
    let base = remoteSha && !ZERO.test(remoteSha) ? remoteSha : null;
    if (base && !gitOk(['cat-file', '-e', `${base}^{commit}`])) base = null; // unknown locally (not fetched)
    if (!base) {
      const fallback = defaultBase();
      base = fallback ? git(['merge-base', fallback, localSha]) : null;
    }
    const range = base ? [`${base}`, localSha] : [`${localSha}^`, localSha];
    const out = git(['diff', '--name-only', ...range]);
    (out || '').split('\n').filter(Boolean).forEach((f) => files.add(f));
  }
  return [...files];
}

function changedFilesFromBase(base) {
  const mergeBase = git(['merge-base', base, 'HEAD']) || base;
  return (git(['diff', '--name-only', mergeBase, 'HEAD']) || '').split('\n').filter(Boolean);
}

function selectTargets(files) {
  return TARGETS.filter((t) => files.some((f) => t.paths.some((p) => f.startsWith(p))));
}

function run(target, logFile) {
  return new Promise((resolveRun) => {
    const log = createWriteStream(logFile);
    const started = Date.now();
    const child = spawn(target.cmd, {
      cwd: join(ROOT, target.dir),
      shell: true,
      env: { ...process.env, CI: 'true', FORCE_COLOR: '0', NG_CLI_ANALYTICS: 'false' },
    });
    child.stdout.pipe(log, { end: false });
    child.stderr.pipe(log, { end: false });
    child.on('close', (code) => {
      log.end();
      resolveRun({ ok: code === 0, seconds: Math.round((Date.now() - started) / 1000) });
    });
    child.on('error', (error) => {
      log.end(`\n${error.message}\n`);
      resolveRun({ ok: false, seconds: 0 });
    });
  });
}

function tail(file, lines = 40) {
  try {
    return readFileSync(file, 'utf8').trimEnd().split('\n').slice(-lines).join('\n');
  } catch {
    return '';
  }
}

async function readStdin() {
  if (process.stdin.isTTY) return '';
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

async function main() {
  const asHook = process.argv.includes('--hook');
  let files;
  if (process.argv.includes('--all')) {
    files = TARGETS.flatMap((t) => t.paths);
  } else if (asHook) {
    files = changedFilesFromStdin(await readStdin());
  } else {
    const base = option('base') || defaultBase();
    if (!base) {
      console.error(`${RED}✖ No base branch found. Use --base <ref> or --all.${RESET}`);
      return 1;
    }
    files = changedFilesFromBase(base);
  }

  let targets = selectTargets(files);
  const only = option('only');
  if (only) {
    const names = only.split(',').map((s) => s.trim());
    targets = TARGETS.filter((t) => names.includes(t.name));
  }

  if (targets.length === 0) {
    console.log(`${GREEN}✔ Build check: no application changed, nothing to build.${RESET}`);
    return 0;
  }

  if (process.argv.includes('--list')) {
    for (const t of targets) console.log(`${t.name.padEnd(20)} ${t.dir}  (${t.cmd})`);
    return 0;
  }

  console.log(`\n${BOLD}Build check before push${RESET} — ${targets.length} application(s) changed: ${targets.map((t) => t.name).join(', ')}`);

  const dirty = (git(['status', '--porcelain']) || '')
    .split('\n')
    .filter(Boolean)
    .map((l) => l.slice(3));
  const dirtyTargets = targets.filter((t) => dirty.some((f) => f.startsWith(`${t.dir}/`)));
  if (dirtyTargets.length > 0) {
    console.log(
      `${YELLOW}⚠ Uncommitted changes in ${dirtyTargets.map((t) => t.name).join(', ')}: the build runs on your working tree,${RESET}\n` +
        `${YELLOW}  which is not exactly what you are pushing. Commit or stash them for an accurate check.${RESET}`
    );
  }
  console.log(`${DIM}  (this can take a few minutes for the Angular apps)${RESET}\n`);

  const logDir = mkdtempSync(join(tmpdir(), 'idem-build-check-'));
  const failures = [];

  for (const target of targets) {
    const logFile = join(logDir, `${target.name}.log`);
    if (target.ownDeps && !existsSync(join(ROOT, target.dir, 'node_modules'))) {
      const installer = target.cmd.startsWith('pnpm') ? 'pnpm install' : 'npm install';
      console.log(`  ${RED}✖${RESET} ${target.name.padEnd(20)} dependencies not installed`);
      failures.push({ target, logFile: null, reason: `Dependencies are not installed. Run: cd ${target.dir} && ${installer}` });
      continue;
    }
    process.stdout.write(`  … ${target.name.padEnd(20)} building`);
    const result = await run(target, logFile);
    process.stdout.write('\r');
    if (result.ok) {
      console.log(`  ${GREEN}✔${RESET} ${target.name.padEnd(20)} built in ${result.seconds}s          `);
    } else {
      console.log(`  ${RED}✖${RESET} ${target.name.padEnd(20)} FAILED after ${result.seconds}s        `);
      failures.push({ target, logFile });
    }
  }

  if (failures.length === 0) {
    console.log(`\n${GREEN}${BOLD}✔ All changed applications build. Push allowed.${RESET}\n`);
    return 0;
  }

  const bar = '═'.repeat(76);
  console.error(`\n${RED}${bar}\n${BOLD} ✖ PUSH BLOCKED — ${failures.length} application(s) do not build${RESET}\n${RED}${bar}${RESET}`);
  for (const { target, logFile, reason } of failures) {
    console.error(`\n${BOLD}${RED}■ ${target.name}${RESET}  (${target.dir}, command: ${target.cmd})`);
    if (reason) {
      console.error(`  ${reason}`);
      continue;
    }
    console.error(`${DIM}  Last lines of the build output:${RESET}`);
    console.error(tail(logFile).replace(/^/gm, '    '));
    console.error(`  Full log: ${logFile}`);
  }
  console.error(`\n${BOLD} What to do:${RESET}`);
  console.error('   1. Fix the errors above.');
  console.error(`   2. Reproduce locally: ${BOLD}cd <app dir> && <command>${RESET}, or ${BOLD}npm run check:builds${RESET}.`);
  console.error('   3. Commit the fix and push again.');
  console.error(`${DIM}   Your commits are still on your machine: nothing was sent to the remote.${RESET}\n`);
  return 1;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(`${RED}✖ Build check failed to run: ${error.message}${RESET}`);
    console.error('  The push is blocked because the check could not complete.');
    process.exit(1);
  });
