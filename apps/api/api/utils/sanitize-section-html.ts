/**
 * Nettoie le HTML d'une section générée par IA avant rendu (PDF) ou édition.
 *
 * Les modèles laissent parfois échapper des artefacts de formatage qui, comme le
 * `data` est injecté tel quel, s'affichent en texte brut au-dessus/en-dessous de
 * la page (y compris dans le PDF) :
 *  - un préfixe de langage nu en tête ("html", "markdown") ;
 *  - des clôtures de bloc de code (```html … ```) ;
 *  - un bloc de sources en markdown ("#### Sources - [s1] [domain](grounding…)")
 *    laissé par l'équipe de recherche (les vraies sources vivent dans
 *    `SectionModel.sources`).
 *
 * Idempotent : réappliquer ne change rien.
 */
export function sanitizeSectionHtml(html: unknown): string {
  if (typeof html !== 'string') return html as string;
  let out = html.trim();

  // 1. Clôture de bloc de code ouvrante ```lang et fermante.
  out = out.replace(/^```[a-zA-Z]*\s*/, '');
  out = out.replace(/```\s*$/, '');

  // 2. Préfixe de langage nu en tête (le vrai HTML commence par '<').
  out = out.replace(/^(?:html|markdown)\b[ \t]*\r?\n?/i, '');

  // 3. Bloc "Sources" markdown résiduel jusqu'à la fin.
  out = out.replace(/\s*#{2,6}\s*Sources\b[\s\S]*$/i, '');

  // 4. Liens de redirection grounding + marqueurs de citation isolés.
  out = out.replace(/<a\b[^>]*grounding-api-redirect[^>]*>[\s\S]*?<\/a>/gi, '');
  out = out.replace(/\[[^\]]*\]\(https?:\/\/[^)]*grounding-api-redirect[^)]*\)/gi, '');
  out = out.replace(/\[s\d+\]/gi, '');

  return out.trim();
}
