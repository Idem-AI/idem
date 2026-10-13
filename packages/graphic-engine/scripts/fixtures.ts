/**
 * Le CORPUS de référence : des livrables représentatifs (marques, contenus, volumes), toujours les mêmes,
 * pour comparer objectivement deux versions du moteur. Aucun réseau : les logos et les photos sont des
 * data-URI dessinées ici.
 */
import type { SectionContent } from '../src/contracts/content-model';
import type { BrandInput } from '../src/design-system/tokens';

const svg = (markup: string): string => `data:image/svg+xml;base64,${Buffer.from(markup).toString('base64')}`;

export function logo(name: string, ink: string, mark: string): string {
  return svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${80 + name.length * 30} 100"><rect x="8" y="14" width="40" height="56" rx="4" fill="${mark}"/><rect x="28" y="50" width="20" height="36" fill="${mark}"/><text x="64" y="66" font-family="Helvetica, Arial, sans-serif" font-size="50" font-weight="700" fill="${ink}">${name}</text></svg>`);
}

export function icon(mark: string): string {
  return svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="22" y="10" width="44" height="60" rx="4" fill="${mark}"/><rect x="46" y="52" width="20" height="38" fill="${mark}"/></svg>`);
}

/** Une « photo » de test : un paysage dégradé, sans texte. */
export function photo(a: string, b: string, c: string): string {
  return svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient><radialGradient id="g" cx="0.7" cy="0.35" r="0.5"><stop offset="0" stop-color="#fff6d8" stop-opacity="0.9"/><stop offset="1" stop-color="#fff6d8" stop-opacity="0"/></radialGradient></defs><rect width="1200" height="900" fill="url(#s)"/><circle cx="840" cy="300" r="320" fill="url(#g)"/><path d="M0 620 Q 300 520 600 600 T 1200 560 V 900 H 0 Z" fill="${c}" opacity="0.85"/><path d="M0 720 Q 400 640 760 720 T 1200 700 V 900 H 0 Z" fill="${c}"/><circle cx="380" cy="560" r="70" fill="${b}" opacity="0.6"/></svg>`);
}

export const BRANDS: Record<string, BrandInput & { styleId: string }> = {
  kora: {
    name: 'Kora',
    styleId: 'swiss',
    palette: { primary: '#1A2A4F', secondary: '#7F9CE5', accent: '#C9A227', background: '#F8F9FB', text: '#0F172A' },
    fonts: { display: 'Space Grotesk', body: 'Inter' },
    logos: { primary: logo('Kora', '#1A2A4F', '#1A2A4F'), onLight: logo('Kora', '#1A2A4F', '#1A2A4F'), onDark: logo('Kora', '#FFFFFF', '#C9A227'), icon: icon('#1A2A4F'), iconOnDark: icon('#FFFFFF') },
  },
  kofi: {
    name: 'Kofi',
    styleId: 'pop-art',
    palette: { primary: '#D6246E', secondary: '#2B2D42', accent: '#F2A541', background: '#FFFFFF', text: '#111111' },
    fonts: { display: 'Poppins', body: 'Inter' },
    logos: { primary: logo('Kofi', '#2B2D42', '#D6246E'), onLight: logo('Kofi', '#2B2D42', '#D6246E'), onDark: logo('Kofi', '#FFFFFF', '#FFFFFF'), icon: icon('#D6246E'), iconOnDark: icon('#FFFFFF') },
  },
  baobab: {
    name: 'Baobab Agro',
    styleId: 'editorial',
    palette: { primary: '#2E7D32', secondary: '#8D6E63', accent: '#F57C00', background: '#FBFAF6', text: '#1B1B1B' },
    fonts: { display: 'Fraunces', body: 'Source Sans 3' },
    logos: { primary: logo('Baobab', '#1B5E20', '#2E7D32'), onLight: logo('Baobab', '#1B5E20', '#2E7D32'), onDark: logo('Baobab', '#FFFFFF', '#F57C00'), icon: icon('#2E7D32'), iconOnDark: icon('#FFFFFF') },
  },
};

export const MARKET: SectionContent = {
  id: 'market',
  kicker: 'Marché',
  title: 'Un marché de 2,3 milliards de FCFA qui croît de 18 % par an',
  lede: 'La demande en café de spécialité double à Douala et Yaoundé, portée par une classe moyenne urbaine qui consomme hors du foyer.',
  blocks: [
    { id: 'b1', kind: 'metrics', items: [{ value: '2,3 Md FCFA', label: 'Marché adressable', note: '2026' }, { value: '+18 %', label: 'Croissance annuelle', note: '2022-2026' }, { value: '41 %', label: 'Part des 25-40 ans' }] },
    { id: 'b2', kind: 'chart', chartType: 'bar', title: 'Ventes mensuelles (tasses)', labels: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin'], series: [{ name: 'Tasses', data: [1200, 1450, 1380, 1720, 1950, 2240] }], readingKey: 'Les ventes ont presque doublé en six mois.' },
  ],
};

export const PROBLEM: SectionContent = {
  id: 'problem',
  kicker: 'Problème',
  title: 'Le café camerounais est exporté vert et racheté torréfié',
  blocks: [
    { id: 'b1', kind: 'cards', items: [{ title: 'Une valeur qui part', body: '92 % de la récolte quitte le pays sans transformation : la marge de torréfaction est captée à l’étranger.' }, { title: 'Une offre locale pauvre', body: 'Les cafés vendus en ville sont des solubles importés ou des vracs sans traçabilité.', emphasis: true }, { title: 'Des producteurs isolés', body: 'Les coopératives n’ont ni marque ni accès direct aux cafés et aux bureaux.' }] },
  ],
};

export const TRACTION: SectionContent = {
  id: 'traction',
  kicker: 'Traction',
  title: 'Six mois après l’ouverture, 640 abonnés et un comptoir rentable',
  lede: 'Le comptoir de Bonanjo couvre ses charges depuis avril ; l’abonnement livré à domicile croît de 22 % par mois.',
  blocks: [
    { id: 'b1', kind: 'chart', chartType: 'line', title: 'Abonnés actifs', labels: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin'], series: [{ name: 'Abonnés', data: [80, 150, 240, 360, 490, 640] }, { name: 'Objectif', data: [100, 180, 260, 340, 420, 500] }], readingKey: 'Les abonnements dépassent l’objectif depuis avril.' },
    { id: 'b2', kind: 'quote', text: 'Enfin un café d’ici, torréfié la semaine même, que je peux offrir à mes clients.', attribution: 'Awa N., gérante d’un cabinet à Akwa' },
  ],
};

export const TEAM: SectionContent = {
  id: 'team',
  kicker: 'Équipe',
  title: 'Une équipe qui connaît la terre et la ville',
  blocks: [
    { id: 'b1', kind: 'cards', items: [{ title: 'Joseph Mbarga — Fondateur', body: 'Dix ans de négoce de café vert à l’ouest du pays ; réseau de 14 coopératives.' }, { title: 'Clarisse Eto — Opérations', body: 'Ancienne responsable logistique d’un distributeur de boissons à Douala.' }, { title: 'Samuel Ngo — Torréfaction', body: 'Torréfacteur formé à Nairobi, certifié Q-grader.' }, { title: 'Inès Fotso — Ventes B2B', body: 'Huit ans de vente aux entreprises dans l’hôtellerie.' }] },
  ],
};

export const ASK: SectionContent = {
  id: 'ask',
  kicker: 'Demande',
  title: 'Nous levons 85 millions de FCFA pour ouvrir deux comptoirs',
  lede: 'Le financement couvre l’équipement de torréfaction, deux comptoirs à Yaoundé et dix-huit mois de fonctionnement.',
  blocks: [
    { id: 'b1', kind: 'table', headers: ['Usage', 'Montant (FCFA)', 'Part'], rows: [['Torréfacteur 15 kg', '28 000 000', '33 %'], ['Deux comptoirs', '36 000 000', '42 %'], ['Fonds de roulement', '21 000 000', '25 %'], ['Total', '85 000 000', '100 %']] },
    { id: 'b2', kind: 'steps', items: [{ title: 'T1 2027', body: 'Torréfacteur installé, production triplée.' }, { title: 'T2 2027', body: 'Premier comptoir de Yaoundé.' }, { title: 'T4 2027', body: 'Second comptoir, 1 500 abonnés.' }] },
  ],
};

export const SUMMARY_BP: SectionContent = {
  id: 'company-summary',
  kicker: 'Présentation',
  title: 'Café des Hauts torréfie à Douala le café des coopératives de l’Ouest',
  lede: 'Une entreprise de torréfaction et de distribution qui garde au Cameroun la valeur de son café.',
  blocks: [
    { id: 'b1', kind: 'prose', paragraphs: ['Café des Hauts achète le café vert de quatorze coopératives de l’Ouest à un prix supérieur de 18 % au cours local, le torréfie chaque semaine à Douala et le vend sous sa marque aux particuliers, aux bureaux et aux hôtels.', 'L’entreprise a été créée en 2025 par Joseph Mbarga, négociant en café vert depuis dix ans. Elle emploie onze personnes et a réalisé 48 millions de FCFA de chiffre d’affaires sur son premier exercice, clos au 31 décembre.', 'Son avantage tient à la maîtrise de toute la chaîne : sélection des lots, torréfaction, emballage et livraison. Chaque paquet indique la coopérative d’origine et la date de torréfaction.'] },
    { id: 'b2', kind: 'metrics', items: [{ value: '48 M FCFA', label: 'Chiffre d’affaires 2026' }, { value: '14', label: 'Coopératives partenaires' }, { value: '11', label: 'Emplois créés' }] },
    { id: 'b3', kind: 'assumption', statement: 'Le prix du café vert reste dans une fourchette de ±15 % autour de son niveau de 2026.', basis: 'Moyenne des cinq dernières campagnes publiée par l’ONCC.' },
  ],
};

export const FINANCE_BP: SectionContent = {
  id: 'financial-plan',
  kicker: 'Plan financier',
  title: 'Un résultat net positif dès le premier exercice',
  lede: 'Les projections suivent l’exercice comptable OHADA, du 1er janvier au 31 décembre.',
  blocks: [
    { id: 'b1', kind: 'table', origin: 'system', headers: ['Poste', '2026', '2027', '2028'], rows: [['Chiffre d’affaires', '48 000 000', '72 500 000', '104 000 000'], ['Achats consommés', '19 200 000', '27 600 000', '37 400 000'], ['Charges de personnel', '12 600 000', '17 800 000', '24 900 000'], ['Autres charges', '7 400 000', '9 700 000', '14 500 000'], ['Résultat net', '8 800 000', '17 400 000', '27 200 000']], caption: 'En FCFA. Source : module Finance du projet.' },
    { id: 'b2', kind: 'chart', chartType: 'groupedBar', title: 'Chiffre d’affaires et charges', labels: ['2026', '2027', '2028'], series: [{ name: 'Chiffre d’affaires', data: [48, 72.5, 104] }, { name: 'Charges', data: [39.2, 55.1, 76.8] }], unit: 'M FCFA', readingKey: 'L’écart entre recettes et charges s’élargit chaque année.' },
    { id: 'b3', kind: 'prose', paragraphs: ['La marge brute atteint 60 % dès 2026 grâce à l’achat direct aux coopératives. Les charges de personnel augmentent avec l’ouverture des comptoirs mais restent sous 25 % du chiffre d’affaires.'] },
  ],
};

export const SWOT_BP: SectionContent = {
  id: 'swot',
  kicker: 'Analyse',
  title: 'Forces, faiblesses, opportunités et menaces',
  blocks: [{ id: 'b1', kind: 'swot', strengths: ['Achat direct à 14 coopératives', 'Torréfaction hebdomadaire maîtrisée'], weaknesses: ['Un seul torréfacteur de 5 kg', 'Marque encore peu connue hors de Douala'], opportunities: ['Cafés de bureau en forte croissance', 'Demande hôtelière pour un café local'], threats: ['Volatilité du café vert', 'Arrivée de chaînes étrangères'] }],
};

export function coverSection(name: string, label: string, kicker: string, promise: string): SectionContent {
  return { id: 'cover', role: 'cover', title: name, blocks: [{ id: 'c', kind: 'cover', brandName: name, kicker, promise, documentLabel: label, detail: 'Version 1.0', dateLabel: 'Octobre 2026' }] };
}

export const CHARTER = (brand: BrandInput): SectionContent[] => [
  { id: 'palette', kicker: 'Couleurs', title: 'Palette de couleurs', lede: 'Trois couleurs portent la marque ; le bleu nuit domine, l’or ne sert qu’à l’emphase.', blocks: [{ id: 'b1', kind: 'swatches', origin: 'system', items: [{ hex: brand.palette?.primary ?? '#1A2A4F', name: 'Bleu nuit', role: 'Titres, aplats, logo' }, { hex: brand.palette?.secondary ?? '#7F9CE5', name: 'Bleu ciel', role: 'Graphiques, illustrations' }, { hex: brand.palette?.accent ?? '#C9A227', name: 'Or mat', role: 'Emphase, une fois par page' }, { hex: brand.palette?.background ?? '#F8F9FB', name: 'Papier', role: 'Fond des pages' }, { hex: brand.palette?.text ?? '#0F172A', name: 'Encre', role: 'Texte courant' }] }] },
  { id: 'typography', kicker: 'Typographie', title: 'Typographie', blocks: [{ id: 'b1', kind: 'typeSpecimen', origin: 'system', specimens: [{ family: brand.fonts?.display ?? 'Space Grotesk', role: 'Titres', sample: 'La grille comme moteur' }, { family: brand.fonts?.body ?? 'Inter', role: 'Texte courant', sample: 'Une typographie lisible à toutes les tailles' }] }] },
  { id: 'logo', kicker: 'Logo', title: 'Déclinaisons du logo', blocks: [{ id: 'b1', kind: 'logoDisplay', origin: 'system', variants: [{ url: brand.logos?.onLight ?? '', label: 'Sur fond clair', background: 'light' }, { url: brand.logos?.onDark ?? '', label: 'Sur fond sombre', background: 'dark' }, { url: brand.logos?.icon ?? '', label: 'Symbole seul', background: 'neutral' }] }] },
  { id: 'direction', kicker: 'Direction artistique', title: 'Direction artistique', blocks: [{ id: 'b1', kind: 'artDirectionStance', origin: 'system', styleName: 'Design suisse', rationale: 'La rigueur d’une grille dit la méthode ; l’or mat dit la valeur de chaque étape franchie. Rien n’est décoratif : chaque filet structure.', keywords: ['grille modulaire', 'bleu nuit profond', 'or mat', 'escalier ascendant', 'espace blanc', 'ligne fine'] }] },
  { id: 'social', kicker: 'Réseaux sociaux', title: 'Publications sociales', blocks: [{ id: 'b1', kind: 'socialPosts', origin: 'system', posts: [{ platform: 'Instagram', headline: 'Le goût du Cameroun, torréfié chaque semaine', ground: 'primary', logoUrl: brand.logos?.onDark }, { platform: 'LinkedIn', headline: '640 abonnés en six mois', kicker: 'Traction', ground: 'light', logoUrl: brand.logos?.onLight }, { platform: 'Facebook', headline: 'Ouverture du comptoir de Yaoundé', ground: 'accent' }] }] },
];

export const CARD_FRONT: SectionContent = { id: 'front', role: 'card-face', title: 'Recto', blocks: [{ id: 'c', kind: 'contact', side: 'front', binding: 'markers', fields: {} }] };
export const CARD_BACK: SectionContent = { id: 'back', role: 'card-face', title: 'Verso', blocks: [{ id: 'c', kind: 'contact', side: 'back', binding: 'markers', fields: {} }] };
export const CARD_VALUES: SectionContent = { id: 'front', role: 'card-face', title: 'Recto', blocks: [{ id: 'c', kind: 'contact', side: 'front', binding: 'values', fields: { fullName: 'Awa Ndiaye', jobTitle: 'Directrice commerciale', email: 'awa@kora.cm', phone: '+237 6 99 12 34 56', website: 'kora.cm', address: 'Rue Joss, Bonanjo, Douala' } }] };

export function flyer(withPhoto: boolean, p: { a: string; b: string; c: string }): SectionContent {
  return {
    id: 'visual',
    role: 'visual',
    title: 'Visuel',
    blocks: [
      { id: 'copy', kind: 'copy', kicker: 'Atelier pratique', headline: 'La tech au féminin prend le micro', subhead: 'Une soirée de témoignages et d’ateliers pour se lancer', facts: [{ text: 'Samedi 18 octobre' }, { text: '18 h, Akwa' }] },
      ...(withPhoto ? [{ id: 'photo', kind: 'figure' as const, url: photo(p.a, p.b, p.c), alt: 'Une salle de conférence baignée de lumière' }] : []),
    ],
  };
}
