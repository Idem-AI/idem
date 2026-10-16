/**
 * Garde-fou des quotas IA — `npm run check:quotas`.
 *
 * Échoue si le barème, les enveloppes de génération, les groupes de quota et les routes ont
 * divergé : c'est ce qui garantit qu'aucune génération IA n'échappe à la fois à son quota et à
 * son budget de coût.
 *
 *  1. chaque action facturée (iBusiness, iCode) a une enveloppe et un groupe, et ce sont les mêmes ;
 *  2. chaque `requireQuota(..., { envelope })` des routes vise une aide qui existe, du même groupe ;
 *  3. chaque modèle d'enveloppe a un tarif connu (pas le tarif par défaut, qui fausserait le coût) ;
 *  4. les limites croissent avec l'offre (Gratuit ≤ Essentiel ≤ Croissance ≤ Cabinet), plafonds compris ;
 *  5. aucune limite n'est incohérente (jour ≤ semaine ≤ mois).
 *
 * Les actions dont le prix ne tient pas R1/R2 sont listées en AVERTISSEMENT (un prix se décide,
 * il ne se corrige pas en silence) : `docs/QUOTAS.md` § 4 en donne le prix minimum.
 */
import { promises as fs } from 'fs';
import path from 'path';

import { isPricingEstimated } from '../config/ai-pricing.config';
import { ENVELOPE_LEVELS, GENERATION_ENVELOPES, envelopeCost, envelopeEconomics, envelopeKey } from '../config/generation-budgets';
import { BUSINESS_CREDIT_COSTS } from '../models/billing.model';
import { APPGEN_CREDIT_COSTS } from '../models/plan-limits.model';
import {
  DEFAULT_QUOTA_LIMITS,
  DEFAULT_SPEND_CAPS_USD,
  QUOTA_GROUPS,
  QUOTA_WINDOWS,
  QuotaGroup,
  QuotaTier,
  WindowLimits,
  quotaGroupOf,
} from '../models/usage-quota.model';

const errors: string[] = [];
const warnings: string[] = [];

const PAID_ORDER: QuotaTier[] = ['free', 'starter', 'growth', 'top'];

function le(a: number | null, b: number | null): boolean {
  if (b === null) return true;
  if (a === null) return false;
  return a <= b;
}

function checkActions(): void {
  const tables: { engine: 'business' | 'appgen'; costs: Record<string, number> }[] = [
    { engine: 'business', costs: BUSINESS_CREDIT_COSTS as Record<string, number> },
    { engine: 'appgen', costs: APPGEN_CREDIT_COSTS as Record<string, number> },
  ];
  for (const { engine, costs } of tables) {
    for (const action of Object.keys(costs)) {
      const key = envelopeKey(engine, action);
      const envelope = GENERATION_ENVELOPES[key];
      if (!envelope) {
        errors.push(`${key} : action facturée sans enveloppe de génération (config/generation-budgets.ts).`);
        continue;
      }
      const group = quotaGroupOf(engine, action);
      if (envelope.group !== group) {
        errors.push(`${key} : groupe de l'enveloppe « ${envelope.group} » ≠ groupe de quota « ${group} » (ACTION_QUOTA_GROUP).`);
      }
    }
  }
}

async function checkRoutes(): Promise<void> {
  const dir = path.resolve(__dirname, '../routes');
  for (const file of await fs.readdir(dir)) {
    if (!file.endsWith('.ts')) continue;
    const source = await fs.readFile(path.join(dir, file), 'utf8');
    for (const match of source.matchAll(/requireQuota\('(\w+)'(?:,\s*\{\s*envelope:\s*'(\w+)'\s*\})?\)/g)) {
      const group = match[1] as QuotaGroup;
      if (!QUOTA_GROUPS.includes(group)) errors.push(`${file} : groupe de quota inconnu « ${group} ».`);
      const name = match[2];
      if (!name) continue;
      const envelope = GENERATION_ENVELOPES[envelopeKey('free', name)];
      if (!envelope) errors.push(`${file} : enveloppe « free.${name} » introuvable.`);
      else if (envelope.group !== group) errors.push(`${file} : free.${name} est du groupe « ${envelope.group} », la route réserve « ${group} ».`);
    }
  }
}

function checkPricing(): void {
  for (const key of Object.keys(GENERATION_ENVELOPES)) {
    for (const level of ENVELOPE_LEVELS) {
      for (const line of envelopeCost(key, level, 'max').lines) {
        if (!line.model.includes('/')) continue;
        if (isPricingEstimated(line.model)) errors.push(`${key} (${level}) : « ${line.model} » n'a pas de tarif connu — le coût serait faux.`);
      }
    }
  }
}

function checkLimits(): void {
  for (const group of QUOTA_GROUPS) {
    for (const tier of Object.keys(DEFAULT_QUOTA_LIMITS) as QuotaTier[]) {
      const limits: WindowLimits = DEFAULT_QUOTA_LIMITS[tier][group];
      if (!le(limits.day, limits.week) || !le(limits.week, limits.month)) {
        errors.push(`${tier}/${group} : jour ≤ semaine ≤ mois non respecté (${limits.day}/${limits.week}/${limits.month}).`);
      }
    }
    for (let i = 1; i < PAID_ORDER.length; i++) {
      const lower = DEFAULT_QUOTA_LIMITS[PAID_ORDER[i - 1]][group];
      const upper = DEFAULT_QUOTA_LIMITS[PAID_ORDER[i]][group];
      for (const window of QUOTA_WINDOWS) {
        if (!le(lower[window], upper[window])) {
          errors.push(`${group}/${window} : ${PAID_ORDER[i - 1]} (${lower[window]}) > ${PAID_ORDER[i]} (${upper[window]}).`);
        }
      }
    }
  }
  for (let i = 2; i < PAID_ORDER.length; i++) {
    const lower = DEFAULT_SPEND_CAPS_USD[PAID_ORDER[i - 1]];
    const upper = DEFAULT_SPEND_CAPS_USD[PAID_ORDER[i]];
    for (const window of QUOTA_WINDOWS) {
      if (!le(lower[window], upper[window])) errors.push(`plafond ${window} : ${PAID_ORDER[i - 1]} > ${PAID_ORDER[i]}.`);
    }
  }
}

function economics(): void {
  for (const key of Object.keys(GENERATION_ENVELOPES)) {
    const envelope = GENERATION_ENVELOPES[key];
    if (envelope.engine === 'free') continue;
    const levels = envelope.creativity ? ENVELOPE_LEVELS : (['medium'] as const);
    for (const level of levels) {
      const eco = envelopeEconomics(key, level);
      if (!eco.ok && eco.credits > 0) {
        warnings.push(`${key}${envelope.creativity ? ` (${level})` : ''} : ${eco.credits} F, prix minimum ${eco.minimumCredits} F.`);
      }
    }
  }
}

async function main(): Promise<void> {
  checkActions();
  await checkRoutes();
  checkPricing();
  checkLimits();
  economics();

  for (const warning of warnings) console.warn(`⚠ ${warning}`);
  if (errors.length) {
    for (const error of errors) console.error(`✗ ${error}`);
    console.error(`\ncheck:quotas — ${errors.length} erreur(s).`);
    process.exit(1);
  }
  console.log(`✓ check:quotas — barème, enveloppes, groupes et routes cohérents (${warnings.length} prix à revoir, cf. docs/QUOTAS.md § 4).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
