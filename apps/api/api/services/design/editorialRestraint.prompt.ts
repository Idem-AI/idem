/**
 * Discipline de soustraction, pour les livrables DOCUMENTAIRES.
 *
 * À distinguer du bloc anti-slop, qui traite d'un autre défaut. L'anti-slop dit
 * « ne recopie pas les tics du corpus ». Celui-ci dit « n'ajoute rien qui ne
 * serve ». Ce sont deux pathologies différentes, et un livrable peut souffrir
 * des deux à la fois : une page peut être parfaitement hors des clichés et
 * rester illisible parce qu'elle est saturée d'ornements et de paragraphes qui
 * ne disent rien.
 *
 * La cause est identifiable : un modèle chargé de « remplir une page » remplit.
 * Il ajoute une carte, une icône, un badge, une phrase de transition — parce
 * que produire du volume est plus facile que produire de la matière. Le remède
 * n'est pas de demander « moins » (un adjectif de plus), mais d'imposer un
 * CRITÈRE : chaque élément doit justifier sa présence, et la page est finie
 * quand on ne peut plus rien retirer sans perdre une information.
 *
 * Ne s'applique PAS aux visuels sociaux ni aux affiches : là, l'atmosphère et
 * l'ornement font partie du message. Un document, non — sa typographie doit
 * s'effacer pour laisser lire.
 */

export const EDITORIAL_RESTRAINT_BLOCK = `<editorial_restraint>
This is a DOCUMENT, not a landing page. Its typography must disappear so the content can be read. Consistency beats novelty, rhythm beats surprise, and hierarchy beats decoration.

THE SUBTRACTION TEST — apply it to every element before emitting it:
Remove the element. Does the reader lose an information, a hierarchy or a reading path? If not, it must not exist. A page is finished when nothing more can be removed, not when it looks full.

DECORATION THAT IS FORBIDDEN because it carries nothing:
- Shapes, blobs, waves, dots, arcs, gradients or glows placed "to fill" or "to liven up".
- An icon next to every heading or every bullet. An icon is admissible only when it encodes a distinction the text does not carry — at most two or three per page, never one per item.
- Coloured badges, pills and tags that hold no data (no figure, no date, no status).
- A card, a frame or a coloured background around a block that is already delimited by its heading and by white space.
- A drop shadow, a border AND a background colour on the same block: choose one separator, hold it for the whole document.
- More than one accent colour per page. Colour marks the ONE thing that matters, otherwise it marks nothing.
- Decorative dividers between every section: white space already separates them.

TEXT THAT IS FORBIDDEN because it says nothing:
- The sentence that restates the heading in other words.
- The introductory sentence announcing what the section is about to say ("Cette section présente…").
- The closing sentence summarising what has just been said, in a section under one page.
- Any sentence that would be equally true of any other company in the sector. If it survives a change of brand name, delete it.
- Adjectives without a referent: "innovant", "unique", "robuste", "performant", used with no figure and no fact behind them.
- Filler in a table or a list: an "N/A" row, a repeated cell, an item added to reach three.
- A figure invented to fill a KPI slot. A KPI with no verified source is removed, not estimated.

WHAT REPLACES THEM:
- Typographic hierarchy: three levels with wide, deliberate jumps, and nothing else, carry a page perfectly well.
- White space: it is the primary structuring device of a document, not leftover.
- Real data: a figure, a date, a name, an amount are worth ten qualifying sentences.
- A rule, a number, an alignment: those are the only ornaments an editorial page needs.

VOLUME:
- Never pad to reach a page target. If the substance fills two thirds of a page, produce two thirds of a page: a shorter document is a better document. The page count is a consequence of the content, never a quota to hit.
- Add depth rather than length: a figure, a local example, a hypothesis stated as such, a risk, a timeline, a comparison.
</editorial_restraint>`;

/**
 * Grille de relecture par soustraction.
 *
 * Formulée en actes plutôt qu'en intentions : « supprimer », « compter »,
 * « chercher ». Un modèle exécute une consigne de vérification bien mieux
 * qu'une consigne de retenue donnée en amont, parce qu'il a alors sa propre
 * sortie sous les yeux.
 */
export const RESTRAINT_SELF_REVIEW_BLOCK = `<restraint_self_review>
Re-read your own output once and DELETE before answering:
1. Count the decorative elements that carry no information (shapes, gradients, icons, empty badges, cards around already-delimited blocks). Delete them all.
2. Find every sentence that restates a heading, announces or summarises the section, or would survive a change of brand name. Delete them.
3. Count the accent colours used on the page. Above one, reduce.
4. Count the icons. Above three, reduce.
5. Check that every figure shown comes from the supplied data. Delete the others rather than estimating them.
6. Check that the typographic hierarchy alone makes the page readable, with no coloured block to guide the eye.
</restraint_self_review>`;
