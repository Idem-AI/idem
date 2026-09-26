/**
 * Choisit le fournisseur des mises en situation de la charte, à chaud.
 *
 *   npm run mockups:provider            → affiche le fournisseur en vigueur
 *   npm run mockups:provider -- gemini  → Gemini (le logo part avec la consigne)
 *   npm run mockups:provider -- glm     → GLM (scène nue, logo composé ensuite)
 *
 * Le choix est écrit en base : les instances de l'API le prennent en compte
 * sous trente secondes, sans redémarrage (cf. `mockup-provider.config.ts`).
 */

import { loadSecrets } from '../config/secrets';
import mongoDBConnection from '../config/mongodb.config';
import {
  MOCKUP_PROVIDERS,
  MockupProvider,
  resolveMockupProvider,
  setMockupProvider,
} from '../config/mockup-provider.config';

async function main(): Promise<void> {
  const wanted = process.argv[2]?.trim().toLowerCase();
  if (wanted && !(MOCKUP_PROVIDERS as readonly string[]).includes(wanted)) {
    console.error(`Fournisseur inconnu « ${wanted} ». Valeurs possibles : ${MOCKUP_PROVIDERS.join(', ')}.`);
    process.exitCode = 1;
    return;
  }

  await loadSecrets();
  await mongoDBConnection.connect();
  try {
    if (wanted) {
      await setMockupProvider(wanted as MockupProvider);
      console.log(`Fournisseur des mises en situation enregistré : ${wanted}`);
    }
    console.log(`Fournisseur en vigueur : ${await resolveMockupProvider()}`);
  } finally {
    await mongoDBConnection.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
