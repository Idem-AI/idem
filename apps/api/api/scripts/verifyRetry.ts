/* Vérification manuelle du réessai réseau. `npx ts-node --transpile-only api/scripts/verifyRetry.ts` */
import { withRetry, isTransientNetworkError, describeError } from '../utils/retry';

let failures = 0;
function check(label: string, condition: boolean) {
  console.log(`${condition ? '  OK  ' : ' FAIL '} ${label}`);
  if (!condition) failures++;
}

(async () => {
  // 1. Une vraie erreur undici garde sa cause : on la déroule.
  let realNetworkError: any;
  try {
    await fetch('http://127.0.0.1:59999/');
  } catch (e) {
    realNetworkError = e;
  }
  console.log(`\n  cause déroulée → ${describeError(realNetworkError)}`);
  check('erreur undici réelle détectée comme transitoire', isTransientNetworkError(realNetworkError));
  check('describeError expose le code système', /code=ECONN|ECONNREFUSED/i.test(describeError(realNetworkError)));

  // 2. Message ré-emballé par @google/genai (cause perdue) : reconnu quand même.
  const sdkWrapped = new Error('exception TypeError: fetch failed sending request');
  check('message ré-emballé du SDK reconnu comme transitoire', isTransientNetworkError(sdkWrapped));

  // 3. Saturation 429/503 : PAS rejouée, on doit basculer de modèle.
  const overloaded: any = new Error('Resource has been exhausted (e.g. check quota).');
  overloaded.status = 429;
  check('429 non rejoué', !isTransientNetworkError(overloaded));

  // 4. Modèle inexistant : déterministe, pas rejoué.
  const notFound: any = new Error('Publisher model ... was not found or your project does not have access to it.');
  notFound.status = 404;
  check('404 non rejoué', !isTransientNetworkError(notFound));

  // 5. Réessai effectif : échec transitoire deux fois puis succès.
  let calls = 0;
  const startedAt = Date.now();
  const value = await withRetry(
    async () => {
      calls++;
      if (calls < 3) throw new Error('exception TypeError: fetch failed sending request');
      return 'ok';
    },
    { label: 'test/transitoire', baseDelayMs: 50, maxDelayMs: 200 }
  );
  check('withRetry réussit à la 3e tentative', value === 'ok' && calls === 3);
  check('withRetry a bien attendu entre les essais', Date.now() - startedAt >= 50);

  // 6. Pas de réessai sur une erreur déterministe.
  let hardCalls = 0;
  try {
    await withRetry(
      async () => {
        hardCalls++;
        throw notFound;
      },
      { label: 'test/404', baseDelayMs: 10 }
    );
  } catch {
    /* attendu */
  }
  check('withRetry n’insiste pas sur un 404 (1 seul appel)', hardCalls === 1);

  // 7. Épuisement : l'erreur de la dernière tentative est propagée.
  let exhausted = false;
  try {
    await withRetry(
      async () => {
        throw new Error('exception TypeError: fetch failed sending request');
      },
      { label: 'test/épuisement', attempts: 2, baseDelayMs: 10 }
    );
  } catch (e: any) {
    exhausted = /fetch failed/.test(e.message);
  }
  check('erreur finale propagée après épuisement', exhausted);

  console.log(failures === 0 ? '\nTout est vert.\n' : `\n${failures} vérification(s) en échec.\n`);
  process.exit(failures === 0 ? 0 : 1);
})();
