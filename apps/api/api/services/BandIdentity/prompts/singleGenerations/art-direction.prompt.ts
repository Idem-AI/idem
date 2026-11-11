/**
 * Agent « direction artistique » — il CHOISIT, il n'écrit pas.
 *
 * Décision du 11/11/2026 : la direction artistique d'une marque vient TOUJOURS du catalogue des DA
 * (`idem-templates/catalog/directions`) ; le modèle n'invente aucun élément de direction. Deux appels courts :
 *
 *   1. le choix de la DA : un identifiant du catalogue, et la raison du choix pour CETTE marque (texte montré dans la
 *      charte, ce n'est pas un élément de direction) ;
 *   2. le choix des déclinaisons : pour chaque champ (formule, mots-clés, grille, blanc, geste signature, recettes,
 *      couleur, typographie, image, dispositifs graphiques), l'identifiant d'une déclinaison rédigée d'avance ; et les
 *      SUJETS des images de la marque (ce qu'on photographie : son activité, pas un style).
 *
 * Le code compose ensuite la direction mot pour mot depuis la fiche (`art-direction.compose.ts`).
 */
import { buildStyleCatalogBrief } from '../../../brand/artDirection.catalog';
import type { DirectionNode } from '@idem/graphic-engine';

export interface ArtDirectionPromptInput {
  projectName: string;
  projectDescription: string;
  industry: string;
  targetAudience: string;
  /** Palette de la charte, sérialisée. */
  colorsJson: string;
  /** Typographie de la charte, sérialisée. */
  typographyJson: string;
  logoConcept?: string;
  logoType?: string;
  /** DA à écarter (régénération : « proposer une autre direction »). */
  excludeStyleIds?: string[];
  /** Ce que le SITE de la marque montre de son style (projet créé depuis un site). */
  siteEvidence?: string;
}

const brief = (input: ArtDirectionPromptInput) => `<brand_brief>
Brand: ${input.projectName}
Description: ${input.projectDescription}
Industry: ${input.industry}
Audience: ${input.targetAudience}
Approved palette (fixed): ${input.colorsJson}
Approved typography (fixed): ${input.typographyJson}
${input.logoConcept ? `Logo concept: ${input.logoConcept}` : ''}
${input.logoType ? `Logo type: ${input.logoType}` : ''}
</brand_brief>`;

const evidence = (input: ArtDirectionPromptInput) =>
  input.siteEvidence
    ? `<existing_brand>
This brand ALREADY EXISTS and has a website. Choose what is CLOSEST to what the site shows, not what you would prefer.
EVIDENCE FROM THE SITE:
${input.siteEvidence.slice(0, 2400)}
</existing_brand>`
    : '';

/** Appel 1 : la DA du catalogue. */
export function buildArtDirectionChoicePrompt(input: ArtDirectionPromptInput): string {
  const excluded = (input.excludeStyleIds || []).filter(Boolean);
  return `<role>Art director in a branding studio. You pick the visual stance of a brand for the next three years, FROM A CATALOGUE.</role>
<objective>Pick ONE art direction from the catalogue below. You invent nothing: every rule of the direction is already written in the catalogue. Output: strict JSON.</objective>

${brief(input)}
${evidence(input)}
<catalogue>
${buildStyleCatalogBrief()}
</catalogue>
${excluded.length ? `<excluded>\nAlready proposed, ruled out: ${excluded.join(', ')}. Pick a different one.\n</excluded>\n` : ''}
<how_to_choose>
1. Name, to yourself, what this brand actually SELLS: its promise (trust, speed, warmth, rigour, status, accessibility, celebration).
2. Eliminate the directions that contradict that promise. An audit firm cannot be Y2K; a street-food brand cannot be Quiet Luxury.
3. Among those left, keep the one that makes the brand RECOGNISABLE against its direct competitors, not the average of its sector.
4. Every deliverable is composed on a LIGHT ground with the approved palette and typography: keep a direction that holds up there.
5. Never keep a direction "because it is safe". Minimalism without a reason specific to this brand is the worst pick.
6. Directions rooted in African visual cultures are first-class choices when the brand lives in that world, never a costume.
</how_to_choose>

<output_format>
Strict JSON, no surrounding text, no code fences.
{"styleId": "exact identifier from the catalogue", "rationale": "2 to 3 sentences IN FRENCH: why this direction for THIS brand, and what it rules out"}
</output_format>
`;
}

/** Appel 2 : une déclinaison par champ, dans la fiche de la DA retenue. */
export function buildArtDirectionVariantsPrompt(input: ArtDirectionPromptInput & { direction: DirectionNode; recentCombos?: string[] }): string {
  const d = input.direction;
  const lines: string[] = [];
  const add = (field: string, label: string, items: Array<{ id: string; text: string }>) => {
    lines.push(`${field} — ${label}`);
    for (const it of items) lines.push(`  ${it.id}: ${it.text}`);
  };
  add('tagline', 'formula', d.variants.tagline.map((v) => ({ id: v.id, text: v.text })));
  add('keywords', 'moodboard words', d.variants.keywords.map((v) => ({ id: v.id, text: v.items.join(', ') })));
  add('grid', 'grid', d.variants.grid.map((v) => ({ id: v.id, text: `${v.text} (${v.density})` })));
  add('whitespace', 'empty space', d.variants.whitespace.map((v) => ({ id: v.id, text: v.text })));
  add('signatureMove', 'signature move', d.variants.signatureMove.map((v) => ({ id: v.id, text: v.text })));
  add('recipes', 'layout recipes', d.variants.recipes.map((v) => ({ id: v.id, text: v.items.map((r) => `${r.name} (${r.use})`).join(' ; ') })));
  add('color', 'colour use', d.variants.color.map((v) => ({ id: v.id, text: `${v.distribution} : ${v.application}` })));
  add('typography', 'typography', d.variants.typography.map((v) => ({ id: v.id, text: `${v.scaleContrast} ${v.caseAndTracking}` })));
  add('imagery', 'imagery', d.variants.imagery.map((v) => ({ id: v.id, text: `${v.medium} : ${v.treatment} ; ${v.lighting} ; ${v.framing}` })));
  add('graphicDevices', 'graphic devices', d.variants.graphicDevices.map((v) => ({ id: v.id, text: v.items.join(', ') })));
  const recent = (input.recentCombos || []).filter((c) => c.startsWith(`${d.id}:`)).slice(0, 8);
  return `<role>Art director. The brand's art direction is "${d.name.en}". You now pick, for each field, ONE variant already written in the catalogue. You write no rule yourself.</role>

${brief(input)}
${evidence(input)}
<direction>
${d.name.en} — ${d.essence.en}
</direction>

<variants>
${lines.join('\n')}
</variants>
${recent.length ? `<already_given>\nThese combinations were given to other brands recently; do not repeat one exactly: ${recent.join(' | ')}\n</already_given>\n` : ''}
<how_to_choose>
- For each field, the variant that fits THIS brand's product, audience and palette best.
- imagery: photography for a brand with real places, people or products to show; illustration or 3D only when the brand has nothing to photograph or sells to children.
- subjects: what this brand's images show (its activity, its people, its places), in French, 20 words at most. This is subject matter, not style.
</how_to_choose>

<output_format>
Strict JSON, no surrounding text, no code fences.
{"variants": {"tagline": "id", "keywords": "id", "grid": "id", "whitespace": "id", "signatureMove": "id", "recipes": "id", "color": "id", "typography": "id", "imagery": "id", "graphicDevices": "id"}, "subjects": "French, 20 words at most"}
</output_format>
`;
}
