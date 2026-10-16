/**
 * Retrait de l'ancien quota global — `npm run db:drop-legacy-quota`.
 *
 * Avant les paiements, chaque compte portait un compteur `users.quota`
 * (50 requêtes par jour, 200 par semaine, tous usages confondus). Il est
 * remplacé par les quotas d'usage par groupe de fonctionnalités
 * (`usage_quota_counters`, `models/usage-quota.model.ts`) : le schéma ne le
 * déclare plus, mais les documents existants le portent encore, avec six index.
 *
 * Ce script retire le champ et ses index. Il est idempotent et ne touche à rien
 * d'autre. Sans `--apply`, il compte seulement ce qu'il ferait.
 *
 *   npm run db:drop-legacy-quota            # compte
 *   npm run db:drop-legacy-quota -- --apply # retire
 */
import mongoose from 'mongoose';

import { loadSecrets } from '../config/secrets';
import mongoDBConnection from '../config/mongodb.config';

const APPLY = process.argv.includes('--apply');

async function main(): Promise<void> {
  await loadSecrets();
  await mongoDBConnection.connect();

  const users = mongoose.connection.collection('users');
  const withQuota = await users.countDocuments({ quota: { $exists: true } });
  const indexes = (await users.indexes()).filter((index) => Object.keys(index.key ?? {}).some((field) => field.startsWith('quota.')));

  console.log(`users : ${withQuota} document(s) portent encore « quota », ${indexes.length} index hérité(s).`);
  for (const index of indexes) console.log(`  · ${index.name}`);

  if (!APPLY) {
    console.log('\nRien n’a été modifié. Relancer avec --apply pour retirer le champ et les index.');
  } else {
    for (const index of indexes) {
      if (index.name) await users.dropIndex(index.name);
    }
    const result = await users.updateMany({ quota: { $exists: true } }, { $unset: { quota: '' } });
    console.log(`\n✓ ${indexes.length} index supprimé(s), champ retiré de ${result.modifiedCount} document(s).`);
  }

  await mongoDBConnection.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoDBConnection.disconnect().catch(() => undefined);
  process.exit(1);
});
