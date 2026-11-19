/**
 * Complément de confidentialité propre au simulateur IDEM.
 *
 * Les conditions de la simulation (`/simulation-terms`) disent déjà ce qu’un
 * indice de viabilité vaut et ce qu’il ne vaut pas. Ce texte-ci traite la
 * seule question qu’elles n’adressent pas de face : ce que devient le business
 * plan que vous importez, et ce que la recherche de chiffres extérieurs
 * envoie dehors.
 */

import type { LegalDocContent } from '../content.model';

export const ISIMULATOR_PRIVACY: LegalDocContent = {
  id: 'isimulator-privacy',
  version: '2026.11',
  effectiveDate: { fr: '19 novembre 2026', en: '19 November 2026' },
  title: { fr: 'Confidentialité — Simulateur IDEM', en: 'Privacy — IDEM Simulator' },
  subtitle: {
    fr: 'Ce que la simulation ajoute à la politique globale : le business plan que vous importez, les chiffres que nous allons chercher dehors, et ce qui reste après une exécution.',
    en: 'What the simulation adds to the global policy: the business plan you import, the figures we fetch from outside, and what remains after a run.',
  },
  sections: [
    {
      id: 'scope',
      title: { fr: 'Ce texte complète deux autres', en: 'This text adds to two others' },
      paragraphs: [
        {
          fr: 'La politique de confidentialité d’IDEM s’applique entièrement au simulateur. Les conditions de la simulation décrivent, elles, ce que l’indice mesure et ce qu’il ne mesure pas — à lire avant toute exécution.',
          en: 'The IDEM privacy policy applies to the simulator in full. The simulation terms describe what the index measures and what it does not — to be read before any run.',
        },
      ],
      list: [
        {
          text: { fr: 'Le texte global.', en: 'The global text.' },
          link: {
            label: { fr: 'Politique de confidentialité', en: 'Privacy Policy' },
            href: '/privacy-policy',
          },
        },
        {
          text: {
            fr: 'Ce que vaut un indice de viabilité.',
            en: 'What a viability index is worth.',
          },
          link: {
            label: { fr: 'Conditions de la simulation', en: 'Simulation terms' },
            href: '/simulation-terms',
          },
        },
      ],
    },
    {
      id: 'imported',
      title: { fr: 'Le business plan que vous importez', en: 'The business plan you import' },
      paragraphs: [
        {
          fr: 'Vous pouvez importer un document — PDF, Word ou Markdown. C’est, dans tout IDEM, le fichier le plus sensible que vous puissiez nous confier : il contient vos chiffres, votre stratégie, parfois vos partenaires et vos salaires.',
          en: 'You can import a document — PDF, Word or Markdown. In all of IDEM, it is the most sensitive file you can entrust to us: it contains your figures, your strategy, sometimes your partners and your salaries.',
        },
        {
          fr: 'Voici son trajet, en entier. Le fichier est déposé sur notre infrastructure, rattaché à votre projet. Son texte est extrait, puis envoyé au modèle qui en tire les hypothèses chiffrées — chiffre d’affaires, marge, coûts fixes, saisonnalité. Les hypothèses extraites sont conservées avec votre projet ; vous pouvez les corriger, et c’est recommandé.',
          en: 'Here is its whole journey. The file is uploaded to our infrastructure, attached to your project. Its text is extracted, then sent to the model that derives the numeric assumptions — revenue, margin, fixed costs, seasonality. The extracted assumptions are kept with your project; you can correct them, and that is recommended.',
        },
        {
          fr: 'Ce qui n’arrive pas : votre business plan n’entraîne aucun modèle, n’est lu par aucun membre de l’équipe en dehors d’une demande de support de votre part, et n’apparaît dans aucun de nos journaux — le filtre central remplace les documents métier et les résultats financiers par leur forme avant écriture.',
          en: 'What does not happen: your business plan trains no model, is read by no team member outside a support request from you, and appears in none of our logs — the central filter replaces business documents and financial results by their shape before writing.',
        },
        {
          fr: 'Vous pouvez supprimer le fichier importé sans supprimer la simulation : les hypothèses corrigées suffisent à rejouer une exécution.',
          en: 'You can delete the imported file without deleting the simulation: the corrected assumptions are enough to replay a run.',
        },
      ],
    },
    {
      id: 'research',
      title: {
        fr: 'Les chiffres que nous allons chercher dehors',
        en: 'The figures we fetch from outside',
      },
      paragraphs: [
        {
          fr: 'Une simulation a besoin de repères extérieurs : taille d’un marché, prix pratiqués, inflation, coût d’un intrant. Le simulateur va les chercher sur le web, et cette recherche sort de notre infrastructure.',
          en: 'A simulation needs external reference points: a market’s size, prevailing prices, inflation, the cost of an input. The simulator goes to the web for them, and that search leaves our infrastructure.',
        },
        {
          fr: 'Ce qui part dans une recherche : des termes construits à partir de votre secteur, de votre pays et de votre produit. Ce qui ne part jamais : vos chiffres, votre nom, le nom de votre entreprise, le contenu de votre business plan. Une requête de recherche décrit un marché, pas un projet.',
          en: 'What leaves in a search: terms built from your sector, your country and your product. What never leaves: your figures, your name, your company’s name, the content of your business plan. A search query describes a market, not a project.',
        },
        {
          fr: 'Les résultats trouvés sont conservés en entier avec la simulation — la source, la date et le texte relevé — pour deux raisons : vous pouvez vérifier d’où vient chaque chiffre, et rejouer une simulation ne déclenche aucune nouvelle recherche. Régénérer ne rappelle jamais le web.',
          en: 'The results found are kept in full with the simulation — the source, the date and the text collected — for two reasons: you can check where each figure comes from, and replaying a simulation triggers no new search. Regenerating never calls the web again.',
        },
      ],
    },
    {
      id: 'results',
      title: { fr: 'Ce que produit une exécution', en: 'What a run produces' },
      paragraphs: [
        {
          fr: 'Un indice, des scénarios, des facteurs, des risques et un rapport. Tout cela est rattaché à votre projet, visible par vous seul, et supprimable.',
          en: 'An index, scenarios, factors, risks and a report. All of it is attached to your project, visible to you alone, and deletable.',
        },
        {
          fr: 'Nous conservons par ailleurs, séparément, une ligne de métadonnées par exécution : la durée, le nombre de scénarios, le coût en jetons, le résultat. Elle sert à vous facturer et à surveiller nos pannes. Elle ne contient aucun de vos chiffres.',
          en: 'We also keep, separately, one line of metadata per run: the duration, the number of scenarios, the token cost, the outcome. It serves to bill you and to watch our failures. It contains none of your figures.',
        },
        {
          fr: 'Un indice de viabilité n’est jamais partagé, publié, ni communiqué à un tiers — ni à un investisseur, ni à une banque, ni à un partenaire. Si vous voulez le montrer, c’est vous qui l’exportez.',
          en: 'A viability index is never shared, published or communicated to a third party — not to an investor, a bank or a partner. If you want to show it, you are the one who exports it.',
        },
      ],
    },
    {
      id: 'retention',
      title: { fr: 'Durées propres au simulateur', en: 'Durations specific to the simulator' },
      table: {
        headers: [
          { fr: 'Donnée', en: 'Data' },
          { fr: 'Durée', en: 'Duration' },
        ],
        rows: [
          [
            { fr: 'Business plan importé', en: 'Imported business plan' },
            {
              fr: 'Jusqu’à ce que vous le supprimiez ; effacé 30 jours après la suppression du projet',
              en: 'Until you delete it; erased 30 days after the project is deleted',
            },
          ],
          [
            { fr: 'Hypothèses extraites et corrigées', en: 'Extracted and corrected assumptions' },
            { fr: 'Liées au projet, effacées avec lui', en: 'Tied to the project, erased with it' },
          ],
          [
            {
              fr: 'Trace de recherche (sources et textes relevés)',
              en: 'Research trace (sources and collected texts)',
            },
            {
              fr: 'Liée à la simulation, effacée avec le projet',
              en: 'Tied to the simulation, erased with the project',
            },
          ],
          [
            { fr: 'Indice, scénarios et rapport', en: 'Index, scenarios and report' },
            { fr: 'Liés au projet, effacés avec lui', en: 'Tied to the project, erased with it' },
          ],
          [
            { fr: 'Métadonnées d’exécution', en: 'Run metadata' },
            {
              fr: 'Conservées, détachées du projet à son effacement',
              en: 'Kept, detached from the project when it is erased',
            },
          ],
        ],
      },
    },
    {
      id: 'contact',
      title: { fr: 'Nous écrire', en: 'Writing to us' },
      paragraphs: [
        {
          fr: 'Question sur ce texte, suppression d’un business plan importé, exercice d’un droit : legal@idem.africa.',
          en: 'A question about this text, deleting an imported business plan, exercising a right: legal@idem.africa.',
        },
      ],
    },
  ],
};
