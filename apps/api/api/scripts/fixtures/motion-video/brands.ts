/**
 * Marques de test pour les vidéos motion design.
 *
 * Quatre identités volontairement différentes : palette chaude, palette froide,
 * fond de marque SOMBRE (la politique de surface claire doit le redresser) et
 * marque sans logo (la signature finale retombe sur le nom).
 */

const xml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const logoSvg = (name: string, color: string, accent: string, ink: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 120"><circle cx="60" cy="60" r="44" fill="${color}"/><path d="M38 60 L60 34 L82 60 L60 86 Z" fill="${accent}"/><text x="124" y="76" font-family="Arial, sans-serif" font-size="46" font-weight="800" fill="${ink}">${xml(name)}</text></svg>`;

const iconSvg = (color: string, accent: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><circle cx="60" cy="60" r="56" fill="${color}"/><path d="M34 60 L60 30 L86 60 L60 90 Z" fill="${accent}"/></svg>`;

export interface FixtureBrand {
  id: string;
  name: string;
  type: string;
  description: string;
  branding: any;
  /** Contexte déjà extrait par le module (évite toute extraction par modèle). */
  context?: any;
}

export const BRANDS: FixtureBrand[] = [
  {
    id: 'wax',
    name: 'Wax & Co',
    type: 'Boutique de pagnes',
    description: 'Le wax authentique, livré chez vous à Abidjan.',
    branding: {
      colors: { colors: { primary: '#c2410c', secondary: '#1e3a5f', accent: '#facc15', background: '#fffaf3', text: '#1c1917' } },
      typography: { primaryFont: 'Poppins', secondaryFont: 'Inter', url: '' },
      logo: {
        svg: logoSvg('Wax & Co', '#c2410c', '#facc15', '#1c1917'),
        iconSvg: iconSvg('#c2410c', '#facc15'),
        variations: {
          withText: {
            lightBackground: logoSvg('Wax & Co', '#c2410c', '#facc15', '#1c1917'),
            darkBackground: logoSvg('Wax & Co', '#facc15', '#c2410c', '#ffffff'),
          },
        },
      },
      artDirection: { styleId: 'maximalism' },
    },
    context: {
      brandName: 'Wax & Co',
      businessType: 'boutique de pagnes wax',
      tone: 'chaleureux, fier, direct',
      valueProposition: 'Le wax authentique, livré chez vous.',
      keywords: ['Authentique', 'Couleurs', 'Élégance'],
      language: 'fr',
    },
  },
  {
    id: 'bissap',
    name: 'Bissap Délices',
    type: 'Boissons artisanales',
    description: 'Jus de bissap et gingembre pressés à Dakar, sans sucre ajouté.',
    branding: {
      colors: { colors: { primary: '#9f1239', secondary: '#065f46', accent: '#fb923c', background: '#fff7f9', text: '#3b0715' } },
      typography: { primaryFont: 'Playfair Display', secondaryFont: 'DM Sans', url: '' },
      logo: {
        svg: logoSvg('Bissap', '#9f1239', '#fb923c', '#3b0715'),
        iconSvg: iconSvg('#9f1239', '#fb923c'),
      },
      artDirection: { styleId: 'editorial' },
    },
    context: {
      brandName: 'Bissap Délices',
      businessType: 'jus artisanaux',
      tone: 'frais, gourmand, naturel',
      valueProposition: 'Des jus pressés le matin même, sans sucre ajouté.',
      keywords: ['Frais', 'Naturel', 'Local'],
      language: 'fr',
    },
  },
  {
    id: 'kofi',
    name: 'Kofi Tech',
    type: 'Studio logiciel',
    description: 'We build software for African SMEs from Accra.',
    branding: {
      // Fond de marque SOMBRE : doit être redressé (politique de surface claire).
      colors: { colors: { primary: '#2563eb', secondary: '#0f172a', accent: '#22d3ee', background: '#0b1020', text: '#e2e8f0' } },
      typography: { primaryFont: 'Space Grotesk', secondaryFont: 'Inter', url: '' },
      logo: { svg: logoSvg('Kofi Tech', '#2563eb', '#22d3ee', '#0f172a') },
      artDirection: { styleId: 'swiss' },
    },
    context: {
      brandName: 'Kofi Tech',
      businessType: 'software studio',
      tone: 'confident, friendly, precise',
      valueProposition: 'Software that helps African SMEs grow.',
      keywords: ['Remote', 'Growth', 'Mentoring'],
      language: 'en',
    },
  },
  {
    id: 'mama',
    name: 'Chez Mama Afia',
    type: 'Restaurant',
    description: 'Cuisine ghanéenne et ivoirienne à Lomé.',
    branding: {
      colors: { colors: { primary: '#15803d', secondary: '#78350f', accent: '#f59e0b', background: '#fefce8', text: '#1a2e05' } },
      typography: { primaryFont: 'Fraunces', secondaryFont: 'Nunito', url: '' },
      // Pas de logo : la signature finale doit afficher le nom.
      logo: {},
    },
  },
];

export const brandById = (id: string): FixtureBrand => {
  const brand = BRANDS.find((b) => b.id === id);
  if (!brand) throw new Error(`fixture brand ${id} missing`);
  return brand;
};
