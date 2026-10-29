/**
 * `npm run references:promote --prefix packages/motion-compiler -- [--approved bench/out/references/approved.json]`
 *
 * Les scènes du professeur que l'équipe a cochées entrent dans la bibliothèque (`packages/motion-compiler/references.json`,
 * lu par le moteur : `src/references/library.ts`). Une scène n'entre que si elle passe encore la lecture d'intention ;
 * une scène déjà présente n'est pas dédoublée.
 */
import fs from 'fs';
import path from 'path';
import { validateIntent } from '../../src/intent/validate';
import type { ReferenceScene } from '../../src/references/library';

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const OUT = path.join(__dirname, '../out/references');
const approvedFile = path.resolve(arg('approved', path.join(OUT, 'approved.json')));
const libraryFile = path.join(__dirname, '../../references.json');

const approved = new Set<string>((JSON.parse(fs.readFileSync(approvedFile, 'utf8')) as { ids: string[] }).ids || []);
const { candidates } = JSON.parse(fs.readFileSync(path.join(OUT, 'candidates.json'), 'utf8')) as { candidates: { ref: ReferenceScene }[] };
const library = fs.existsSync(libraryFile) ? (JSON.parse(fs.readFileSync(libraryFile, 'utf8')) as { scenes: ReferenceScene[] }) : { scenes: [] };
const known = new Set(library.scenes.map((s) => s.id));
let added = 0;
for (const { ref } of candidates) {
  if (!approved.has(ref.id) || known.has(ref.id)) continue;
  const keys = [...new Set(JSON.stringify(ref.intent).match(/\$\w+/g) || [])].map((k) => k.slice(1));
  const ok = validateIntent(ref.intent, { texts: Object.fromEntries(keys.map((k) => [k, 'x'])), media: ref.media, hasLogo: true }).ok;
  if (!ok) continue;
  library.scenes.push({ ...ref, source: 'teacher' });
  added++;
}
fs.writeFileSync(libraryFile, JSON.stringify({ updatedAt: new Date().toISOString(), scenes: library.scenes }, null, 2));
console.log(`${added} scène(s) ajoutée(s) · ${library.scenes.length} scène(s) du professeur dans la bibliothèque (${libraryFile})`);
