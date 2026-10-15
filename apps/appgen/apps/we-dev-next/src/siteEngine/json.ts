/**
 * Lecture tolérante des réponses de modèle : blocs de code, virgules finales,
 * texte autour de l'objet.
 */
export function readJsonObject(text: string): unknown {
  if (!text) return null;

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const source = fenced ? fenced[1] : text;

  const start = source.indexOf('{');
  const end = source.lastIndexOf('}');
  if (start === -1 || end <= start) return null;

  const candidate = source.slice(start, end + 1);

  for (const attempt of [candidate, candidate.replace(/,\s*([}\]])/g, '$1')]) {
    try {
      return JSON.parse(attempt);
    } catch {
      // Essai suivant.
    }
  }

  return null;
}

/** Un texte court du modèle, nettoyé : espaces, tirets cadratins, typographie française. */
export const cleanText = (value: unknown, max = 400): string =>
  typeof value === 'string'
    ? value
        .replace(/\s*[—–]\s*/g, ', ')
        .replace(/\s+/g, ' ')
        .replace(/^["“«]\s*|\s*["”»]$/g, '')
        .trim()
        .slice(0, max)
        .replace(/ ([:;!?»])/g, ' $1')
        .replace(/« /g, '« ')
    : '';
