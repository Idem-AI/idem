/**
 * LES 17 ÉCHANTILLONS DU PLAN QUALITÉ CRÉATIVE (annexe A de `PLAN-QUALITE-CREATIVE-MOTEURS.md`).
 *
 * Marques FICTIVES (aucune marque réelle), une par échantillon, qui couvrent les 13 pays provisionnés, en français,
 * anglais et portugais : 5 vidéos et 3 échantillons par livrable graphique (business plan, charte, pitch deck, carte de
 * visite). Ils servent de ligne de base (phase 0) puis de banc à chaque phase — générés UNE fois par phase au plus, sur
 * demande de l'utilisateur (`npm run sample:quality`), car ils appellent de vrais modèles.
 */

export interface SampleBrand {
  name: string;
  country: string;
  locale: 'fr' | 'en' | 'pt';
  sector: string;
  palette: { primary: string; secondary: string; accent: string; background: string; text: string };
  fonts: { display: string; body: string };
  /** Ce que fait l'entreprise (brief du directeur). */
  brief: string;
}

export interface GraphicSample {
  id: string;
  deliverable: 'business-plan' | 'brand-charter' | 'pitch-deck' | 'business-card';
  brand: SampleBrand;
  /** Le sujet en une ligne (BP, deck) ou le porteur (carte). */
  subject: string;
}

export interface VideoSample {
  id: string;
  brand: SampleBrand;
  /** La demande, mot pour mot, dans la langue du client. */
  request: string;
  durationSec: number;
  format: 'story' | 'square' | 'landscape';
}

const b = (name: string, country: string, locale: SampleBrand['locale'], sector: string, palette: [string, string, string], fonts: [string, string], brief = ''): SampleBrand => ({
  name,
  country,
  locale,
  sector,
  palette: { primary: palette[0], secondary: palette[1], accent: palette[2], background: '#FAF8F4', text: '#1A1D21' },
  fonts: { display: fonts[0], body: fonts[1] },
  brief,
});

export const VIDEO_SAMPLES: VideoSample[] = [
  { id: 'V1', brand: b('Thiéboudienne Express', 'SEN', 'fr', 'restauration', ['#C8462B', '#1F5F5B', '#F2B33D'], ['Fraunces', 'Inter']), request: 'Une vidéo de 30 s pour lancer Thiéboudienne Express, livraison de plats maison à Dakar, commande par WhatsApp.', durationSec: 30, format: 'story' },
  { id: 'V2', brand: b('SokoPay', 'KEN', 'en', 'fintech', ['#0E6E55', '#12263A', '#F4B942'], ['Space Grotesk', 'Inter']), request: 'A 20-second promo for SokoPay, a mobile-money checkout for market traders in Nairobi. Calm, trustworthy, modern.', durationSec: 20, format: 'square' },
  { id: 'V3', brand: b('Café des Grassfields', 'CMR', 'fr', 'agroalimentaire', ['#5B3A29', '#2F6B4F', '#D9A441'], ['DM Serif Display', 'DM Sans']), request: "Présentez en 45 s la coopérative Café des Grassfields : café arabica de l'Ouest, du champ à la tasse, pour des acheteurs en Europe.", durationSec: 45, format: 'landscape' },
  { id: 'V4', brand: b('Capulana Viva', 'MOZ', 'pt', 'mode', ['#D6336C', '#1B4965', '#FFB703'], ['Syne', 'Manrope']), request: 'Um vídeo de 30 segundos para a Capulana Viva, loja online de moda em capulana em Maputo. Alegre e colorido.', durationSec: 30, format: 'story' },
  { id: 'V5', brand: b('Kinshasa Solar', 'COD', 'fr', 'énergie', ['#F29E0C', '#123D6A', '#2BA84A'], ['Outfit', 'Inter']), request: "Une vidéo explicative de 60 s pour Kinshasa Solar, kits solaires payables par mobile money : le problème, la solution, comment s'abonner.", durationSec: 60, format: 'landscape' },
];

export const GRAPHIC_SAMPLES: GraphicSample[] = [
  { id: 'BP1', deliverable: 'business-plan', brand: b('Noix d’Or Korhogo', 'CIV', 'fr', 'agro-transformation', ['#8C5A1E', '#2E5E4E', '#E2B33C'], ['Lora', 'Inter']), subject: 'Atelier de transformation de cajou à Korhogo (financement bancaire, comptes SYSCOHADA)' },
  { id: 'BP2', deliverable: 'business-plan', brand: b('SoilSense Musanze', 'RWA', 'en', 'agritech', ['#2D6A4F', '#1B263B', '#E9C46A'], ['Sora', 'Inter']), subject: 'Agri-tech startup selling soil sensors to farming cooperatives in Musanze' },
  { id: 'BP3', deliverable: 'business-plan', brand: b('Lopé Écolodge', 'GAB', 'fr', 'tourisme', ['#355E3B', '#6B4226', '#C9A227'], ['Cormorant Garamond', 'Montserrat']), subject: 'Écolodge à la Lopé, tourisme durable et guides locaux' },
  { id: 'CH1', deliverable: 'brand-charter', brand: b('Cotonou Saveurs', 'BEN', 'fr', 'épicerie fine', ['#B5422F', '#2F4858', '#F6AE2D'], ['Playfair Display', 'Source Sans 3']), subject: 'Épicerie fine de produits béninois' },
  { id: 'CH2', deliverable: 'brand-charter', brand: b('Kampala Bark & Co.', 'UGA', 'en', 'mode durable', ['#9C4A1A', '#2B2D42', '#D4A373'], ['DM Serif Display', 'DM Sans']), subject: 'Sustainable fashion accessories' },
  { id: 'CH3', deliverable: 'brand-charter', brand: b('Brazza Mode', 'COG', 'fr', 'couture', ['#6A1B9A', '#1D3557', '#F4A261'], ['Bebas Neue', 'Montserrat']), subject: 'Atelier de couture sur mesure' },
  { id: 'PD1', deliverable: 'pitch-deck', brand: b('Lusaka LastMile', 'ZMB', 'en', 'logistique', ['#E76F51', '#264653', '#2A9D8F'], ['Space Grotesk', 'Inter']), subject: 'Lusaka logistics startup: last-mile delivery by motorbike for pharmacies' },
  { id: 'PD2', deliverable: 'pitch-deck', brand: b('Osusu Digital', 'SLE', 'en', 'fintech', ['#1F7A8C', '#022B3A', '#E1A140'], ['Outfit', 'Inter']), subject: 'Freetown fintech: savings groups (osusu) digitised on USSD' },
  { id: 'PD3', deliverable: 'pitch-deck', brand: b('Code Thiès', 'SEN', 'fr', 'éducation', ['#3A86FF', '#1B1B3A', '#FFBE0B'], ['Unbounded', 'Manrope']), subject: 'Plateforme de formation au code pour les jeunes de Thiès' },
  { id: 'CV1', deliverable: 'business-card', brand: b('Atelier Ndop Intérieurs', 'CMR', 'fr', 'architecture d’intérieur', ['#1E3A5F', '#C9A227', '#E07A5F'], ['Fraunces', 'Inter']), subject: 'Architecte d’intérieur à Douala' },
  { id: 'CV2', deliverable: 'business-card', brand: b('Nanyuki Wild Lens', 'KEN', 'en', 'photographie', ['#283618', '#BC6C25', '#DDA15E'], ['Playfair Display', 'Inter']), subject: 'Wildlife photographer in Nanyuki' },
  { id: 'CV3', deliverable: 'business-card', brand: b('Machava Advogados', 'MOZ', 'pt', 'droit', ['#14213D', '#FCA311', '#8D99AE'], ['Libre Baskerville', 'Source Sans 3']), subject: 'Advogada em Beira' },
];

/** Un logo FICTIF dessiné par le code (initiales dans un cercle), aux couleurs de la marque. */
export function sampleLogo(brand: SampleBrand, ground: 'light' | 'dark' = 'light'): string {
  const initials = brand.name.replace(/[^A-Za-zÀ-ÿ ]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  const ink = ground === 'light' ? brand.palette.primary : '#FFFFFF';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><circle cx="60" cy="60" r="46" fill="none" stroke="${ink}" stroke-width="7"/><circle cx="92" cy="28" r="8" fill="${brand.palette.accent}"/><text x="60" y="76" text-anchor="middle" font-family="Georgia" font-weight="700" font-size="44" fill="${ink}">${initials}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}
