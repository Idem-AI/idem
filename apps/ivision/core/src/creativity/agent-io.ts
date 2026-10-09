/**
 * Entrées / sorties des agents — commun à tous les livrables.
 *
 * Un agent ne répond jamais en JSON imposé : quelques lignes `clé: valeur`, des choix par
 * lettre ou par identifiant. Tout ce qu'un petit modèle peut y ajouter (puces, gras,
 * majuscules, préambule, JSON malgré la consigne) est toléré ici, une fois pour tous.
 */
import type { ArtDirectionModel } from '../brand/art-direction.model';

export const LETTERS = 'abcdefghijklmnop';

/** Lignes `clé: valeur` d'une réponse, quelle qu'en soit la forme (puces, gras, JSON, majuscules). */
export function agentLines(raw: string): Record<string, string> {
  let text = (raw || '').replace(/```[a-z]*\n?/gi, '').trim();
  if (/^\{/.test(text)) {
    try {
      const data = JSON.parse(text);
      text = Object.entries(data)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : typeof v === 'object' && v ? Object.entries(v as Record<string, unknown>).map(([a, b]) => `${a}=${b}`).join(', ') : v}`)
        .join('\n');
    } catch {
      /* lignes telles quelles */
    }
  }
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^[\s*_#>-]*([a-zA-Zéè]+)[*_\s]*[:=]\s*(.+)$/);
    if (m) out[m[1].toLowerCase()] = m[2].trim().replace(/^["'*`]+|["'*`.]+$/g, '');
  }
  return out;
}

/** Une option désignée par sa lettre (« b », « b) », « B - ») ou par son identifiant. */
export function pickOption<T extends string>(value: string | undefined, options: readonly T[]): T | undefined {
  if (!value) return undefined;
  const v = value.trim();
  const letter = v.match(/^([a-p])(?:\W|$)/i);
  if (letter) {
    const i = LETTERS.indexOf(letter[1].toLowerCase());
    if (i >= 0 && i < options.length) return options[i];
  }
  const id = v.toLowerCase().replace(/[^a-z0-9-]/g, '');
  // « bignumber layout » vaut bigNumber ; mais un identifiant court (« G », « a ») ne se
  // cherche pas DANS la réponse : « hologram » contiendrait « g ».
  return options.find((o) => o.toLowerCase() === id) || options.find((o) => o.length >= 3 && id.includes(o.toLowerCase()));
}

/** Paires « n=valeur » (« 2=b, 3=split », « 2: b », « scene 2 → b »). */
export function pairs(value: string | undefined): [number, string][] {
  if (!value) return [];
  return [...value.matchAll(/(\d{1,2})\s*[=:→>-]+\s*([a-zA-Z][a-zA-Z-]*)/g)].map((m) => [Number(m[1]), m[2]] as [number, string]);
}

/** Un menu, une option par ligne : « a) identifiant — description ». */
export const menuLines = (ids: readonly string[], describe: (id: string) => string) => ids.map((id, i) => `${LETTERS[i]}) ${id} — ${describe(id)}`);

/** Un nombre lu dans une réponse, ramené dans ses bornes (null si absent). */
export function boundedNumber(value: string | undefined, min: number, max: number): number | null {
  const n = Number(String(value ?? '').replace(',', '.').match(/-?\d+(\.\d+)?/)?.[0]);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : null;
}

export interface BrandSheetInput {
  brandName: string;
  businessType?: string;
  tone?: string;
  palette: Record<string, string | undefined>;
  fonts: { display: string; body: string };
  art?: Partial<ArtDirectionModel> | null;
}

/**
 * La charte et sa direction artistique, en 3 à 5 lignes : la même fiche pour tous les
 * agents d'un livrable (et de tous les livrables). Ce que la DA exclut n'y est pas
 * rappelé : c'est retiré des menus par le code, jamais confié à la discipline du modèle.
 */
export function brandSheet({ brandName, businessType, tone, palette, fonts, art }: BrandSheetInput): string {
  const colors = ['primary', 'secondary', 'accent', 'background', 'text']
    .filter((k) => palette[k])
    .map((k) => `${k} ${palette[k]}`)
    .join(', ');
  const lines = [
    `BRAND: ${brandName}${businessType ? ` — ${businessType}` : ''}${tone ? ` · tone: ${tone}` : ''}`,
    `CHARTER: colors ${colors}; fonts ${fonts.display} (titles) / ${fonts.body} (text)`,
  ];
  if (art) {
    const da = [art.styleName || art.styleId, art.tagline, (art.keywords || []).slice(0, 5).join(', ')].filter(Boolean).join(' · ');
    if (da) lines.push(`ART DIRECTION: ${da}`.slice(0, 260));
    if (art.dos?.length) lines.push(`DO: ${art.dos.slice(0, 3).join('; ')}`.slice(0, 220));
    if (art.donts?.length) lines.push(`AVOID: ${art.donts.slice(0, 3).join('; ')}`.slice(0, 220));
  }
  return lines.join('\n');
}
