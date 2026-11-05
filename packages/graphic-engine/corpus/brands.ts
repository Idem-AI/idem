/**
 * Les 12 marques FICTIVES du corpus (les mêmes que les échantillons du plan qualité, `apps/api/api/scripts/quality/samples.ts`,
 * recopiées ici : le paquet n'importe jamais le code d'une application). 13 pays, français, anglais et portugais.
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

const b = (name: string, country: string, locale: SampleBrand['locale'], sector: string, palette: [string, string, string], fonts: [string, string], brief = ''): SampleBrand => ({
  name,
  country,
  locale,
  sector,
  palette: { primary: palette[0], secondary: palette[1], accent: palette[2], background: '#FAF8F4', text: '#1A1D21' },
  fonts: { display: fonts[0], body: fonts[1] },
  brief,
});

export const GRAPHIC_SAMPLES: Array<{ id: string; brand: SampleBrand }> = [
  { id: 'BP1', brand: b('Noix d’Or Korhogo', 'CIV', 'fr', 'agro-transformation', ['#8C5A1E', '#2E5E4E', '#E2B33C'], ['Lora', 'Inter']) },
  { id: 'BP2', brand: b('SoilSense Musanze', 'RWA', 'en', 'agritech', ['#2D6A4F', '#1B263B', '#E9C46A'], ['Sora', 'Inter']) },
  { id: 'BP3', brand: b('Lopé Écolodge', 'GAB', 'fr', 'tourisme', ['#355E3B', '#6B4226', '#C9A227'], ['Cormorant Garamond', 'Montserrat']) },
  { id: 'CH1', brand: b('Cotonou Saveurs', 'BEN', 'fr', 'épicerie fine', ['#B5422F', '#2F4858', '#F6AE2D'], ['Playfair Display', 'Source Sans 3']) },
  { id: 'CH2', brand: b('Kampala Bark & Co.', 'UGA', 'en', 'mode durable', ['#9C4A1A', '#2B2D42', '#D4A373'], ['DM Serif Display', 'DM Sans']) },
  { id: 'CH3', brand: b('Brazza Mode', 'COG', 'fr', 'couture', ['#6A1B9A', '#1D3557', '#F4A261'], ['Bebas Neue', 'Montserrat']) },
  { id: 'PD1', brand: b('Lusaka LastMile', 'ZMB', 'en', 'logistique', ['#E76F51', '#264653', '#2A9D8F'], ['Space Grotesk', 'Inter']) },
  { id: 'PD2', brand: b('Osusu Digital', 'SLE', 'en', 'fintech', ['#1F7A8C', '#022B3A', '#E1A140'], ['Outfit', 'Inter']) },
  { id: 'PD3', brand: b('Code Thiès', 'SEN', 'fr', 'éducation', ['#3A86FF', '#1B1B3A', '#FFBE0B'], ['Unbounded', 'Manrope']) },
  { id: 'CV1', brand: b('Atelier Ndop Intérieurs', 'CMR', 'fr', 'architecture d’intérieur', ['#1E3A5F', '#C9A227', '#E07A5F'], ['Fraunces', 'Inter']) },
  { id: 'CV2', brand: b('Nanyuki Wild Lens', 'KEN', 'en', 'photographie', ['#283618', '#BC6C25', '#DDA15E'], ['Playfair Display', 'Inter']) },
  { id: 'CV3', brand: b('Machava Advogados', 'MOZ', 'pt', 'droit', ['#14213D', '#FCA311', '#8D99AE'], ['Libre Baskerville', 'Source Sans 3']) },
];

/** Un logo FICTIF dessiné par le code (initiales dans un cercle), aux couleurs de la marque. */
export function sampleLogo(brand: SampleBrand, ground: 'light' | 'dark' = 'light'): string {
  const initials = brand.name.replace(/[^A-Za-zÀ-ÿ ]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  const ink = ground === 'light' ? brand.palette.primary : '#FFFFFF';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><circle cx="60" cy="60" r="46" fill="none" stroke="${ink}" stroke-width="7"/><circle cx="92" cy="28" r="8" fill="${brand.palette.accent}"/><text x="60" y="76" text-anchor="middle" font-family="Georgia" font-weight="700" font-size="44" fill="${ink}">${initials}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}
