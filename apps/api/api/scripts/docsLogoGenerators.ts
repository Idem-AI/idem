/**
 * `npm run docs:logo` — régénère `docs/LOGO_GENERATORS.md`, le catalogue des générateurs de symboles
 * du moteur de logos (famille, tons, paramètres et bornes, étiquettes de secteur). Fichier généré :
 * ne pas l'éditer à la main, éditer les générateurs (`services/logo-engine/render/generators/`).
 */
import fs from 'fs';
import path from 'path';
import { describeGenerator, listGenerators } from '../services/logo-engine/render/generators';

const FAMILY: Record<string, string> = { abstract: 'Abstrait', pictorial: 'Figuratif', mascot: 'Mascotte', frame: 'Cadre' };

const rows = (family: string) =>
  listGenerators(family as never)
    .map((g) => `| \`${g.id}\` | ${g.label} | ${g.tones} | \`${describeGenerator(g).replace(/^[a-z0-9-]+\(/, '').replace(/\)$/, '').replace(/\|/g, '/')}\` | ${g.tags.slice(0, 8).join(', ')} |`)
    .join('\n');

const body = ['abstract', 'pictorial', 'mascot']
  .map((f) => `## ${FAMILY[f]} (${listGenerators(f as never).length})\n\n| Id | Nom | Tons | Paramètres (min-max=défaut) | Secteurs / idées |\n|---|---|---|---|---|\n${rows(f)}\n`)
  .join('\n');

fs.writeFileSync(
  path.resolve(__dirname, '../../docs/LOGO_GENERATORS.md'),
  `# Catalogue des générateurs de symboles\n\n> Généré par \`npm run docs:logo\` — ne pas éditer. ${listGenerators().length} générateurs. Tons : 1 = une encre, 2 = + seconde encre, 3 = + accent ; « découpe » = le fond transparaît.\n\n${body}`
);
console.log(`docs/LOGO_GENERATORS.md : ${listGenerators().length} générateurs`);
