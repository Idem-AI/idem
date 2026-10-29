/**
 * LE BANC QUALITÉ — 40 demandes : les huit temps forts d'une vidéo produit (banc Code2Video de HeyGen) × cinq types de
 * vidéo (produit, service, événement, explicatif, marque), en français et en anglais, dans les quatre formats.
 *
 * Chaque demande met l'accent sur UN temps fort (la scène que le panel regardera d'abord) ; toutes ont une marque, des
 * faits réels (jamais inventés par le moteur) et un format. Les mêmes demandes servent à la ligne de base (moteur
 * actuel) et à chaque version du moteur : les comparaisons par paires opposent deux vidéos d'une même demande.
 */
import type { VideoFormat } from '../../../../apps/ivision/core/src/video/contracts/model';

export type BenchType = 'product' | 'service' | 'event' | 'explainer' | 'brand';
export type BenchBeat = 'hook' | 'problem' | 'reveal' | 'feature' | 'benefits' | 'proof' | 'cta' | 'signature';

export interface QualityBrief {
  id: string;
  type: BenchType;
  beat: BenchBeat;
  language: 'fr' | 'en';
  format: VideoFormat;
  durationSec: 15 | 30;
  objective: 'product' | 'promotion' | 'event' | 'announce' | 'opening';
  brand: { name: string; colors: { primary: string; secondary: string; accent: string; background: string; text: string }; fonts: { display: string; body: string }; tone: string };
  request: string;
}

const BRANDS: Record<BenchType, QualityBrief['brand']> = {
  product: { name: 'Mama Bissap', colors: { primary: '#9b1d3a', secondary: '#2b1a2e', accent: '#f4b942', background: '#fff8f2', text: '#1e1418' }, fonts: { display: 'Poppins', body: 'Inter' }, tone: 'gourmand, solaire' },
  service: { name: 'Verda', colors: { primary: '#1f6f4a', secondary: '#14324a', accent: '#f2a93b', background: '#fbfaf7', text: '#16181d' }, fonts: { display: 'Manrope', body: 'Inter' }, tone: 'précis, rassurant' },
  event: { name: 'Dakar Tech Days', colors: { primary: '#3a2bd8', secondary: '#0f0b3a', accent: '#ff5d73', background: '#f7f6ff', text: '#12102b' }, fonts: { display: 'Space Grotesk', body: 'Inter' }, tone: 'énergique, ouvert' },
  explainer: { name: 'Kora Pay', colors: { primary: '#0b7a75', secondary: '#0e2f3a', accent: '#ffb000', background: '#f6fbfa', text: '#0f1d22' }, fonts: { display: 'DM Sans', body: 'DM Sans' }, tone: 'clair, pédagogique' },
  brand: { name: 'Atelier Ndiaye', colors: { primary: '#7a4b2a', secondary: '#2a1d14', accent: '#c9a227', background: '#fbf7f1', text: '#21170f' }, fonts: { display: 'Playfair Display', body: 'Lato' }, tone: 'artisanal, élégant' },
};

const FACTS: Record<BenchType, { fr: string; en: string }> = {
  product: { fr: 'Mama Bissap lance son jus de bissap pressé à froid, sans sucre ajouté, en bouteille de 33 cl à 1 500 FCFA. Disponible dans 40 boutiques à Dakar. Commandez sur WhatsApp au 77 000 00 00.', en: 'Mama Bissap launches its cold-pressed hibiscus juice, no added sugar, 33 cl bottle at 1,500 FCFA. Available in 40 shops in Dakar. Order on WhatsApp at +221 77 000 00 00.' },
  service: { fr: 'Verda aide les agriculteurs à arroser au bon moment : un capteur dans le champ, une alerte sur le téléphone. 1 200 exploitations l’utilisent, 30 % d’eau économisée en moyenne. Essai gratuit d’un mois sur verda.africa.', en: 'Verda helps farmers water at the right time: a sensor in the field, an alert on the phone. 1,200 farms use it, 30% water saved on average. One-month free trial at verda.africa.' },
  event: { fr: 'Dakar Tech Days revient les 14 et 15 novembre au CICAD de Diamniadio : 60 intervenants, 3 000 participants, des ateliers sur l’IA et le paiement mobile. Billets à partir de 10 000 FCFA sur dakartechdays.sn.', en: 'Dakar Tech Days is back on 14–15 November at CICAD, Diamniadio: 60 speakers, 3,000 attendees, workshops on AI and mobile payments. Tickets from 10,000 FCFA at dakartechdays.sn.' },
  explainer: { fr: 'Comment payer un fournisseur avec Kora Pay : 1. ouvrez l’application, 2. scannez le code du fournisseur, 3. confirmez avec votre code. L’argent arrive en 5 secondes, sans frais jusqu’à 100 000 FCFA.', en: 'How to pay a supplier with Kora Pay: 1. open the app, 2. scan the supplier’s code, 3. confirm with your PIN. The money arrives in 5 seconds, no fees up to 100,000 FCFA.' },
  brand: { fr: 'Atelier Ndiaye fabrique à la main des sacs en cuir à Thiès depuis 1998. Chaque sac est cousu par un seul artisan, signé et garanti dix ans. Découvrez la collection sur atelierndiaye.com.', en: 'Atelier Ndiaye has handmade leather bags in Thiès since 1998. Each bag is sewn by a single craftsman, signed and guaranteed for ten years. Discover the collection at atelierndiaye.com.' },
};

const EMPHASIS: Record<BenchBeat, { fr: string; en: string }> = {
  hook: { fr: 'L’ouverture doit arrêter le défilement dès la première seconde.', en: 'The opening must stop the scroll in the first second.' },
  problem: { fr: 'Montrez d’abord le problème que vit le client, avant la solution.', en: 'Show the customer’s problem first, before the solution.' },
  reveal: { fr: 'Le moment où la marque et son offre apparaissent doit être fort.', en: 'The moment the brand and its offer appear must land hard.' },
  feature: { fr: 'Montrez concrètement comment cela fonctionne.', en: 'Show concretely how it works.' },
  benefits: { fr: 'Mettez en avant les bénéfices, un par un.', en: 'Put the benefits forward, one by one.' },
  proof: { fr: 'Le chiffre clé doit être le moment fort de la vidéo.', en: 'The key number must be the strongest moment of the video.' },
  cta: { fr: 'L’appel à l’action doit être impossible à manquer.', en: 'The call to action must be impossible to miss.' },
  signature: { fr: 'Finissez sur la marque, avec de l’élégance.', en: 'End on the brand, with elegance.' },
};

const OBJECTIVE: Record<BenchType, QualityBrief['objective']> = { product: 'product', service: 'promotion', event: 'event', explainer: 'announce', brand: 'opening' };
const TYPES: BenchType[] = ['product', 'service', 'event', 'explainer', 'brand'];
const BEATS: BenchBeat[] = ['hook', 'problem', 'reveal', 'feature', 'benefits', 'proof', 'cta', 'signature'];
const FORMATS: VideoFormat[] = ['story', 'square', 'portrait', 'landscape'];

/** Les 40 demandes du banc (ordre stable : type × temps fort). */
export function qualityBriefs(): QualityBrief[] {
  const out: QualityBrief[] = [];
  TYPES.forEach((type, t) =>
    BEATS.forEach((beat, b) => {
      const k = t * BEATS.length + b;
      const language = k % 2 === 0 ? 'fr' : 'en';
      out.push({
        id: `${type}-${beat}`,
        type,
        beat,
        language,
        format: FORMATS[k % FORMATS.length],
        durationSec: k % 3 === 0 ? 30 : 15,
        objective: OBJECTIVE[type],
        brand: BRANDS[type],
        request: `${FACTS[type][language]} ${EMPHASIS[beat][language]}`,
      });
    })
  );
  return out;
}
