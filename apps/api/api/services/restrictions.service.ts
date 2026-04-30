import logger from '../config/logger';

export interface Restrictions {
  maxStyles: number;
  maxResolution: string;
  maxOutputTokens: number;
  restrictedPrompts: string[];
}

export interface ValidationResult {
  allowed: boolean;
  message?: string;
  adjustedParams?: any;
}

export class RestrictionsService {
  private restrictions: Restrictions;

  constructor() {
    logger.info('Initializing RestrictionsService...');

    // Configure restrictions using environment variables
    this.restrictions = {
      maxStyles: parseInt(process.env.MAX_STYLES || '3'),
      maxResolution: process.env.MAX_RESOLUTION || 'medium',
      maxOutputTokens: parseInt(process.env.MAX_OUTPUT_TOKENS || '1000'),
      restrictedPrompts: (
        process.env.RESTRICTED_PROMPTS || 'complex-branding,full-charter'
      ).split(','),
    };

    logger.info('RestrictionsService initialized:', this.restrictions);
  }

  /**
   * Validate and adjust prompt parameters for current restrictions
   */
  validatePromptParams(promptType: string, params: any): ValidationResult {
    logger.info(`Validating prompt params for '${promptType}'`);

    // Check if prompt type is restricted
    if (this.restrictions.restrictedPrompts.includes(promptType)) {
      const message = `Prompt type '${promptType}' is restricted`;
      logger.warn(message);
      return {
        allowed: false,
        message,
      };
    }

    // Adjust parameters for current restrictions
    const adjustedParams = { ...params };

    // Limit output tokens
    if (adjustedParams.llmOptions?.maxOutputTokens) {
      adjustedParams.llmOptions.maxOutputTokens = Math.min(
        adjustedParams.llmOptions.maxOutputTokens,
        this.restrictions.maxOutputTokens
      );
      logger.info(`Adjusted maxOutputTokens to ${adjustedParams.llmOptions.maxOutputTokens}`);
    }

    // Limit styles if applicable
    if (adjustedParams.styles && Array.isArray(adjustedParams.styles)) {
      if (adjustedParams.styles.length > this.restrictions.maxStyles) {
        adjustedParams.styles = adjustedParams.styles.slice(0, this.restrictions.maxStyles);
        logger.info(`Limited styles to ${this.restrictions.maxStyles}`);
      }
    }

    // Set resolution limit
    if (adjustedParams.resolution) {
      const resolutionHierarchy = ['low', 'medium', 'high', 'ultra'];
      const maxResolutionIndex = resolutionHierarchy.indexOf(this.restrictions.maxResolution);
      const requestedResolutionIndex = resolutionHierarchy.indexOf(adjustedParams.resolution);

      if (requestedResolutionIndex > maxResolutionIndex) {
        adjustedParams.resolution = this.restrictions.maxResolution;
        logger.info(`Adjusted resolution to ${this.restrictions.maxResolution}`);
      }
    }

    return {
      allowed: true,
      adjustedParams,
    };
  }

  /**
   * Get current limitations message for user
   */
  getLimitationsMessage(): string {
    return `
🚀 System Limitations:
• Maximum ${this.restrictions.maxStyles} style options per generation
• Maximum resolution: ${this.restrictions.maxResolution}
• Optimized token output for faster responses
    `.trim();
  }

  /**
   * Validate input to prevent abusive requests
   */
  validateInput(input: string): ValidationResult {
    logger.info('Validating user input for potential abuse');

    // Check for empty or whitespace-only input
    if (!input || input.trim().length === 0) {
      const message = 'Input cannot be empty';
      logger.warn(message);
      return {
        allowed: false,
        message,
      };
    }

    // Check minimum length
    const minLength = parseInt(process.env.MIN_INPUT_LENGTH || '3');
    if (input.trim().length < minLength) {
      const message = `Input must be at least ${minLength} characters long`;
      logger.warn(message);
      return {
        allowed: false,
        message,
      };
    }

    // Check maximum length
    const maxLength = parseInt(process.env.MAX_INPUT_LENGTH || '500');
    if (input.length > maxLength) {
      const message = `Input must not exceed ${maxLength} characters`;
      logger.warn(message);
      return {
        allowed: false,
        message,
      };
    }

    // Check for suspicious patterns
    const suspiciousPatterns = [
      /(.)\1{10,}/, // Repeated characters
      /[^\w\s\-.,!?'"()]/g, // Special characters (allow basic punctuation)
      /^[^a-zA-Z]*$/, // No alphabetic characters
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(input)) {
        const message = 'Input contains invalid or suspicious content';
        logger.warn(`Suspicious input detected: ${input.substring(0, 50)}...`);
        return {
          allowed: false,
          message,
        };
      }
    }

    // Check for spam-like content
    const words = input.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    const repetitionRatio = uniqueWords.size / words.length;

    if (words.length > 10 && repetitionRatio < 0.3) {
      const message = 'Input appears to be repetitive or spam-like';
      logger.warn(`High repetition detected in input: ratio=${repetitionRatio}`);
      return {
        allowed: false,
        message,
      };
    }

    return { allowed: true };
  }

  /**
   * Get current restrictions
   */
  getRestrictions(): Restrictions {
    return { ...this.restrictions };
  }

  /**
   * Apply prompt modifications if needed
   */
  applyPromptModifications(originalPrompt: string): string {
    // Add standard instructions to prompts
    const instructions = `
SYSTEM INSTRUCTIONS:
- Keep responses concise and focused
- Limit creative variations to essential options
- Prioritize speed over extensive detail
- Use efficient, token-conscious language

`;

    return instructions + originalPrompt;
  }
}

export default new RestrictionsService();
