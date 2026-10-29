/**
 * LES MARQUES D'UN SITE « GÉNÉRÉ », RETIRÉES PAR LE CODE — les mêmes règles que le constructeur général
 * (`design/slopLint.ts`, skill `anti-slop`), appliquées à chaque composant du moteur de sites, qu'il vienne d'un
 * projet IDEM, d'une refonte ou d'une retouche.
 *
 * Une consigne dans un prompt ne suffit pas : un modèle finit toujours par poser un émoji en puce ou un dégradé
 * violet. Ici, c'est réparé sans relancer le modèle et sans jamais bloquer une section :
 *
 *   émojis                 retirés des textes
 *   tiret cadratin         remplacé par une virgule
 *   dégradés décoratifs    retirés (un voile transparent posé sur une photo pour lire le texte est gardé)
 *   texte en dégradé       redevient un texte plein
 *   effet verre            le flou d'arrière-plan sur un fond translucide est retiré
 *   pastilles floues       les formes floues décoratives en position absolue sont supprimées
 *   animations gadgets     rebond, pulsation, ping retirés
 *   étiquettes             un badge ou un petit texte en capitales AU-DESSUS d'un titre : retiré
 *   pastilles d'icône      une icône dans un rond ou un carré teinté : l'icône reste, nue
 *   Sparkles               l'icône « magie » de tous les sites générés : retirée
 *   décor en HTML          blocs vides ou formes en position absolue (cercles, blobs, cadres) : retirés
 */

const EMOJI = /(?:[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F000}-\u{1F2FF}]\u{FE0F}?(?:\u{200D}[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]\u{FE0F}?)*)\s?/gu;
const GRADIENT_TOKEN = /^(?:[\w-]+:)*(?:bg-(?:gradient|linear|radial|conic)-[\w-[\]/.]+|(?:from|via|to)-[\w-[\]/.#()%,]+)$/;
const TRANSPARENT_STOP = /^(?:[\w-]+:)*(?:from|via|to)-(?:transparent|black\/\d+|foreground\/\d+|background\/\d+|white\/\d+)$/;

/** Les classes d'un `className="…"` (ou `className={'…'}` / `cn('…')` : les chaînes littérales). */
function rewriteClasses(code: string, rewrite: (tokens: string[]) => string[]): string {
  return code.replace(/(className\s*=\s*["'`]|cn\(\s*["'`]|clsx\(\s*["'`])([^"'`]*)(["'`])/g, (_match, open: string, classes: string, close: string) => {
    const tokens = classes.split(/\s+/).filter(Boolean);
    const next = rewrite(tokens);
    return `${open}${next.join(' ')}${close}`;
  });
}

export function cleanSlop(code: string): { code: string; fixes: string[] } {
  const fixes = new Set<string>();
  let out = code;

  // Émojis : dans le texte affiché (hors commentaires d'import, rares), retirés.
  const withoutEmoji = out.replace(EMOJI, '');
  if (withoutEmoji !== out) fixes.add('émojis retirés');
  out = withoutEmoji;

  // Tiret cadratin dans le texte : une virgule.
  const withoutDash = out.replace(/\s+—\s+/g, ', ').replace(/—/g, ', ');
  if (withoutDash !== out) fixes.add('tirets cadratins remplacés');
  out = withoutDash;

  out = rewriteClasses(out, (tokens) => {
    let next = tokens;
    const gradient = tokens.filter((t) => GRADIENT_TOKEN.test(t));
    const stops = gradient.filter((t) => /^(?:[\w-]+:)*(?:from|via|to)-/.test(t));
    // Un voile (vers le transparent, ou noir/fond translucide) sur une photo sert la lecture : gardé.
    const scrim = stops.length > 0 && stops.every((t) => TRANSPARENT_STOP.test(t) || /-(?:primary|foreground|background|black)(?:\/\d+)?$/.test(t)) && stops.some((t) => /transparent/.test(t));
    if (gradient.length && !scrim) {
      next = next.filter((t) => !GRADIENT_TOKEN.test(t));
      fixes.add('dégradé décoratif retiré');
    }
    if (next.some((t) => /(?:^|:)bg-clip-text$/.test(t))) {
      next = next.filter((t) => !/(?:^|:)(?:bg-clip-text|text-transparent)$/.test(t));
      fixes.add('texte en dégradé redevenu plein');
    }
    if (next.some((t) => /(?:^|:)backdrop-blur/.test(t)) && next.some((t) => /(?:^|:)bg-[\w-]+\/\d{1,2}$/.test(t))) {
      next = next.filter((t) => !/(?:^|:)backdrop-blur/.test(t));
      fixes.add('effet verre retiré');
    }
    if (next.some((t) => /(?:^|:)animate-(?:bounce|ping|pulse|spin)$/.test(t))) {
      next = next.filter((t) => !/(?:^|:)animate-(?:bounce|ping|pulse|spin)$/.test(t));
      fixes.add('animation gadget retirée');
    }
    return next;
  });

  // Pastilles floues décoratives : un bloc vide, en position absolue, flouté.
  const withoutBlobs = out.replace(/<div\b[^>]*className=["'`][^"'`]*\babsolute\b[^"'`]*\bblur-(?:xl|2xl|3xl)\b[^"'`]*["'`][^>]*?(?:\/>|>\s*<\/div>)/g, '');
  if (withoutBlobs !== out) fixes.add('formes floues décoratives retirées');
  out = withoutBlobs;

  // Étiquettes au-dessus des titres : un <Badge>, ou un petit texte en capitales espacées, suivi (sans autre texte
  // entre les deux) d'un titre. Le titre se suffit.
  const beforeHeading = (rest: string) => /^(?:\s|<\/?(?:motion\.)?(?:div|span|p)\b[^>]*>|\{\/\*[\s\S]*?\*\/\})*<(?:Heading|h[1-3])\b/.test(rest);
  let eyebrows = 0;
  out = out.replace(/<Badge\b[^>]*>[\s\S]*?<\/Badge>|<(p|span|div)\b[^>]*className=["'`][^"'`]*\buppercase\b[^"'`]*\btracking-[^"'`]*["'`][^>]*>[^<]{1,60}<\/\1>/g, (match, _tag, offset: number, whole: string) => {
    if (!beforeHeading(whole.slice(offset + match.length, offset + match.length + 600))) return match;
    eyebrows += 1;
    return '';
  });
  if (eyebrows) fixes.add('étiquettes au-dessus des titres retirées');

  // Pastilles d'icône : le rond (ou carré) teinté autour d'une icône seule disparaît, l'icône reste.
  const withoutChips = out.replace(
    /<(div|span)\b[^>]*className=["'`](?=[^"'`]*\brounded-(?:full|md|lg|xl|2xl)\b)(?=[^"'`]*\bbg-[\w-]+\/\d{1,2}\b)[^"'`]*["'`][^>]*>\s*(<[A-Z][\w.]*\b[^>]*\/>)\s*<\/\1>/g,
    '$2'
  );
  if (withoutChips !== out) fixes.add('pastilles d’icône retirées');
  out = withoutChips;

  // L'icône Sparkles.
  const withoutSparkles = out.replace(/<Sparkles\b[^>]*\/>/g, '');
  if (withoutSparkles !== out) fixes.add('icône Sparkles retirée');
  out = withoutSparkles;

  // Décor dessiné en HTML : un bloc en position absolue sans contenu, ou un conteneur décoratif vide.
  // Une forme : en position absolue, dimensionnée, arrondie, floutée ou tournée — jamais un voile `inset-0`.
  const SHAPE_SELF_CLOSING = /<div\b[^>]*className=["'`](?![^"'`]*\binset-0\b)(?=[^"'`]*\babsolute\b)(?=[^"'`]*(?:\brounded-full\b|\bblur-|\brotate-\d|\bw-\d|\bh-\d|\bsize-\d|\bw-\[|\bh-\[))[^"'`]*["'`][^>]*\/>/g;
  const SHAPE_EMPTY = /<div\b[^>]*className=["'`](?![^"'`]*\binset-0\b)(?=[^"'`]*\babsolute\b)(?=[^"'`]*(?:\brounded-full\b|\bblur-|\brotate-\d|\bw-\d|\bh-\d|\bsize-\d|\bw-\[|\bh-\[))[^"'`]*["'`][^>]*>\s*<\/div>/g;
  const withoutDecor = out
    .replace(SHAPE_SELF_CLOSING, '')
    .replace(SHAPE_EMPTY, '')
    .replace(/<div\b[^>]*aria-hidden=["'{]?true["'}]?[^>]*>\s*<\/div>/g, '');
  if (withoutDecor !== out) fixes.add('décor en HTML retiré');
  out = withoutDecor;

  // Dégradés écrits en style : la propriété est retirée.
  const withoutInline = out.replace(/\b(?:background|backgroundImage)\s*:\s*(["'`])[^"'`]*(?:linear|radial|conic)-gradient\([^"'`]*\1\s*,?/g, '');
  if (withoutInline !== out) fixes.add('dégradé en style retiré');
  out = withoutInline;

  return { code: out, fixes: [...fixes] };
}
