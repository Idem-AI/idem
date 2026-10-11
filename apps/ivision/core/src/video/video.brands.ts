/**
 * LOGOS DE MARQUES — Simple Icons, lus comme des SVG (jamais embarqués en bloc dans la page).
 *
 * Quand un texte d'une scène NOMME une marque (« Paiement par Orange Money », « Écrivez-nous sur
 * WhatsApp »), le serveur lit son logo, le normalise (couleur héritée, sans dimensions) et le donne à
 * la scène (`s.brands`). Un SVG, donc animable : `<IconMotion svg={b.svg} mode="draw" />`.
 *
 * Seules les marques d'un catalogue court, utile au commerce en Afrique francophone, sont reconnues :
 * un nom absent du catalogue ne donne rien, jamais un logo approximatif.
 *
 * Marques déposées : les fichiers de Simple Icons sont en CC0, pas les marques elles-mêmes. Un logo
 * sert à NOMMER la marque (moyen de paiement accepté, canal de contact) — jamais à habiller la marque
 * du client ni à suggérer un partenariat.
 */
import fs from 'fs';
import path from 'path';

export interface BrandIcon {
  name: string;
  slug: string;
  /** SVG normalisé : `fill="currentColor"`, sans dimensions ni titre. */
  svg: string;
}

/** Slug Simple Icons, nom d'affichage, reconnaissance dans un texte. */
const CATALOGUE: [string, string, RegExp][] = [
  ['whatsapp', 'WhatsApp', /whats ?app|wa\.me/i],
  ['instagram', 'Instagram', /instagram|\binsta\b/i],
  ['facebook', 'Facebook', /facebook|\bfb\b/i],
  ['tiktok', 'TikTok', /tik ?tok/i],
  ['youtube', 'YouTube', /youtube/i],
  ['x', 'X', /\btwitter\b|\bx\.com\b/i],
  ['telegram', 'Telegram', /telegram/i],
  ['snapchat', 'Snapchat', /snapchat/i],
  ['pinterest', 'Pinterest', /pinterest/i],
  ['spotify', 'Spotify', /spotify/i],
  ['google', 'Google', /\bgoogle\b/i],
  ['googlepay', 'Google Pay', /google ?pay/i],
  ['applepay', 'Apple Pay', /apple ?pay/i],
  ['visa', 'Visa', /\bvisa\b/i],
  ['mastercard', 'Mastercard', /master ?card/i],
  ['paypal', 'PayPal', /pay ?pal/i],
  ['stripe', 'Stripe', /\bstripe\b/i],
  ['orange', 'Orange', /orange ?money|\borange\b/i],
  ['airtel', 'Airtel', /airtel/i],
  ['uber', 'Uber', /\buber\b/i],
  ['glovo', 'Glovo', /glovo/i],
];

const ROOT = (() => {
  try {
    // Le package.json de simple-icons n'est pas exporté : on part de son point d'entrée.
    return path.dirname(require.resolve('simple-icons'));
  } catch {
    return path.resolve(process.cwd(), 'node_modules/simple-icons');
  }
})();

const memo = new Map<string, string | null>();

/** Le SVG normalisé d'une marque, ou null si le fichier manque. */
export function brandSvg(slug: string): string | null {
  if (memo.has(slug)) return memo.get(slug)!;
  const file = path.join(ROOT, 'icons', `${slug}.svg`);
  let out: string | null = null;
  if (/^[a-z0-9]+$/.test(slug) && fs.existsSync(file)) {
    out = fs
      .readFileSync(file, 'utf8')
      .replace(/<title>[\s\S]*?<\/title>/g, '')
      .replace(/\srole="img"/g, '')
      .replace(/\s(width|height|class)="[^"]*"/g, '')
      .replace('<svg ', '<svg fill="currentColor" aria-hidden="true" ')
      .replace(/\n\s*/g, '')
      .trim();
  }
  memo.set(slug, out);
  return out;
}

/** Les marques nommées dans un texte, dans l'ordre où elles apparaissent (au plus `max`, sans doublon). */
export function brandIconsIn(text: string, max = 4): BrandIcon[] {
  const found: { at: number; entry: [string, string, RegExp] }[] = [];
  for (const entry of CATALOGUE) {
    const m = entry[2].exec(text || '');
    if (m) found.push({ at: m.index, entry });
  }
  // « Google Pay » nomme Google Pay, pas Google ; « Orange Money » ne double pas « Orange ».
  const slugs = new Set(found.map((f) => f.entry[0]));
  return found
    .filter((f) => !(f.entry[0] === 'google' && slugs.has('googlepay')))
    .sort((a, b) => a.at - b.at)
    .map((f) => ({ name: f.entry[1], slug: f.entry[0], svg: brandSvg(f.entry[0]) }))
    .filter((b): b is BrandIcon => !!b.svg)
    .slice(0, max);
}

export const BRAND_SLUGS = CATALOGUE.map((c) => c[0]);
