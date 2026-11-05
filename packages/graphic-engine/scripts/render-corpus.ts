/**
 * Rend les pages du corpus écrit à la main, SANS modèle ni réseau (hors polices), avec le vrai moteur :
 * jetons de la marque → clés remplies → Tailwind compilé → Chromium → constats du code.
 *
 *   npx ts-node --transpile-only scripts/render-corpus.ts <dossier de sortie> [préfixe d'identifiant]
 *
 * Écrit `<id>.html` (le code de la page), `<id>.png` (le rendu) et `<id>.json` ({ nature, role, intent, blocking, … }),
 * le trio que `build-examples.ts` assemble. Une page qui ne s'affiche pas est listée avec le constat du moteur.
 */
import fs from 'fs';
import path from 'path';
import { brandFromIdem, buildTokens, compileTailwind, closeBrowser, formatOf } from '../src';
import { buildContentMap } from '../src/runtime/content-map';
import { expandPage, sanitizeHtml, stripInventedText } from '../src/runtime/expand';
import { checkRender } from '../src/runtime/check';
import { natureOf } from '../src/examples/library';
import { GRAPHIC_SAMPLES, sampleLogo } from '../corpus/brands';
import { photo } from './fixtures';
import type { CorpusPage } from '../corpus/types';

async function load(): Promise<CorpusPage[]> {
  const dir = path.join(__dirname, '..', 'corpus');
  const pages: CorpusPage[] = [];
  for (const f of fs.readdirSync(dir).filter((x) => /^pages-.*\.ts$/.test(x)).sort()) pages.push(...((await import(path.join(dir, f))) as { PAGES: CorpusPage[] }).PAGES);
  return pages;
}

function imageOf(spec: string): string {
  if (spec.startsWith('photo:')) {
    const [a, b, c] = spec.slice(6).split(',');
    return photo(a, b, c);
  }
  return spec;
}

async function main() {
  const [out, prefix = ''] = process.argv.slice(2);
  if (!out) throw new Error('usage : render-corpus.ts <dossier> [préfixe]');
  fs.mkdirSync(out, { recursive: true });
  const pages = (await load()).filter((p) => p.id.startsWith(prefix));
  const seen = new Set<string>();
  let ok = 0;
  for (const p of pages) {
    if (seen.has(p.id)) throw new Error(`identifiant en double : ${p.id}`);
    seen.add(p.id);
    const sample = GRAPHIC_SAMPLES[p.brand % GRAPHIC_SAMPLES.length];
    const format = formatOf(p.format);
    const light = sampleLogo(sample.brand);
    const dark = sampleLogo(sample.brand, 'dark');
    const { brand, direction } = brandFromIdem({ name: sample.brand.name, branding: { colors: { colors: sample.brand.palette }, typography: { primaryFont: sample.brand.fonts.display, secondaryFont: sample.brand.fonts.body }, ...(p.style ? { artDirection: { styleId: p.style } } : {}) } as never, logos: { primary: light, withTextLight: light, withTextDark: dark, withTextMono: light, icon: light } });
    const tokens = buildTokens({ brand, direction, format: p.format, allowDark: true });
    // La matière de démonstration → la carte de contenu que le moteur donne à l'auteur.
    const blocks: unknown[] = [];
    const map = buildContentMap({ id: p.id, blocks: [] } as never);
    for (const [k, v] of Object.entries(p.texts)) map.entries.set(k, { key: k, value: v, kind: /(^|\.)icon$/.test(k) ? 'icon' : 'text' });
    for (const [k, v] of Object.entries(p.images ?? {})) map.entries.set(k, { key: k, value: imageOf(v), kind: 'url' });
    for (const [id, c] of Object.entries(p.charts ?? {})) map.primitives.set(id, { id, kind: 'chart', ...c } as never);
    for (const [id, t] of Object.entries(p.tables ?? {})) map.primitives.set(id, { id, kind: 'table', ...t } as never);
    void blocks;
    const clean = sanitizeHtml(p.html);
    const words = stripInventedText(clean.html);
    const notes: string[] = [];
    if (words.removed.length) notes.push(`texte en dur retiré : ${words.removed.slice(0, 4).join(' · ')}`);
    if (words.loops) notes.push('boucle {{#each}}');
    const page = expandPage(words.html, map, tokens, format, { sectionId: p.id, locale: sample.brand.locale, engine: 'corpus' });
    if (page.unknown.length) notes.push(`clés inconnues : ${page.unknown.join(', ')}`);
    if (page.orphans.length) notes.push(`primitives sans bloc : ${page.orphans.join(', ')}`);
    const unused = [...map.entries.keys()].filter((k) => !page.used.has(k));
    if (unused.length) notes.push(`non placées : ${unused.slice(0, 5).join(', ')}`);
    const css = await compileTailwind(page.html, tokens);
    const head = `${tokens.font.headHtml ? `${tokens.font.headHtml}\n` : ''}<style data-ge-tailwind>${css}</style>`;
    const check = await checkRender(page.html, head, format, { lang: sample.brand.locale, shoot: true });
    const blocking = check.ok ? 0 : 1;
    fs.writeFileSync(path.join(out, `${p.id}.html`), p.html);
    if (check.png) fs.writeFileSync(path.join(out, `${p.id}.png`), check.png);
    fs.writeFileSync(path.join(out, `${p.id}.json`), JSON.stringify({ doc: p.doc, nature: natureOf(formatOf(p.format), p.role), ...(p.role ? { role: p.role } : {}), intent: p.intent, brand: sample.brand.name, country: sample.brand.country, format: p.format, blocking }));
    if (check.ok) ok++;
    console.log(`${check.ok ? 'OK ' : 'KO '} ${p.id} ${check.ok ? '' : `— ${(check.error ?? '').slice(0, 300)}`}${notes.length ? ` [${notes.join(' ; ')}]` : ''}`);
  }
  console.log(`${ok}/${pages.length} pages affichées → ${out}`);
  await closeBrowser();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
