/**
 * Le service worker d'IDEM — un seul, partagé par les six applications.
 *
 * Il répond à deux problèmes mesurés sur les connexions africaines à bas débit :
 *
 * 1. CHAQUE RETOUR RETÉLÉCHARGEAIT TOUT ce que le cache HTTP n'avait pas gardé.
 *    Ici, la deuxième visite part du cache et se met à jour en arrière-plan :
 *    l'application s'affiche tout de suite, même à 30 Ko/s, même hors ligne.
 *
 * 2. LES VERSIONS PÉRIMÉES. Le cache heuristique des navigateurs gardait des
 *    semaines une coquille obsolète. Ici, la page est servie depuis le cache
 *    PUIS revalidée : la mise à jour arrive au chargement suivant, et la page
 *    en est prévenue (message `idem-sw:update`).
 *
 * Choix volontaires :
 *
 * - AUCUN PRÉCACHE À L'INSTALLATION. Précharger la coquille entière au premier
 *   passage doublerait le coût de la première visite — exactement ce qu'on
 *   cherche à éviter sur un lien faible. Le cache se remplit de ce qui a
 *   réellement servi.
 * - PAS DE `skipWaiting()` AUTOMATIQUE. Remplacer le worker pendant que
 *   l'utilisateur travaille échangerait les fichiers sous ses pieds. La page
 *   décide (message `idem-sw:skip-waiting`).
 * - LES REQUÊTES D'API NE SONT JAMAIS MISES EN CACHE. Un solde de portefeuille
 *   ou une génération en cours servis depuis un cache seraient faux.
 */

// Changer cette valeur invalide tous les caches d'un coup.
const VERSION = 'v1';
const SHELL_CACHE = `idem-shell-${VERSION}`;
const ASSET_CACHE = `idem-assets-${VERSION}`;

/** Au-delà, on abandonne le réseau et on sert le cache : l'attente a assez duré. */
const NAVIGATION_TIMEOUT_MS = 4000;

/**
 * Une empreinte de build dans le nom : le contenu ne changera jamais sous
 * cette URL, donc le cache fait autorité sans revalidation.
 */
const HASHED = /-[A-Za-z0-9_-]{8,}\.(?:js|mjs|css|woff2|woff|ttf|otf|eot|png|jpe?g|gif|svg|webp|avif|wasm)$/i;

/** Ce qui ne doit jamais être servi depuis un cache. */
function isLive(url) {
  return (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/internal/') ||
    url.pathname.startsWith('/auth/') ||
    url.pathname.includes('/sse') ||
    url.search.includes('stream=')
  );
}

self.addEventListener('install', () => {
  // Rien à précharger : voir l'en-tête. Le worker devient « en attente » et
  // n'écrase pas l'actuel tant que la page ne le demande pas.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n.startsWith('idem-') && n !== SHELL_CACHE && n !== ASSET_CACHE)
          .map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'idem-sw:skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Une autre origine (API, CDN, police tierce) : on laisse passer.
  if (url.origin !== self.location.origin) return;
  if (isLive(url)) return;

  // Navigation (la coquille HTML) : réseau d'abord, mais avec une limite de
  // patience. Au-delà, ou hors ligne, la dernière version connue s'affiche.
  if (request.mode === 'navigate') {
    event.respondWith(navigationStrategy(request));
    return;
  }

  // Fichier à empreinte : le cache fait autorité, aucun aller-retour réseau.
  if (HASHED.test(url.pathname)) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
    return;
  }

  // Le reste (images non hachées, traductions, manifestes) : on sert tout de
  // suite ce qu'on a et on rafraîchit derrière.
  event.respondWith(staleWhileRevalidate(request, ASSET_CACHE));
});

/** Réseau d'abord, repli sur le cache, avec une limite de patience. */
async function navigationStrategy(request) {
  const cache = await caches.open(SHELL_CACHE);

  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(null), NAVIGATION_TIMEOUT_MS);
  });

  const network = fetch(request)
    .then((response) => {
      if (response && response.ok) void cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  const fresh = await Promise.race([network, timeout]);
  clearTimeout(timer);
  if (fresh) return fresh;

  const cached = (await cache.match(request)) || (await cache.match('/index.html'));
  if (cached) {
    // Le réseau continue en arrière-plan : la version suivante sera à jour, et
    // la page est prévenue pour pouvoir proposer de recharger.
    void network.then((response) => {
      if (response && response.ok) notify('idem-sw:update');
    });
    return cached;
  }

  // Ni réseau ni cache : laisser le navigateur afficher son erreur.
  return network.then((r) => r || Response.error());
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response && response.ok) void cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const network = fetch(request)
    .then((response) => {
      if (response && response.ok) void cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  if (cached) {
    void network;
    return cached;
  }
  const response = await network;
  return response || Response.error();
}

/** Prévenir toutes les pages ouvertes. */
async function notify(message) {
  const clients = await self.clients.matchAll({ type: 'window' });
  for (const client of clients) client.postMessage(message);
}
