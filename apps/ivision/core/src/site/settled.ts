import type { Page } from 'puppeteer';

/**
 * Lire une page qui se recharge d'elle-même : redirection côté navigateur (langue, consentement, cache), ou
 * document encore vide un instant après l'ouverture. Le contexte détruit, ou une page sans `<body>`, n'est pas une
 * panne du site : on attend la page suivante et on relit (trois fois au plus).
 *
 * La fonction lue doit lever `navigation pending` quand le document est vide (voir `readPage`, `readStructure`).
 */
export async function evaluateSettled<T>(page: Page, fn: () => T): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return (await page.evaluate(fn)) as T;
    } catch (error) {
      const message = (error as Error).message || '';
      if (attempt >= 2 || !/context was destroyed|detached|navigat|reading 'appendChild'|of null/i.test(message)) throw error;
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15_000 }).catch(() => undefined);
      await new Promise((r) => setTimeout(r, 800));
    }
  }
}
