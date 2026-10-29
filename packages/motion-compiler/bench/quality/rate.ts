/**
 * `npm run bench:quality:rate --prefix packages/motion-compiler [-- --pairs 200]`
 *
 * LE PROTOCOLE HUMAIN (phase 0) — des comparaisons par paires À L'AVEUGLE : deux vidéos d'une même demande, côte à côte,
 * sans nom de moteur ni de cran ; « A », « B » ou « égalité ». Cinq évaluateurs, environ 200 paires.
 *
 * Écrit `bench/out/quality/rate/index.html` : une page autonome (ouverte localement, aucun réseau), le côté de chaque
 * vidéo tiré au hasard POUR CHAQUE évaluateur (le biais de position s'annule), les votes gardés dans le navigateur et
 * exportés en JSON (`votes-<nom>.json`, à déposer dans `bench/out/quality/votes/`). Puis `bench:quality:fit`.
 *
 * Les paires : même demande, deux versions différentes (moteur, cran ou étiquette) — en priorité le moteur du plan
 * contre la ligne de base au même cran, puis le cran Low du plan contre le cran High de la ligne de base.
 */
import fs from 'fs';
import path from 'path';
import type { QualityResult } from './run';

const OUT = path.join(__dirname, '../out/quality');
const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const MAX = Number(arg('pairs', '200'));

export interface Pair {
  id: string;
  brief: string;
  a: string;
  b: string;
  /** Pourquoi cette paire (lecture du rapport). */
  kind: 'same-level' | 'low-vs-high' | 'other';
}

export function buildPairs(results: Record<string, QualityResult>, max = MAX): Pair[] {
  const ok = Object.values(results).filter((r) => r.ok && r.mp4);
  const byBrief = new Map<string, QualityResult[]>();
  for (const r of ok) byBrief.set(r.brief, [...(byBrief.get(r.brief) || []), r]);
  const pairs: Pair[] = [];
  for (const [brief, runs] of byBrief) {
    for (let i = 0; i < runs.length; i++) {
      for (let j = i + 1; j < runs.length; j++) {
        const a = runs[i];
        const b = runs[j];
        if (a.label === b.label && a.level === b.level) continue;
        const kind: Pair['kind'] = a.label !== b.label && a.level === b.level ? 'same-level' : a.label !== b.label && ((a.level === 'low' && b.level === 'high') || (a.level === 'high' && b.level === 'low')) ? 'low-vs-high' : 'other';
        pairs.push({ id: `${a.key}~${b.key}`, brief, a: a.key, b: b.key, kind });
      }
    }
  }
  const rank = { 'same-level': 0, 'low-vs-high': 1, other: 2 } as const;
  return pairs.sort((x, y) => rank[x.kind] - rank[y.kind] || x.brief.localeCompare(y.brief)).slice(0, max);
}

function page(pairs: Pair[], results: Record<string, QualityResult>): string {
  const items = pairs.map((p) => ({ id: p.id, a: p.a, b: p.b, va: `../${results[p.a].mp4}`, vb: `../${results[p.b].mp4}` }));
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Banc qualité — comparaisons</title>
<style>
:root{--ground:#f7f5f0;--ink:#16181d;--muted:#5b5f66;--line:#d9d5cc;--accent:#1f6f4a;--card:#fff}
*{box-sizing:border-box}body{margin:0;background:var(--ground);color:var(--ink);font:16px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{max-width:1200px;margin:0 auto;padding:16px}
header{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-bottom:12px}
h1{font-size:20px;margin:0}.muted{color:var(--muted);font-size:14px}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media (max-width:720px){.pair{grid-template-columns:1fr}}
figure{margin:0;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:8px}
figcaption{font-weight:700;margin:4px 0 8px}video{width:100%;max-height:70vh;background:#000;border-radius:8px}
.actions{display:flex;gap:8px;justify-content:center;margin:14px 0;flex-wrap:wrap}
button{font:inherit;padding:10px 18px;border-radius:10px;border:1px solid var(--line);background:var(--card);cursor:pointer}
button.primary{background:var(--accent);color:#fff;border-color:var(--accent)}
button:focus-visible,input:focus-visible{outline:3px solid #f2a93b;outline-offset:2px}
input{font:inherit;padding:8px 10px;border-radius:8px;border:1px solid var(--line)}
.bar{height:6px;background:var(--line);border-radius:3px;overflow:hidden}.bar>i{display:block;height:100%;background:var(--accent)}
</style></head><body><main>
<header><div><h1>Quelle vidéo est la meilleure ?</h1><p class="muted">Regardez les deux (avec le son), puis choisissez. Touches : ← A · → B · ↓ égalité. Vous ne savez pas quel moteur a fait quoi : c'est voulu.</p></div>
<div><label>Votre prénom <input id="rater" autocomplete="off"></label> <button id="export">Exporter mes votes</button></div></header>
<div class="bar" aria-hidden="true"><i id="progress" style="width:0"></i></div><p class="muted" id="count" aria-live="polite"></p>
<section class="pair" aria-label="Paire à comparer">
<figure><figcaption>A</figcaption><video id="va" controls playsinline preload="auto"></video></figure>
<figure><figcaption>B</figcaption><video id="vb" controls playsinline preload="auto"></video></figure>
</section>
<div class="actions"><button class="primary" data-v="A">A est meilleure</button><button data-v="tie">Égalité</button><button class="primary" data-v="B">B est meilleure</button></div>
</main>
<script>
const PAIRS=${JSON.stringify(items)};
const $=(id)=>document.getElementById(id);
const store={get(k,d){try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}};
let rater=store.get('rater','');$('rater').value=rater;
function rng(s){let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return()=>((h=Math.imul(h^(h>>>15),2246822507)>>>0)/4294967296)}
function order(){const r=rng(rater||'anon');const list=PAIRS.map(p=>({...p,swap:r()<0.5,k:r()}));return list.sort((x,y)=>x.k-y.k)}
let queue=order(),i=0,votes=store.get('votes:'+rater,[]);
function next(){const done=new Set(votes.map(v=>v.pair));while(i<queue.length&&done.has(queue[i].id))i++;show()}
function show(){const n=votes.length;$('count').textContent=n+' / '+PAIRS.length+' paires';$('progress').style.width=(100*n/PAIRS.length)+'%';
if(i>=queue.length){$('count').textContent='Terminé : merci ! Exportez vos votes.';return}
const p=queue[i];$('va').src=p.swap?p.vb:p.va;$('vb').src=p.swap?p.va:p.vb}
function vote(v){if(!rater){$('rater').focus();return}if(i>=queue.length)return;const p=queue[i];
const winner=v==='tie'?'tie':((v==='A')!==p.swap?p.a:p.b);votes.push({pair:p.id,a:p.a,b:p.b,winner,shownLeft:p.swap?p.b:p.a,at:new Date().toISOString()});store.set('votes:'+rater,votes);i++;next()}
document.querySelectorAll('button[data-v]').forEach(b=>b.addEventListener('click',()=>vote(b.dataset.v)));
document.addEventListener('keydown',e=>{if(e.target.tagName==='INPUT')return;if(e.key==='ArrowLeft')vote('A');if(e.key==='ArrowRight')vote('B');if(e.key==='ArrowDown')vote('tie')});
$('rater').addEventListener('change',e=>{rater=e.target.value.trim();store.set('rater',rater);queue=order();i=0;votes=store.get('votes:'+rater,[]);next()});
$('export').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({rater,votes},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='votes-'+(rater||'anon')+'.json';a.click()});
next();
</script></body></html>`;
}

if (require.main === module) {
  const file = path.join(OUT, 'results.json');
  if (!fs.existsSync(file)) {
    console.log('Aucun résultat : lancez d’abord bench:quality.');
    process.exit(1);
  }
  const results = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, QualityResult>;
  const pairs = buildPairs(results);
  fs.mkdirSync(path.join(OUT, 'rate'), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'votes'), { recursive: true });
  fs.writeFileSync(path.join(OUT, 'rate', 'pairs.json'), JSON.stringify(pairs, null, 2));
  fs.writeFileSync(path.join(OUT, 'rate', 'index.html'), page(pairs, results));
  const kinds = pairs.reduce<Record<string, number>>((a, p) => ((a[p.kind] = (a[p.kind] || 0) + 1), a), {});
  console.log(`${pairs.length} paires (${JSON.stringify(kinds)}) → ${path.join(OUT, 'rate', 'index.html')}`);
}
