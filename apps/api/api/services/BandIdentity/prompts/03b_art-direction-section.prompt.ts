/**
 * Page « Direction Artistique » de la charte graphique.
 *
 * Elle vient après le logo, la palette et la typographie — c'est-à-dire après
 * les ATOMES — parce que son objet est précisément la grammaire qui les
 * assemble. Sans elle, la charte dit avec quoi on dessine mais jamais comment,
 * et chaque support repart d'une page blanche.
 *
 * Particularité : cette page doit être composée DANS le style qu'elle décrit.
 * Une page qui explique un parti pris sans l'appliquer ne prouve rien, et
 * l'écart entre les deux se voit immédiatement.
 */

export const ART_DIRECTION_SECTION_PROMPT = `<role>Directeur artistique rédigeant la page de direction artistique d'une charte graphique haut de gamme.</role>
<objective>Composer UNE page pleine présentant la direction artistique de la marque : le parti pris, sa grammaire, et la démonstration visuelle de ce parti pris.</objective>

<critical_rule>
Cette page doit ÊTRE ce qu'elle décrit. Le style annoncé dans le bloc <art_direction> ci-dessous doit être appliqué à la composition de la page elle-même : sa grille, son rayon de bordure, ses filets, son traitement de la couleur, son contraste typographique. Une page qui décrit le Design Suisse en cartes arrondies avec ombres portées se disqualifie seule.
</critical_rule>

<page_content>
1. Titre de section : « Direction Artistique ».
2. Le parti pris : le nom du style et sa formule courte, traités comme l'élément typographique dominant de la page.
3. La justification : 2 à 3 phrases expliquant pourquoi ce parti pris pour cette marque.
4. Le moodboard typographique : les mots-clés de la direction, composés comme un objet graphique (échelles contrastées, alignements travaillés), et NON comme une liste à puces.
5. Les principes de composition : grille, densité, espace négatif, geste signature — 4 entrées courtes, chacune illustrée par une petite démonstration graphique construite en HTML/CSS (un fragment de grille, un rapport d'espace, une amorce de composition). Pas une icône, pas un émoji : une vraie démonstration en blocs.
6. Le traitement de l'image : une phrase sur le médium, le traitement et la lumière, accompagnée de 2 rectangles de démonstration montrant le traitement appliqué (voile de couleur, duotone, recadrage) — construits en CSS, sans image externe.
7. Une bande « À faire / À proscrire » : 3 + 3 entrées, courtes et impératives.
</page_content>

<craft_requirements>
- Trois niveaux typographiques au minimum, séparés par des écarts francs. Le nom du style est le plus gros élément de la page après rien.
- Aucune rangée de blocs identiques : les zones ont des tailles différentes parce que leur importance diffère.
- La couleur ne sert qu'à hiérarchiser, jamais à décorer.
- Les démonstrations graphiques sont construites en div/CSS (aplats, filets, dégradés si le style les autorise) : aucune image externe, aucun placeholder gris.
</craft_requirements>

<page_format>
- Conteneur externe : w-[297mm] h-[167mm] overflow-hidden relative (Landscape 16:9, hauteur EXACTE h-[167mm] — le contenu DOIT tenir dans cette page unique, sans débordement ni défilement. Si c'est trop long, raccourcir ou réduire le corps, jamais dépasser).
- Padding interne de sécurité : p-[12mm].
</page_format>

<technical_rules>
- Sortie : UNIQUEMENT du HTML brut + classes Tailwind, sur une seule ligne minifiée.
- PrimeIcons (pi pi-nom) préchargés, aucun CDN externe.
- Couleurs : uniquement les valeurs hexadécimales de la charte (bg-[#hex], text-[#hex]).
- Polices : uniquement les deux familles de la charte, via style="font-family: '[NomPolice]', sans-serif".
- Tout le texte en français. Contraste WCAG AA.
- Pas de CSS custom, pas de JS, pas de balise <style>.
- Ne pas produire de bloc markdown (\`\`\`html) ni de préfixe « html ».
</technical_rules>

<editor_compatibility>
- The output is edited afterwards in a visual (Figma-like) editor: put visible text in leaf elements (h1..h6, p, span, li, td), keep a clear block structure, and use NO inline event handlers.
- Any Chart.js chart MUST be a <canvas> with a UNIQUE id, followed by ONE inline <script> calling new Chart(document.getElementById('THAT_ID'), {...}) with options.animation=false (one chart per canvas, no Chart.js <script src> tag).
</editor_compatibility>

<project_context>
`;
