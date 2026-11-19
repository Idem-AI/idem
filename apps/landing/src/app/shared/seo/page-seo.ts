import { SERVICES, type FaqEntry, type LandingPageId } from '@idem/shared-seo';

/**
 * Les textes de référencement de chaque page du landing, traduits par
 * `$localize` (messages.fr.json). Le reste (chemin, image, sujet, plan du site)
 * est dans `@idem/shared-seo` (LANDING_PAGES).
 *
 * Tous disent la même promesse : IDEM aide à créer et lancer un business
 * RENTABLE — pas un outil pour « créer une entreprise ».
 *
 * Titres : 60 caractères au plus. Descriptions : 140 à 160.
 */
export interface PageSeoText {
  title: string;
  description: string;
  /** Nom court de la page dans le fil d'Ariane. */
  crumb: string;
  /** Texte alternatif de l'image de partage. */
  imageAlt: string;
  faq?: FaqEntry[];
  noindex?: boolean;
}

export function pageSeoText(id: LandingPageId, locale: 'fr' | 'en'): PageSeoText {
  switch (id) {
    case 'home':
      return {
        title: $localize`:@@seo.home.title:IDEM — The African AI that builds profitable businesses`,
        description: $localize`:@@seo.home.description:More than 500 AI agents to structure your project, manage your finances, create your brand, communication strategy and website, and deploy it in Africa.`,
        crumb: 'IDEM',
        imageAlt: $localize`:@@seo.home.imageAlt:IDEM — The African AI that builds profitable businesses. A baobab bearing fruit.`,
      };
    case 'pricing':
      return {
        title: $localize`:@@seo.pricing.title:IDEM pricing — Packs to launch a profitable business`,
        description: $localize`:@@seo.pricing.description:Create for free, pay only for what you keep, by Mobile Money: Business Kit 2,500 F, Launch Pack 5,000 F, IDEM Growth 3,000 F a month.`,
        crumb: $localize`:@@seo.pricing.crumb:Pricing`,
        imageAlt: $localize`:@@seo.pricing.imageAlt:IDEM pricing — Cowrie shells, the historic currency of West Africa.`,
      };
    case 'simulator':
      return {
        title: $localize`:@@seo.simulator.title:iSimulator — Is your business profitable? Test it first`,
        description: SERVICES.simulator.description[locale],
        crumb: 'iSimulator',
        imageAlt: $localize`:@@seo.simulator.imageAlt:iSimulator — Test profitability before you invest. An awalé board.`,
        faq: [
          {
            question: $localize`:@@simulation.faq.q1.question:Does iSimulator predict whether my business will succeed?`,
            answer: $localize`:@@simulation.faq.q1.answer:No. The results are estimates based on the data, assumptions and scenarios available at the time of analysis. A high index guarantees neither viability nor profitability, and a low index does not mean the project is impossible.`,
          },
          {
            question: $localize`:@@simulation.faq.q2.question:Do I need to have built my project in IDEM to run a simulation?`,
            answer: $localize`:@@simulation.faq.q2.answer:No. You can import an existing business plan as PDF, DOCX or plain text: IDEM extracts the activity, market, business model, prices and costs. Projects already built in IDEM get a reduced price, because the deliverables are already available.`,
          },
          {
            question: $localize`:@@simulation.faq.q3.question:What does the simulated viability index measure?`,
            answer: $localize`:@@simulation.faq.q3.answer:It measures how robust the model is across the scenarios that were run: how well it keeps holding as the factors deteriorate. It is always shown together with a confidence level and the list of main uncertainties.`,
          },
          {
            question: $localize`:@@simulation.faq.q4.question:Is simulation included in IDEM?`,
            answer: $localize`:@@simulation.faq.q4.answer:No, it is billed separately because it spends external research, several agents and compute. The amount is shown and confirmed before the run starts. The full report can be bought with the simulation or later.`,
          },
        ],
      };
    case 'icode':
      return {
        title: $localize`:@@seo.icode.title:iCode — AI website and app builder for your business`,
        description: SERVICES.icode.description[locale],
        crumb: 'iCode',
        imageAlt: $localize`:@@seo.icode.imageAlt:iCode — Your business website, written by AI. A weaving loom.`,
      };
    case 'ideploy':
      return {
        title: $localize`:@@seo.ideploy.title:iDeploy — One-click hosting on African servers`,
        description: SERVICES.ideploy.description[locale],
        crumb: 'iDeploy',
        imageAlt: $localize`:@@seo.ideploy.imageAlt:iDeploy — Put your business online in one click. A dugout canoe ready to sail.`,
      };
    case 'idomain':
      return {
        title: $localize`:@@seo.idomain.title:iDomain — Your name, online, in mobile money`,
        description: SERVICES.idomain.description[locale],
        crumb: 'iDomain',
        imageAlt: $localize`:@@seo.idomain.imageAlt:iDomain — Your name, online. A painted Ndebele facade, its plaque carrying the name.`,
      };
    case 'ivision':
      return {
        title: $localize`:@@seo.ivision.title:iVision — Say it, see it: videos and visuals`,
        description: SERVICES.ivision.description[locale],
        crumb: 'iVision',
        imageAlt: $localize`:@@seo.ivision.imageAlt:iVision — Say it, see it. The griot's kora, which tells its story in music.`,
      };
    case 'about':
      return {
        title: $localize`:@@seo.about.title:About IDEM — The African team behind your business`,
        description: $localize`:@@seo.about.description:IDEM was founded in Cameroon to help African entrepreneurs build and launch profitable businesses, with open-source AI hosted in Africa.`,
        crumb: $localize`:@@seo.about.crumb:About`,
        imageAlt: $localize`:@@seo.about.imageAlt:About IDEM — A palaver tree and its stools.`,
      };
    case 'open-source':
      return {
        title: $localize`:@@seo.openSource.title:Open source and data sovereignty`,
        description: $localize`:@@seo.openSource.description:IDEM is open source under the Apache 2.0 licence: your business, your code and your data stay yours, on servers in Africa.`,
        crumb: $localize`:@@seo.openSource.crumb:Open source`,
        imageAlt: $localize`:@@seo.openSource.imageAlt:IDEM open source — A granary door and the wooden lock you hold the key to.`,
      };
    case 'african-market':
      return {
        title: $localize`:@@seo.africanMarket.title:Built for African markets`,
        description: $localize`:@@seo.africanMarket.description:CFA francs, SYSCOHADA, OHADA and Mobile Money built in: IDEM helps entrepreneurs across Africa launch businesses that are profitable at home.`,
        crumb: $localize`:@@seo.africanMarket.crumb:African market`,
        imageAlt: $localize`:@@seo.africanMarket.imageAlt:IDEM for African markets — A market stall.`,
      };
    case 'blog':
      return {
        title: $localize`:@@seo.blog.title:IDEM blog — Articles and release notes`,
        description: $localize`:@@seo.blog.description:Product news, release notes and lessons from the team building IDEM, the AI that helps African entrepreneurs create profitable businesses.`,
        crumb: $localize`:@@seo.blog.crumb:Blog`,
        imageAlt: $localize`:@@seo.blog.imageAlt:The IDEM blog — A handwritten leaf and its reed pen.`,
      };
    case 'contact':
      return {
        title: $localize`:@@seo.contact.title:Contact IDEM — Let’s talk about your business`,
        description: $localize`:@@seo.contact.description:A question, a partnership or a project? Write to the IDEM team: we help entrepreneurs build and launch profitable businesses.`,
        crumb: $localize`:@@seo.contact.crumb:Contact`,
        imageAlt: $localize`:@@seo.contact.imageAlt:Contact IDEM — A talking drum.`,
      };
    case 'builders':
      return {
        title: $localize`:@@seo.builders.title:Idem Builders — African projects built with IDEM`,
        description: $localize`:@@seo.builders.description:Idem Builders showcases African projects run with IDEM, with visibility, a wallet bonus and lower hosting costs to help them grow profitably.`,
        crumb: 'Idem Builders',
        imageAlt: $localize`:@@seo.builders.imageAlt:Idem Builders — A commemorative printed cloth, its medallion stacked with mud bricks.`,
      };
    case 'builders-terms':
      return {
        title: $localize`:@@seo.buildersTerms.title:Idem Builders — Participation terms`,
        description: $localize`:@@seo.buildersTerms.description:The rules of the Idem Builders programme: who can apply, how applications are reviewed, the benefits granted, the showcase licence and how to leave.`,
        crumb: $localize`:@@seo.buildersTerms.crumb:Idem Builders terms`,
        imageAlt: $localize`:@@seo.legal.imageAlt:IDEM legal information — An Akan gold-weighing scale.`,
      };
    case 'builders-privacy':
      return {
        title: $localize`:@@seo.buildersPrivacy.title:Idem Builders — Privacy policy`,
        description: $localize`:@@seo.buildersPrivacy.description:What personal data the Idem Builders programme processes, why, what becomes public on the showcase, how long it is kept and how to exercise your rights.`,
        crumb: $localize`:@@seo.buildersPrivacy.crumb:Idem Builders privacy`,
        imageAlt: $localize`:@@seo.legal.imageAlt:IDEM legal information — An Akan gold-weighing scale.`,
      };
    case 'premium-beta':
      return {
        title: $localize`:@@seo.beta.title:IDEM premium beta — Launch your business with us`,
        description: $localize`:@@seo.beta.description:Join the IDEM premium beta: premium access, renewed credits and a direct line to the team while you build and launch your business.`,
        crumb: $localize`:@@seo.beta.crumb:Premium beta`,
        imageAlt: $localize`:@@seo.beta.imageAlt:IDEM premium beta — A key whose ring is the IDEM shield.`,
      };
    case 'privacy-policy':
      return {
        title: $localize`:@@seo.privacy.title:Privacy policy`,
        description: $localize`:@@seo.privacy.description:How IDEM collects, uses and protects your personal data and the information about your business, and the rights you keep over them.`,
        crumb: $localize`:@@seo.privacy.crumb:Privacy policy`,
        imageAlt: $localize`:@@seo.legal.imageAlt:IDEM legal information — An Akan gold-weighing scale.`,
      };
    case 'terms-of-service':
      return {
        title: $localize`:@@seo.terms.title:Terms of service`,
        description: $localize`:@@seo.terms.description:The terms that govern your use of IDEM and its services: IDEM Business, iSimulator, iCode and iDeploy.`,
        crumb: $localize`:@@seo.terms.crumb:Terms of service`,
        imageAlt: $localize`:@@seo.legal.imageAlt:IDEM legal information — An Akan gold-weighing scale.`,
      };
    case 'beta-policy':
      return {
        title: $localize`:@@seo.betaPolicy.title:Beta programme terms`,
        description: $localize`:@@seo.betaPolicy.description:What the IDEM beta includes, its limits and your commitments as a beta tester.`,
        crumb: $localize`:@@seo.betaPolicy.crumb:Beta terms`,
        imageAlt: $localize`:@@seo.legal.imageAlt:IDEM legal information — An Akan gold-weighing scale.`,
      };
    case 'simulation-terms':
      return {
        title: $localize`:@@seo.simulationTerms.title:iSimulator terms`,
        description: $localize`:@@seo.simulationTerms.description:What a simulated viability index is worth, how an imported business plan is processed, and what you accept before each simulation.`,
        crumb: $localize`:@@seo.simulationTerms.crumb:Simulator terms`,
        imageAlt: $localize`:@@seo.legal.imageAlt:IDEM legal information — An Akan gold-weighing scale.`,
      };
    case 'cookie-policy':
      return {
        title: $localize`:@@seo.cookiePolicy.title:Cookies and trackers`,
        description: $localize`:@@seo.cookiePolicy.description:Every cookie IDEM stores on your device, what it is for, how long it stays, and how to refuse the audience measurement on the public site.`,
        crumb: $localize`:@@seo.cookiePolicy.crumb:Cookies`,
        imageAlt: $localize`:@@seo.legal.imageAlt:IDEM legal information — An Akan gold-weighing scale.`,
      };
    case 'subprocessors':
      return {
        title: $localize`:@@seo.subprocessors.title:IDEM sub-processors`,
        description: $localize`:@@seo.subprocessors.description:Every third party that touches your data, what it receives, where it processes it, and whether it may train a model on it. The list is enforced by code.`,
        crumb: $localize`:@@seo.subprocessors.crumb:Sub-processors`,
        imageAlt: $localize`:@@seo.legal.imageAlt:IDEM legal information — An Akan gold-weighing scale.`,
      };
    case 'icode-privacy':
      return {
        title: $localize`:@@seo.icodePrivacy.title:iCode privacy`,
        description: $localize`:@@seo.icodePrivacy.description:What the iCode workshop adds on data: your GitHub repository, the container that runs your project, and the survey of a site you ask us to redesign.`,
        crumb: $localize`:@@seo.icodePrivacy.crumb:iCode privacy`,
        imageAlt: $localize`:@@seo.legal.imageAlt:IDEM legal information — An Akan gold-weighing scale.`,
      };
    case 'icode-terms':
      return {
        title: $localize`:@@seo.icodeTerms.title:iCode usage rules`,
        description: $localize`:@@seo.icodeTerms.description:What you may do with the iCode workshop, who owns the generated code, what the preview container may not be used for, and what is billed.`,
        crumb: $localize`:@@seo.icodeTerms.crumb:iCode rules`,
        imageAlt: $localize`:@@seo.legal.imageAlt:IDEM legal information — An Akan gold-weighing scale.`,
      };
    case 'ideploy-privacy':
      return {
        title: $localize`:@@seo.ideployPrivacy.title:iDeploy privacy`,
        description: $localize`:@@seo.ideployPrivacy.description:Your deployment secrets, your application logs, and your visitors' data: who is the controller, who the processor, and what the firewall sees.`,
        crumb: $localize`:@@seo.ideployPrivacy.crumb:iDeploy privacy`,
        imageAlt: $localize`:@@seo.legal.imageAlt:IDEM legal information — An Akan gold-weighing scale.`,
      };
    case 'ideploy-terms':
      return {
        title: $localize`:@@seo.ideployTerms.title:iDeploy hosting rules`,
        description: $localize`:@@seo.ideployTerms.description:What may run on IDEM machines, what triggers a suspension and in what order, what happens on non-payment, and how a complaint is handled.`,
        crumb: $localize`:@@seo.ideployTerms.crumb:iDeploy rules`,
        imageAlt: $localize`:@@seo.legal.imageAlt:IDEM legal information — An Akan gold-weighing scale.`,
      };
    case 'ivision-privacy':
      return {
        title: $localize`:@@seo.ivisionPrivacy.title:iVision privacy`,
        description: $localize`:@@seo.ivisionPrivacy.description:Your voice, the images you upload, the media we generate, and what publishing to a social network entails. Transcription runs on our own machines.`,
        crumb: $localize`:@@seo.ivisionPrivacy.crumb:iVision privacy`,
        imageAlt: $localize`:@@seo.legal.imageAlt:IDEM legal information — An Akan gold-weighing scale.`,
      };
    case 'ivision-terms':
      return {
        title: $localize`:@@seo.ivisionTerms.title:iVision usage rules`,
        description: $localize`:@@seo.ivisionTerms.description:Who owns the videos and visuals, why no real person's face or voice may be generated, and what iVision refuses to produce.`,
        crumb: $localize`:@@seo.ivisionTerms.crumb:iVision rules`,
        imageAlt: $localize`:@@seo.legal.imageAlt:IDEM legal information — An Akan gold-weighing scale.`,
      };
    case 'idomain-privacy':
      return {
        title: $localize`:@@seo.idomainPrivacy.title:iDomain privacy`,
        description: $localize`:@@seo.idomainPrivacy.description:Buying a domain means declaring a holder. Exactly which details leave IDEM, to whom, what becomes public, and what masking can and cannot hide.`,
        crumb: $localize`:@@seo.idomainPrivacy.crumb:iDomain privacy`,
        imageAlt: $localize`:@@seo.legal.imageAlt:IDEM legal information — An Akan gold-weighing scale.`,
      };
    case 'idomain-terms':
      return {
        title: $localize`:@@seo.idomainTerms.title:iDomain registration rules`,
        description: $localize`:@@seo.idomainTerms.description:What you are really buying, which registry rules bind us, why a registered name is not refundable, and what happens at expiry or on transfer.`,
        crumb: $localize`:@@seo.idomainTerms.crumb:iDomain rules`,
        imageAlt: $localize`:@@seo.legal.imageAlt:IDEM legal information — An Akan gold-weighing scale.`,
      };
    case 'isimulator-privacy':
      return {
        title: $localize`:@@seo.isimulatorPrivacy.title:iSimulator privacy`,
        description: $localize`:@@seo.isimulatorPrivacy.description:What happens to the business plan you import, what a market search sends out, and what remains after a run. Your figures never leave in a search query.`,
        crumb: $localize`:@@seo.isimulatorPrivacy.crumb:iSimulator privacy`,
        imageAlt: $localize`:@@seo.legal.imageAlt:IDEM legal information — An Akan gold-weighing scale.`,
      };
    case 'not-found':
      return {
        title: $localize`:@@seo.notFound.title:Page not found`,
        description: $localize`:@@seo.notFound.description:This page no longer exists. Head back home to build and launch your profitable business with IDEM.`,
        crumb: $localize`:@@seo.notFound.crumb:Page not found`,
        imageAlt: $localize`:@@seo.notFound.imageAlt:Page not found — Sankofa, the Akan bird that looks back.`,
        noindex: true,
      };
  }
}
