/**
 * Assainit le HTML d'une section avant édition/affichage.
 *
 * L'équipe d'agents de recherche laisse parfois fuiter, en fin de `data`, un
 * bloc de sources en MARKDOWN ("#### Sources - [s1] [domain](grounding-api-redirect…)")
 * qui n'est pas du HTML et s'affiche donc en texte brut, cassant la mise en
 * page. Les vraies sources restent disponibles dans `SectionModel.sources`
 * (structuré) : ce résidu est donc du bruit à retirer.
 *
 * On retire :
 *  - le bloc markdown "#### Sources …" jusqu'à la fin du contenu ;
 *  - les liens de redirection grounding résiduels (vertexaisearch…redirect) ;
 *  - les marqueurs de citation isolés type [s12].
 */
const SOURCES_HEADING = /\s*#{2,6}\s*Sources\b[\s\S]*$/i;
const GROUNDING_ANCHOR = /<a\b[^>]*grounding-api-redirect[^>]*>[\s\S]*?<\/a>/gi;
const GROUNDING_MD_LINK = /\[[^\]]*\]\(https?:\/\/[^)]*grounding-api-redirect[^)]*\)/gi;
const CITATION_TOKEN = /\[s\d+\]/gi;

export function sanitizeSectionHtml(html: string): string {
  if (!html) return html;
  let out = html.replace(SOURCES_HEADING, '');
  out = out.replace(GROUNDING_ANCHOR, '');
  out = out.replace(GROUNDING_MD_LINK, '');
  out = out.replace(CITATION_TOKEN, '');
  return out.trim();
}

/** Indique si un HTML contient le bruit de sources (pour audit/log éventuel). */
export function hasSourcesNoise(html: string): boolean {
  return SOURCES_HEADING.test(html) || /grounding-api-redirect/i.test(html);
}
