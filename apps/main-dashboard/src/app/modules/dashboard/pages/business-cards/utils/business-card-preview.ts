import { BusinessCardOrientation, BUSINESS_CARD_SIZE_MM } from '../../../models/business-card.model';

/** Retire les blocs `data-field` restés vides (identique au rendu serveur). */
const EMPTY_FIELD_CLEANUP = `
(function () {
  var nodes = document.querySelectorAll('[data-field]');
  for (var i = nodes.length - 1; i >= 0; i--) {
    var el = nodes[i];
    var hasText = (el.textContent || '').trim().length > 0;
    var hasMedia = el.querySelector('img[src], svg') !== null;
    if (!hasText && !hasMedia) el.remove();
  }
})();
`;

export interface CardPreviewFonts {
  primaryFont?: string;
  secondaryFont?: string;
  fontUrl?: string;
}

/**
 * Construit le document complet de l'iframe d'aperçu : Tailwind local (même
 * script que l'éditeur), polices de marque, carte calée aux dimensions exactes.
 */
export function buildCardPreviewDocument(
  interpolatedHtml: string,
  orientation: BusinessCardOrientation,
  fonts: CardPreviewFonts = {},
): string {
  const size = BUSINESS_CARD_SIZE_MM[orientation];
  const primary = fonts.primaryFont || 'Inter';
  const secondary = fonts.secondaryFont || primary;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<script src="/scripts/tailwind.js"></script>
${fonts.fontUrl ? `<link href="${fonts.fontUrl}" rel="stylesheet" />` : ''}
<script>
  if (window.tailwind) {
    window.tailwind.config = {
      theme: { extend: { fontFamily: {
        primary: ['${primary}', 'sans-serif'],
        secondary: ['${secondary}', 'sans-serif'],
        sans: ['${secondary}', 'system-ui', 'sans-serif']
      } } },
      corePlugins: { preflight: false }
    };
  }
</script>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: transparent; font-family: '${secondary}', system-ui, sans-serif; }
  body > *:first-child {
    width: ${size.width}mm !important;
    height: ${size.height}mm !important;
    overflow: hidden !important;
  }
  img { max-width: 100%; }
</style>
</head>
<body>
${interpolatedHtml}
<script>${EMPTY_FIELD_CLEANUP}</script>
</body>
</html>`;
}

/** Convertit des millimètres en pixels CSS (96 dpi). */
export function mmToPx(mm: number): number {
  return Math.round((mm * 96) / 25.4);
}
