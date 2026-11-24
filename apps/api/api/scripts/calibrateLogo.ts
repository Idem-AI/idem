/**
 * `npm run calibrate:logo` — recaler la note perceptive sur des jugements HUMAINS, sans aucun modèle.
 *
 *   pairs [--out dossier] [--per-type 30]
 *       construit des logos (8 marques, les 11 types) et écrit `pairs.html` : une page locale où un
 *       designer choisit, paire par paire, le logo le plus réussi (← / →, = pour « égal »). Les
 *       réponses se gardent dans le navigateur et s'exportent en `judgments.json`.
 *
 *   fit <judgments.json>
 *       ajuste, type par type, les poids du profil (modèle de Bradley–Terry : P(A ≻ B) = σ(w · (A − B)),
 *       poids positifs, rappel vers les poids raisonnés), affiche l'accord avant/après et réécrit
 *       `services/logo-engine/validate/calibration.ts`. Un type à moins de 20 jugements n'est pas touché.
 */
import fs from 'fs';
import path from 'path';
import { CONCEPT_TYPES, fileFontProvider } from '../services/logo-engine';
import type { ConceptType } from '../services/logo-engine';
import { candidateDocs } from '../services/logo-engine/planner/planner';
import { produceLogo } from '../services/logo-engine/pipeline';
import { seeded } from '../services/logo-engine/render/generators';
import { PROFILES } from '../services/logo-engine/validate/perception';
import type { PerceptKey } from '../services/logo-engine/validate/perception';
import { fitWeights } from '../services/logo-engine/validate/calibrate';
import type { Judged } from '../services/logo-engine/validate/calibrate';

const FONT_FILE = path.resolve(__dirname, '../../../../node_modules/pdfjs-dist/standard_fonts/LiberationSans-Bold.ttf');
const BUILD = { fontProvider: fileFontProvider(FONT_FILE), fonts: { display: { family: 'Liberation Sans' }, body: { family: 'Liberation Sans' } } };

const BRANDS = [
  { brandName: 'Verda', industry: 'agriculture bio', description: 'Fruits et légumes bio du Cameroun', personality: ['naturel', 'durable'], pal: { primary: '#14532d', secondary: '#65a30d', accent: '#f59e0b' } },
  { brandName: 'Kora Bank', industry: 'banque mobile', description: 'Épargne pour les jeunes actifs', personality: ['fiable', 'moderne'], pal: { primary: '#0f3d5e', secondary: '#2a9d8f', accent: '#e76f51' } },
  { brandName: 'Maison Ébène', industry: 'joaillerie', description: 'Joaillerie africaine haut de gamme', personality: ['luxe', 'élégant'], pal: { primary: '#2b1b17', secondary: '#b08d57', accent: '#8a1c2b' } },
  { brandName: 'Tamtam', industry: 'concerts et festivals', description: 'Festivals à Douala', personality: ['festif', 'jeune'], pal: { primary: '#7c2d12', secondary: '#ea580c', accent: '#facc15' } },
  { brandName: 'Clinique Sahel', industry: 'santé', description: 'Soins de proximité', personality: ['soin', 'confiance'], pal: { primary: '#075985', secondary: '#0d9488', accent: '#f97316' } },
  { brandName: 'Atlas', industry: 'logistique', description: 'Livraison entre villes africaines', personality: ['rapide', 'fiable'], pal: { primary: '#1e3a8a', secondary: '#0891b2', accent: '#f59e0b' } },
  { brandName: 'Nova Académie', industry: 'éducation', description: 'Cours en ligne et mentorat', personality: ['savoir', 'jeune'], pal: { primary: '#4c1d95', secondary: '#0ea5e9', accent: '#f43f5e' } },
  { brandName: 'Kiosk', industry: 'commerce en ligne', description: 'Marketplace de créateurs', personality: ['ludique'], pal: { primary: '#9d174d', secondary: '#0f766e', accent: '#fbbf24' } },
];


const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : fallback;
};

async function pairs(): Promise<void> {
  const out = path.resolve(arg('--out', 'logo-calibration'));
  const perType = Number(arg('--per-type', '30'));
  fs.mkdirSync(out, { recursive: true });
  const byType = new Map<ConceptType, { svg: string; parts: Partial<Record<PerceptKey, number>>; score: number }[]>();
  for (const brand of BRANDS)
    for (const kind of ['icon', 'name', 'initial'] as const) {
      const docs = candidateDocs({ brief: brand, palette: brand.pal, fonts: BUILD.fonts, kind, seed: `calib:${brand.brandName}:${kind}`, explore: 0.8 }, 10);
      for (const { doc, type } of docs) {
        const made = await produceLogo(doc, BUILD, { skipVariants: true });
        if (!made.ok || !made.logo?.report.perception) continue;
        const list = byType.get(type) ?? [];
        list.push({ svg: made.logo.rendered.svg, parts: made.logo.report.perception.parts, score: made.logo.report.aesthetic ?? 0 });
        byType.set(type, list);
      }
      process.stdout.write('.');
    }
  const rng = seeded(20261124);
  const items: { type: ConceptType; a: { svg: string; parts: unknown }; b: { svg: string; parts: unknown } }[] = [];
  for (const [type, list] of byType) {
    if (list.length < 2) continue;
    for (let k = 0; k < perType; k++) {
      const i = Math.floor(rng() * list.length);
      let j = Math.floor(rng() * (list.length - 1));
      if (j >= i) j++;
      items.push({ type, a: list[i], b: list[j] });
    }
  }
  items.sort(() => rng() - 0.5);
  fs.writeFileSync(path.join(out, 'pairs.html'), page(items));
  console.log(`\n${items.length} paires (${[...byType.keys()].length} types) → ${path.join(out, 'pairs.html')}`);
}

function page(items: unknown[]): string {
  const data = JSON.stringify(items).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Calibration des logos</title>
<style>
:root{--bg:#fafaf7;--ink:#1c1917;--muted:#78716c;--line:#e7e5e4;--card:#ffffff;--accent:#0f766e}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,sans-serif}
main{max-width:1000px;margin:0 auto;padding:24px 16px}h1{font-size:20px;margin:0 0 4px}p{color:var(--muted);margin:0 0 16px}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px}@media(max-width:640px){.pair{grid-template-columns:1fr}}
button.logo{background:var(--card);border:2px solid var(--line);border-radius:12px;padding:24px;min-height:260px;display:flex;align-items:center;justify-content:center;cursor:pointer}
button.logo:hover,button.logo:focus-visible{border-color:var(--accent);outline:none}button.logo svg{max-width:100%;max-height:220px;height:auto}
.bar{display:flex;gap:12px;align-items:center;margin:16px 0;flex-wrap:wrap}.bar button{border:1px solid var(--line);background:var(--card);border-radius:8px;padding:8px 14px;cursor:pointer}
.meta{color:var(--muted);font-size:13px}
</style></head><body><main>
<h1>Lequel est le plus réussi ?</h1>
<p>Jugez la forme seule (équilibre, netteté, simplicité, harmonie), pas les couleurs ni le nom. Clavier : ← gauche, → droite, = égal.</p>
<div class="bar"><span class="meta" id="progress"></span><button id="equal">Égal / je ne sais pas</button><button id="export">Exporter judgments.json</button></div>
<div class="pair"><button class="logo" id="a" aria-label="Logo de gauche"></button><button class="logo" id="b" aria-label="Logo de droite"></button></div>
<p class="meta" id="type"></p>
</main><script>
const items=${data};const KEY='idem-logo-calibration';let done=[];try{done=JSON.parse(localStorage.getItem(KEY)||'[]')}catch(e){}
let i=done.length;const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(done))}catch(e){}};
function show(){if(i>=items.length){document.querySelector('.pair').innerHTML='<p>Terminé — exportez vos réponses.</p>';document.getElementById('progress').textContent=done.length+' jugements';return}
const it=items[i];document.getElementById('a').innerHTML=it.a.svg;document.getElementById('b').innerHTML=it.b.svg;
document.getElementById('progress').textContent=(i+1)+' / '+items.length;document.getElementById('type').textContent='Type : '+it.type}
function pick(w){if(i>=items.length)return;const it=items[i];if(w)done.push({type:it.type,a:it.a.parts,b:it.b.parts,winner:w});i++;save();show()}
document.getElementById('a').onclick=()=>pick('a');document.getElementById('b').onclick=()=>pick('b');document.getElementById('equal').onclick=()=>pick(null);
document.addEventListener('keydown',e=>{if(e.key==='ArrowLeft')pick('a');if(e.key==='ArrowRight')pick('b');if(e.key==='=')pick(null)});
document.getElementById('export').onclick=()=>{const blob=new Blob([JSON.stringify(done,null,1)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='judgments.json';a.click()};
show();
</script></body></html>`;
}

function fit(file: string): void {
  const judged = (JSON.parse(fs.readFileSync(file, 'utf8')) as Judged[]).filter((j) => j.winner === 'a' || j.winner === 'b');
  const weights: Record<string, Record<string, number>> = {};
  for (const type of CONCEPT_TYPES) {
    const rows = judged.filter((j) => j.type === type);
    if (rows.length < 20) {
      console.log(`${type.padEnd(15)} ${rows.length} jugements : poids raisonnés gardés`);
      continue;
    }
    const result = fitWeights(rows, PROFILES[type].weights);
    weights[type] = result.weights;
    console.log(`${type.padEnd(15)} ${rows.length} jugements · accord ${Math.round(result.before * 100)} % → ${Math.round(result.after * 100)} % · ${JSON.stringify(result.weights)}`);
  }
  const target = path.resolve(__dirname, '../services/logo-engine/validate/calibration.ts');
  const body = `/**\n * Poids des profils perceptifs recalés sur des jugements humains — fichier ÉCRIT par\n * \`npm run calibrate:logo -- fit <jugements.json>\`. Vide : les poids raisonnés de \`perception.ts\`.\n */\nexport const CALIBRATION: { judgments: number; date: string | null; weights: Record<string, Record<string, number>> } = ${JSON.stringify({ judgments: judged.length, date: new Date().toISOString().slice(0, 10), weights }, null, 2)};\n`;
  fs.writeFileSync(target, body);
  console.log(`→ ${target}`);
}

const [command, file] = process.argv.slice(2);
if (command === 'pairs') pairs().catch((e) => (console.error(e), process.exit(1)));
else if (command === 'fit' && file) fit(file);
else console.log('Usage : npm run calibrate:logo -- pairs [--out dossier] [--per-type 30]  |  npm run calibrate:logo -- fit judgments.json');
