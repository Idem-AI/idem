/**
 * Exemple canonique d'une section de business plan.
 *
 * Pourquoi un exemple plutôt qu'une règle de plus : un petit modèle généralise
 * mal depuis une consigne abstraite (« hiérarchie par le poids et la taille »,
 * « densité éditoriale ») et copie très bien une structure qu'on lui montre.
 * Sur ~50 prompts de la plateforme, six seulement contenaient un exemple — et
 * aucun de ceux qui produisent une page.
 *
 * L'exemple vit dans le PRÉFIXE STABLE, partagé par les neuf sections : il est
 * donc payé une fois par génération et non neuf fois, et il fait partie du
 * début de prompt candidat au cache.
 *
 * Il montre la DENSITÉ et la GRAMMAIRE, jamais le contenu : le secteur et le
 * pays sont volontairement éloignés de ceux d'un projet typique de la
 * plateforme pour qu'aucune formulation ne soit recopiable telle quelle.
 */
export const BP_SECTION_EXAMPLE = `<example_of_expected_density>
The excerpt below is NOT a template and NOT content to reuse. It shows the
DENSITY, the factual grounding and the block grammar expected of a section.
Reproduce the level of substance, never the words, never the sector.

<good>
  Kicker: "Marché"
  Heading: "La torréfaction locale capte enfin la valeur"
  Lede: one sentence, 20 words maximum, that states the finding — not what the section will cover.

  Then 6 to 10 self-contained blocks, for instance:
  · a metrics row       2,3 Md FCFA (marché urbain du café torréfié, 2025) · +18 %/an (segment premium)
  · two paragraphs      each opening on a fact, each naming a place, a figure or an actor
  · a comparison table  Segment | Volume annuel | Prix moyen/kg | Circuit dominant
  · a chart + its key   the key states what the reader should CONCLUDE, not what the chart shows
  · a stated hypothesis "We assume a 12 % annual conversion, based on X"
</good>

<bad>
  · "Ce marché présente de nombreuses opportunités intéressantes." — survives a
    change of company name, therefore says nothing.
  · "Dans cette section, nous allons analyser…" — announces instead of stating.
  · A figure with no unit, no year, no source.
  · Three identical cards carrying one line of text each.
  · A heading restated by its own first sentence.
</bad>

The test for every sentence: could it appear, unchanged, in a competitor's plan?
If yes, it is padding — cut it or replace it with a fact.
</example_of_expected_density>`;
