/**
 * Ce que les agents du moteur de sites reçoivent quand le site EXISTE déjà.
 *
 * Une refonte n'est pas une copie : on garde ce que le site sait (les faits, l'offre, les coordonnées, la
 * marque, les photos) et on refait ce qu'il fait mal (la structure, la promesse, les textes, la mise en
 * page). Trois blocs, un par agent :
 *
 *   faits          ce que le site dit aujourd'hui → ajouté aux faits du projet : les auteurs peuvent le
 *                  reprendre, le garde-fou des faits l'accepte (un téléphone du site n'est pas « inventé »)
 *   architecte     analyser le site pour sa cible, dire ce qui manque, concevoir mieux
 *   design         le style relevé sur le site : l'ADN à garder, l'exécution à moderniser
 */
import type { SiteContent } from './idemClient.js';

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** Les textes du site actuel, comme des faits du projet. */
export function redesignFacts(content: SiteContent, fr: boolean): string {
  const v = content.voice ?? {};
  const lines = [
    fr ? `# Le site actuel (${content.url}) — ce qu'il dit aujourd'hui` : `# The current website (${content.url}) — what it says today`,
    content.title ? `${fr ? 'Titre' : 'Title'} : ${content.title}` : '',
    content.description ? `${fr ? 'Description' : 'Description'} : ${content.description}` : '',
    v.businessType ? `${fr ? 'Activité' : 'Business'} : ${v.businessType}` : '',
    v.valueProposition ? `${fr ? 'Promesse affichée' : 'Stated promise'} : ${v.valueProposition}` : '',
    v.tone ? `${fr ? 'Ton' : 'Tone'} : ${v.tone}` : '',
    content.headings.length ? `${fr ? 'Titres des sections' : 'Section titles'} : ${content.headings.join(' | ')}` : '',
    content.paragraphs.length ? `${fr ? 'Textes' : 'Copy'} :\n${clip(content.paragraphs.map((p) => `- ${p}`).join('\n'), 3200)}` : '',
  ];
  return lines.filter(Boolean).join('\n');
}

/** La mission de l'architecte : comprendre le site, sa cible, ses manques, et concevoir mieux. */
export type RedesignFocus = 'all' | 'design' | 'copy';

/** Ce que l'utilisateur veut améliorer d'abord (question du déroulé `/redesign`). */
function focusLine(focus: RedesignFocus, fr: boolean): string {
  if (focus === 'design')
    return fr
      ? '\nPriorité de l’utilisateur : le DESIGN. Garde la structure et les textes du site presque tels quels (corrige seulement ce qui est faux ou illisible) ; tout l’effort va à la mise en page, la hiérarchie et les visuels.'
      : '\nUser priority: the DESIGN. Keep the site structure and copy almost as they are (only fix what is wrong or unreadable); all the effort goes into layout, hierarchy and visuals.';
  if (focus === 'copy')
    return fr
      ? '\nPriorité de l’utilisateur : les TEXTES et le MESSAGE. Réécris la promesse, les titres et les appels à l’action pour la cible ; garde une mise en page sobre et proche de l’esprit du site.'
      : '\nUser priority: the COPY and MESSAGE. Rewrite the promise, headings and calls to action for the audience; keep a sober layout close to the site’s spirit.';
  return '';
}

export function redesignArchitect(content: SiteContent, fr: boolean, focus: RedesignFocus = 'all'): string {
  return (fr
    ? `# C'est une REFONTE
Ce projet a déjà un site (${content.url}, ${content.pages.length} page${content.pages.length > 1 ? 's' : ''} lue${content.pages.length > 1 ? 's' : ''}). Ses textes sont dans les faits ci-dessus. Tu ne le recopies pas : tu le refais mieux.
1. Comprends-le d'abord : ce que l'entreprise vend, à qui, où, et ce qui la distingue — d'après ce que le site dit.
2. Juge-le pour SA cible : la promesse est-elle claire dès le premier écran ? L'action principale (appeler, réserver, commander, écrire) est-elle évidente et répétée ? Les offres sont-elles faciles à comparer ? Y a-t-il des preuves (réalisations, chiffres réels, avis réels) mises en valeur ? Des textes trop longs, flous ou centrés sur l'entreprise plutôt que sur le client ?
3. Conçois l'architecture qui corrige ces manques : un ordre plus clair, des pages qui ont chacune un but, une promesse réécrite pour la cible, un appel à l'action à chaque étape.
4. Garde TOUS les faits du site (offres, coordonnées, lieux, noms, chiffres) : rien ne disparaît, rien ne s'invente. Ce qui change, c'est la façon de le dire et de le montrer.
Dans chaque brief, dis ce que la section améliore par rapport à l'ancien site.`
    : `# This is a REDESIGN
This project already has a website (${content.url}, ${content.pages.length} page${content.pages.length > 1 ? 's' : ''} read). Its copy is in the facts above. Do not copy it: rebuild it better.
1. Understand it first: what the business sells, to whom, where, and what sets it apart — from what the site says.
2. Judge it for ITS audience: is the promise clear on the first screen? Is the main action (call, book, order, write) obvious and repeated? Are the offers easy to compare? Is there proof (work, real figures, real reviews) put forward? Is the copy too long, vague, or about the company rather than the customer?
3. Design the structure that fixes these gaps: a clearer order, pages that each have one goal, a promise rewritten for the audience, a call to action at every step.
4. Keep ALL the site's facts (offers, contact details, places, names, figures): nothing disappears, nothing is invented. What changes is how it is said and shown.
In each brief, say what the section improves over the old site.`) + focusLine(focus, fr);
}

/** Le style relevé sur le site : l'ADN à garder, l'exécution à refaire. */
export function redesignDesign(content: SiteContent, fr: boolean): string {
  const evidence = clip(content.styleEvidence || '', 1600);
  return fr
    ? `# Refonte d'un site existant
Ce que le site actuel montre de son style (relevé sur ses pages) :
${evidence || '(rien de lisible)'}
Garde l'ADN reconnaissable de la marque (couleurs et polices imposées par la charte, caractère général) et refais l'exécution avec un niveau actuel : hiérarchie typographique nette, espace généreux, composants cohérents, contraste lisible, mouvement discret. Le visiteur doit reconnaître la marque et voir que tout a été repensé.`
    : `# Redesign of an existing website
What the current site shows of its style (read on its pages):
${evidence || '(nothing readable)'}
Keep the brand's recognisable DNA (colours and fonts imposed by the brand, general character) and redo the execution to a current standard: crisp type hierarchy, generous space, consistent components, readable contrast, discreet motion. Visitors must recognise the brand and see that everything was rethought.`;
}
