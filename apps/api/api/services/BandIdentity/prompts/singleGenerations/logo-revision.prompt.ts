import { LOGO_SYSTEM_BASE } from './00_logo-system-base.prompt';

/**
 * Agent de révision — corrige un logo à partir des remarques de l'agent critique.
 * Le concept est conservé ; seuls les défauts pointés sont corrigés, dans le
 * respect de la doctrine (LOGO_SYSTEM_BASE). Sortie : même format JSON que la
 * génération, pour réutiliser le parseur existant.
 */
/**
 * Injecté à la place de {{REVISION_SCOPE}} pour le type `icon` : la révision ne
 * porte que sur l'icône, le nom étant composé par le serveur.
 */
export const ICON_ONLY_REVISION_SCOPE = `
REVISION SCOPE — ICON ONLY (overrides every wordmark instruction above):
- The "svg" in the JSON below is the ICON ALONE, on viewBox="0 0 100 100".
- The brand name is typeset by the rendering pipeline (real font metrics, outlined,
  metric-aligned to the icon). You neither draw it nor position it.
- Return the CORRECTED ICON in the same format: viewBox="0 0 100 100", ZERO <text>,
  ZERO <tspan>, ZERO letterforms, no lockup.
- You may also update the wordmark STYLE fields if a remark calls for it:
  "wordmarkColor" (#HEX), "wordmarkTracking" (em), "wordmarkWeight" (600|700),
  "lockupArrangement" ("horizontal" | "stacked").`;

export const LOGO_REVISION_PROMPT = `
${LOGO_SYSTEM_BASE}

<module_logo_revision>
You are revising an EXISTING logo concept that failed design review. This is a
surgical correction, not a redesign.

BRAND CONTEXT:
- BRAND NAME: "{{BRAND_NAME}}" — the text displayed in the logo must be exactly
  this name (or its initials for a monogram/initial type). The original logo's
  "name" field is only the creative title of the concept: NEVER replace the
  displayed brand name with the concept title.
{{REVISION_SCOPE}}

REVISION RULES:
- KEEP the concept, the visual idea, the layout type and the overall composition.
- FIX every remark from the design director below, precisely and completely.
- Any element not mentioned in the remarks stays as close to the original as possible.
- All fixes must respect the construction system above (grid, canonical angles,
  modular values, symmetry by construction, palette-only colors, real typography).
- Re-run the quality gates after fixing: black-and-white test, silhouette test,
  no clipping, legible at 16px.
- Keep the SAME "id" as the original concept. You may keep or minimally adjust
  "name" and update "concept" (40-60 words) to reflect the corrected construction.

ORIGINAL LOGO (JSON):
{{ORIGINAL_LOGO_JSON}}

DESIGN DIRECTOR REMARKS TO FIX (ordered by severity):
{{CRITIQUE_REMARKS}}
</module_logo_revision>
`;
