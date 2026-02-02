/* eslint-disable no-undef */
/**
 * Token Limits Configuration
 *
 * This module manages token limits for AI generation based on environment variables.
 * It provides centralized configuration for:
 * - Maximum output tokens (response length)
 * - Maximum input tokens (context size)
 * - Standard token limit threshold
 */

export interface TokenLimitsConfig {
  /** Maximum number of tokens the AI can generate in a single response */
  maxOutputTokens: number;

  /** Maximum number of tokens allowed in the input context */
  maxInputTokens: number;

  /** Threshold for switching to token-limited mode */
  standardTokenLimit: number;
}

/**
 * Get token limits from environment variables with fallback defaults
 */
export function getTokenLimits(): TokenLimitsConfig {
  return {
    maxOutputTokens: parseInt(process.env.AI_MAX_OUTPUT_TOKENS || '8192', 10),
    maxInputTokens: parseInt(process.env.AI_MAX_INPUT_TOKENS || '128000', 10),
    standardTokenLimit: parseInt(process.env.AI_STANDARD_TOKEN_LIMIT || '128000', 10),
  };
}

/**
 * Validate token limits configuration
 * Throws an error if limits are invalid
 */
export function validateTokenLimits(limits: TokenLimitsConfig): void {
  if (limits.maxOutputTokens <= 0) {
    throw new Error(
      `Invalid AI_MAX_OUTPUT_TOKENS: ${limits.maxOutputTokens}. Must be greater than 0.`
    );
  }

  if (limits.maxInputTokens <= 0) {
    throw new Error(
      `Invalid AI_MAX_INPUT_TOKENS: ${limits.maxInputTokens}. Must be greater than 0.`
    );
  }

  if (limits.standardTokenLimit <= 0) {
    throw new Error(
      `Invalid AI_STANDARD_TOKEN_LIMIT: ${limits.standardTokenLimit}. Must be greater than 0.`
    );
  }

  if (limits.maxOutputTokens > limits.maxInputTokens) {
    console.warn(
      `⚠️  Warning: AI_MAX_OUTPUT_TOKENS (${limits.maxOutputTokens}) is greater than AI_MAX_INPUT_TOKENS (${limits.maxInputTokens}). ` +
        'This may cause issues with some AI providers.'
    );
  }
}

/**
 * Get and validate token limits
 */
export function getValidatedTokenLimits(): TokenLimitsConfig {
  const limits = getTokenLimits();
  validateTokenLimits(limits);
  return limits;
}

/**
 * Log current token limits configuration
 */
export function logTokenLimits(): void {
  const limits = getTokenLimits();
  console.log('\n📊 TOKEN LIMITS CONFIGURATION:');
  console.log(`  Max Output Tokens: ${limits.maxOutputTokens.toLocaleString()}`);
  console.log(`  Max Input Tokens: ${limits.maxInputTokens.toLocaleString()}`);
  console.log(`  Standard Token Limit: ${limits.standardTokenLimit.toLocaleString()}`);
  console.log('');
}

// Export singleton instance
export const tokenLimits = getValidatedTokenLimits();
