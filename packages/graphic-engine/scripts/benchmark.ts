/**
 * Le BANC D'ESSAI A / C (plan de migration, étape « mesurer avant de remplacer »).
 *
 *  A — l'ancien moteur : les moyennes relevées dans les journaux de production (agents graphiques, par appel),
 *      gardées dans `scratch/graphic-baseline/` avant la migration ;
 *  C — le nouveau moteur, sur le corpus de référence, à chaque cran de la jauge, rendu ET mesuré dans
 *      Chromium. Les agents sont SIMULÉS (réponses types, instantanées) : les jetons d'ENTRÉE sont ceux des
 *      vrais prompts ; les jetons de sortie sont ceux des réponses simulées, avec le plafond de la tâche en
 *      regard ; le temps est celui du moteur (composition, rendu, mesure), sans la latence d'un modèle.
 *
 * Écrit `docs/BENCHMARK.md`. `npm run bench` (≈ 3 min).
 */
import fs from 'fs';
import path from 'path';
import type { CreativityLevel, DocumentType, FormatId } from '../src/contracts/common';
import type { SectionContent } from '../src/contracts/content-model';
import type { BrandInput } from '../src/design-system/tokens';
import { configureGraphicEngine } from '../src/host';
import { createDocument } from '../src/engine';
import { closeBrowser } from '../src/quality-engine/browser';
import { diversityStats, parse as parseFingerprint } from '../src/composition-engine/diversity';
import { TASK_POLICIES } from '../src/orchestrator/policies';
import type { GenerationTrace } from '../src/observability/traces';
import { ASK, BRANDS, CARD_BACK, CARD_FRONT, CHARTER, coverSection, FINANCE_BP, flyer, MARKET, PROBLEM, SUMMARY_BP, SWOT_BP, TEAM, TRACTION } from './fixtures';

const LEVELS: CreativityLevel[] = ['low', 'medium', 'high', 'max', 'ultra'];

interface Job {
  name: string;
  documentType: DocumentType;
  format: FormatId;
  brand: BrandInput & { styleId?: string };
  sections: SectionContent[];
  bindings?: 'markers';
}

const JOBS: Job[] = [
  { name: 'Pitch deck', documentType: 'pitch-deck', format: 'slide-16x9', brand: BRANDS.kora, sections: [coverSection('Kora', 'Pitch deck', 'Torréfaction artisanale', 'Le goût du Cameroun, torréfié chaque semaine à Douala'), PROBLEM, MARKET, TRACTION, TEAM, ASK] },
  { name: 'Charte graphique', documentType: 'brand-charter', format: 'slide-16x9', brand: BRANDS.kora, sections: [coverSection('Kora', 'Charte graphique', 'Torréfaction', 'Promesse'), ...CHARTER(BRANDS.kora)] },
  { name: 'Business plan', documentType: 'business-plan', format: 'a4-portrait', brand: BRANDS.baobab, sections: [coverSection('Baobab Agro', 'Business plan', 'Agriculture', 'Promesse'), SUMMARY_BP, FINANCE_BP, SWOT_BP] },
  { name: 'Carte de visite', documentType: 'business-card', format: 'card-landscape', brand: BRANDS.kora, sections: [CARD_FRONT, CARD_BACK], bindings: 'markers' },
  { name: 'Flyer', documentType: 'flyer', format: 'flyer-square', brand: BRANDS.kofi, sections: [flyer(true, { a: '#3a1c4a', b: '#d6246e', c: '#1f1530' })] },
];

/** Des réponses types, de la taille d'une vraie réponse courte (le plafond de la tâche est rapporté à côté). */
function simulatedAgent(): void {
  configureGraphicEngine({
    agentCall: () => async ({ role, system, user }) => {
      if (role === 'graphic.artDirector') {
        return system.includes('"params"')
          ? '{"choice": 2, "params": {}, "tension": "calm", "accent": "none", "why": "La silhouette change de la page précédente et le chiffre-clé garde la place."}'
          : '{"choice": 2, "why": "La silhouette change de la page précédente et le chiffre-clé garde la place."}';
      }
      if (role === 'graphic.composer') {
        const ids = [...user.matchAll(/^- ([\w-]+):/gm)].map((m) => m[1]);
        const blocks = ids.map((id) => ({ t: 'block', ref: id }));
        const body = blocks.length > 1 ? { t: 'grid', cols: [5, 7], gap: 'xl', grow: true, children: [blocks[0], { t: 'stack', gap: 'lg', children: blocks.slice(1) }] } : { t: 'stack', grow: true, justify: 'center', children: blocks };
        return JSON.stringify({ root: { t: 'stack', grow: true, gap: 'lg', children: [{ t: 'text', role: 'kicker', ref: 'kicker' }, { t: 'text', role: 'display', ref: 'title', size: '3xl' }, body] } });
      }
      if (role === 'graphic.repairer') return '{"action": "dense"}';
      return '';
    },
    analyzeImage: async () => '{"hierarchy":4,"alignment":4,"legibility":4,"brand":4,"balance":4,"fit":4}',
  });
}

interface Row {
  job: string;
  level: CreativityLevel;
  pages: number;
  calls: number;
  input: number;
  output: number;
  ceiling: number;
  ms: number;
  patterns: number;
  distance: number;
  /** Silhouettes MESURÉES distinctes sur les pages intérieures (« 5/5 »). */
  silhouettes: string;
  blocking: number;
  repairs: number;
}

async function runJob(job: Job, level: CreativityLevel): Promise<Row> {
  const traces: GenerationTrace[] = [];
  configureGraphicEngine({ onTrace: (t) => traces.push(t) });
  const doc = await createDocument({ documentType: job.documentType, format: job.format, brand: job.brand, direction: { styleId: job.brand.styleId }, creativity: level, seed: `bench:${job.name}`, sections: job.sections.map((s) => ({ id: s.id, role: s.role })), bindings: job.bindings });
  const started = Date.now();
  let blocking = 0;
  const prints: string[] = [];
  const silhouettes: string[] = [];
  for (const [i, s] of job.sections.entries()) {
    const out = await doc.composeSection(s, { index: i + 1, total: job.sections.length });
    blocking += out.result.issues.filter((x) => x.severity === 'blocking').length;
    // Hors couverture : c'est la suite des pages intérieures qui doit varier.
    if (i === 0 && job.sections.length > 1) continue;
    const fp = out.result.html.match(/data-ge-fp="([^"]+)"/)?.[1];
    if (fp) prints.push(fp);
    if (out.result.measured?.silhouette) silhouettes.push(out.result.measured.silhouette);
  }
  const ms = Date.now() - started;
  const tasks = traces.flatMap((t) => t.tasks).filter((t) => t.source === 'llm');
  const ceilings: Record<string, number> = Object.fromEntries(Object.values(TASK_POLICIES).map((p) => [p.task, p.maxTokens]));
  const fingerprints = prints.map((p) => parseFingerprint(p.replace(/&amp;/g, '&'))).filter((f): f is NonNullable<typeof f> => Boolean(f));
  const stats = diversityStats(fingerprints);
  return {
    job: job.name,
    level,
    pages: job.sections.length,
    calls: tasks.length,
    input: tasks.reduce((s, t) => s + t.inputTokens, 0),
    output: tasks.reduce((s, t) => s + t.outputTokens, 0),
    ceiling: tasks.reduce((s, t) => s + (ceilings[t.task] ?? 0), 0),
    ms,
    patterns: stats.distinctPatterns,
    distance: stats.meanDistance,
    silhouettes: `${new Set(silhouettes).size}/${silhouettes.length}`,
    blocking,
    repairs: traces.reduce((s, t) => s + t.repairs.length, 0),
  };
}

/** Les moyennes de l'ancien moteur (journaux de production), par appel. */
function baseline(): Array<{ agent: string; n: number; input: number; output: number; ms: number }> {
  const file = path.resolve(__dirname, '../../../scratch/graphic-baseline/old-graphic-agents.txt');
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .map((line) => line.match(/creative\.(\w+)\s+n\s+(\d+) · in moy\s+(\d+) · out moy\s+(\d+) · ms moy\s+(\d+)/))
    .filter((m): m is RegExpMatchArray => Boolean(m))
    .map((m) => ({ agent: m[1], n: Number(m[2]), input: Number(m[3]), output: Number(m[4]), ms: Number(m[5]) }));
}

const per = (v: number, pages: number) => Math.round(v / Math.max(1, pages));
const fmt = (v: number) => v.toLocaleString('fr-FR');

async function main() {
  simulatedAgent();
  const rows: Row[] = [];
  for (const level of LEVELS) {
    for (const job of JOBS) {
      const row = await runJob(job, level);
      rows.push(row);
      console.log(`${level.padEnd(7)} ${job.name.padEnd(18)} appels ${String(row.calls).padStart(3)} · entrée ${String(row.input).padStart(6)} · sortie ${String(row.output).padStart(5)} (plafond ${row.ceiling}) · ${per(row.ms, row.pages)} ms/page · ${row.patterns} motifs · silhouettes ${row.silhouettes} · distance ${row.distance} · bloquants ${row.blocking}`);
    }
  }
  await closeBrowser();

  const old = baseline();
  const byLevel = LEVELS.map((level) => {
    const r = rows.filter((x) => x.level === level);
    const pages = r.reduce((s, x) => s + x.pages, 0);
    return { level, pages, calls: r.reduce((s, x) => s + x.calls, 0), input: r.reduce((s, x) => s + x.input, 0), output: r.reduce((s, x) => s + x.output, 0), ceiling: r.reduce((s, x) => s + x.ceiling, 0), ms: r.reduce((s, x) => s + x.ms, 0), blocking: r.reduce((s, x) => s + x.blocking, 0), repairs: r.reduce((s, x) => s + x.repairs, 0) };
  });
  const composer = old.find((o) => o.agent === 'pageComposer');
  const director = old.find((o) => o.agent === 'pageDirector');
  const critic = old.find((o) => o.agent === 'documentCritic');
  const oldPage = composer ? composer.input + composer.output + (director ? director.input + director.output : 0) : 0;

  const md = `# Banc d'essai — ancien moteur (A) contre @idem/graphic-engine (C)

Généré par \`npm run bench\` le ${new Date().toISOString().slice(0, 10)}. Corpus : ${JOBS.map((j) => `${j.name.toLowerCase()} (${j.sections.length} p.)`).join(', ')} — ${JOBS.reduce((s, j) => s + j.sections.length, 0)} pages par cran.

## Méthode

- **A — ancien moteur** : moyennes PAR APPEL relevées dans les journaux de production avant la migration
  (\`scratch/graphic-baseline/\`), toutes jauges confondues. Le compositeur de page y écrivait le HTML lui-même.
- **C — nouveau moteur** : le corpus de référence composé, rendu et MESURÉ dans Chromium à chaque cran.
  Les agents sont simulés (réponses types, instantanées) : les jetons d'**entrée** sont ceux des vrais prompts ;
  la **sortie** est celle des réponses simulées, avec le **plafond** de chaque tâche en regard ; le **temps** est
  celui du moteur (composition, rendu, mesure, réparations), sans la latence d'un modèle.

## A — l'ancien moteur (par appel, journaux)

| Agent | Appels relevés | Entrée moy. | Sortie moy. | Durée moy. |
|---|---:|---:|---:|---:|
${old.map((o) => `| ${o.agent} | ${o.n} | ${fmt(o.input)} | ${fmt(o.output)} | ${fmt(Math.round(o.ms / 100) / 10)} s |`).join('\n')}

Une page composée par l'ancien moteur coûtait au moins **${fmt(oldPage)} jetons** (direction de page + compositeur${critic ? ', hors critique' : ''}) et **${composer ? fmt(Math.round(composer.ms / 1000)) : '?'} s** de modèle.

## C — le nouveau moteur, par cran

| Cran | Pages | Appels de modèle | Appels / page | Entrée / page | Sortie / page (simulée) | Plafond de sortie / page | Moteur / page | Constats bloquants | Réparations par le code |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
${byLevel.map((l) => `| ${l.level} | ${l.pages} | ${l.calls} | ${(l.calls / l.pages).toFixed(2)} | ${fmt(per(l.input, l.pages))} | ${fmt(per(l.output, l.pages))} | ${fmt(per(l.ceiling, l.pages))} | ${fmt(per(l.ms, l.pages))} ms | ${l.blocking} | ${l.repairs} |`).join('\n')}

## C — détail par livrable

| Cran | Livrable | Appels | Entrée | Motifs distincts | Silhouettes mesurées distinctes | Distance moyenne | Bloquants | Moteur / page |
|---|---|---:|---:|---:|---:|---:|---:|---:|
${rows.map((r) => `| ${r.level} | ${r.job} | ${r.calls} | ${fmt(r.input)} | ${r.pages > 1 ? r.patterns : '—'} | ${r.pages > 1 ? r.silhouettes : '—'} | ${r.pages > 2 ? r.distance : '—'} | ${r.blocking} | ${fmt(per(r.ms, r.pages))} ms |`).join('\n')}

## Lecture

- **Low et Medium** : zéro appel de modèle — le code compose, rend et mesure chaque page.
- **High** choisit dans un menu, **Max** choisit et règle en un appel, **Ultra** compose l'arbre de la page :
  le coût par page reste une fraction de celui de l'ancien compositeur, qui ÉCRIVAIT le HTML (sortie
  moyenne ${composer ? fmt(composer.output) : '?'} jetons par page).
- La critique visuelle (High+) ne s'exécute que sur une page déjà juste ; elle départage des rendus valides.
- Les pages Ultra sont des arbres d'auteur (motif « authored ») : leur diversité se lit dans les silhouettes
  MESURÉES, pas dans les noms de motifs. Les mesures excluent la couverture. Ici, le compositeur SIMULÉ rend
  le même arbre pour chaque page : la diversité d'Ultra n'est pas mesurée par ce banc (elle dépend du modèle
  réel) ; ce qui l'est, c'est que chaque arbre est validé, rendu et mesuré sans constat bloquant.
- Les constats bloquants sont ceux qui restent APRÈS les réparations du code (textes ajustés, contraste
  ramené à l'encre de la charte, décor retiré, mise à l'échelle bornée, composition suivante) : c'est ce qui
  partirait chez le client.
`;
  const out = path.resolve(__dirname, '../docs/BENCHMARK.md');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, md);
  console.log(`\n→ ${out}`);
}

main().catch(async (error) => {
  console.error(error);
  await closeBrowser();
  process.exit(1);
});
