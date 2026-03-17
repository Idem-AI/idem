/**
 * Configuration centralisée pour la génération de mockups
 * Modifiez simplement MOCKUP_COUNT pour changer le nombre de mockups générés
 */

export const MOCKUP_CONFIG = {
  /**
   * Nombre de mockups à générer par projet
   * Modifiez cette valeur pour générer plus ou moins de mockups
   */
  MOCKUP_COUNT: 3,

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
    model: 'gemini-3.1-flash-image-preview',
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
 */
export const PHYSICAL_SUPPORT_TYPES = {
  // Vêtements et textiles
  athletic_wear: {
    name: 'Vêtements sportifs',
    examples: ['T-shirt technique', 'Polo sport', 'Sweat-shirt', 'Short de sport'],
    context: 'Sur un athlète ou mannequin en action, dans un environnement sportif',
  },
  uniforms: {
    name: 'Uniformes professionnels',
    examples: ['Chemise de travail', 'Tablier', 'Blouse médicale', 'Polo entreprise'],
    context: 'Porté par un professionnel dans son environnement de travail',
  },

  // Packaging et produits
  food_packaging: {
    name: 'Packaging alimentaire',
    examples: ['Boîte à emporter', 'Gobelet café', 'Sac sandwich', 'Emballage burger'],
    context: 'Dans un contexte de restaurant ou de livraison, avec nourriture visible',
  },
  product_packaging: {
    name: 'Packaging produit',
    examples: ['Boîte premium', 'Sachet kraft', 'Étui carton', 'Coffret cadeau'],
    context: 'Mise en scène produit haut de gamme, éclairage studio',
  },
  packaging: {
    name: 'Emballage général',
    examples: ['Boîte carton', 'Sac papier', 'Pochette', 'Emballage cadeau'],
    context: 'Contexte commercial ou e-commerce, présentation soignée',
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
  },
} as const;

export type IndustryKey = keyof typeof INDUSTRY_MOCKUP_CATEGORIES;
export type SupportTypeKey = keyof typeof PHYSICAL_SUPPORT_TYPES;
