import { useFileStore } from '@/components/WeIde/stores/fileStore';

/**
 * Last-line guarantee that the generated project can actually start.
 *
 * `npm run dev` is dispatched the moment generation finishes, so a package.json
 * without a `scripts.dev` entry surfaces to the user as a raw
 * `npm error Missing script: "dev"` before anything can be repaired. A prompt
 * instruction makes that rare; it cannot make it impossible. This patches the
 * manifest in place first, so the failure mode simply cannot occur.
 *
 * Deliberately conservative: it only ever fills in what is missing, and never
 * overwrites a script or a version the model chose on purpose.
 */

const VITE_SCRIPTS: Record<string, string> = {
  dev: 'vite',
  build: 'vite build',
  preview: 'vite preview',
};

/** Minimum toolchain for the Vite + React target. Versions match the prompt. */
const REQUIRED_DEV_DEPENDENCIES: Record<string, string> = {
  vite: '^5.0.0',
  '@vitejs/plugin-react': '^4.2.0',
};

const REQUIRED_DEPENDENCIES: Record<string, string> = {
  react: '^18.2.0',
  'react-dom': '^18.2.0',
};

export interface EnsureResult {
  patched: boolean;
  addedScripts: string[];
  addedDependencies: string[];
}

/**
 * Finds the manifest wherever the generator put it. Most projects write
 * `package.json` at the root, but a stray prefix should not defeat the guard.
 */
function findManifestPath(files: Record<string, string>): string | null {
  if (typeof files['package.json'] === 'string') {
    return 'package.json';
  }

  return (
    Object.keys(files).find((path) => path.replace(/^\.?\//, '') === 'package.json') ??
    Object.keys(files).find((path) => path.endsWith('/package.json')) ??
    null
  );
}

/** Reproduces the file's own indentation so the patch does not reformat it. */
function detectIndent(source: string): number {
  const match = source.match(/\n(\s+)"/);
  return match ? match[1].replace(/\t/g, '  ').length || 2 : 2;
}

const NO_CHANGE: EnsureResult = { patched: false, addedScripts: [], addedDependencies: [] };

/**
 * Pure half: takes the manifest source, returns the patched source or null when
 * nothing was missing. Kept separate from the store so it can be reasoned about
 * and tested on its own.
 */
export function patchManifest(source: string): (EnsureResult & { content: string }) | null {
  let manifest: Record<string, any>;

  try {
    manifest = JSON.parse(source);
  } catch (error) {
    console.warn('[ensureRunnable] package.json is not valid JSON, leaving it alone:', error);
    return null;
  }

  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return null;
  }

  const addedScripts: string[] = [];
  const addedDependencies: string[] = [];

  const scripts = { ...(manifest.scripts ?? {}) };

  for (const [name, command] of Object.entries(VITE_SCRIPTS)) {
    if (typeof scripts[name] !== 'string' || !scripts[name].trim()) {
      scripts[name] = command;
      addedScripts.push(name);
    }
  }

  const dependencies = { ...(manifest.dependencies ?? {}) };
  const devDependencies = { ...(manifest.devDependencies ?? {}) };

  for (const [name, version] of Object.entries(REQUIRED_DEPENDENCIES)) {
    if (!dependencies[name] && !devDependencies[name]) {
      dependencies[name] = version;
      addedDependencies.push(name);
    }
  }

  // `scripts.dev` pointing at a binary that was never installed fails just as
  // hard as a missing script, with a less obvious message.
  for (const [name, version] of Object.entries(REQUIRED_DEV_DEPENDENCIES)) {
    if (!devDependencies[name] && !dependencies[name]) {
      devDependencies[name] = version;
      addedDependencies.push(name);
    }
  }

  if (!addedScripts.length && !addedDependencies.length) {
    return null;
  }

  const patched = { ...manifest, scripts, dependencies, devDependencies };

  return {
    patched: true,
    addedScripts,
    addedDependencies,
    content: `${JSON.stringify(patched, null, detectIndent(source))}\n`,
  };
}

export async function ensureProjectIsRunnable(): Promise<EnsureResult> {
  const { files, updateContent } = useFileStore.getState();
  const manifestPath = findManifestPath(files);

  if (!manifestPath) {
    console.warn('[ensureRunnable] no package.json in the generated project');
    return NO_CHANGE;
  }

  const result = patchManifest(files[manifestPath]);

  if (!result) {
    return NO_CHANGE;
  }

  await updateContent(manifestPath, result.content, true);

  console.warn(
    `[ensureRunnable] patched ${manifestPath} — scripts: [${result.addedScripts.join(', ')}], deps: [${result.addedDependencies.join(', ')}]`
  );

  return { patched: true, addedScripts: result.addedScripts, addedDependencies: result.addedDependencies };
}
