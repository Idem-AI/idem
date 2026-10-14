/**
 * « AMÉLIORER MA DEMANDE » — la phrase de l'utilisateur, rendue précise.
 *
 * Une demande vague (« une vidéo pour mon jus ») donne une vidéo vague. Le
 * modèle la réécrit en 2 à 4 phrases : le message clé, ce qu'il faut montrer
 * (avec les médias joints), le ton, l'appel à l'action — dans le contexte de la
 * marque et de sa direction artistique.
 *
 * Garde-fous dans le code, pas dans le prompt seulement : un chiffre (prix, date,
 * numéro) absent de la demande et du contexte de marque est retiré avec sa
 * phrase ; tirets cadratins, émojis et mots creux sont nettoyés ; sans réponse
 * exploitable, une amélioration par gabarit prend le relais.
 */
import { CopyContext, CopyWriter, estimateTokens } from './video.copy';

export interface EnhanceInput {
  text: string;
  ctx: CopyContext;
  /** Médias joints, par sorte (« 2 photos, 1 clip »). */
  media: { images: number; videos: number; models: number; lotties: number };
  /** Résumé de la DA de la charte. */
  art?: string;
}

export interface EnhanceResult {
  prompt: string;
  source: 'llm' | 'template';
  tokens: { input: number; output: number };
}

const LANG: Record<string, string> = { fr: 'French', en: 'English', pt: 'Portuguese', es: 'Spanish', ar: 'Arabic', sw: 'Swahili' };

export function buildEnhancePrompt(input: EnhanceInput): { system: string; user: string } {
  const lang = LANG[(input.ctx.language || 'fr').slice(0, 2)] || 'French';
  const system = [
    `You improve a request for a short brand video. Rewrite it in ${lang} as 2 to 4 short sentences:`,
    '- the key message to say,',
    '- what to show (product, place, people; use the attached media when there are some),',
    '- the tone, and the call to action.',
    'Keep every fact exactly as written (prices, dates, phone numbers, places). Never add a number, price, date, address or promise that is not given.',
    'No emoji, no hashtag, no em dash, no filler words. Output only the improved request, nothing else.',
  ].join('\n');
  const m = input.media;
  const media = [m.images && `${m.images} photo(s)`, m.videos && `${m.videos} clip(s)`, m.models && `${m.models} 3D model(s)`, m.lotties && `${m.lotties} animation(s)`].filter(Boolean).join(', ');
  const user = [
    `BRAND: ${input.ctx.brandName}${input.ctx.businessType ? ` (${input.ctx.businessType})` : ''}`,
    input.ctx.valueProposition ? `PROMISE: ${input.ctx.valueProposition.slice(0, 160)}` : '',
    input.ctx.tone ? `TONE: ${input.ctx.tone}` : '',
    input.art ? `ART DIRECTION: ${input.art}` : '',
    media ? `ATTACHED MEDIA: ${media}` : '',
    `REQUEST: ${input.text.slice(0, 1200)}`,
  ]
    .filter(Boolean)
    .join('\n');
  return { system, user };
}

const FILLER = /\b(révolutionnaire|incontournable|ultime|inégalé|de nouvelle génération|à la pointe|de classe mondiale|seamless|revolutionary|cutting-edge|world-class|game-?changer|unleash|elevate)\b/gi;

/** Nettoie la réécriture et retire toute phrase qui avance un chiffre non fourni. */
export function groundEnhanced(output: string, sources: string): string {
  const known = new Set((sources.match(/\d[\d\s.,:/h-]*\d|\d/g) || []).map((n) => n.replace(/\s/g, '')));
  const knownDigits = sources.replace(/\D/g, '');
  const sentences = (output || '')
    .replace(/```[a-z]*\n?/gi, '')
    .replace(/^\s*(improved request|demande améliorée)\s*[:：]\s*/i, '')
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
    .replace(/#[\p{L}\d_]+/gu, '')
    .replace(FILLER, '')
    .replace(/^["«“\s]+|["»”\s]+$/g, '')
    .split(/(?<=[.!?])\s+/);
  const kept = sentences.filter((s) => {
    const numbers = s.match(/\d[\d\s.,:/h-]*\d|\d/g) || [];
    // Chaque nombre doit venir de la demande ou de la marque (exactement, ou contenu dans un nombre fourni).
    return numbers.every((n) => {
      const compact = n.replace(/\s/g, '');
      return known.has(compact) || knownDigits.includes(compact.replace(/\D/g, ''));
    });
  });
  return kept.join(' ').replace(/\s+/g, ' ').replace(/\s+([,.!?])/g, '$1').trim().slice(0, 1200);
}

/** Amélioration sans modèle : la demande, plus le ton de la marque et une fin qui appelle à l'action. */
export function templateEnhance(input: EnhanceInput): string {
  const fr = !(input.ctx.language || 'fr').startsWith('en');
  const text = input.text.trim().replace(/\s+/g, ' ');
  const base = /[.!?]$/.test(text) ? text : `${text}.`;
  const m = input.media;
  const show = m.models ? (fr ? 'Montrer le produit en 3D.' : 'Show the product in 3D.') : m.videos ? (fr ? 'Montrer les clips joints.' : 'Show the attached clips.') : m.images ? (fr ? 'Mettre en avant les photos jointes.' : 'Feature the attached photos.') : '';
  const tone = input.ctx.tone ? (fr ? `Ton ${input.ctx.tone}.` : `Tone: ${input.ctx.tone}.`) : '';
  const cta = fr ? 'Terminer par un appel à l’action clair.' : 'End with a clear call to action.';
  return [base, show, tone, cta].filter(Boolean).join(' ');
}

export async function enhanceRequest(input: EnhanceInput, writer?: CopyWriter): Promise<EnhanceResult> {
  const prompt = buildEnhancePrompt(input);
  const sources = `${input.text}\n${input.ctx.valueProposition || ''}\n${input.ctx.brandName}\n${input.ctx.businessType || ''}`;
  if (writer) {
    try {
      const raw = await writer(prompt.system, prompt.user);
      const cleaned = groundEnhanced(raw, sources);
      // Une réécriture plus courte que la demande n'améliore rien.
      if (cleaned.length >= Math.min(40, input.text.length)) {
        return { prompt: cleaned, source: 'llm', tokens: { input: estimateTokens(prompt.system + prompt.user), output: estimateTokens(raw) } };
      }
    } catch {
      /* repli par gabarit */
    }
  }
  return { prompt: templateEnhance(input), source: 'template', tokens: { input: 0, output: 0 } };
}
