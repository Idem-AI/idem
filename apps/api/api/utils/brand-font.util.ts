/**
 * Vilevile — la police de marque IDEM — pour les rendus faits côté serveur.
 *
 * Les quatre moteurs de rendu (PDF des livrables, visuel social, carte de
 * visite, maquettes) chargeaient jusqu'ici la police de marque depuis Google
 * Fonts. Vilevile n'y est pas : elle est fabriquée dans `@idem/shared-styles`
 * et auto-hébergée par les applications front. Un `<link>` vers Google ne
 * chargerait donc rien, et le rendu retomberait silencieusement sur la police
 * système — exactement la panne que `google-fonts.util` a été écrite pour
 * éliminer.
 *
 * On lit donc les `.woff2` dans le paquet partagé et on les embarque en base64
 * dans le HTML. Chromium (Puppeteer) n'a alors aucune requête réseau à faire,
 * et le document sort dans la bonne typographie même hors ligne.
 *
 * La feuille `fonts.css` est reprise telle quelle, ses `unicode-range`
 * compris : refabriquer la police (`packages/shared-styles/tools/font`) suffit à
 * mettre les rendus serveur à jour, sans toucher à ce fichier.
 *
 * Le bloc publie aussi `--idem-font-tracking`, lu dans le `styles.css` du
 * paquet partagé. Vilevile porte son approche dans ses chasses : un
 * `letter-spacing` posé dans un gabarit s'AJOUTE à celle-ci au lieu de la
 * remplacer. Les gabarits expriment donc leurs approches relativement à ce
 * jeton, exactement comme les feuilles de style des applications front.
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';

/** Le nom de famille sous lequel la police de marque est déclarée. */
export const BRAND_FONT_FAMILY = 'Vilevile';

/** Familles servies depuis le paquet partagé, jamais depuis Google. */
export const SELF_HOSTED_FAMILIES = new Set([BRAND_FONT_FAMILY.toLowerCase()]);

let cached: string | null = null;

/**
 * Le `<style>` déclarant Vilevile, polices embarquées en base64.
 *
 * Renvoie une chaîne vide si le paquet partagé est introuvable : un rendu sans
 * la police de marque vaut mieux qu'un rendu qui échoue, et l'avertissement
 * dit où regarder.
 */
export function brandFontFaceStyle(): string {
  if (cached !== null) return cached;

  try {
    const cssPath = require.resolve('@idem/shared-styles/fonts/fonts.css');
    const fontsDir = dirname(cssPath);
    const css = readFileSync(cssPath, 'utf8').replace(
      /url\('\.\/([^']+)'\)/g,
      (_match, file: string) => {
        const data = readFileSync(join(fontsDir, file)).toString('base64');
        return `url(data:font/woff2;base64,${data})`;
      }
    );
    cached = `<style>\n${css}\n:root { --idem-font-tracking: ${bakedTracking()}; }\n</style>`;
  } catch (error) {
    console.warn(
      '[brand-font] Vilevile introuvable dans @idem/shared-styles — les rendus ' +
        'serveur sortiront en police système.',
      error
    );
    cached = '';
  }
  return cached;
}

/**
 * L'approche que Vilevile porte dans ses chasses, lue dans le design system
 * pour qu'il n'y ait qu'un seul endroit où cette valeur est écrite.
 */
function bakedTracking(): string {
  try {
    const css = readFileSync(require.resolve('@idem/shared-styles/styles.css'), 'utf8');
    const match = css.match(/--idem-font-tracking:\s*([^;]+);/);
    if (match) return match[1].trim();
  } catch {
    /* on retombe sur la valeur de la police telle que fabriquée */
  }
  return '-0.09em';
}

/** Vrai si la famille demandée est servie depuis le paquet partagé. */
export function isSelfHostedFamily(family?: string | null): boolean {
  return SELF_HOSTED_FAMILIES.has(String(family ?? '').trim().toLowerCase());
}
