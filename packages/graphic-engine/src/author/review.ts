/**
 * LE RELECTEUR VISUEL — un agent de vision regarde la page RENDUE, comme le lecteur la verra.
 *
 * La mesure du code (`runtime/check.ts`) attrape ce qui se calcule : texte coupé, recouvert, superposé, actif
 * rogné, cadre vide. Elle ne voit pas une page désordonnée, une hiérarchie fausse (un texte courant composé comme
 * un titre), une zone vide qui déséquilibre la page, une légende séparée de ce qu'elle légende, une couverture
 * banale. Le relecteur les voit : il répond à une LISTE FERMÉE de questions et dit, pour chaque défaut, la
 * correction précise. L'auteur corrige ; la mise en page reste la sienne.
 *
 * Il ne note pas le goût : il refuse ce qu'un studio refuserait. Borné : une relecture par page (deux pour une
 * couverture), une correction par relecture.
 */
import type { DocumentType } from '../contracts/common';

export interface PageReview {
  /** La page peut partir telle quelle. */
  ok: boolean;
  /** Les défauts, chacun avec sa correction (consigne pour l'auteur). */
  issues: string[];
}

const DOC: Partial<Record<DocumentType, string>> = {
  'brand-charter': 'a page of a brand guidelines book',
  'pitch-deck': 'a pitch deck slide',
  'business-plan': 'a page of a printed business plan',
  flyer: 'a marketing visual',
  'business-card': 'a business card face',
};

/** La consigne du relecteur : une liste fermée, une réponse JSON. */
export function reviewInstruction(o: { documentType: DocumentType; cover: boolean; title?: string }): string {
  return [
    `You are the senior art director of a design studio. This image is ${DOC[o.documentType] ?? 'a document page'}${o.cover ? ' — THE COVER of the document' : ''}${o.title ? `, titled "${o.title.slice(0, 80)}"` : ''}. Decide if it can be delivered to a paying client.`,
    'Check ONLY these defects, each one a reason to refuse:',
    '1. OVERLAP: a text, logo or image sits on top of another element (even partly), or a logo touches a title.',
    '2. CUT: anything is cut by the page edge or by its frame (text, logo, image, card, swatch).',
    '3. HIERARCHY: a plain text (label, caption, description, paragraph) is set as large or as bold as a title, or the title is not the dominant text.',
    '4. EMPTY OR BROKEN: an empty box, circle, card or image zone; a missing image (blank frame); leftover code characters; a placeholder.',
    '5. DISORDER: elements not aligned on a grid, a caption far from what it describes, a large empty area that unbalances the page, crowding.',
    '6. NOT ESSENTIAL: decoration or text that serves nothing (random icons, dots, repeated logos, filler sentences).',
    o.cover ? '7. GENERIC COVER: a plain centred name on an empty page, no use of the brand colour, pattern, image or a bold composition — not memorable.' : '',
    'Answer ONLY JSON: {"ok": true|false, "issues": ["<defect> — <precise fix the designer must apply, naming the element and where it should go>", …at most 6]}. ok is true only if none of the defects is present.',
  ]
    .filter(Boolean)
    .join('\n');
}

/** La réponse du relecteur, ou `null` si elle est illisible (la page passe alors, sans relecture). */
export function parseReview(raw: string): PageReview | null {
  const match = String(raw || '').replace(/```[a-z]*\n?/gi, '').match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const json = JSON.parse(match[0]) as { ok?: unknown; issues?: unknown };
    const issues = (Array.isArray(json.issues) ? json.issues : []).filter((i): i is string => typeof i === 'string' && i.trim().length > 6).map((i) => i.trim().slice(0, 300)).slice(0, 6);
    const ok = json.ok === true && !issues.length;
    return { ok, issues };
  } catch {
    return null;
  }
}
