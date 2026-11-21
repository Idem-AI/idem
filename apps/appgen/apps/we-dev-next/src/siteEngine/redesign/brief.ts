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
  const n = content.pages.length;
  return (fr
    ? `# C'est une REFONTE — le nouveau site doit être nettement meilleur que l'ancien, pas une copie rafraîchie
Ce projet a déjà un site (${content.url}, ${n} page${n > 1 ? 's' : ''} lue${n > 1 ? 's' : ''}). Ses textes sont dans les faits ci-dessus. Ce que tu GARDES : le contenu (offres, faits, coordonnées, noms, chiffres, photos) et la marque. Ce que tu REFAIS : tout le reste — le découpage, l'ordre, les mises en page, la promesse, les titres.
1. Comprends-le : ce que l'entreprise vend, à qui, où, ce qui la distingue — d'après ce que le site dit.
2. Juge-le pour SA cible : la promesse est-elle claire dès le premier écran ? L'action principale (appeler, réserver, commander, écrire) est-elle évidente et répétée ? Les offres se comparent-elles facilement ? Les preuves (réalisations, chiffres réels, avis réels, partenaires) sont-elles mises en avant ? Les textes sont-ils trop longs, flous, centrés sur l'entreprise plutôt que sur le client ?
3. Conçois l'architecture d'un site professionnel d'aujourd'hui : un parcours (promesse → preuve → offre → action), des pages qui ont chacune un but, une ouverture forte, des preuves tôt, un appel à l'action à chaque étape. Les compositions sont choisies pour le contenu, jamais d'après la forme qu'il avait.
4. Rien ne disparaît, rien ne s'invente : chaque fait du site est repris ; aucun fait absent n'est ajouté.
Dans chaque brief, dis ce que la section fait mieux que l'ancien site.`
    : `# This is a REDESIGN — the new site must be clearly better than the old one, not a refreshed copy
This project already has a website (${content.url}, ${n} page${n > 1 ? 's' : ''} read). Its copy is in the facts above. What you KEEP: the content (offers, facts, contact details, names, figures, photos) and the brand. What you REDO: everything else — the breakdown, the order, the layouts, the promise, the headings.
1. Understand it: what the business sells, to whom, where, what sets it apart — from what the site says.
2. Judge it for ITS audience: is the promise clear on the first screen? Is the main action (call, book, order, write) obvious and repeated? Are the offers easy to compare? Is proof (work, real figures, real reviews, partners) put forward? Is the copy too long, vague, or about the company rather than the customer?
3. Design the structure of a professional website of today: a journey (promise → proof → offer → action), pages that each have one goal, a strong opener, proof early, a call to action at every step. Compositions are chosen for the content, never after the shape it had.
4. Nothing disappears, nothing is invented: every fact of the site is carried; no absent fact is added.
In each brief, say what the section does better than the old site.`) + focusLine(focus, fr);
}

/**
 * Le style relevé sur le site, pour le directeur artistique. Ce qui reste : le logo, les couleurs, le caractère de la
 * marque. Ce qui ne revient PAS : l'exécution de l'ancien site (formes, ombres, boutons, cartes, effets), qui est
 * justement ce que la refonte remplace — le relevé ne sert qu'à savoir de quoi s'éloigner.
 */
export function redesignDesign(content: SiteContent, fr: boolean): string {
  const evidence = clip(content.styleEvidence || '', 1600);
  return fr
    ? `# Refonte d'un site existant
Ce que le site actuel montre de son style (relevé sur ses pages) :
${evidence || '(rien de lisible)'}
Le nouveau site doit être reconnu comme la même marque ET vu comme nettement plus professionnel. Garde : le logo, les couleurs de la marque, son caractère général (sérieux, chaleureux, technique…). Ne reproduis PAS l'exécution relevée ci-dessus : ses rayons, ses ombres, ses boutons, ses cartes, ses bordures et ses effets sont ceux d'avant — choisis-en d'autres, plus actuels, qui suivent la personnalité donnée plus bas. Vise un niveau de studio : hiérarchie typographique nette et contrastée (titres plus grands, plus serrés), rythme vertical généreux, composants cohérents, contraste lisible, mouvement discret.`
    : `# Redesign of an existing website
What the current site shows of its style (read on its pages):
${evidence || '(nothing readable)'}
The new site must be recognised as the same brand AND seen as clearly more professional. Keep: the logo, the brand colours, its general character (serious, warm, technical…). Do NOT reproduce the execution read above: its radii, shadows, buttons, cards, borders and effects are the old ones — choose others, more current, following the personality given below. Aim for studio quality: a crisp, contrasted type hierarchy (larger, tighter headings), generous vertical rhythm, consistent components, readable contrast, discreet motion.`;
}
