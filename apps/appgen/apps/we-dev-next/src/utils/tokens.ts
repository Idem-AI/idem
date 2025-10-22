export function estimateTokens(text: string) {
  // Basic rules
  // 1. English: approximately 4 characters per token
  // 2. Chinese: approximately 1-2 characters per token
  // 3. Spaces and punctuation: approximately 1 token

  const chineseRegex = /[\u4e00-\u9fff]/g;
  const punctuationRegex = /[.,!?;:，。！？；：]/g;
  const whitespaceRegex = /\s+/g;

  // Count Chinese characters
  const chineseChars = (text.match(chineseRegex) || []).length;

  // Count punctuation marks
  const punctuationCount = (text.match(punctuationRegex) || []).length;

  // Count whitespace
  const whitespaceCount = (text.match(whitespaceRegex) || []).length;

  // Count remaining characters (mainly English)
  const otherChars = text.length - chineseChars - punctuationCount - whitespaceCount;

  // Estimate token count
  const tokenEstimate = Math.ceil(
    chineseChars * 1.5 + // Chinese characters
      otherChars / 4 + // English characters
      punctuationCount + // Punctuation marks
      whitespaceCount // Whitespace
  );

  return tokenEstimate;
}
