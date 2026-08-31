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
Ces interdits priment sur toute habitude de composition. Ils décrivent les réflexes qui font qu'un visuel est immédiatement identifié comme généré par une machine.

NIVEAU 0 — rédhibitoires, un seul suffit à disqualifier le rendu :
- Dégradé violet/indigo/fuchsia, ou dégradé « violet vers bleu ». Aucun dégradé qui n'est pas prescrit par la direction artistique.
- Titre en dégradé (background-clip: text). Un titre est d'UNE couleur.
- Inter, Roboto, Poppins, Montserrat, Open Sans, Lato, Arial, "system-ui", font-sans/serif/mono — sauf si c'est LA police de la charte. Aucune police écrite en dur.
- Le triptyque « bandeau héros centré + trois cartes identiques + bouton ». Aucune rangée de 3 cartes au gabarit identique.
- Glassmorphisme réflexe (backdrop-blur sur une surface blanche translucide) hors direction artistique qui le prescrit.
- Une couleur qui n'est pas dans la palette de la charte (ni un de ses niveaux d'opacité).

NIVEAU 1 — signaux nets, à éliminer :
- \`rounded-2xl shadow-lg\` posé sur tout. Le rayon et l'ombre viennent de la direction artistique et sont les MÊMES partout.
- L'icône dans un carré arrondi coloré, répétée en grille.
- Le surtitre minuscule en capitales espacées répété au-dessus de chaque bloc : un seul, ou aucun.
- Les émojis en puces ou en icônes de section.
- Le bouton bleu Tailwind par défaut, la flèche « → » soudée au libellé.
- Le filet coloré sur le bord gauche d'une carte.
- Le gris clair (text-gray-400) pour du texte courant.
- Le contenu bouche-trou : « Lorem ipsum », « Fonctionnalité 1 », « Votre entreprise », une statistique inventée en gros chiffre sans source.

VOCABULAIRE INTERDIT dans les textes produits (français et anglais) :
« révolutionnaire », « innovant » employé seul, « solution clé en main », « propulsez », « boostez », « libérez le potentiel », « à l'ère du numérique », « dans un monde en constante évolution », "elevate", "unlock", "seamless", "empower", "supercharge", "cutting-edge", "game-changing", "next-generation", "world-class".
Écrire à la place ce que la marque FAIT, avec un nom concret et un verbe.

NIVEAU 2 — finitions :
- Espacements uniformes partout (gap-4 / p-6 sur tout) : la hiérarchie passe aussi par l'espace.
- Alignements approximatifs : tout s'aligne sur la grille annoncée, ou délibérément contre elle.
</anti_generic_rules>

<craft_bar>
Le rendu est jugé comme une pièce imprimée, pas comme une page web. Avant d'écrire une seule balise :
1. Décider LA chose qu'un lecteur doit retenir à deux mètres, puis dimensionner tout le reste par rapport à elle.
2. Construire trois niveaux typographiques au minimum, séparés par des écarts francs (rapport d'échelle donné par la direction artistique). Jamais deux éléments de taille voisine qui se disputent l'attention.
3. Aligner à l'œil, pas au pixel par défaut : sur le bord des lettres et des sujets, pas sur un padding hérité.
4. Tenir un rythme spatial unique (marges, gouttières, décalages dérivés du multiplicateur de la graine), au lieu d'improviser élément par élément.
5. Introduire UN accident délibéré — un recadrage, une rotation, un chevauchement, un débord — qu'un gabarit ne produirait jamais. C'est ce geste qui fait « dessiné » plutôt que « généré ».
6. Retenue plutôt que décoration : aucun dégradé, halo, ombre ou forme qui ne fasse un vrai travail.
7. Chaque texte lisible sur ce qui se trouve réellement derrière lui (WCAG AA), et rien d'important dans les 4 % au bord du cadre.
</craft_bar>`;

/**
 * Auto-relecture finale. Un modèle corrige beaucoup mieux ce qu'il vient
 * d'écrire quand on lui donne une grille de relecture explicite que quand on
 * lui demande de « bien faire » en amont.
 */
export const SELF_REVIEW_BLOCK = `<final_self_review>
Relire sa propre sortie une fois, et corriger avant de répondre :
1. Chercher chaque valeur hexadécimale : chacune doit figurer dans la palette de la charte. Remplacer les autres.
2. Chercher chaque déclaration de police : seules les deux familles de la charte sont admises.
3. Chercher les marqueurs de niveau 0 (dégradé violet, titre en dégradé, trois cartes identiques, héros centré, glassmorphisme non prescrit). En supprimer la cause, pas seulement l'apparence.
4. Vérifier que la direction artistique est reconnaissable : un lecteur qui connaît la marque doit la reconnaître logo masqué.
5. Vérifier la présence, la taille et le contraste du logo.
6. Vérifier qu'aucun texte n'est coupé par le bord du cadre et que chaque texte passe le contraste AA.
</final_self_review>`;
