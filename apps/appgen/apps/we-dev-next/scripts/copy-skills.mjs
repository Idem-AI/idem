/**
 * Copies the skill catalog into dist/ after `tsc`.
 *
 * Skills are markdown on purpose — editing a design rule should be editing
 * prose, not recompiling a string constant — but that means TypeScript does not
 * carry them into the build output. Without this step the server boots with an
 * empty catalog and generates un-skilled prompts, silently.
 */

import { cpSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'src', 'skills', 'catalog');
const target = join(root, 'dist', 'skills', 'catalog');

if (!existsSync(source)) {
  console.error(`[copy-skills] missing catalog at ${source}`);
  process.exit(1);
}

cpSync(source, target, { recursive: true });

const count = readdirSync(target).filter((name) => name.endsWith('.md')).length;
console.log(`[copy-skills] copied ${count} skills to dist/skills/catalog`);
