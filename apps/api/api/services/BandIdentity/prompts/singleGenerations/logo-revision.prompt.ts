import { LOGO_SYSTEM_BASE } from './00_logo-system-base.prompt';

/**
 * Agent de révision — corrige un logo à partir des remarques de l'agent critique.
 * Le concept est conservé ; seuls les défauts pointés sont corrigés, dans le
 * respect de la doctrine (LOGO_SYSTEM_BASE). Sortie : même format JSON que la
 * génération, pour réutiliser le parseur existant.
 */
export const LOGO_REVISION_PROMPT = `
${LOGO_SYSTEM_BASE}

<module_logo_revision>
You are revising an EXISTING logo concept that failed design review. This is a
surgical correction, not a redesign.

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
