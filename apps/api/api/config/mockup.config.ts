import { AI_CONFIG } from './ai.config';


export const MOCKUP_CONFIG = {
  /**
   * Nombre de mises en situation choisies par l'analyseur, donc de pages de
   * mise en situation dans la charte.
   *
   * Deux, pas davantage : au-delà, la charte empilait des photographies de
   * supports voisins, et chacune ajoutait une génération d'image à l'attente.
   */
  MOCKUP_COUNT: 2,

  /**
   * Scènes produites au plus par mise en situation.
   *
   * Une scène où la vision lit des lettres, des chiffres ou une marque est
   * régénérée : le logo incrusté viendrait s'y superposer. Après ce nombre de
   * scènes marquées, la page est omise plutôt que publiée avec un faux marquage.
   */
  SCENE_ATTEMPTS: 2,

  /**
   * Qualité et résolution des mockups
   */
  IMAGE_QUALITY: {
    width: 1024,
    height: 1024,
    compressionLevel: 9,
    quality: 100,
  },

  /**
   * Configuration Gemini pour la génération d'images
   */
  GEMINI_CONFIG: {
    model: AI_CONFIG.branding.brandMockup.imageModel,
    responseModalities: ['TEXT', 'IMAGE'] as const,
  },

  /**
   * Timeout et retry
   */
  GENERATION_TIMEOUT_MS: 60000, // 60 secondes par mockup
  MAX_RETRIES: 2,
} as const;

/**
 * Définition des catégories de supports physiques par industrie
 * L'IA choisira automatiquement parmi ces catégories en fonction du contexte
 */
export const INDUSTRY_MOCKUP_CATEGORIES = {
  'Delivery & Logistics': {
    primary: ['vehicle_branding', 'packaging', 'uniforms', 'signage'],
    secondary: ['business_cards', 'stationery', 'digital_screens', 'safety_equipment'],
    context: 'logistics, delivery, transportation, warehouse',
  },
  'Food & Beverage': {
    primary: ['food_packaging', 'menu_design', 'storefront', 'table_settings'],
    secondary: ['uniforms', 'delivery_bags', 'business_cards', 'digital_menu'],
    context: 'restaurant, café, food service, culinary',
  },
  Healthcare: {
    primary: ['medical_signage', 'uniforms', 'stationery', 'patient_materials'],
    secondary: ['business_cards', 'digital_screens', 'packaging', 'badges'],
    context: 'medical, hospital, clinic, healthcare',
  },
  Finance: {
    primary: ['business_cards', 'stationery', 'digital_banking', 'office_branding'],
    secondary: ['signage', 'presentation_materials', 'corporate_gifts', 'documents'],
    context: 'banking, finance, corporate, professional',
  },
  Education: {
    primary: ['stationery', 'signage', 'digital_learning', 'campus_branding'],
    secondary: ['uniforms', 'books', 'certificates', 'event_materials'],
    context: 'school, university, learning, academic',
  },
  'Retail & E-commerce': {
    primary: ['packaging', 'shopping_bags', 'storefront', 'product_tags'],
    secondary: ['business_cards', 'digital_commerce', 'gift_cards', 'receipts'],
    context: 'retail, shopping, e-commerce, store',
  },
  'Sports & Fitness': {
    primary: ['athletic_wear', 'equipment', 'gym_signage', 'membership_cards'],
    secondary: ['water_bottles', 'towels', 'digital_app', 'event_materials'],
    context: 'sports, fitness, gym, athletic',
  },
  'Travel & Hospitality': {
    primary: ['hotel_branding', 'room_amenities', 'signage', 'welcome_materials'],
    secondary: ['business_cards', 'luggage_tags', 'digital_booking', 'menus'],
    context: 'hotel, travel, tourism, hospitality',
  },
  'Beauty & Cosmetics': {
    primary: ['product_packaging', 'salon_branding', 'business_cards', 'mirrors'],
    secondary: ['uniforms', 'gift_sets', 'digital_booking', 'certificates'],
    context: 'beauty, cosmetics, salon, spa',
  },
  Construction: {
    primary: ['vehicle_branding', 'safety_equipment', 'signage', 'uniforms'],
    secondary: ['business_cards', 'blueprints', 'site_signage', 'hard_hats'],
    context: 'construction, building, contractor, architecture',
  },
  'Real Estate': {
    primary: ['signage', 'business_cards', 'property_brochures', 'for_sale_signs'],
    secondary: ['presentation_folders', 'digital_listings', 'office_branding', 'vehicle_branding'],
    context: 'real estate, property, housing, commercial',
  },
  Fashion: {
    primary: ['clothing_tags', 'packaging', 'shopping_bags', 'storefront'],
    secondary: ['business_cards', 'lookbooks', 'hangers', 'tissue_paper'],
    context: 'fashion, clothing, apparel, style',
  },
  Sustainability: {
    primary: ['eco_packaging', 'tote_bags', 'signage', 'educational_materials'],
    secondary: ['business_cards', 'certificates', 'digital_platforms', 'reusable_products'],
    context: 'sustainability, eco-friendly, green, environmental',
  },
  Technology: {
    primary: ['digital_interfaces', 'business_cards', 'office_branding', 'tech_accessories'],
    secondary: ['packaging', 'conference_materials', 'swag', 'signage'],
    context: 'technology, software, digital, innovation',
  },
  'General Business': {
    primary: ['business_cards', 'stationery', 'office_branding', 'digital_presence'],
    secondary: ['signage', 'presentation_materials', 'corporate_gifts', 'packaging'],
    context: 'business, corporate, professional, services',
  },
} as const;

/**
 * Types de supports physiques détaillés avec descriptions
 * L'IA utilisera ces informations pour créer des mockups pertinents
 *
 * `scene` est la description, en anglais, que lit le modèle d'image. Seuls les
 * supports qui se photographient NUS en ont une : une enseigne, une papeterie,
 * un écran, un menu ou une carte de visite portent des mots par nature, le
 * modèle d'image les y écrivait, et le logo incrusté se posait dessus. Ces
 * supports-là ne sont jamais mis en scène (cf. `supportScene`).
 *
 * Une scène ne contient aucun mot du champ de l'écrit (logo, marque, texte,
 * étiquette…), pas même nié : un modèle d'image retient le mot, pas la négation.
 */
export const PHYSICAL_SUPPORT_TYPES = {
  // Vêtements et textiles
  athletic_wear: {
    name: 'Vêtements sportifs',
    examples: ['T-shirt technique', 'Polo sport', 'Sweat-shirt', 'Short de sport'],
    context: 'Sur un athlète ou mannequin en action, dans un environnement sportif',
    scene:
      'a plain technical sports T-shirt worn by an athlete in mid-movement, its chest a smooth panel of solid fabric',
  },
  uniforms: {
    name: 'Uniformes professionnels',
    examples: ['Chemise de travail', 'Tablier', 'Blouse médicale', 'Polo entreprise'],
    context: 'Porté par un professionnel dans son environnement de travail',
    scene:
      'a plain work polo shirt worn by a professional at their workplace, its chest a smooth panel of solid fabric',
  },
  tote_bags: {
    name: 'Sacs en toile',
    examples: ['Tote bag en coton', 'Sac en toile', 'Cabas', 'Sac réutilisable'],
    context: "Porté à l'épaule, dans une scène urbaine ou quotidienne",
    scene: 'a canvas tote bag carried on the shoulder, its front panel flat, smooth and uniform',
  },

  // Packaging et produits
  food_packaging: {
    name: 'Packaging alimentaire',
    examples: ['Boîte à emporter', 'Gobelet café', 'Sac sandwich', 'Emballage burger'],
    context: 'Dans un contexte de restaurant ou de livraison, avec nourriture visible',
    scene:
      'a plain takeaway box and a plain paper coffee cup on a counter, fresh food beside them, their sides smooth and uniform',
  },
  product_packaging: {
    name: 'Packaging produit',
    examples: ['Boîte premium', 'Sachet kraft', 'Étui carton', 'Coffret cadeau'],
    context: 'Mise en scène produit haut de gamme, éclairage studio',
    scene: 'a premium rigid box with a smooth matte lid, set on a pedestal in soft studio light',
  },
  packaging: {
    name: 'Emballage général',
    examples: ['Boîte carton', 'Sac papier', 'Pochette', 'Emballage cadeau'],
    context: 'Contexte commercial ou e-commerce, présentation soignée',
    scene: 'a sturdy cardboard box and a folded paper pouch, neatly presented, their faces smooth and uniform',
  },
  corporate_gifts: {
    name: 'Objets de marque',
    examples: ['Mug', 'Carnet', 'Gourde', 'Coffret'],
    context: 'Sur un bureau soigné, en lumière naturelle',
    scene: 'a matte ceramic mug beside a hardcover notebook with a smooth solid cover, on a tidy desk',
  },
  water_bottles: {
    name: 'Gourdes',
    examples: ['Gourde isotherme', 'Bouteille de sport', 'Shaker', 'Gourde aluminium'],
    context: 'Salle de sport ou extérieur, en mouvement',
    scene: 'a matte stainless steel water bottle standing on a gym bench, its body smooth and uniform',
  },
  tech_accessories: {
    name: 'Accessoires tech',
    examples: ["Housse d'ordinateur", 'Chargeur sans fil', 'Tapis de souris', 'Support de téléphone'],
    context: 'Bureau moderne, lumière douce',
    scene: 'a felt laptop sleeve and a wireless charging pad on a desk, their surfaces smooth and uniform',
  },

  // Papeterie et bureau
  business_cards: {
    name: 'Cartes de visite',
    examples: ['Carte premium mate', 'Carte avec dorure', 'Carte épaisse', 'Carte minimaliste'],
    context: 'Sur un bureau élégant, avec éclairage professionnel, finitions visibles',
  },
  stationery: {
    name: 'Papeterie professionnelle',
    examples: ['En-tête', 'Enveloppe', 'Bloc-notes', 'Chemise à rabats'],
    context: 'Ensemble coordonné sur bureau, ambiance corporate',
  },

  // Signalétique et extérieur
  billboard: {
    name: 'Affichage grand format',
    examples: ['4x3 urbain', 'Panneau autoroutier', 'Affiche métro', 'Mur pignon'],
    context:
      'Panneau grand format en situation urbaine réelle, vu de la rue, avec la perspective et la lumière du lieu',
  },
  brand_imagery: {
    name: 'Univers visuel',
    examples: ['Scène de marque', 'Sujet en situation', 'Matière et lumière', 'Ambiance'],
    context:
      "Photographie d'univers, SANS aucun logo ni texte : elle montre le sujet, le traitement et la lumière de la marque",
  },
  signage: {
    name: 'Signalétique',
    examples: ['Enseigne façade', 'Panneau directionnel', 'Totem', 'Plaque murale'],
    context: 'Installation extérieure ou intérieure, contexte réel du lieu',
  },
  storefront: {
    name: 'Devanture de magasin',
    examples: ['Vitrine', 'Enseigne lumineuse', 'Façade boutique', 'Entrée magasin'],
    context: 'Vue extérieure réaliste, contexte urbain ou commercial',
  },
  vehicle_branding: {
    name: 'Véhicule brandé',
    examples: ['Camionnette', 'Voiture de service', 'Camion', 'Scooter de livraison'],
    context: 'Véhicule en situation réelle, urbain ou sur route',
    scene: 'a clean delivery van parked in a city street, its side panel one smooth uniform paint',
  },

  // Digital et tech
  digital_interfaces: {
    name: 'Interfaces digitales',
    examples: ['Site web sur laptop', 'Application mobile', 'Tablette', 'Écran interactif'],
    context: 'Écran moderne, interface visible, contexte professionnel ou personnel',
  },
  digital_screens: {
    name: 'Écrans digitaux',
    examples: ['Écran accueil', 'Borne interactive', 'Affichage digital', 'Moniteur'],
    context: 'Installation professionnelle, contenu visible et lisible',
  },

  // Événementiel et marketing
  event_materials: {
    name: 'Supports événementiels',
    examples: ['Roll-up', 'Kakémono', 'Badge', 'Invitation'],
    context: 'Contexte événement, salon, conférence',
  },
  presentation_materials: {
    name: 'Supports de présentation',
    examples: ['Dossier présentation', 'Brochure', 'Catalogue', 'Portfolio'],
    context: 'Contexte business, réunion, présentation client',
  },

  // Spécifiques par industrie
  shopping_bags: {
    name: 'Sacs shopping',
    examples: ['Sac kraft', 'Sac luxe', 'Tote bag', 'Sac boutique'],
    context: 'Porté ou posé, contexte shopping ou lifestyle',
    scene: 'a paper shopping bag with rope handles standing upright, its front panel flat, smooth and uniform',
  },
  menu_design: {
    name: 'Menu restaurant',
    examples: ['Menu table', 'Carte des vins', 'Menu ardoise', 'Menu digital'],
    context: 'Sur table de restaurant, ambiance culinaire',
  },
  safety_equipment: {
    name: 'Équipement de sécurité',
    examples: ['Casque', 'Gilet haute visibilité', 'Panneau sécurité', 'Badge'],
    context: 'Contexte chantier ou industriel, professionnel',
  },
  office_branding: {
    name: 'Branding bureau',
    examples: ['Mur logo', 'Plaque porte', 'Signalétique intérieure', 'Décoration murale'],
    context: 'Intérieur bureau moderne, ambiance professionnelle',
  },
  eco_packaging: {
    name: 'Packaging écologique',
    examples: [
      'Emballage recyclé',
      'Sac réutilisable',
      'Packaging biodégradable',
      'Contenant compostable',
    ],
    context: 'Mise en valeur aspect écologique, matériaux naturels visibles',
    scene:
      'recycled kraft packaging and a reusable cotton pouch among natural materials, their faces smooth and uniform',
  },
} as const;

export type IndustryKey = keyof typeof INDUSTRY_MOCKUP_CATEGORIES;
export type SupportTypeKey = keyof typeof PHYSICAL_SUPPORT_TYPES;

/**
 * La scène d'un support, telle que le modèle d'image la lit — ou `undefined`
 * quand le support porte des mots par nature et ne doit pas être mis en scène.
 */
export function supportScene(type: SupportTypeKey): string | undefined {
  return (PHYSICAL_SUPPORT_TYPES[type] as { scene?: string }).scene;
}

/**
 * Supports qui complètent la sélection quand un secteur n'offre pas assez de
 * supports photographiables nus : ceux de la finance ou de l'éducation sont
 * surtout de la papeterie et de la signalétique.
 */
export const FALLBACK_STAGED_SUPPORTS: readonly SupportTypeKey[] = [
  'tote_bags',
  'corporate_gifts',
  'packaging',
  'uniforms',
];

/**
 * Mises en situation NOMMÉES de la charte.
 *
 * Les `MOCKUP_COUNT` premières mises en situation sont choisies par l'analyseur
 * selon le secteur : c'est ce qui rend une charte de restaurant différente
 * d'une charte de cabinet d'avocats. Les supports imposés suivent.
 *
 * Il n'en reste qu'un, l'univers visuel. Le grand format et la papeterie ont
 * été retirés : la charte ne montre plus que deux mises en situation, et ces
 * deux supports-là portent des mots par nature — le modèle d'image y écrivait
 * un nom, sur lequel le logo venait se poser.
 *
 * `skipLogo` : la photographie d'univers montre le TRAITEMENT de l'image, pas
 * la marque posée dessus. Elle n'a pas de page à elle : elle illustre la page
 * « Traitement de l'image » de la direction artistique (cf.
 * `charterComposedPages.ts`).
 */
export const CHARTER_NAMED_MOCKUPS = [
  { stepName: 'Brand Imagery', supportType: 'brand_imagery', skipLogo: true },
] as const satisfies readonly {
  stepName: string;
  supportType: SupportTypeKey;
  skipLogo?: boolean;
}[];

/** Pages que la charte ne produit plus, et qu'une charte déjà stockée peut encore porter. */
const RETIRED_CHARTER_PAGES: ReadonlySet<string> = new Set([
  'Brand Billboard',
  'Brand Stationery',
  'Brand Imagery',
]);

/**
 * Cette page a-t-elle été retirée de la charte ?
 *
 * Une régénération remplace les sections par leur nom : celles qui ne sont plus
 * produites resteraient donc dans la charte stockée, et dans son PDF. Une mise
 * en situation au-delà de `MOCKUP_COUNT` l'est aussi.
 */
export function isRetiredCharterPage(name: string): boolean {
  const mockup = /^Brand Mockup (\d+)$/.exec(name);
  if (mockup) return Number(mockup[1]) > MOCKUP_CONFIG.MOCKUP_COUNT;
  return RETIRED_CHARTER_PAGES.has(name);
}
