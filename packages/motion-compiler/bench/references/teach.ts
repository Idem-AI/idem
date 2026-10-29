/**
 * `npm run references:teach --prefix packages/motion-compiler -- [--per 3] [--slots hook,proof] [--providers …]`
 *
 * LE PROFESSEUR HORS LIGNE (phase 5) — un GRAND modèle open-weight (rôle `video.teacher` : Qwen3.8-2.4T, replis
 * DeepSeek V4.1 Flash et GLM-5.3) écrit des scènes de référence exemplaires ; le code les ÉVALUE comme il évalue les
 * scènes du moteur (solveurs, compilation, exécution dans les quatre formats, juge) ; l'équipe TRIE sur une planche ;
 * `references:promote` ajoute les scènes acceptées à la bibliothèque (`references.json`). Payant : à lancer sur décision.
 *
 * Jamais en production : la bibliothèque est un fichier relu par le moteur ; le petit modèle de production ÉDITE la
 * référence la plus proche au lieu de tout inventer.
 *
 * Sorties : `bench/out/references/candidates.json` (intentions, mesures, défauts), `bench/out/references/review.html`
 * (planche à cocher ; « Exporter » écrit `approved.json`).
 */
import fs from 'fs';
import path from 'path';
import { openRouterCall, zeroUsage } from '../quality/openrouter';
import { evalAssets, evaluateReference, EvalResult } from '../quality/offline';
import { INTENT_REFERENCE } from '../../../../apps/ivision/core/src/video/author/intent.author';
import { closeFilmBrowser } from '../../../../apps/ivision/core/src/video/rendering/runner';
import { intentJsonSchema } from '../../src/intent/schema';
import { parseIntent, validateIntent } from '../../src/intent/validate';
import { SEED_REFERENCES, ReferenceScene } from '../../src/references/library';
import { PRODUCT_SKELETON } from '../../src/design/film';
import { LAYOUT_KINDS } from '../../src/intent/types';

const OUT = path.join(__dirname, '../out/references');
const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const PER = Number(arg('per', '3'));
const SLOTS = arg('slots', '').split(',').filter(Boolean);
const PROVIDERS = arg('providers', '').split(',').filter(Boolean);

/** Les cases à remplir : chaque temps fort × des compositions qui lui conviennent. */
const SLOT_LAYOUTS: Record<string, string[]> = {
  hook: ['hero', 'full-bleed', 'hero-left'],
  problem: ['hero-left', 'media-split', 'figure'],
  reveal: ['hero', 'media-split', 'end-card'],
  feature: ['device', 'media-split', 'hero-left'],
  benefits: ['list', 'stacked', 'grid'],
  proof: ['figure', 'quote', 'full-bleed'],
  cta: ['hero', 'hero-left'],
  signature: ['end-card'],
};
const TEXTS = { title: 'Le café qui réveille Dakar', sub: 'Torréfié chaque matin, à deux pas de chez vous', figure: '1 250 clients', label: 'servis chaque semaine', p1: 'Grains du Fouta-Djalon', p2: 'Torréfaction artisanale', p3: 'Livré en 30 minutes', quote: 'Le meilleur café de la ville, sans hésiter', author: 'Awa, cliente depuis 2019', cta: 'Commander', tagline: 'Réveillez votre journée' };

interface Candidate {
  ref: ReferenceScene;
  eval: EvalResult | null;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const usage = zeroUsage();
  const call = openRouterCall(usage, { providers: PROVIDERS });
  const assets = await evalAssets(OUT);
  const candidates: Candidate[] = [];
  const slots = PRODUCT_SKELETON.map((s) => s.role).filter((r) => !SLOTS.length || SLOTS.includes(r));
  for (const role of slots) {
    for (const layout of SLOT_LAYOUTS[role] || ['hero']) {
      if (!(LAYOUT_KINDS as string[]).includes(layout)) continue;
      const media: ('image' | 'video')[] = ['media-split', 'full-bleed', 'device'].includes(layout) ? ['image'] : layout === 'grid' ? ['image', 'image', 'image'] : [];
      const keys = layout === 'list' ? ['title', 'p1', 'p2', 'p3'] : layout === 'figure' ? ['figure', 'label'] : layout === 'quote' ? ['quote', 'author'] : layout === 'end-card' ? ['tagline', 'cta'] : role === 'cta' ? ['title', 'cta'] : ['title', 'sub'];
      const texts = Object.fromEntries(keys.map((k) => [k, (TEXTS as Record<string, string>)[k]]));
      const examples = SEED_REFERENCES.filter((r) => r.intent.role === role || r.intent.layout === layout).slice(0, 2);
      for (let k = 0; k < PER; k++) {
        const system = `You are a world-class motion designer building a LIBRARY of exemplary scenes that smaller models will edit. Each scene must be professional: deliberate hierarchy, varied entrances, a landed title that stays still, one accent word at most, a pause before the strongest moment.\n\n${INTENT_REFERENCE}`;
        const user = [`ROLE: ${role} — LAYOUT: ${layout} — variation ${k + 1} of ${PER} (make it clearly different from the others and from the examples)`, `texts (use "$KEY"): ${Object.entries(texts).map(([kk, v]) => `$${kk} = "${v}"`).join(' · ')}`, `media: ${media.length ? media.map((m, i) => `${i} = ${m}`).join(' · ') : 'none'}`, 'logo: available', `EXAMPLES (do not copy):\n${examples.map((e) => JSON.stringify(e.intent)).join('\n')}`].join('\n');
        try {
          const raw = await call({ role: 'video.teacher', profile: 'coder', system, user, level: 'high', options: { schema: { name: 'scene_intent', schema: intentJsonSchema({ texts: keys, media: media.length }) }, temperature: 0.6 + 0.15 * k, reasoning: true } });
          const parsed = parseIntent(raw);
          const v = parsed.intent ? validateIntent(parsed.intent, { texts, media, hasLogo: true }) : null;
          if (!v?.ok) {
            console.log(`✗ ${role}/${layout}#${k + 1} : ${parsed.error || v?.errors.join(' ; ')}`);
            continue;
          }
          const ref: ReferenceScene = { id: `t-${role}-${layout}-${Date.now().toString(36)}-${k}`, purpose: `${role} scene, ${layout} composition`, tags: [role, layout], texts: keys.length, media, intent: { ...v.intent!, role: role as never }, source: 'teacher' };
          const evaluation = await evaluateReference(ref, assets, OUT);
          candidates.push({ ref, eval: evaluation });
          console.log(`${evaluation && !evaluation.errors && !Object.values(evaluation.layout).some(Boolean) ? '✓' : '✗'} ${ref.id} · score ${evaluation?.score ?? '—'}`);
        } catch (error) {
          console.log(`✗ ${role}/${layout} : ${(error as Error).message}`);
          if (/openrouter_40[123]/.test((error as Error).message)) {
            await closeFilmBrowser();
            process.exit(1);
          }
        }
      }
    }
  }
  await closeFilmBrowser();
  // Seules les scènes sans défaut, au-dessus du seuil du juge, sont proposées au tri.
  const proposable = candidates.filter((c) => c.eval && !c.eval.errors && !Object.values(c.eval.layout).some(Boolean) && c.eval.score >= 0.8);
  fs.writeFileSync(path.join(OUT, 'candidates.json'), JSON.stringify({ at: new Date().toISOString(), usage, candidates: proposable }, null, 2));
  fs.writeFileSync(path.join(OUT, 'review.html'), `<!doctype html><html lang="fr"><meta charset="utf-8"><title>Tri des références</title><style>body{font:14px system-ui;background:#f7f5f0;color:#16181d;margin:16px}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px}article{background:#fff;border:1px solid #d9d5cc;border-radius:10px;padding:8px}.row{display:flex;gap:4px}.row img{width:25%;object-fit:contain;background:#eee}label{display:flex;gap:6px;align-items:center;margin-top:6px}button{font:inherit;padding:8px 14px;border-radius:8px}</style>
<h1>Scènes proposées par le professeur</h1><p>Cochez celles qui entrent dans la bibliothèque, puis « Exporter » (approved.json), puis <code>npm run references:promote</code>.</p><button id="x">Exporter</button>
<main>${proposable.map((c) => `<article><div class="row">${Object.values(c.eval!.thumbs).map((t) => `<img src="${t}" alt="">`).join('')}</div><label><input type="checkbox" value="${c.ref.id}"> ${c.ref.id} · score ${c.eval!.score}</label></article>`).join('')}</main>
<script>document.getElementById('x').onclick=()=>{const ids=[...document.querySelectorAll('input:checked')].map(i=>i.value);const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify({ids},null,2)],{type:'application/json'}));a.download='approved.json';a.click()}</script></html>`);
  console.log(`\n${proposable.length}/${candidates.length} scènes proposées au tri · ${usage.calls} appels · ${usage.cost.toFixed(3)} $ → ${path.join(OUT, 'review.html')}`);
})();
