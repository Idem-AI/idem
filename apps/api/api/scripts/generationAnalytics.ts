/**
 * LE COÛT PAR RÉSULTAT ACCEPTÉ — lecture des générations déjà faites.
 *
 *   npx ts-node api/scripts/generationAnalytics.ts                 # les 30 derniers jours
 *   npx ts-node api/scripts/generationAnalytics.ts --days 7        # une autre fenêtre
 *   npx ts-node api/scripts/generationAnalytics.ts --by level      # par cran plutôt que par livrable
 *   npx ts-node api/scripts/generationAnalytics.ts --json          # pour un tableau de bord
 *
 * Aucun appel de modèle : le script lit les enregistrements écrits par le moteur (`design.record`) dans les
 * business plans, les pitch decks et les chartes. Il dit ce qu'une création coûte VRAIMENT — un modèle bon
 * marché qui rate trois fois coûte plus cher qu'un modèle cher qui réussit du premier coup.
 */
import mongoose from 'mongoose';
import type { GenerationRecord } from '@idem/graphic-engine';
import { metricsBy, metricsOf, metricsTable } from '../services/graphic/generation-analytics.service';

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};

/** Là où le moteur dépose ses enregistrements, avec le champ qui les porte. */
const SOURCES: Array<{ collection: string; path: string }> = [
  { collection: 'businessplans', path: 'design.record' },
  { collection: 'pitchdecks', path: 'design.record' },
  { collection: 'brandidentities', path: 'charterDesign.record' },
];

async function collect(days: number): Promise<GenerationRecord[]> {
  const since = new Date(Date.now() - days * 24 * 3600 * 1000);
  const out: GenerationRecord[] = [];
  for (const { collection, path } of SOURCES) {
    const rows = await mongoose.connection
      .collection(collection)
      .find({ [path]: { $exists: true } }, { projection: { [path]: 1 } })
      .limit(20000)
      .toArray();
    for (const row of rows) {
      const record = path.split('.').reduce<unknown>((v, k) => (v as Record<string, unknown> | undefined)?.[k], row) as GenerationRecord | undefined;
      if (record?.v === 1 && new Date(record.createdAt) >= since) out.push(record);
    }
  }
  return out;
}

async function main(): Promise<void> {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGO_URI manquante.');
    process.exit(1);
  }
  await mongoose.connect(uri);
  const days = Number(arg('days') ?? 30);
  const records = await collect(days);
  const by = arg('by') === 'level' ? (r: GenerationRecord) => r.level : (r: GenerationRecord) => r.deliverable;

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ days, total: metricsOf(records), groups: metricsBy(records, by) }, null, 2));
  } else {
    const total = metricsOf(records);
    console.log(`\n${records.length} génération(s) sur ${days} jour(s)\n`);
    console.log(metricsTable({ ...metricsBy(records, by), TOTAL: total }));
    console.log(`\nCoût par résultat accepté : ${total.costPerAcceptedUsd} $ · premier jet : ${Math.round(total.firstPassRate * 100)} % · appels de modèle par création : ${total.agentCallsPerGeneration}`);
    // La tenue des nœuds, tous enregistrements confondus : ce que le classement apprend.
    const nodes = new Map<string, { uses: number; repairs: number; blocking: number }>();
    for (const r of records) for (const t of r.templates ?? []) {
      const e = nodes.get(t.id) ?? { uses: 0, repairs: 0, blocking: 0 };
      nodes.set(t.id, { uses: e.uses + t.uses, repairs: e.repairs + t.repairs, blocking: e.blocking + t.blocking });
    }
    const fragile = [...nodes.entries()].filter(([, e]) => e.uses >= 12).map(([id, e]) => ({ id, ...e, clean: 1 - Math.min(e.uses, e.repairs + e.blocking) / e.uses })).sort((a, b) => a.clean - b.clean).slice(0, 10);
    if (fragile.length) {
      console.log('\nNœuds les plus fragiles (12 usages au moins) :');
      for (const f of fragile) console.log(`  ${f.id}\t${Math.round(f.clean * 100)} % de pages propres\t${f.uses} usages`);
    }
  }
  await mongoose.disconnect();
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
