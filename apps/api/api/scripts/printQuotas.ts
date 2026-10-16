/**
 * Matrice des quotas IA — écrit `docs/QUOTAS.md` depuis le code.
 *
 *   npm run quotas:matrix                     → écrit docs/QUOTAS.md
 *   npm run quotas:matrix -- --out <chemin>   → écrit aussi une copie ailleurs
 *
 * Tout chiffre du document vient du code : enveloppes de génération et prix des modèles
 * (`config/generation-budgets.ts`, `config/openrouter.config.ts`), barème en francs (modèle au portefeuille)
 * (`models/billing.model.ts`, `models/plan-limits.model.ts`), quotas par offre et plafonds de
 * dépense (`models/usage-quota.model.ts`). Le document ne se modifie pas à la main : on corrige
 * la source, puis on relance.
 */
import { promises as fs } from 'fs';
import path from 'path';

import {
  CREDIT_VALUE_XAF,
  ENVELOPE_LEVELS,
  GENERATION_ENVELOPES,
  MEDIA_UNIT_USD,
  TARGET_TYPICAL_MARGIN,
  envelopeCost,
  envelopeEconomics,
  generationBudget,
} from '../config/generation-budgets';
import { COST_LEVERS, targetScenario } from '../config/cost-scenarios';
import { getXafPerUsd } from '../models/billing.model';
import { CreativityLevel } from '../models/creativity.model';
import {
  DEFAULT_QUOTA_LIMITS,
  DEFAULT_SPEND_CAPS_USD,
  QUOTA_GROUPS,
  QUOTA_GROUP_LABELS,
  QUOTA_TIERS,
  QuotaGroup,
  QuotaTier,
  WindowLimits,
} from '../models/usage-quota.model';

const RATE = getXafPerUsd();

const TIER_LABELS: Record<QuotaTier, string> = {
  free: 'Gratuit (Découverte / Hobby)',
  starter: 'Essentiel / Starter',
  growth: 'Croissance / Pro',
  top: 'Cabinet / Studio / Scale',
  beta: 'Bêta premium (offerte)',
};

const LEVEL_LABELS: Record<CreativityLevel, string> = { low: 'Low', medium: 'Medium', high: 'High', ultra: 'Ultra' };

const fmt = (value: number, digits = 0): string =>
  value.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).replace(/ /g, ' ');
const xaf = (usd: number): string => `${fmt(usd * RATE, usd * RATE < 10 ? 1 : 0)} F`;
const usd = (value: number): string => `$${value < 0.01 ? value.toFixed(4) : value.toFixed(3)}`;
const tokens = (value: number): string => (value >= 1000 ? `${fmt(value / 1000, value >= 100_000 ? 0 : 1)} k` : fmt(value));
const pct = (value: number | null): string => (value === null ? '—' : `${fmt(value * 100)} %`);
const limit = (value: number | null): string => (value === null ? '∞' : fmt(value));
const windows = (limits: WindowLimits): string => `${limit(limits.day)} / ${limit(limits.week)} / ${limit(limits.month)}`;

function levelsOf(key: string): CreativityLevel[] {
  return GENERATION_ENVELOPES[key].creativity ? [...ENVELOPE_LEVELS] : ['medium'];
}

/** Le modèle qui coûte le plus dans une enveloppe, au cran donné : ce qui se lit d'abord. */
function mainModels(key: string, level: CreativityLevel): string {
  const lines = envelopeCost(key, level, 'max').lines.filter((line) => line.inputTokens + line.outputTokens > 0);
  const byModel = new Map<string, number>();
  for (const line of lines) byModel.set(line.model, (byModel.get(line.model) ?? 0) + line.usd);
  return [...byModel.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([model]) => `\`${model.split('/').pop()}\``)
    .join(', ');
}

function verdict(key: string, level: CreativityLevel): string {
  const eco = envelopeEconomics(key, level);
  if (GENERATION_ENVELOPES[key].engine === 'free') return 'gratuit — borné par le quota';
  if (eco.credits <= 0) return 'inclus';
  if (eco.ok) return '✅';
  const issues: string[] = [];
  if ((eco.marginAtFloor ?? -1) < 0) issues.push('perte possible au plancher');
  if ((eco.typicalMarginAtReference ?? -1) < TARGET_TYPICAL_MARGIN) issues.push('marge < 75 %');
  return `⚠️ ${issues.join(', ')} → ${eco.minimumCredits} F`;
}

function featureSection(key: string): string {
  const env = GENERATION_ENVELOPES[key];
  const out: string[] = [];
  out.push(`#### ${env.label}`);
  out.push('');
  out.push(`Clé \`${key}\` · groupe **${QUOTA_GROUP_LABELS[env.group]}** · ${env.creativity ? 'suit la jauge de créativité' : 'hors jauge'}`);
  if (env.entrypoints.length) out.push(`  \nPoints d’entrée : ${env.entrypoints.map((e) => `\`${e}\``).join(', ')}`);
  out.push('');
  out.push('| Cran | Modèles dominants | Entrée typ. / max | Sortie typ. / max | Coût typ. | Coût max | Prix | Marge au plafond (plancher) | Marge typique (référence) | Verdict |');
  out.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const level of levelsOf(key)) {
    const eco = envelopeEconomics(key, level);
    out.push(
      `| ${env.creativity ? LEVEL_LABELS[level] : '—'} | ${mainModels(key, level)} | ${tokens(eco.typical.inputTokens)} / ${tokens(eco.max.inputTokens)} | ${tokens(eco.typical.outputTokens)} / ${tokens(eco.max.outputTokens)} | ${xaf(eco.typical.usd)} | ${xaf(eco.max.usd)} | ${env.engine === 'free' ? '0' : `${eco.credits} F`} | ${pct(eco.marginAtFloor)} | ${pct(eco.typicalMarginAtReference)} | ${verdict(key, level)} |`
    );
  }
  out.push('');

  // Détail par étape, au cran de référence (Medium, ou le seul cran).
  const level: CreativityLevel = 'medium';
  const max = envelopeCost(key, level, 'max');
  const typical = envelopeCost(key, level, 'typical');
  out.push(`<details><summary>Détail des étapes${env.creativity ? ' (cran Medium)' : ''}</summary>`);
  out.push('');
  out.push('| Étape | Modèle | Appels typ. / max | Entrée typ. / max | Sortie typ. / max | Coût typ. / max |');
  out.push('|---|---|---|---|---|---|');
  max.lines.forEach((line, index) => {
    const t = typical.lines[index];
    const isMedia = line.inputTokens + line.outputTokens === 0 && t.inputTokens + t.outputTokens === 0 && !line.model.includes('/');
    out.push(
      `| ${line.step} | \`${line.model}\` | ${fmt(t.calls, t.calls % 1 ? 1 : 0)} / ${fmt(line.calls)} | ${isMedia ? '—' : `${tokens(t.inputTokens)} / ${tokens(line.inputTokens)}`} | ${isMedia ? '—' : `${tokens(t.outputTokens)} / ${tokens(line.outputTokens)}`} | ${xaf(t.usd)} / ${xaf(line.usd)} |`
    );
  });
  out.push('');
  const budget = generationBudget(key, level);
  if (budget) {
    out.push(`Budget d’exécution : alerte au-delà de ${xaf(budget.softUsd)}, arrêt (mode \`enforce\`) au-delà de ${xaf(budget.hardUsd)}.`);
    out.push('');
  }
  out.push('</details>');
  out.push('');
  if (env.note) {
    out.push(`> ${env.note}`);
    out.push('');
  }
  return out.join('\n');
}

/** Pire cas mensuel d'une offre : chaque groupe consommé jusqu'à sa limite au coût plafond de son action la plus chère. */
function exposure(tier: QuotaTier): { group: QuotaGroup; month: number | null; worstKey: string | null; worstUsd: number; totalUsd: number }[] {
  return QUOTA_GROUPS.map((group) => {
    const month = DEFAULT_QUOTA_LIMITS[tier][group].month;
    let worstKey: string | null = null;
    let worstUsd = 0;
    for (const key of Object.keys(GENERATION_ENVELOPES)) {
      if (GENERATION_ENVELOPES[key].group !== group) continue;
      for (const level of levelsOf(key)) {
        const cost = envelopeCost(key, level, 'max').usd;
        if (cost > worstUsd) {
          worstUsd = cost;
          worstKey = key;
        }
      }
    }
    return { group, month, worstKey, worstUsd, totalUsd: month === null ? Infinity : month * worstUsd };
  });
}

function render(): string {
  const date = new Date().toISOString().slice(0, 10);
  const keys = Object.keys(GENERATION_ENVELOPES);
  const out: string[] = [];

  out.push('# Quotas IA par fonctionnalité');
  out.push('');
  out.push(`> Généré par \`npm run quotas:matrix\` le ${date} — ne pas modifier à la main : corriger \`config/generation-budgets.ts\` ou \`models/usage-quota.model.ts\`, puis relancer.`);
  out.push('');
  out.push('## Comment lire ce document');
  out.push('');
  out.push('Chaque génération IA a une **enveloppe** : ses étapes, le modèle de chacune, le nombre d’appels et les jetons d’entrée et de sortie, en valeur **typique** et en **plafond** (les `maxOutputTokens` configurés, le nombre maximal de sections ou de scènes, les reprises bornées). Multipliée par le tarif OpenRouter du modèle choisi pour la fonctionnalité, elle donne le coût d’une génération à chaque cran de la jauge de créativité.');
  out.push('');
  out.push(`- Taux de conversion : **1 $ = ${fmt(RATE)} F CFA** (\`XAF_USD_RATE\`).`);
  out.push(`- Valeur nette d’un franc de prix (modèle au portefeuille) : **plancher ${fmt(CREDIT_VALUE_XAF.floor, 2)} F** (pire grille pays, bonus de recharge maximal, frais) et **référence ${fmt(CREDIT_VALUE_XAF.reference, 2)} F** (frais seuls). Un livrable rapporte sa part du Kit plafonné (2 500 F pour 7 500 F) ; une esquisse, une aide ou la génération initiale iCode ne rapportent rien et sont bornées par les quotas.`);
  out.push('- **R1 · jamais à perte** : coût plafond ≤ prix × valeur plancher (« marge au plafond » ≥ 0).');
  out.push(`- **R2 · très rentable** : coût typique ≤ ${fmt((1 - TARGET_TYPICAL_MARGIN) * 100)} % du prix × valeur de référence (« marge typique » ≥ ${fmt(TARGET_TYPICAL_MARGIN * 100)} %).`);
  out.push(`- Unités hors jetons : résultat web ${usd(MEDIA_UNIT_USD.web_result)}, image FLUX.2 ${usd(MEDIA_UNIT_USD.image)}, image Gemini ${usd(MEDIA_UNIT_USD.image_gemini)}, seconde de clip ${usd(MEDIA_UNIT_USD.video_second)}, voix ${fmt(MEDIA_UNIT_USD.speech_char * 1_000_000, 2)} $ par million de caractères.`);
  out.push('');
  out.push('Les **quotas** comptent les générations par groupe de fonctionnalités, par jour (UTC), semaine (ISO, lundi) et mois. Un **plafond de dépense IA** par compte complète le comptage : il arrête le pire cas (une suite de générations au coût plafond) avant qu’il ne coûte plus que ce que l’offre rapporte. Enfin chaque génération a un **budget d’exécution** : au-delà, elle est signalée (mode `log`) ou arrêtée et remboursée (mode `enforce`).');
  out.push('');

  out.push('## 1. Quotas par offre — jour / semaine / mois');
  out.push('');
  out.push(`| Groupe | ${QUOTA_TIERS.map((tier) => TIER_LABELS[tier]).join(' | ')} |`);
  out.push(`|---|${QUOTA_TIERS.map(() => '---').join('|')}|`);
  for (const group of QUOTA_GROUPS) {
    out.push(`| ${QUOTA_GROUP_LABELS[group]} | ${QUOTA_TIERS.map((tier) => windows(DEFAULT_QUOTA_LIMITS[tier][group])).join(' | ')} |`);
  }
  out.push('');
  out.push('**Ce que chaque groupe recouvre**');
  out.push('');
  out.push('| Groupe | Fonctionnalités comptées |');
  out.push('|---|---|');
  for (const group of QUOTA_GROUPS) {
    const labels = keys.filter((key) => GENERATION_ENVELOPES[key].group === group).map((key) => GENERATION_ENVELOPES[key].label);
    out.push(`| ${QUOTA_GROUP_LABELS[group]} | ${labels.join(' · ') || '—'} |`);
  }
  out.push('');
  out.push('Le palier se lit sur l’offre du moteur du groupe (iBusiness pour retouches, créations, livrables et vidéos ; iCode pour les applications) ; les aides IA et les simulations prennent la meilleure offre du compte. Un accès bêta offert a son propre palier, volontairement borné. Les limites se surchargent sans redéploiement (`billing_settings.usageQuotas`).');
  out.push('');

  out.push('## 2. Plafond de dépense IA par compte');
  out.push('');
  out.push('| Offre | Jour | Semaine | Mois |');
  out.push('|---|---|---|---|');
  for (const tier of QUOTA_TIERS) {
    const caps = DEFAULT_SPEND_CAPS_USD[tier];
    const cell = (value: number | null) => (value === null ? '∞' : `${usd(value)} (${xaf(value)})`);
    out.push(`| ${TIER_LABELS[tier]} | ${cell(caps.day)} | ${cell(caps.week)} | ${cell(caps.month)} |`);
  }
  out.push('');
  out.push('Le plafond n’est jamais affiché en montant à l’utilisateur : le tableau de bord montre une « capacité de génération » en pourcentage.');
  out.push('');

  out.push('## 3. Coût, prix et marge de chaque fonctionnalité');
  out.push('');
  for (const group of QUOTA_GROUPS) {
    const inGroup = keys.filter((key) => GENERATION_ENVELOPES[key].group === group);
    if (!inGroup.length) continue;
    out.push(`### Groupe « ${QUOTA_GROUP_LABELS[group]} »`);
    out.push('');
    for (const key of inGroup) out.push(featureSection(key));
  }

  out.push('## 4. Actions dont le prix ne tient pas les deux règles');
  out.push('');
  out.push('| Action | Cran | Prix actuel | Coût typ. | Coût max | Prix minimum (R1 + R2) |');
  out.push('|---|---|---|---|---|---|');
  let failing = 0;
  for (const key of keys) {
    if (GENERATION_ENVELOPES[key].engine === 'free') continue;
    for (const level of levelsOf(key)) {
      const eco = envelopeEconomics(key, level);
      if (eco.ok || eco.credits <= 0) continue;
      failing++;
      out.push(`| ${GENERATION_ENVELOPES[key].label} | ${GENERATION_ENVELOPES[key].creativity ? LEVEL_LABELS[level] : '—'} | ${eco.credits} F | ${xaf(eco.typical.usd)} | ${xaf(eco.max.usd)} | **${eco.minimumCredits} F** |`);
    }
  }
  if (!failing) out.push('| — | — | — | — | — | Toutes les actions tiennent R1 et R2. |');
  out.push('');

  out.push('## 5. Exposition maximale par offre (pire cas mensuel)');
  out.push('');
  out.push('Chaque groupe consommé jusqu’à sa limite mensuelle, chaque fois au coût plafond de son action la plus chère. Ce pire cas est théorique : le plafond de dépense mensuel l’arrête bien avant.');
  out.push('');
  out.push('| Offre | Pire cas sans plafond | Plafond de dépense mensuel |');
  out.push('|---|---|---|');
  for (const tier of QUOTA_TIERS) {
    const total = exposure(tier).reduce((sum, row) => sum + row.totalUsd, 0);
    const cap = DEFAULT_SPEND_CAPS_USD[tier].month;
    out.push(`| ${TIER_LABELS[tier]} | ${Number.isFinite(total) ? `${usd(total)} (${xaf(total)})` : '∞'} | ${cap === null ? '∞' : `${usd(cap)} (${xaf(cap)})`} |`);
  }
  out.push('');

  out.push('## 6. Scénario cible : coûts après optimisation et prix recommandés');
  out.push('');
  out.push('Les mêmes enveloppes, rejouées avec les leviers de la phase 1 du plan d’action (`config/cost-scenarios.ts`). Le prix recommandé est le plus bas qui tient R1 et R2 : le prix actuel quand il suffit, sinon le minimum arrondi. Une action qui suit la jauge garde un seul prix de base, multiplié par cran.');
  out.push('');
  out.push('| Levier | Changement |');
  out.push('|---|---|');
  for (const lever of COST_LEVERS) out.push(`| **${lever.id}** · ${lever.label} | ${lever.change} |`);
  out.push('');
  out.push('| Action | Cran | Coût typ. aujourd’hui → cible | Coût max aujourd’hui → cible | Prix actuel | Prix recommandé | Marge typique | Marge au plafond |');
  out.push('|---|---|---|---|---|---|---|---|');
  for (const entry of targetScenario(ENVELOPE_LEVELS)) {
    const changed = entry.recommendedCredits !== entry.currentCredits;
    out.push(
      `| ${entry.label}${entry.virtual ? ' *(nouvelle)*' : ''} | ${entry.creativity ? LEVEL_LABELS[entry.level] : '—'} | ${xaf(entry.current.typical.usd)} → ${xaf(entry.target.typical.usd)} | ${xaf(entry.current.max.usd)} → ${xaf(entry.target.max.usd)} | ${entry.virtual ? '—' : `${entry.currentCredits} F`} | ${changed || entry.virtual ? `**${entry.recommendedCredits} F**` : `${entry.recommendedCredits} F`} | ${pct(entry.typicalMargin)} | ${pct(entry.floorMargin)} |`
    );
  }
  out.push('');
  return out.join('\n');
}

async function main(): Promise<void> {
  const markdown = render();
  const target = path.resolve(__dirname, '../../docs/QUOTAS.md');
  await fs.writeFile(target, markdown, 'utf8');
  console.log(`✓ ${path.relative(process.cwd(), target)}`);

  const outIndex = process.argv.indexOf('--out');
  if (outIndex > 0 && process.argv[outIndex + 1]) {
    const extra = path.resolve(process.argv[outIndex + 1]);
    await fs.writeFile(extra, markdown, 'utf8');
    console.log(`✓ ${extra}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
