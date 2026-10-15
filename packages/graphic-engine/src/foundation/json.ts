/** Le premier objet JSON d'une réponse (texte autour, balises de code et virgules finales tolérés). */
export function parseJsonObject(raw: string): Record<string, unknown> | undefined {
  const text = raw.replace(/```(?:json)?/gi, '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return undefined;
  const body = text.slice(start, end + 1).replace(/,\s*([}\]])/g, '$1');
  try {
    const value = JSON.parse(body);
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}
