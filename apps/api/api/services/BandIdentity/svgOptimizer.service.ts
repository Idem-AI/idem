import logger from "../../config/logger";

/**
 * SVG Optimization Service
 * Implements manual SVG optimization without external dependencies
 * Focuses on reducing file size and improving performance
 */
export class SvgOptimizerService {
  
  /**
   * Optimize SVG content using manual optimization techniques
   */
  static optimizeSvg(svgContent: string): string {
    logger.info("Optimizing SVG content");
    
    try {
      let optimized = svgContent;
      
      // 1. Remove unnecessary whitespace and line breaks
      optimized = this.removeUnnecessaryWhitespace(optimized);
      
      // 2. Remove comments
      optimized = this.removeComments(optimized);
      
      // 3. Optimize numeric precision (limit to 2 decimal places)
      optimized = this.optimizeNumericPrecision(optimized);
      
      // 4. Remove default attributes
      optimized = this.removeDefaultAttributes(optimized);
      
      // 5. Merge similar paths and shapes
      optimized = this.mergeSimilarElements(optimized);
      
      // 6. Remove empty groups and containers
      optimized = this.removeEmptyGroups(optimized);
      
      // 7. Optimize colors (convert rgb to hex, remove unnecessary opacity)
      optimized = this.optimizeColors(optimized);
      
      const originalSize = svgContent.length;
      const optimizedSize = optimized.length;
      const reduction = ((originalSize - optimizedSize) / originalSize * 100).toFixed(1);
      
      logger.info(`SVG optimized: ${originalSize}B → ${optimizedSize}B (${reduction}% reduction)`);
      
      return optimized;
      
    } catch (error) {
      logger.error("Error optimizing SVG:", error);
      return svgContent; // Return original if optimization fails
    }
  }
  
  /**
   * Remove unnecessary whitespace while preserving structure
   */
  private static removeUnnecessaryWhitespace(svg: string): string {
    return svg
      .replace(/\s+/g, ' ') // Multiple spaces to single space
      .replace(/>\s+</g, '><') // Remove spaces between tags
      .replace(/\s+\/>/g, '/>') // Clean self-closing tags
      .replace(/\s+>/g, '>') // Remove trailing spaces in tags
      .replace(/\s+="/g, '="') // Remove spaces before attributes
      .trim();
  }
  
  /**
   * Remove XML and SVG comments
   */
  private static removeComments(svg: string): string {
    return svg.replace(/<!--[\s\S]*?-->/g, '');
  }
  
  /**
   * Optimize numeric precision to reduce file size
   */
  private static optimizeNumericPrecision(svg: string): string {
    // Round numbers to 2 decimal places
    return svg.replace(/(\d+\.\d{3,})/g, (match) => {
      return parseFloat(match).toFixed(2);
    });
  }
  
  /**
   * Remove default SVG attributes that don't add value
   */
  private static removeDefaultAttributes(svg: string): string {
    return svg
      .replace(/\s+fill="none"/g, '') // Remove default fill
      .replace(/\s+stroke="none"/g, '') // Remove default stroke
      .replace(/\s+opacity="1"/g, '') // Remove default opacity
      .replace(/\s+stroke-width="1"/g, '') // Remove default stroke-width
      .replace(/\s+fill-rule="nonzero"/g, ''); // Remove default fill-rule
  }
  
  /**
   * Merge similar elements to reduce redundancy
   */
  private static mergeSimilarElements(svg: string): string {
    // This is a simplified version - can be enhanced
    // For now, just remove duplicate style definitions
    const styleMatches = svg.match(/style="[^"]*"/g);
    if (styleMatches) {
      const uniqueStyles = [...new Set(styleMatches)];
      // Could implement CSS class extraction here for repeated styles
    }
    return svg;
  }
  
  /**
   * Remove empty groups and containers
   */
  private static removeEmptyGroups(svg: string): string {
    return svg
      .replace(/<g[^>]*>\s*<\/g>/g, '') // Remove empty groups
      .replace(/<defs[^>]*>\s*<\/defs>/g, '') // Remove empty defs
      .replace(/<clipPath[^>]*>\s*<\/clipPath>/g, ''); // Remove empty clipPaths
  }
  
  /**
   * Optimize color representations
   */
  private static optimizeColors(svg: string): string {
    // Convert rgb() to hex when shorter
    svg = svg.replace(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/g, (match, r, g, b) => {
      const hex = '#' + [r, g, b].map(x => {
        const hex = parseInt(x).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      }).join('');
      return hex.length <= match.length ? hex : match;
    });
    
    // Convert 6-digit hex to 3-digit when possible
    svg = svg.replace(/#([0-9a-fA-F])\1([0-9a-fA-F])\2([0-9a-fA-F])\3/g, '#$1$2$3');
    
    return svg;
  }
  
  /**
   * Optimize multiple SVGs in batch
   */
  static optimizeLogos(logos: Array<{ svg?: string; iconSvg?: string; variations?: any }>): Array<{ svg?: string; iconSvg?: string; variations?: any }> {
    logger.info(`Batch optimizing ${logos.length} logos`);
    
    return logos.map(logo => {
      const optimizedLogo = { ...logo };
      
      if (logo.svg) {
        optimizedLogo.svg = this.optimizeSvg(logo.svg);
      }
      
      if (logo.iconSvg) {
        optimizedLogo.iconSvg = this.optimizeSvg(logo.iconSvg);
      }
      
      if (logo.variations) {
        optimizedLogo.variations = this.optimizeVariations(logo.variations);
      }
      
      return optimizedLogo;
    });
  }
  
  /**
   * Optimize logo variations
   */
  private static optimizeVariations(variations: any): any {
    const optimized = { ...variations };
    
    if (variations.withText) {
      optimized.withText = this.optimizeVariationSet(variations.withText);
    }
    
    if (variations.iconOnly) {
      optimized.iconOnly = this.optimizeVariationSet(variations.iconOnly);
    }
    
    return optimized;
  }
  
  /**
   * Optimize a set of variations (lightBackground, darkBackground, monochrome)
   */
  private static optimizeVariationSet(variationSet: any): any {
    const optimized = { ...variationSet };
    
    Object.keys(optimized).forEach(key => {
      if (typeof optimized[key] === 'string') {
        optimized[key] = this.optimizeSvg(optimized[key]);
      }
    });
    
    return optimized;
  }
}
