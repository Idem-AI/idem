/**
 * Bloc anti-« slop » commun à TOUTES les générations visuelles.
 *
 * Un modèle laissé sans contrainte renvoie la moyenne de son corpus : dégradé
 * violet-bleu, Inter, héros centré, trois cartes arrondies à ombre douce,
 * « Elevate your business ». Ce n'est pas un défaut de talent, c'est la
 * définition d'un générateur probabiliste — et c'est exactement ce qui fait
 * qu'un livrable « sent l'IA ».
 *
 * La parade tient en deux temps, et les deux sont indispensables :
 *   1. des CONTRAINTES NÉGATIVES explicites (ce bloc), qui retirent les défauts
 *      que le modèle comblerait tout seul ;
 *   2. des CONTRAINTES POSITIVES différentes d'un projet à l'autre (la direction
 *      artistique + la graine de composition), qui donnent un ancrage à la place.
 *
 * Ce bloc est vérifié après coup par `slopLint.ts` : ce qui est écrit ici est
 * mesuré sur le HTML produit, pas seulement demandé.
 */

/**
 * Interdits universels. Ils valent quelle que soit la direction artistique —
 * sauf quand celle-ci les revendique explicitement (le glassmorphisme est
 * interdit… sauf si le style retenu EST le glassmorphisme). Les prompts qui
 * incluent ce bloc incluent aussi la fiche de style, qui a le dernier mot.
 */
export const ANTI_SLOP_BLOCK = `<anti_generic_rules>
These bans override every composition habit. They describe the reflexes that make a piece immediately recognisable as machine-made.

LEVEL 0 — disqualifying, a single one is enough to reject the output:
- Purple / indigo / fuchsia gradient, or a "violet to blue" gradient. No gradient that the art direction did not prescribe.
- Gradient headline (background-clip: text). A headline is ONE colour.
- Inter, Roboto, Poppins, Montserrat, Open Sans, Lato, Arial, "system-ui", font-sans / font-serif / font-mono — unless it IS the charter typeface. Never a hard-coded font family.
- The "centred hero band + three identical cards + button" skeleton. Never a row of cards sharing the same width, padding and shadow.
- Reflexive glassmorphism (backdrop-blur over a translucent white surface) unless the art direction prescribes it.
- Any colour outside the charter palette (or one of its opacity levels).

LEVEL 1 — strong tells, remove them:
- \`rounded-2xl shadow-lg\` applied to everything. The radius and the shadow come from the art direction and are the SAME everywhere.
- The icon inside a coloured rounded square, repeated in a grid.
- The tiny uppercase tracked eyebrow repeated above every block: keep one, or none.
- Emoji used as bullets or as section icons.
- The default Tailwind blue button, the "→" arrow welded to a label.
- A coloured rule on the left edge of a card.
- Light grey (text-gray-400) for running text.
- Filler content: "Lorem ipsum", "Feature 1", "Your company", an invented statistic set large with no source.

BANNED VOCABULARY in the copy you write (French and English alike):
"révolutionnaire", "innovant" used on its own, "solution clé en main", "propulsez", "boostez", "libérez le potentiel", "à l'ère du numérique", "dans un monde en constante évolution", "elevate", "unlock", "seamless", "empower", "supercharge", "cutting-edge", "game-changing", "next-generation", "world-class".
Write what the brand actually DOES instead, with a concrete noun and a verb.

LEVEL 2 — finishing:
- Uniform spacing everywhere (gap-4 / p-6 on everything): hierarchy is also expressed through space.
- Loose alignment: everything snaps to the announced grid, or deliberately breaks it.
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
 */
export const SELF_REVIEW_BLOCK = `<final_self_review>
Re-read your own output once and fix it before answering:
1. Find every hex value: each must belong to the charter palette. Replace the others.
2. Find every font declaration: only the two charter families are allowed.
3. Look for the level 0 tells (purple gradient, gradient headline, three identical cards, centred hero, unprescribed glassmorphism). Remove their CAUSE, not just their appearance.
4. Check that the art direction is recognisable: someone who knows the brand must recognise it with the logo covered.
5. Check the logo: present, large enough, contrasting with what sits behind it.
6. Check that no text is clipped by the edge of the frame and that every text passes AA contrast.
</final_self_review>`;
