/**
 * Vérifie que les six applications servent leurs fichiers avec la bonne
 * politique de cache.
 *
 * Ce contrôle existe à cause d'un vrai incident : la landing posait son
 * `no-cache` via une expression régulière sur les URL finissant par `.html`,
 * alors que ses pages prérendues sont servies sur des URL finissant par `/`.
 * La règle ne s'appliquait jamais, les pages repartaient sans aucun
 * `Cache-Control`, et des appareils ont gardé des semaines une version
 * obsolète — dont les fichiers hachés n'existaient plus.
 *
 * L'erreur était invisible à la lecture : la règle avait l'air juste. D'où ce
 * script, qui lit les configurations plutôt que de faire confiance à l'œil.
 *
 * Usage : npm run check:cache
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');

const APPS = [
  'apps/landing',
  'apps/main-dashboard',
  'apps/ideploy-web',
  'apps/simulation',
  'apps/ivision/web',
  'apps/idomain/web',
];

/** Chaque règle : ce qu'on exige, et pourquoi. */
const REGLES = [
  {
    nom: 'cache piloté par le type de contenu',
    attendu: /map \$sent_http_content_type \$idem_type_cc/,
    pourquoi:
      "sans cela, une page servie sur une URL sans extension (dossier prérendu) repart sans Cache-Control",
  },
  {
    nom: 'HTML revalidé à chaque fois',
    attendu: /"~\*\^text\/html"\s+"no-cache, must-revalidate"/,
    pourquoi: 'une coquille périmée pointe vers des fichiers hachés supprimés',
  },
  {
    nom: 'traductions revalidées',
    attendu: /"~\*\^\/assets\/i18n\/"\s+"no-cache"/,
    pourquoi: "elles gardent le même nom d'un déploiement à l'autre",
  },
  {
    nom: 'service worker jamais mis en cache',
    attendu: /sw\|ngsw-worker\|safety-worker.*"no-cache, no-store, must-revalidate"/,
    pourquoi: "le mettre en cache gèlerait l'application sur une version",
  },
  {
    nom: 'fichiers hachés immuables',
    attendu: /"public, max-age=31536000, immutable"/,
    pourquoi: 'leur nom change à chaque build : les revalider est du gaspillage',
  },
  {
    nom: 'erreurs jamais mises en cache',
    attendu: /map \$status \$idem_cc_final/,
    pourquoi: 'un 404 passager pendant un déploiement serait gardé un an',
  },
  {
    nom: 'un fichier statique absent répond 404',
    attendu: /\(js\|mjs\|css\|map\|woff2[^)]*\)\$ \{\n\s*try_files \$uri =404;/,
    pourquoi: 'sinon un morceau supprimé renvoie du HTML avec un code 200',
  },
  {
    nom: 'Brotli activé',
    attendu: /brotli_static on;/,
    pourquoi: 'environ 16 % de moins que gzip sur le JS et le HTML',
  },
  {
    nom: 'gzip précalculé',
    attendu: /gzip_static on;/,
    pourquoi: 'pour les navigateurs sans Brotli',
  },
  {
    nom: 'SVG compressés',
    attendu: /image\/svg\+xml/,
    pourquoi: 'iDeploy sert des SVG de plusieurs centaines de kilo-octets',
  },
  {
    nom: 'images négociées en WebP',
    attendu: /map \$http_accept \$idem_webp/,
    pourquoi: 'un PNG de 660 Ko tombe à 67 Ko sans toucher aux gabarits',
  },
];

/** Ce qui ne doit PAS réapparaître. */
const INTERDITS = [
  {
    nom: 'règle de cache basée sur l\'extension .html',
    motif: /location\s+~\*?\s+\\\.html\$/,
    pourquoi:
      "elle n'atteint pas les pages prérendues en dossiers — c'est exactement le bug d'origine",
  },
  {
    nom: 'add_header dans un location sans répéter Cache-Control',
    motif: null, // vérifié plus bas, il faut regarder le contenu du bloc
    pourquoi: 'un add_header local annule tous ceux hérités du serveur',
  },
];

let echecs = 0;
let controles = 0;

for (const app of APPS) {
  const chemin = join(RACINE, app, 'nginx.conf');
  let conf;
  try {
    conf = readFileSync(chemin, 'utf8');
  } catch {
    console.error(`✘ ${app} : nginx.conf introuvable`);
    echecs++;
    continue;
  }

  // Les commentaires citent volontiers la règle fautive d'origine pour
  // expliquer pourquoi elle a disparu : ils ne doivent pas déclencher
  // l'interdiction.
  const sansCommentaires = conf
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('#'))
    .join('\n');

  const manques = [];

  for (const regle of REGLES) {
    controles++;
    // idomain n'a pas encore d'image de production : sa configuration reste
    // sur une image nginx sans le module Brotli.
    if (app === 'apps/idomain/web' && /Brotli/.test(regle.nom)) continue;
    if (!regle.attendu.test(conf)) manques.push(regle);
  }

  for (const interdit of INTERDITS) {
    if (!interdit.motif) continue;
    controles++;
    if (interdit.motif.test(sansCommentaires)) {
      manques.push({ nom: `INTERDIT : ${interdit.nom}`, pourquoi: interdit.pourquoi });
    }
  }

  // Tout bloc `location` qui pose un add_header doit reposer Cache-Control,
  // sinon il perd silencieusement celui du serveur.
  for (const bloc of sansCommentaires.matchAll(/location[^{]*\{([^}]*)\}/g)) {
    const corps = bloc[1];
    if (/add_header/.test(corps) && !/Cache-Control/.test(corps)) {
      controles++;
      manques.push({
        nom: `location avec add_header mais sans Cache-Control`,
        pourquoi: 'un add_header local annule tous ceux hérités du serveur',
      });
    }
  }

  if (manques.length === 0) {
    console.log(`✓ ${app}`);
  } else {
    echecs += manques.length;
    console.error(`✘ ${app}`);
    for (const m of manques) console.error(`    ${m.nom}\n      → ${m.pourquoi}`);
  }
}

console.log(`\n${controles} contrôles sur ${APPS.length} applications.`);
if (echecs > 0) {
  console.error(`${echecs} problème(s).`);
  process.exit(1);
}
console.log('Politique de cache conforme.');
