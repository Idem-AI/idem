/**
 * `npm run bench:report --prefix packages/motion-compiler` — écrit `bench/out/report.html` à partir de `results.json`.
 *
 * Trois parties : (1) les MESURES (coût réel en dollars, jetons, appels, délais, fiabilité) par logique ;
 * (2) les RENDUS côte à côte, demande par demande, avec le mode « à l'aveugle » (noms des logiques masqués,
 * ordre mélangé) et la grille de notes humaines ; (3) le détail de chaque scène (statut, vignette, code).
 * Les coûts et les délais sont présentés séparément des notes, comme le veut la règle de décision.
 */
import fs from 'fs';
import path from 'path';

const OUT = path.join(__dirname, 'out');
const results = JSON.parse(fs.readFileSync(path.join(OUT, 'results.json'), 'utf8')) as any[];
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const NAME: Record<string, string> = { tsx: 'Avant · TSX libre (supprimé)', dsl: 'Programme v0.1', v2: 'Programme v0.2 (actuel)' };
const LABEL: Record<string, string> = { typo: 'Typographique', data: 'Données animées', demo: 'Démo produit', story: 'Récit en 5 scènes' };
const tokens = (u: any) => u.input + u.output;
const sum = (rs: any[], f: (r: any) => number) => rs.reduce((n, r) => n + f(r), 0);

function aggregate(logic: string, level?: string) {
  const rs = results.filter((r) => r.logic === logic && (!level || r.level === level));
  const n = rs.length || 1;
  const scenes = sum(rs, (r) => r.scenes) || 1;
  return {
    runs: rs.length,
    mp4: rs.filter((r) => r.ok).length,
    sceneOk: sum(rs, (r) => r.scenesReady),
    scenes,
    // 1re écriture en échec : relevé direct, ou reconstitué (scènes corrigées + scènes restées en erreur).
    firstFail: sum(rs, (r) => Math.max(r.firstPassErrors, r.repairedScenes + (r.scenes - r.scenesReady))),
    repaired: sum(rs, (r) => r.repairedScenes),
    authorCost: sum(rs, (r) => r.author.cost),
    authorTokens: sum(rs, (r) => tokens(r.author)),
    outTokens: sum(rs, (r) => r.author.output),
    calls: sum(rs, (r) => r.author.calls),
    retries: sum(rs, (r) => r.validationRetries),
    authorMs: sum(rs, (r) => r.author.ms) / n,
    renderMs: sum(rs, (r) => r.renderMs) / n,
    codeChars: sum(rs, (r) => r.authorCodeChars) / n,
    layoutFixed: sum(rs, (r) => r.layoutFixed || 0),
    layoutLeft: sum(rs, (r) => r.layoutLeft || 0),
    formats: rs.length ? Math.max(...rs.map((r) => (r.formats || [r.brief]).length)) : 0,
  };
}
const money = (v: number) => `$${v.toFixed(4)}`;
const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)} %` : '—');
const sec = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

const levels = [...new Set(results.map((r) => r.level))];
const briefs = [...new Set(results.map((r) => r.brief))];
const logics = ['tsx', 'dsl', 'v2'].filter((l) => results.some((r) => r.logic === l));

function aggRow(label: string, level?: string) {
  const ag = logics.map((l) => aggregate(l, level));
  const row = (name: string, f: (a: ReturnType<typeof aggregate>) => string, hint = '') => `<tr><th>${name}${hint ? `<small>${hint}</small>` : ''}</th>${ag.map((a) => `<td>${a.runs ? f(a) : '—'}</td>`).join('')}</tr>`;
  return `<h3>${label}</h3><div class="scroll"><table><thead><tr><th>Mesure</th>${logics.map((l) => `<th>${NAME[l]}</th>`).join('')}</tr></thead><tbody>
${row('Vidéos produites (MP4 lisible)', (a) => `${a.mp4} / ${a.runs}`)}
${row('Scènes qui s’exécutent à la livraison', (a) => pct(a.sceneOk, a.scenes))}
${row('Scènes en échec à la 1re écriture', (a) => `${a.firstFail} / ${a.scenes}`, 'avant toute correction')}
${row('Scènes corrigées automatiquement', (a) => String(a.repaired))}
${row('Défauts d’affichage corrigés / restants', (a) => (a.layoutFixed + a.layoutLeft ? `${a.layoutFixed} / ${a.layoutLeft}` : '—'), 'texte coupé, textes chevauchés (v0.2)')}
${row('Coût des modèles — écriture des scènes', (a) => money(a.authorCost), 'dollars réels OpenRouter')}
${row('Coût moyen par vidéo', (a) => money(a.authorCost / (a.runs || 1)))}
${row('Jetons (entrée + sortie)', (a) => a.authorTokens.toLocaleString('fr-FR'))}
${row('dont jetons générés (sortie)', (a) => a.outTokens.toLocaleString('fr-FR'), 'ce que le modèle écrit')}
${row('Appels de modèle', (a) => String(a.calls), 'corrections comprises')}
${row('Programmes refusés puis redemandés', (a) => String(a.retries))}
${row('Temps cumulé d’écriture, moyenne / vidéo', (a) => sec(a.authorMs), 'somme des appels')}
${row('Formats rendus par vidéo', (a) => String(a.formats))}
</tbody></table></div>`;
}

const shared = (b: string, l: string) => results.find((r) => r.brief === b && r.level === l && r.logic === 'tsx')?.shared || results.find((r) => r.brief === b && r.level === l)?.shared;

function videoCard(r: any, key: string) {
  const vid = (src: string, label = '') => `<div class="v">${label ? `<span class="fmt">${label}</span>` : ''}<video controls preload="metadata" playsinline src="${src}" poster="${src.replace('.mp4', '.jpg')}"></video></div>`;
  const extra = Object.entries(r.mp4s || {}).filter(([, src]) => src !== r.mp4);
  const mp4 = r.mp4 ? `<div class="vids">${vid(r.mp4, extra.length ? (r.formats?.[0] || '') : '')}${extra.map(([f, src]) => vid(src as string, f)).join('')}</div>` : `<div class="fail">Aucune vidéo — ${esc(r.error || 'échec')}</div>`;
  return `<figure data-key="${key}" data-logic="${r.logic}"><div class="who"><span class="real">${NAME[r.logic]}</span><span class="blind"></span></div>${mp4}
<figcaption>scènes ${r.scenesReady}/${r.scenes} · ${money(r.author.cost)} · ${tokens(r.author).toLocaleString('fr-FR')} jetons · ${r.author.calls} appels</figcaption>${rating(key)}</figure>`;
}
const CRIT = ['Originalité', 'Cohérence', 'Qualité du mouvement', 'Lisibilité', 'Fidélité au brief'];
function rating(key: string) {
  return `<div class="rate">${CRIT.map((c, i) => `<label>${c}<select data-rate="${key}" data-c="${i}"><option value="">—</option>${[1, 2, 3, 4, 5].map((n) => `<option>${n}</option>`).join('')}</select></label>`).join('')}</div>`;
}

const sections = levels.map((level) => `<section><h2>Cran ${esc(level)}</h2>${briefs.map((b) => {
  const pair = logics.map((l) => results.find((r) => r.brief === b && r.logic === l && r.level === level)).filter(Boolean);
  if (!pair.length) return '';
  const first = pair[0];
  return `<article class="pair" data-pair="${b}-${level}"><h3>${esc(LABEL[b] || b)} <small>${esc(first.title || '')}</small></h3>
<p class="meta">Direction + storyboard communs (mis en cache, identiques pour les deux) : ${money(shared(b, level)?.cost || 0)} · ${esc(first.concept || '')}</p>
<div class="grid">${pair.map((r) => videoCard(r, `${b}-${r.logic}-${level}`)).join('')}</div>
<details><summary>Détail des scènes</summary><div class="grid">${pair.map((r) => `<div><h4>${NAME[r.logic]}</h4><ul class="scenes">${r.sceneList.map((s: any) => `<li class="${s.status}">${s.thumb ? `<img loading="lazy" src="${s.thumb}" alt="">` : ''}<div><b>${s.key}</b> ${esc(s.purpose)} <em>${s.status === 'ready' ? 'ok' : esc(s.error || 'erreur')}</em><br><a href="${s.codeFile}">code</a></div></li>`).join('')}</ul></div>`).join('')}</div></details></article>`;
}).join('')}</section>`).join('');

const total = (l: string) => aggregate(l);
const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Banc d’essai vidéo</title><style>
:root{color-scheme:light;--bg:#fff;--ink:#14181f;--mut:#5b6472;--line:#e2e6ec;--acc:#1447e6;--soft:#f5f7fa;--bad:#b3261e}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}
main{max-width:1180px;margin:0 auto;padding:24px 16px 80px}h1{font-size:26px;margin:0 0 4px}h2{font-size:20px;margin:36px 0 8px;border-top:1px solid var(--line);padding-top:20px}h3{font-size:16px;margin:18px 0 8px}h3 small{color:var(--mut);font-weight:400}
p{color:var(--mut)}table{width:100%;border-collapse:collapse;font-size:14px}th,td{padding:7px 10px;border-bottom:1px solid var(--line);text-align:left}thead th{background:var(--soft)}tbody th{font-weight:500}th small{display:block;color:var(--mut);font-weight:400;font-size:12px}td{font-variant-numeric:tabular-nums}
.scroll{overflow-x:auto}.vids{display:flex;gap:8px;align-items:flex-start}.vids .v{flex:1;min-width:0;position:relative}.fmt{position:absolute;top:6px;left:6px;background:rgba(0,0,0,.6);color:#fff;font-size:11px;padding:2px 6px;border-radius:4px;z-index:1}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;align-items:start}figure{margin:0;border:1px solid var(--line);border-radius:12px;padding:10px;background:#fff}video{width:100%;max-height:520px;background:#000;border-radius:8px}figcaption{font-size:12px;color:var(--mut);margin:6px 0}.who{font-weight:600;margin-bottom:6px}.blind{display:none}body.blind .real{display:none}body.blind .blind{display:inline}
.fail{background:#fdecea;color:var(--bad);padding:30px 12px;border-radius:8px;text-align:center}.rate{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:6px;font-size:12px;color:var(--mut)}.rate select{display:block;width:100%;margin-top:2px;padding:4px;border:1px solid var(--line);border-radius:6px;background:#fff;color:var(--ink)}
.bar{position:sticky;top:0;background:#fff;border-bottom:1px solid var(--line);padding:10px 16px;display:flex;gap:16px;align-items:center;flex-wrap:wrap;z-index:5}button{background:var(--acc);color:#fff;border:0;border-radius:8px;padding:8px 14px;font:inherit;cursor:pointer}button.ghost{background:#fff;color:var(--ink);border:1px solid var(--line)}
.scenes{list-style:none;margin:0;padding:0;display:grid;gap:8px}.scenes li{display:flex;gap:10px;font-size:13px}.scenes img{width:54px;border-radius:6px;border:1px solid var(--line)}.scenes li.error em{color:var(--bad)}.scenes em{color:var(--mut);font-style:normal}
#tally{margin-top:12px}.pair{margin-top:20px}.meta{font-size:13px;margin:0 0 8px}details{margin-top:10px}summary{cursor:pointer;color:var(--acc)}a{color:var(--acc)}
</style></head><body><div class="bar"><b>Banc d’essai vidéo</b><label><input type="checkbox" id="blind"> Évaluer à l’aveugle (noms masqués, ordre mélangé)</label><button id="sum" class="ghost">Calculer les notes</button><button id="reset" class="ghost">Effacer mes notes</button></div>
<main><h1>Moteur vidéo : avant et après le Motion Compiler</h1>
<p>${results.length} vidéos réelles, mêmes demandes, mêmes marques, mêmes médias, mêmes storyboards (la direction et le storyboard sont communs et mis en cache). Seule l’écriture des scènes diffère. Ni média généré, ni musique, ni voix : on mesure l’écriture et le rendu des scènes. Coûts en dollars réels rendus par OpenRouter pour les modèles de chaque cran.</p>
<h2>1. Mesures</h2>${aggRow('Tous crans confondus')}${levels.map((l) => aggRow(`Cran ${l}`, l)).join('')}
<p>Règle de décision : retenir le programme seulement s’il atteint une qualité artistique comparable ou supérieure, avec moins de coût, moins d’erreurs ou un délai plus court. Les notes ci-dessous donnent le volet artistique.</p>
<h2>2. Rendus et notes humaines</h2><div id="tally"></div>${sections}</main>
<script>
const NAMES=${JSON.stringify(NAME)},K='bench-ratings-v1';
let store={};try{store=JSON.parse(localStorage.getItem(K)||'{}')}catch(e){}
const save=()=>{try{localStorage.setItem(K,JSON.stringify(store))}catch(e){}};
document.querySelectorAll('select[data-rate]').forEach(s=>{const k=s.dataset.rate+'|'+s.dataset.c;if(store[k])s.value=store[k];s.onchange=()=>{store[k]=s.value;save()}});
const hash=s=>[...s].reduce((a,c)=>(a*31+c.charCodeAt(0))>>>0,7);
document.getElementById('blind').onchange=e=>{if(!e.target.checked){location.reload();return}document.body.classList.add('blind');document.querySelectorAll('[data-pair] > .grid').forEach(g=>{const p=g.closest('[data-pair]').dataset.pair;const f=[...g.children].filter(c=>c.matches('figure'));const k=hash(p)%f.length;const order=f.slice(k).concat(f.slice(0,k));order.forEach((fig,i)=>{g.appendChild(fig);fig.querySelector('.blind').textContent='Vidéo '+'XYZW'[i]})})};
document.getElementById('reset').onclick=()=>{store={};save();location.reload()};
document.getElementById('sum').onclick=()=>{const t={};for(const k in store){if(!store[k])continue;const[key]=k.split('|');const logic=key.split('-')[1];const level=key.split('-')[2];const a=t[logic+'|'+level]||(t[logic+'|'+level]={n:0,s:0,c:{}});a.n++;a.s+=Number(store[k])}
const rows=Object.entries(t).map(([k,v])=>{const[l,lv]=k.split('|');return '<tr><td>'+NAMES[l]+'</td><td>'+lv+'</td><td>'+(v.s/v.n).toFixed(2)+' / 5</td><td>'+v.n+' notes</td></tr>'}).join('');
document.getElementById('tally').innerHTML=rows?'<table><thead><tr><th>Logique</th><th>Cran</th><th>Note moyenne</th><th></th></tr></thead><tbody>'+rows+'</tbody></table>':'<p>Aucune note saisie.</p>'};
</script></body></html>`;
fs.writeFileSync(path.join(OUT, 'report.html'), html);
console.log(`Rapport : ${path.join(OUT, 'report.html')} (${total('tsx').runs + total('dsl').runs} vidéos)`);
