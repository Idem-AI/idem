/**
 * Reprise des comptes existants dans le serveur d'authentification Supabase —
 * `npm run auth:import`.
 *
 * L'ancien fournisseur d'authentification n'est plus accessible : ni mots de
 * passe, ni identités OAuth ne peuvent en être exportés. La seule source est
 * la collection `users` de MongoDB (uid IDEM + adresse e-mail).
 *
 * Pour chaque utilisateur IDEM sans compte d'authentification, le script crée
 * un compte Supabase :
 *  - avec la même adresse, **confirmée** (elle a servi à se connecter à IDEM) ;
 *  - **sans mot de passe** ;
 *  - avec `app_metadata.idem_uid` = l'uid IDEM (non modifiable par l'utilisateur) ;
 * puis enregistre `authId` sur l'utilisateur IDEM.
 *
 * Au retour de l'utilisateur :
 *  - Google ou LinkedIn avec la même adresse : le serveur rattache
 *    l'identité au compte importé, IDEM retrouve l'uid d'origine ;
 *  - e-mail + mot de passe : « Mot de passe oublié » lui envoie un lien pour
 *    choisir son mot de passe — ce lien est la preuve qu'il possède l'adresse.
 * Projets, crédits, paiements et iDeploy restent attachés à l'uid d'origine.
 *
 * Garde-fous :
 *  - **simulation par défaut** : sans `--apply`, il compte et n'écrit rien ;
 *  - **idempotent** : un utilisateur qui a déjà un `authId` est ignoré ; un
 *    compte Supabase déjà présent pour l'adresse est rattaché, pas dupliqué.
 *
 *   npx ts-node --transpile-only api/scripts/importAuthAccounts.ts          # simulation
 *   npx ts-node --transpile-only api/scripts/importAuthAccounts.ts --apply  # exécution
 */

import { loadSecrets } from '../config/secrets';
import mongoDBConnection from '../config/mongodb.config';
import { supabaseAdmin } from '../services/identity/supabaseAuth.client';
import { importAuthAccounts } from '../services/identity/accountImport';

const APPLY = process.argv.includes('--apply');

async function main(): Promise<void> {
  console.log(
    APPLY
      ? 'Reprise des comptes — EXÉCUTION\n'
      : 'Reprise des comptes — simulation (ajouter --apply pour exécuter)\n'
  );

  await loadSecrets();
  await mongoDBConnection.connect();

  if (!(await supabaseAdmin.health())) {
    throw new Error(`Serveur d'authentification injoignable (${process.env.SUPABASE_AUTH_URL})`);
  }

  const report = await importAuthAccounts(APPLY);

  console.log('Résultat');
  const row = (label: string, value: number) => console.log(`  ${label.padEnd(34)}${value}`);
  row('utilisateurs IDEM parcourus', report.scanned);
  row('déjà rattachés', report.alreadyLinked);
  row(`comptes ${APPLY ? 'créés' : 'à créer'}`, report.created);
  row(`comptes existants ${APPLY ? 'rattachés' : 'à rattacher'}`, report.attachedExisting);
  const lists: Array<[string, string[]]> = [
    ['adresse invalide', report.invalidEmail],
    ['adresse en double', report.duplicateEmail],
    ['conflit', report.conflicts],
    ['échec', report.failed],
  ];
  for (const [label, items] of lists) {
    if (!items.length) continue;
    console.log(`\n  ${label} (${items.length})`);
    for (const item of items) console.log(`    - ${item}`);
  }

  await mongoDBConnection.disconnect();
  if (report.failed.length) process.exitCode = 1;
}

main().catch(async (error) => {
  console.error(`Erreur : ${error.message}`);
  try {
    await mongoDBConnection.disconnect();
  } catch {
    // déjà fermé
  }
  process.exit(1);
});
