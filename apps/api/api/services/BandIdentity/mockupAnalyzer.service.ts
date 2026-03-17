import logger from '../../config/logger';
import {
  INDUSTRY_MOCKUP_CATEGORIES,
  PHYSICAL_SUPPORT_TYPES,
  MOCKUP_CONFIG,
  IndustryKey,
  SupportTypeKey,
} from '../../config/mockup.config';

/**
 * Interface pour les supports sélectionnés
 */
export interface SelectedMockupSupport {
  supportType: SupportTypeKey;
  supportName: string;
  examples: readonly string[];
  context: string;
  priority: 'primary' | 'secondary';
  mockupIndex: number;
  industryContext: string;
}

/**
 * Service d'analyse de projet pour déterminer les supports de mockup adaptés
 * L'IA analyse le projet et choisit intelligemment les supports les plus pertinents
 */
export class MockupAnalyzerService {
  /**
   * Analyse le projet et retourne les supports de mockup adaptés
   * @param industry - Industrie du projet
   * @param projectDescription - Description complète du projet
   * @param brandName - Nom de la marque
   * @param mockupCount - Nombre de mockups à générer (depuis config)
   * @returns Liste des supports sélectionnés avec contexte
   */
  async analyzeMockupSupports(
    industry: string,
    projectDescription: string,
    brandName: string,
    mockupCount: number = MOCKUP_CONFIG.MOCKUP_COUNT
  ): Promise<SelectedMockupSupport[]> {
    logger.info('Starting mockup support analysis', {
      industry,
      brandName,
      mockupCount,
      projectDescriptionLength: projectDescription.length,
    });

    // Normaliser l'industrie
    const normalizedIndustry = this.normalizeIndustry(industry);

    // Récupérer les catégories de supports pour cette industrie
    const industryCategories = INDUSTRY_MOCKUP_CATEGORIES[normalizedIndustry];

    if (!industryCategories) {
      logger.warn(`Industry "${industry}" not found in config, using General Business`, {
        industry,
        normalizedIndustry,
      });
      return this.getDefaultMockupSupports(mockupCount);
    }

    // Analyser le contexte du projet pour affiner les choix
    const projectContext = this.analyzeProjectContext(projectDescription, brandName);

    logger.info('Project context analyzed', {
      industry: normalizedIndustry,
      projectContext,
      availablePrimarySupports: industryCategories.primary.length,
      availableSecondarySupports: industryCategories.secondary.length,
    });

    // Sélectionner les supports en fonction du nombre demandé
    const selectedSupports = this.selectSupports(
      industryCategories,
      normalizedIndustry,
      projectContext,
      mockupCount
    );

    logger.info('Mockup supports selected', {
      industry: normalizedIndustry,
      brandName,
      mockupCount,
      selectedSupports: selectedSupports.map((s) => ({
        index: s.mockupIndex,
        type: s.supportType,
        priority: s.priority,
      })),
    });

    return selectedSupports;
  }

  /**
   * Normalise le nom de l'industrie pour correspondre aux clés de config
   */
  private normalizeIndustry(industry: string): IndustryKey {
    const industryLower = industry.toLowerCase();

    // Mapping des variations possibles
    const industryMap: Record<string, IndustryKey> = {
      'delivery & logistics': 'Delivery & Logistics',
      'delivery and logistics': 'Delivery & Logistics',
      logistics: 'Delivery & Logistics',
      delivery: 'Delivery & Logistics',

      'food & beverage': 'Food & Beverage',
      'food and beverage': 'Food & Beverage',
      food: 'Food & Beverage',
      restaurant: 'Food & Beverage',
      beverage: 'Food & Beverage',

      healthcare: 'Healthcare',
      health: 'Healthcare',
      medical: 'Healthcare',
      hospital: 'Healthcare',

      finance: 'Finance',
      banking: 'Finance',
      financial: 'Finance',

      education: 'Education',
      school: 'Education',
      university: 'Education',
      learning: 'Education',

      'retail & e-commerce': 'Retail & E-commerce',
      'retail and e-commerce': 'Retail & E-commerce',
      retail: 'Retail & E-commerce',
      'e-commerce': 'Retail & E-commerce',
      ecommerce: 'Retail & E-commerce',
      shopping: 'Retail & E-commerce',

      'sports & fitness': 'Sports & Fitness',
      'sports and fitness': 'Sports & Fitness',
      sports: 'Sports & Fitness',
      fitness: 'Sports & Fitness',
      gym: 'Sports & Fitness',

      'travel & hospitality': 'Travel & Hospitality',
      'travel and hospitality': 'Travel & Hospitality',
      travel: 'Travel & Hospitality',
      hospitality: 'Travel & Hospitality',
      hotel: 'Travel & Hospitality',
      tourism: 'Travel & Hospitality',

      'beauty & cosmetics': 'Beauty & Cosmetics',
      'beauty and cosmetics': 'Beauty & Cosmetics',
      beauty: 'Beauty & Cosmetics',
      cosmetics: 'Beauty & Cosmetics',
      salon: 'Beauty & Cosmetics',

      construction: 'Construction',
      building: 'Construction',
      contractor: 'Construction',

      'real estate': 'Real Estate',
      realestate: 'Real Estate',
      property: 'Real Estate',
      immobilier: 'Real Estate',

      fashion: 'Fashion',
      clothing: 'Fashion',
      apparel: 'Fashion',
      style: 'Fashion',

      sustainability: 'Sustainability',
      'eco-friendly': 'Sustainability',
      green: 'Sustainability',
      environmental: 'Sustainability',

      technology: 'Technology',
      tech: 'Technology',
      software: 'Technology',
      digital: 'Technology',
      it: 'Technology',
    };

    // Chercher une correspondance
    for (const [key, value] of Object.entries(industryMap)) {
      if (industryLower.includes(key)) {
        return value;
      }
    }

    // Par défaut, retourner General Business
    return 'General Business';
  }

  /**
   * Analyse le contexte du projet pour affiner les choix de supports
   */
  private analyzeProjectContext(
    projectDescription: string,
    brandName: string
  ): {
    keywords: string[];
    emphasis: string[];
    scale: 'startup' | 'small' | 'medium' | 'enterprise';
  } {
    const descLower = projectDescription.toLowerCase();

    // Extraire des mots-clés importants
    const keywords: string[] = [];

    // Mots-clés de contexte
    const contextKeywords = [
      'digital',
      'physical',
      'online',
      'offline',
      'local',
      'international',
      'premium',
      'luxury',
      'budget',
      'eco',
      'sustainable',
      'modern',
      'traditional',
      'innovative',
      'classic',
    ];

    contextKeywords.forEach((keyword) => {
      if (descLower.includes(keyword)) {
        keywords.push(keyword);
      }
    });

    // Déterminer l'échelle du business
    let scale: 'startup' | 'small' | 'medium' | 'enterprise' = 'small';
    if (descLower.includes('startup') || descLower.includes('new business')) {
      scale = 'startup';
    } else if (
      descLower.includes('enterprise') ||
      descLower.includes('corporation') ||
      descLower.includes('multinational')
    ) {
      scale = 'enterprise';
    } else if (
      descLower.includes('medium') ||
      descLower.includes('growing') ||
      descLower.includes('expanding')
    ) {
      scale = 'medium';
    }

    // Déterminer les points d'emphase
    const emphasis: string[] = [];
    if (
      descLower.includes('online') ||
      descLower.includes('digital') ||
      descLower.includes('web')
    ) {
      emphasis.push('digital');
    }
    if (
      descLower.includes('store') ||
      descLower.includes('shop') ||
      descLower.includes('physical')
    ) {
      emphasis.push('physical');
    }
    if (descLower.includes('delivery') || descLower.includes('shipping')) {
      emphasis.push('delivery');
    }
    if (descLower.includes('event') || descLower.includes('conference')) {
      emphasis.push('events');
    }

    return { keywords, emphasis, scale };
  }

  /**
   * Sélectionne les supports en fonction du contexte
   */
  private selectSupports(
    industryCategories: {
      readonly primary: readonly string[];
      readonly secondary: readonly string[];
      readonly context: string;
    },
    industry: IndustryKey,
    projectContext: {
      keywords: string[];
      emphasis: string[];
      scale: 'startup' | 'small' | 'medium' | 'enterprise';
    },
    mockupCount: number
  ): SelectedMockupSupport[] {
    const selectedSupports: SelectedMockupSupport[] = [];

    // Stratégie de sélection :
    // - Premier mockup : toujours un support primaire (le plus iconique)
    // - Mockups suivants : alterner entre primaire et secondaire
    // - Éviter les doublons
    // - Prioriser les supports qui correspondent au contexte du projet

    const usedSupports = new Set<string>();

    // Combiner et scorer tous les supports disponibles
    const allSupports = [
      ...industryCategories.primary.map((s) => ({ type: s, priority: 'primary' as const })),
      ...industryCategories.secondary.map((s) => ({ type: s, priority: 'secondary' as const })),
    ];

    // Scorer chaque support en fonction du contexte
    const scoredSupports = allSupports
      .map((support) => {
        let score = support.priority === 'primary' ? 10 : 5;

        // Bonus si le support correspond aux emphases du projet
        if (projectContext.emphasis.includes('digital') && support.type.includes('digital')) {
          score += 5;
        }
        if (projectContext.emphasis.includes('physical') && !support.type.includes('digital')) {
          score += 3;
        }
        if (projectContext.emphasis.includes('delivery') && support.type.includes('vehicle')) {
          score += 5;
        }
        if (projectContext.emphasis.includes('events') && support.type.includes('event')) {
          score += 5;
        }

        // Bonus pour certains mots-clés
        if (
          projectContext.keywords.includes('premium') &&
          support.type.includes('business_cards')
        ) {
          score += 3;
        }
        if (projectContext.keywords.includes('eco') && support.type.includes('eco')) {
          score += 5;
        }

        return { ...support, score };
      })
      .sort((a, b) => b.score - a.score);

    // Sélectionner les N meilleurs supports
    for (let i = 0; i < mockupCount && i < scoredSupports.length; i++) {
      const support = scoredSupports[i];

      // Vérifier que le type de support existe dans la config
      if (!(support.type in PHYSICAL_SUPPORT_TYPES)) {
        logger.warn(`Support type "${support.type}" not found in PHYSICAL_SUPPORT_TYPES`, {
          supportType: support.type,
          industry,
        });
        continue;
      }

      const supportType = support.type as SupportTypeKey;
      const supportDetails = PHYSICAL_SUPPORT_TYPES[supportType];

      selectedSupports.push({
        supportType,
        supportName: supportDetails.name,
        examples: supportDetails.examples,
        context: supportDetails.context,
        priority: support.priority,
        mockupIndex: i + 1,
        industryContext: industryCategories.context,
      });

      usedSupports.add(support.type);
    }

    return selectedSupports;
  }

  /**
   * Retourne des supports par défaut si l'industrie n'est pas reconnue
   */
  private getDefaultMockupSupports(mockupCount: number): SelectedMockupSupport[] {
    const defaultSupports: SupportTypeKey[] = [
      'business_cards',
      'stationery',
      'digital_interfaces',
      'packaging',
      'signage',
    ];

    return defaultSupports.slice(0, mockupCount).map((supportType, index) => {
      const supportDetails = PHYSICAL_SUPPORT_TYPES[supportType];
      return {
        supportType,
        supportName: supportDetails.name,
        examples: supportDetails.examples,
        context: supportDetails.context,
        priority: index === 0 ? ('primary' as const) : ('secondary' as const),
        mockupIndex: index + 1,
        industryContext: 'business, corporate, professional, services',
      };
    });
  }
}

export const mockupAnalyzerService = new MockupAnalyzerService();
