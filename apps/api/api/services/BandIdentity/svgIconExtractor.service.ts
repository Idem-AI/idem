import logger from "../../config/logger";

/**
 * Service pour traiter les logos et variations SVG
 * Maintenant que l'IA génère directement les icônes séparément, ce service se concentre sur les variations
 */
export class SvgIconExtractorService {
  /**
   * @deprecated Cette méthode n'est plus nécessaire car l'IA génère directement les icônes
   * Conservée pour compatibilité descendante
   */
  static extractIcon(logoSvg: string): {
    fullLogo: string;
    iconOnly: string;
  } {
    logger.warn("extractIcon is deprecated - AI now generates icons directly");
    return {
      fullLogo: logoSvg,
      iconOnly: logoSvg,
    };
  }

  /**
   * @deprecated Cette méthode n'est plus nécessaire car l'IA génère directement les icônes
   * Conservée pour compatibilité descendante
   */
  static extractIconsFromLogos(logos: any[]): any[] {
    logger.warn("extractIconsFromLogos is deprecated - AI now generates icons directly");
    return logos;
  }

  /**
   * Génère les variations d'un logo avec et sans texte
   * @param logoSvg - SVG du logo complet
   * @param variations - Variations générées par l'IA
   * @returns Variations avec texte et sans texte
   */
  static generateVariationsWithText(
    logoSvg: string,
    variations: {
      lightBackground?: string;
      darkBackground?: string;
      monochrome?: string;
    }
  ): {
    withText: {
      lightBackground?: string;
      darkBackground?: string;
      monochrome?: string;
    };
    iconOnly: {
      lightBackground?: string;
      darkBackground?: string;
      monochrome?: string;
    };
  } {
    logger.info("Generating variations with and without text");

    const result = {
      withText: {} as any,
      iconOnly: {} as any,
    };

    // Pour chaque variation, créer une version avec texte et une sans texte
    Object.entries(variations).forEach(([key, variationSvg]) => {
      if (variationSvg) {
        // Version avec texte : adapter le logo complet aux couleurs de la variation
        result.withText[key] = this.adaptLogoColors(logoSvg, variationSvg);
        // Version sans texte : utiliser la variation telle quelle (déjà sans texte)
        result.iconOnly[key] = variationSvg;
      }
    });

    return result;
  }

  /**
   * Adapte les couleurs du logo complet selon une variation
   * @param fullLogoSvg - Logo complet avec texte
   * @param variationSvg - Variation avec les bonnes couleurs
   * @returns Logo complet avec les couleurs adaptées
   */
  private static adaptLogoColors(
    fullLogoSvg: string,
    variationSvg: string
  ): string {
    try {
      // Extraire les couleurs de la variation
      const colors = this.extractColorsFromSvg(variationSvg);
      
      // Appliquer ces couleurs au logo complet
      let adaptedLogo = fullLogoSvg;
      
      // Remplacer les couleurs principales
      colors.forEach((color, index) => {
        // Remplacer les couleurs par ordre d'apparition
        const colorRegex = new RegExp(`fill="[^"]*"`, 'g');
        if (index === 0) {
          adaptedLogo = adaptedLogo.replace(colorRegex, `fill="${color}"`);
        }
      });

      return adaptedLogo;
    } catch (error) {
      logger.error("Error adapting logo colors:", error);
      return fullLogoSvg;
    }
  }

  /**
   * Extrait les couleurs d'un SVG
   * @param svgContent - Contenu SVG
   * @returns Tableau des couleurs trouvées
   */
  private static extractColorsFromSvg(svgContent: string): string[] {
    const colors: string[] = [];
    const fillMatches = svgContent.match(/fill="([^"]*)"/g);
    
    if (fillMatches) {
      fillMatches.forEach((match) => {
        const color = match.match(/fill="([^"]*)"/)?.[1];
        if (color && color !== "none" && !colors.includes(color)) {
          colors.push(color);
        }
      });
    }

    return colors;
  }

  /**
   * Supprime les éléments vides d'un SVG
   * @param svgElement - Élément SVG à nettoyer
   */
  private static removeEmptyElements(svgElement: SVGElement): void {
    const emptyElements = svgElement.querySelectorAll("g:empty, defs:empty");
    emptyElements.forEach((element) => element.remove());
  }
}
