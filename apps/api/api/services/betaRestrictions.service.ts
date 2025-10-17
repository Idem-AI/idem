import logger from "../config/logger";

export interface BetaRestrictions {
  maxStyles: number;
  maxResolution: string;
  allowedFeatures: string[];
  maxOutputTokens: number;
  restrictedPrompts: string[];
}

export interface FeatureValidationResult {
  allowed: boolean;
  message?: string;
  adjustedParams?: any;
}

export class BetaRestrictionsService {
  private isBeta: boolean;
  private restrictions: BetaRestrictions;

  constructor() {
    logger.info("Initializing BetaRestrictionsService...");
    this.isBeta = process.env.IS_BETA === "true";

    // Configure beta restrictions
    this.restrictions = {
      maxStyles: parseInt(process.env.BETA_MAX_STYLES || "3"),
      maxResolution: process.env.BETA_MAX_RESOLUTION || "medium",
      allowedFeatures: (
        process.env.BETA_ALLOWED_FEATURES || "logo,colors,typography"
      ).split(","),
      maxOutputTokens: parseInt(process.env.BETA_MAX_OUTPUT_TOKENS || "1000"),
      restrictedPrompts: (
        process.env.BETA_RESTRICTED_PROMPTS || "complex-branding,full-charter"
      ).split(","),
    };

    logger.info(
      `BetaRestrictionsService initialized - Beta mode: ${this.isBeta}`,
      this.restrictions
    );
  }

  /**
   * Validate if a feature is allowed in beta mode
   */
  validateFeature(featureName: string): FeatureValidationResult {
    if (!this.isBeta) {
      return { allowed: true };
    }

    logger.info(`Validating feature '${featureName}' for beta mode`);

    if (!this.restrictions.allowedFeatures.includes(featureName)) {
      const message = `Feature '${featureName}' is not available in beta version. Available features: ${this.restrictions.allowedFeatures.join(
        ", "
      )}`;
      logger.warn(message);
      return {
        allowed: false,
        message,
      };
    }

    return { allowed: true };
  }

  /**
   * Validate and adjust prompt parameters for beta restrictions
   */
  validatePromptParams(
    promptType: string,
    params: any
  ): FeatureValidationResult {
    if (!this.isBeta) {
      return { allowed: true, adjustedParams: params };
    }

    logger.info(`Validating prompt params for '${promptType}' in beta mode`);

    // Check if prompt type is restricted
    if (this.restrictions.restrictedPrompts.includes(promptType)) {
      const message = `Prompt type '${promptType}' is restricted in beta version`;
      logger.warn(message);
      return {
        allowed: false,
        message,
      };
    }

    // Adjust parameters for beta restrictions
    const adjustedParams = { ...params };

    // Limit output tokens
    if (adjustedParams.llmOptions?.maxOutputTokens) {
      adjustedParams.llmOptions.maxOutputTokens = Math.min(
        adjustedParams.llmOptions.maxOutputTokens,
        this.restrictions.maxOutputTokens
      );
      logger.info(
        `Adjusted maxOutputTokens to ${adjustedParams.llmOptions.maxOutputTokens} for beta`
      );
    }

    // Limit styles if applicable
    if (adjustedParams.styles && Array.isArray(adjustedParams.styles)) {
      if (adjustedParams.styles.length > this.restrictions.maxStyles) {
        adjustedParams.styles = adjustedParams.styles.slice(
          0,
          this.restrictions.maxStyles
        );
        logger.info(
          `Limited styles to ${this.restrictions.maxStyles} for beta`
        );
      }
    }

    // Set resolution limit
    if (adjustedParams.resolution) {
      const resolutionHierarchy = ["low", "medium", "high", "ultra"];
      const maxResolutionIndex = resolutionHierarchy.indexOf(
        this.restrictions.maxResolution
      );
      const requestedResolutionIndex = resolutionHierarchy.indexOf(
        adjustedParams.resolution
      );

      if (requestedResolutionIndex > maxResolutionIndex) {
        adjustedParams.resolution = this.restrictions.maxResolution;
        logger.info(
          `Adjusted resolution to ${this.restrictions.maxResolution} for beta`
        );
      }
    }

    return {
      allowed: true,
      adjustedParams,
    };
  }

  /**
   * Get beta limitations message for user
   */
  getBetaLimitationsMessage(): string {
    if (!this.isBeta) {
      return "";
    }

    return `
🧪 Beta Version Limitations:
• Maximum ${this.restrictions.maxStyles} style options per generation
• Maximum resolution: ${this.restrictions.maxResolution}
• Available features: ${this.restrictions.allowedFeatures.join(", ")}
• Reduced token output for faster responses
• Some advanced features are disabled

Thank you for testing our beta version! 🚀
    `.trim();
  }

  /**
   * Validate input to prevent abusive requests
   */
  validateInput(input: string): FeatureValidationResult {
    logger.info("Validating user input for potential abuse");

    // Check for empty or whitespace-only input
    if (!input || input.trim().length === 0) {
      const message = "Input cannot be empty";
      logger.warn(message);
      return {
        allowed: false,
        message,
      };
    }

    // Check minimum length
    const minLength = parseInt(process.env.MIN_INPUT_LENGTH || "3");
    if (input.trim().length < minLength) {
      const message = `Input must be at least ${minLength} characters long`;
      logger.warn(message);
      return {
        allowed: false,
        message,
      };
    }

    // Check maximum length
    const maxLength = parseInt(process.env.MAX_INPUT_LENGTH || "500");
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
        const message = "Input contains invalid or suspicious content";
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
      const message = "Input appears to be repetitive or spam-like";
      logger.warn(
        `High repetition detected in input: ratio=${repetitionRatio}`
      );
      return {
        allowed: false,
        message,
      };
    }

    return { allowed: true };
  }

  /**
   * Check if beta mode is enabled
   */
  isBetaMode(): boolean {
    return this.isBeta;
  }

  /**
   * Get current beta restrictions
   */
  getRestrictions(): BetaRestrictions {
    return { ...this.restrictions };
  }

  /**
   * Apply beta-specific prompt modifications
   */
  applyBetaPromptModifications(originalPrompt: string): string {
    if (!this.isBeta) {
      return originalPrompt;
    }

    // Add beta-specific instructions to prompts
    const betaInstructions = `
BETA VERSION INSTRUCTIONS:
- Keep responses concise and focused
- Limit creative variations to essential options
- Prioritize speed over extensive detail
- Use efficient, token-conscious language

`;

    return betaInstructions + originalPrompt;
  }
}

export default new BetaRestrictionsService();
