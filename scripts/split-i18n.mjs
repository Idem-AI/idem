/**
 * Découpe les traductions d'une application en un noyau + des morceaux.
 *
 * Pourquoi : `ngx-translate` charge le fichier de langue AVANT le premier
 * rendu. Sur le tableau de bord, cela faisait 272 Ko (72 Ko compressés) à
 * télécharger avant d'afficher quoi que ce soit — dont 34 % pour deux modules
 * que la plupart des visites n'ouvrent jamais.
 *
 * Ce script lit le fichier source (inchangé, versionné) et écrit à côté :
 *
 *   <lang>.core.json        tout sauf les espaces de noms différés
 *   <lang>.<morceau>.json   un fichier par espace de nom différé
 *
 * Les fichiers produits sont ignorés par git. Le fichier source reste servi :
 * il sert de filet si un morceau ne se charge pas (voir le chargeur).
 *
 * Usage : node scripts/split-i18n.mjs <dossier i18n> <chemin:morceau> [...]
 *   ex. : node scripts/split-i18n.mjs public/assets/i18n \
 *           dashboard.showCommunication:communication dashboard.finance:finance
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const [dirArg, ...specs] = process.argv.slice(2);
if (!dirArg || specs.length === 0) {
  console.error('usage: split-i18n.mjs <dossier> <chemin:morceau> [...]');
  process.exit(1);
}

const dir = resolve(process.cwd(), dirArg);
const decoupes = specs.map((s) => {
  const [chemin, morceau] = s.split(':');
  if (!chemin || !morceau) throw new Error(`spécification invalide : ${s}`);
  return { chemin: chemin.split('.'), morceau };
});

/** Retire `chemin` de l'objet et renvoie ce qui s'y trouvait. */
function extraire(objet, chemin) {
  let parent = objet;
  for (const cle of chemin.slice(0, -1)) {
    if (parent?.[cle] === undefined) return undefined;
    parent = parent[cle];
  }
  const derniere = chemin.at(-1);
  const valeur = parent?.[derniere];
  if (valeur !== undefined) delete parent[derniere];
  return valeur;
}

/** Reconstruit `{a: {b: valeur}}` à partir de ['a','b']. */
function nicher(chemin, valeur) {
  return chemin.reduceRight((acc, cle) => ({ [cle]: acc }), valeur);
}

// `.core.json` et les morceaux sont produits ici : ne jamais les relire comme
// sources, sinon un deuxième passage découperait un fichier déjà découpé.
const sources = readdirSync(dir).filter(
  (f) => f.endsWith('.json') && f.split('.').length === 2,
);

for (const fichier of sources) {
  const lang = fichier.replace('.json', '');
  const complet = JSON.parse(readFileSync(join(dir, fichier), 'utf8'));

  for (const { chemin, morceau } of decoupes) {
    const valeur = extraire(complet, chemin);
    if (valeur === undefined) {
      console.warn(`[i18n] ${lang}: ${chemin.join('.')} introuvable, ignoré`);
      continue;
    }
    const cible = join(dir, `${lang}.${morceau}.json`);
    writeFileSync(cible, JSON.stringify(nicher(chemin, valeur)));
    console.log(`[i18n] ${lang}.${morceau}.json`);
  }

  const noyau = join(dir, `${lang}.core.json`);
  writeFileSync(noyau, JSON.stringify(complet));
  const avant = readFileSync(join(dir, fichier), 'utf8').length;
  const apres = readFileSync(noyau, 'utf8').length;
  console.log(
    `[i18n] ${lang}.core.json : ${Math.round(avant / 1024)} Ko -> ${Math.round(apres / 1024)} Ko`,
  );
}
