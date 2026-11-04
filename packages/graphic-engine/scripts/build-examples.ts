/**
 * Assemble la BIBLIOTHÈQUE D'EXEMPLES (phase 5) à partir de pages déjà fabriquées hors ligne par le professeur
 * (`apps/api/api/scripts/teachExamples.ts`) — sans modèle, sans réseau :
 *
 *   npx ts-node --transpile-only scripts/build-examples.ts <dossier des pages> <fichier de sortie.json>
 *
 * Chaque page est un trio `<id>.html` (le code de la page, textes en clés), `<id>.json` ({ nature, role, intent }) et
 * `<id>.png` (son rendu). Une page n'entre que si la mesure la tient pour lisible : un seul foyer d'attention (deux au
 * plus), et aucun constat bloquant noté dans son `.json`. Son empreinte CLIP est calculée pour la garde anti-copie.
 */
import fs from 'fs';
import path from 'path';
import { analyzeSaliency, encodeVector, imageEmbedding } from '@idem/design-tools';
import type { PageExample } from '../src/examples/library';

async function main() {
  const [dir, out] = process.argv.slice(2);
  if (!dir || !out) throw new Error('usage : build-examples.ts <dossier des pages> <sortie.json>');
  const ids = fs.readdirSync(dir).filter((f) => f.endsWith('.html')).map((f) => f.slice(0, -5));
  const examples: PageExample[] = [];
  let refused = 0;
  for (const id of ids) {
    const meta = JSON.parse(fs.readFileSync(path.join(dir, `${id}.json`), 'utf8')) as { nature: string; role?: string; intent: string; blocking?: number };
    const png = path.join(dir, `${id}.png`);
    if (!fs.existsSync(png) || (meta.blocking ?? 0) > 0) {
      refused++;
      continue;
    }
    const image = fs.readFileSync(png);
    const sal = await analyzeSaliency(image);
    if (sal.focalCount > 2) {
      refused++;
      continue;
    }
    const vector = await imageEmbedding(image);
    // Les mots des pages ne servent à rien à l'auteur (et ne doivent pas être recopiés) : seule la structure reste.
    const html = fs.readFileSync(path.join(dir, `${id}.html`), 'utf8').replace(/>([^<>{}]*[A-Za-zÀ-ÿ]{3,}[^<>{}]*)</g, '>…<');
    examples.push({ id, nature: meta.nature, ...(meta.role ? { role: meta.role } : {}), intent: meta.intent.slice(0, 240), html, ...(vector ? { vector: encodeVector(vector) } : {}), score: Math.round((1 / Math.max(1, sal.focalCount)) * 100) / 100 });
  }
  fs.writeFileSync(out, JSON.stringify({ builtAt: new Date().toISOString(), examples }, null, 1));
  console.log(`${examples.length} exemple(s) gardé(s), ${refused} écarté(s) → ${out}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
