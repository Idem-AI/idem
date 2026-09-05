/**
 * Bloc anti-« slop » commun à TOUTES les générations visuelles.
 *
 * Un modèle laissé sans contrainte renvoie la moyenne de son corpus : dégradé
 * violet-bleu, Inter, héros centré, trois cartes arrondies à ombre douce,
 * « Elevate your business ». Ce n'est pas un défaut de talent, c'est la
 * définition d'un générateur probabiliste — et c'est exactement ce qui fait
 * qu'un livrable « sent l'IA ».
 *
 * ⚠️ RÉPARTITION DES RÔLES — lire avant d'ajouter une règle ici.
 *
 * Ce bloc a longtemps porté une soixantaine d'interdits. C'est trop : un modèle
 * applique de façon fiable une dizaine de contraintes dures et ignore
 * SILENCIEUSEMENT les autres, et le phénomène s'aggrave à mesure que le modèle
 * rapetisse — or la plateforme doit tourner sur de petits modèles.
 *
 * Or la moitié de ces interdits sont DÉTECTABLES APRÈS COUP par du code, et
 * `slopLint.service.ts` les détecte déjà : dégradé violet, titre en dégradé,
 * police par défaut, couleur hors palette, couleurs Tailwind de stock, texte en
 * gris clair, sur-titre répété, emoji, pastille vide, rayons et ombres
 * hétérogènes, logo absent, `alt` manquant. Ils sont désormais CORRIGÉS en
 * code (`repairHtml` + `repairHtmlExtended`), donc garantis quel que soit le
 * modèle — au lieu d'être demandés à chaque page et obtenus une fois sur deux.
 *
 * Ne subsistent ici que les règles qu'aucune expression régulière ne peut
 * juger : la hiérarchie, l'ancrage du propos, le vocabulaire, l'intention de
 * composition. Ajouter une règle mécanique dans ce bloc, c'est reprendre au
 * code un travail qu'il fait mieux — et diluer celles qui restent.
 */

/**
 * Interdits que seul le modèle peut respecter, parce qu'ils portent sur le
 * SENS et non sur la forme. La fiche de style a le dernier mot quand une
 * direction artistique revendique explicitement l'un d'eux.
 */
export const ANTI_SLOP_BLOCK = `<anti_generic_rules>
These bans describe the reflexes that make a piece immediately recognisable as machine-made. They are about JUDGEMENT — the mechanical ones (colours, fonts, radii, shadows, emoji, eyebrows) are enforced by the renderer and you do not need to police them.

DISQUALIFYING — a single one is enough to reject the output:
- The "centred hero band + three identical cards + button" skeleton. Never a row of cards sharing the same width, padding and shadow: if three things genuinely differ, express the difference.
- Filler content: "Lorem ipsum", "Feature 1", "Your company", an invented statistic set large with no source.
- A sentence that would survive a change of company name. It says nothing; cut it or replace it with a fact.

BANNED VOCABULARY in the copy you write (French and English alike):
"révolutionnaire", "innovant" used on its own, "solution clé en main", "propulsez", "boostez", "libérez le potentiel", "à l'ère du numérique", "dans un monde en constante évolution", "elevate", "unlock", "seamless", "empower", "supercharge", "cutting-edge", "game-changing", "next-generation", "world-class".
Write what the brand actually DOES instead, with a concrete noun and a verb.

COMPOSITION:
- Hierarchy is expressed through SPACE as well as size: uniform spacing everywhere (gap-4 / p-6 on everything) flattens the page.
- Everything snaps to the announced grid, or deliberately breaks it. Loose alignment reads as carelessness.
</anti_generic_rules>

<craft_bar>
The output is judged the way a printed piece is judged, not the way a web page is. Before writing a single tag:
1. Decide the ONE thing a reader must retain from two metres away, then size everything else against it.
2. Build at least three typographic levels, separated by decisive jumps (the scale ratio is given by the art direction). Never two elements of similar size competing for attention.
3. Align optically, not to a default padding: to the edges of letterforms and of the subjects in the image.
4. Hold a single spatial rhythm (margins, gutters and offsets derived from the seed multiplier) instead of improvising element by element.
5. Introduce ONE deliberate accident — a crop, a rotation, an overlap, a bleed — that a template would never produce. That gesture is what makes the piece read as designed rather than generated.
6. Restraint over decoration: no gradient, glow, shadow or shape unless it does real work.
7. Every text legible on what actually sits behind it (WCAG AA), and nothing important in the outer 4% of the frame.
</craft_bar>`;

/**
 * Auto-relecture finale. Un modèle corrige beaucoup mieux ce qu'il vient
 * d'écrire quand on lui donne une grille de relecture explicite que quand on
 * lui demande de « bien faire » en amont.
 *
 * Réduite aux points que le linter ne sait pas juger : demander au modèle de
 * relire ses valeurs hexadécimales une par une lui coûtait des tokens de sortie
 * pour un contrôle que `repairHtml` fait sans erreur et sans variance.
 */
export const SELF_REVIEW_BLOCK = `<final_self_review>
Re-read your own output once and fix it before answering:
1. Is the art direction recognisable? Someone who knows the brand must recognise it with the logo covered.
2. Is there a real hierarchy — three levels, decisive jumps — or two elements competing at the same size?
3. Is there one deliberate compositional gesture, or is this a template with the content swapped?
4. Does every claim carry a figure, a place or an actor? Cut the sentences that do not.
5. Is any text clipped by the edge of the frame?
</final_self_review>`;
