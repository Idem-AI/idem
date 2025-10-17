import logger from "../../config/logger";
import {
  LogoJsonStructure,
  LogoShape,
  LogoTextElement,
  LogoVariationStructure,
  LogoVariationsJson,
} from "./interfaces/logoJson.interface";
import { LogoModel } from "../../models/logo.model";

/**
 * Service for converting compact JSON logo structures to optimized SVG
 * Implements the token-saving strategy by generating SVG server-side
 */
export class LogoJsonToSvgService {
  /**
   * Convert JSON logo structure to complete LogoModel with optimized SVGs
   */
  convertJsonToLogoModel(logoJson: LogoJsonStructure): LogoModel {
    logger.info(
      `Converting JSON logo structure to LogoModel - ID: ${logoJson.id}`
    );

    try {
      // Generate main SVG (icon + text combined)
      const mainSvg = this.generateCombinedSvg(logoJson);

      // Generate icon-only SVG
      const iconSvg = this.generateIconSvg(logoJson.icon);

      const logoModel: LogoModel = {
        id: logoJson.id,
        name: logoJson.name,
        svg: mainSvg,
        iconSvg: iconSvg,
        concept: logoJson.concept,
        colors: logoJson.colors,
        fonts: logoJson.fonts,
      };

      logger.info(
        `Successfully converted JSON to LogoModel - ID: ${logoJson.id}`
      );
      return logoModel;
    } catch (error) {
      logger.error(`Error converting JSON to LogoModel:`, error);
      throw new Error(`Failed to convert JSON logo structure: ${error}`);
    }
  }

  /**
   * Convert logo variations JSON to SVG variations
   */
  convertVariationsJsonToSvg(variationsJson: LogoVariationsJson): {
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
    logger.info(`Converting logo variations JSON to SVG`);

    try {
      const iconOnly = {
        lightBackground: this.generateVariationSvg(
          variationsJson.variations.lightBackground
        ),
        darkBackground: this.generateVariationSvg(
          variationsJson.variations.darkBackground
        ),
        monochrome: this.generateVariationSvg(
          variationsJson.variations.monochrome
        ),
      };

      // For now, withText uses the same as iconOnly since we're focusing on icon variations
      // This can be extended later for text variations
      const withText = { ...iconOnly };

      logger.info(`Successfully converted variations JSON to SVG`);
      return { withText, iconOnly };
    } catch (error) {
      logger.error(`Error converting variations JSON to SVG:`, error);
      throw new Error(`Failed to convert variations JSON: ${error}`);
    }
  }

  /**
   * Generate combined SVG (icon + text) with intelligent layout positioning and validation
   */
  private generateCombinedSvg(logoJson: LogoJsonStructure): string {
    const layout = logoJson.layout;
    
    // Validate and potentially correct the layout choice
    const validatedLayout = this.validateAndCorrectLayout(logoJson);
    
    const iconElements = this.generateShapeElements(logoJson.icon.shapes);
    const spacing = Math.max(4, Math.min(layout.spacing, 8)); // Force 4-8px spacing

    let textElements: string;
    let totalWidth: number;
    let totalHeight: number;

    if (validatedLayout.textPosition === "bottom") {
      // Vertical layout: text below icon
      totalWidth = Math.max(logoJson.icon.size.w, logoJson.text.size.w);
      totalHeight = logoJson.icon.size.h + spacing + logoJson.text.size.h;

      // Always center text horizontally regardless of width
      const textOffsetX = (totalWidth - logoJson.text.size.w) / 2;
      const textOffsetY = logoJson.icon.size.h + spacing;

      // Also center icon horizontally if narrower than text
      let centeredIconElements = iconElements;
      if (logoJson.icon.size.w < logoJson.text.size.w) {
        const iconOffsetX = (totalWidth - logoJson.icon.size.w) / 2;
        centeredIconElements = this.adjustIconPosition(logoJson.icon.shapes, iconOffsetX, 0);
      }

      textElements = this.generateTextElements(
        logoJson.text.elements,
        textOffsetX,
        textOffsetY
      );
      
      return this.wrapInSvg(centeredIconElements + textElements, totalWidth, totalHeight);
    } else {
      // Horizontal layout: text to the right of icon
      totalWidth = logoJson.icon.size.w + spacing + logoJson.text.size.w;
      totalHeight = Math.max(logoJson.icon.size.h, logoJson.text.size.h);

      // Center text vertically if shorter than icon
      const textOffsetX = logoJson.icon.size.w + spacing;
      const textOffsetY =
        logoJson.text.size.h < logoJson.icon.size.h
          ? (logoJson.icon.size.h - logoJson.text.size.h) / 2
          : 0;

      textElements = this.generateTextElements(
        logoJson.text.elements,
        textOffsetX,
        textOffsetY
      );
    }

    return this.wrapInSvg(iconElements + textElements, totalWidth, totalHeight);
  }

  /**
   * Validate layout choice and correct if necessary to prevent text overlap
   */
  private validateAndCorrectLayout(logoJson: LogoJsonStructure): { textPosition: 'right' | 'bottom'; spacing: number } {
    const iconWidth = logoJson.icon.size.w;
    const iconHeight = logoJson.icon.size.h;
    const textWidth = logoJson.text.size.w;
    const textHeight = logoJson.text.size.h;
    
    // Calculate aspect ratios
    const iconRatio = iconWidth / iconHeight;
    const textRatio = textWidth / textHeight;
    
    // Determine optimal layout based on dimensions
    let optimalPosition: 'right' | 'bottom';
    
    if (textWidth > iconWidth * 1.2) {
      // Text is significantly wider than icon -> use bottom layout
      optimalPosition = 'bottom';
      logger.info(`Layout corrected to 'bottom': text width (${textWidth}) > icon width (${iconWidth})`);
    } else if (textHeight > iconHeight * 0.8) {
      // Text is relatively tall compared to icon -> use bottom layout
      optimalPosition = 'bottom';
      logger.info(`Layout corrected to 'bottom': text height (${textHeight}) > 80% of icon height (${iconHeight})`);
    } else if (iconRatio < 0.7) {
      // Icon is very tall -> use right layout
      optimalPosition = 'right';
      logger.info(`Layout set to 'right': icon is tall (ratio: ${iconRatio})`);
    } else {
      // Default to AI's choice if dimensions are reasonable
      optimalPosition = logoJson.layout.textPosition;
    }
    
    return {
      textPosition: optimalPosition,
      spacing: logoJson.layout.spacing
    };
  }

  /**
   * Generate icon-only SVG
   */
  private generateIconSvg(iconStructure: {
    shapes: LogoShape[];
    size: { w: number; h: number };
  }): string {
    const elements = this.generateShapeElements(iconStructure.shapes);
    return this.wrapInSvg(elements, iconStructure.size.w, iconStructure.size.h);
  }

  /**
   * Generate variation SVG
   */
  private generateVariationSvg(variation: LogoVariationStructure): string {
    const elements = this.generateShapeElements(variation.shapes);
    return this.wrapInSvg(elements, variation.size.w, variation.size.h);
  }

  /**
   * Generate SVG elements from shapes array
   */
  private generateShapeElements(shapes: LogoShape[]): string {
    return shapes.map((shape) => this.generateShapeElement(shape)).join("");
  }

  /**
   * Adjust icon position by adding offset to all shapes
   */
  private adjustIconPosition(shapes: LogoShape[], offsetX: number, offsetY: number): string {
    const adjustedShapes = shapes.map(shape => {
      const adjustedShape = { ...shape };
      
      // Adjust coordinates based on shape type
      switch (shape.type) {
        case 'circle':
          adjustedShape.cx = (shape.cx || 0) + offsetX;
          adjustedShape.cy = (shape.cy || 0) + offsetY;
          break;
        case 'rect':
          adjustedShape.x = (shape.x || 0) + offsetX;
          adjustedShape.y = (shape.y || 0) + offsetY;
          break;
        case 'ellipse':
          adjustedShape.cx = (shape.cx || 0) + offsetX;
          adjustedShape.cy = (shape.cy || 0) + offsetY;
          break;
        case 'line':
          adjustedShape.x1 = (shape.x1 || 0) + offsetX;
          adjustedShape.y1 = (shape.y1 || 0) + offsetY;
          adjustedShape.x2 = (shape.x2 || 0) + offsetX;
          adjustedShape.y2 = (shape.y2 || 0) + offsetY;
          break;
        case 'polygon':
          // Adjust polygon points
          if (shape.points) {
            const points = shape.points.split(' ').map(point => {
              const [x, y] = point.split(',').map(Number);
              return `${x + offsetX},${y + offsetY}`;
            });
            adjustedShape.points = points.join(' ');
          }
          break;
        case 'path':
          // For paths, we'd need to parse and adjust the d attribute
          // This is complex, so for now we'll leave paths unchanged
          break;
      }
      
      return adjustedShape;
    });
    
    return this.generateShapeElements(adjustedShapes);
  }

  /**
   * Generate single SVG shape element
   */
  private generateShapeElement(shape: LogoShape): string {
    const commonAttrs = this.getCommonAttributes(shape);

    switch (shape.type) {
      case "circle":
        return `<circle cx="${shape.cx}" cy="${shape.cy}" r="${shape.r}"${commonAttrs}/>`;

      case "rect":
        const rectAttrs = shape.rx ? ` rx="${shape.rx}"` : "";
        return `<rect x="${shape.x}" y="${shape.y}" width="${shape.w}" height="${shape.h}"${rectAttrs}${commonAttrs}/>`;

      case "ellipse":
        return `<ellipse cx="${shape.cx}" cy="${shape.cy}" rx="${shape.rx_ellipse}" ry="${shape.ry_ellipse}"${commonAttrs}/>`;

      case "line":
        return `<line x1="${shape.x1}" y1="${shape.y1}" x2="${shape.x2}" y2="${shape.y2}"${commonAttrs}/>`;

      case "polygon":
        return `<polygon points="${shape.points}"${commonAttrs}/>`;

      case "path":
        return `<path d="${shape.d}"${commonAttrs}/>`;

      default:
        logger.warn(`Unknown shape type: ${shape.type}`);
        return "";
    }
  }

  /**
   * Generate SVG text elements with optional X and Y offsets
   */
  private generateTextElements(
    textElements: LogoTextElement[],
    offsetX: number = 0,
    offsetY: number = 0
  ): string {
    return textElements
      .map((element) => {
        const x = element.x + offsetX;
        const y = element.y + offsetY;
        const attrs = [
          `x="${x}"`,
          `y="${y}"`,
          `font-size="${element.fontSize}"`,
          element.fill ? `fill="${element.fill}"` : "",
          element.fontFamily ? `font-family="${element.fontFamily}"` : "",
          element.fontWeight ? `font-weight="${element.fontWeight}"` : "",
          element.textAnchor ? `text-anchor="${element.textAnchor}"` : "",
          element.dominantBaseline
            ? `dominant-baseline="${element.dominantBaseline}"`
            : "",
        ]
          .filter((attr) => attr)
          .join(" ");

        return `<text ${attrs}>${element.text}</text>`;
      })
      .join("");
  }

  /**
   * Get common SVG attributes (fill, stroke, etc.)
   */
  private getCommonAttributes(shape: LogoShape): string {
    const attrs = [];

    if (shape.fill) attrs.push(`fill="${shape.fill}"`);
    if (shape.stroke) attrs.push(`stroke="${shape.stroke}"`);
    if (shape.strokeWidth) attrs.push(`stroke-width="${shape.strokeWidth}"`);
    if (shape.opacity) attrs.push(`opacity="${shape.opacity}"`);

    return attrs.length > 0 ? " " + attrs.join(" ") : "";
  }

  /**
   * Wrap elements in optimized SVG container
   */
  private wrapInSvg(elements: string, width: number, height: number): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${elements}</svg>`;
  }

  /**
   * Optimize SVG by removing unnecessary whitespace and attributes
   * Basic optimization - can be enhanced with SVGO later
   */
  optimizeSvg(svg: string): string {
    return svg
      .replace(/\s+/g, " ") // Replace multiple spaces with single space
      .replace(/>\s+</g, "><") // Remove spaces between tags
      .replace(/\s+\/>/g, "/>") // Clean self-closing tags
      .trim();
  }
}
