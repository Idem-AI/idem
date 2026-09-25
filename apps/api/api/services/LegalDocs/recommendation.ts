import {
  LegalDocPriority,
  LegalDocRecommendation,
  LegalDocsContext,
  LegalDocumentType,
  LegalFormCode,
  LegalFormRecommendation,
  LegalJurisdiction,
  LegalReason,
  LegalRecommendations,
} from '../../models/legalDocs.model';
import { ProjectModel } from '../../models/project.model';
import { detectJurisdiction, getLegalForm, normalizeLegalForm } from './legalForms';

/**
 * Recommandations juridiques d'un projet : forme de société et documents.
 *
 * Tout est décidé ici, par des règles lisibles, et non par l'IA : le même
 * projet donne toujours la même recommandation, et chaque choix porte sa
 * raison en phrase simple, affichée telle quelle à l'utilisateur.
 */

/** Ce que l'on retient du projet pour décider. */
interface ProjectSignals {
  name: string;
  jurisdiction: LegalJurisdiction;
  solo: boolean;
  partnerCount: number;
  digital: boolean;
  hasWebsite: boolean;
  sellsOnline: boolean;
  tech: boolean;
  fundraising: boolean;
  regulatedSector: 'bank' | 'insurance' | null;
  publicListing: boolean;
  international: boolean;
  b2b: boolean;
  b2c: boolean;
  health: boolean;
  hiring: boolean;
  bigTeam: boolean;
}

const DIGITAL_TYPES = ['web', 'mobile', 'ai', 'api', 'blockchain', 'desktop', 'iot', 'landing', 'ecommerce'];
const TECH_TYPES = ['web', 'mobile', 'ai', 'api', 'blockchain', 'desktop', 'iot'];

const FUNDRAISING_RE =
  /invest|lev[ée]e de fonds|lever des fonds|fund ?rais|business angel|capital[- ]risque|venture|\bseed\b|start-?up|scale-?up|incubat|accélérat|accelerat/i;
const BANK_RE = /\bbanque|\bbank(ing)?\b|microfinance|micro-finance|\bemf\b|établissement de crédit/i;
const INSURANCE_RE = /assurance|insurance|réassurance|reinsurance/i;
const LISTING_RE = /\bbourse\b|stock exchange|\bipo\b|appel public [àa] l.[ée]pargne|cot(é|er) en bourse|brvm|bvmac/i;

function readSignals(project: ProjectModel, country?: string): ProjectSignals {
  const text = [project.description, project.longDescription, ...(project.constraints || [])]
    .filter(Boolean)
    .join(' ');
  const targets = (project.targets || '').toLowerCase();
  const teamSize = (project.teamSize || '').trim();
  const members = project.additionalInfos?.teamMembers?.filter((m) => m?.name?.trim()) || [];
  const partnerCount = Math.max(members.length, teamSize && teamSize !== '1' ? 2 : 1);
  const solo = teamSize === '1' || (!teamSize && members.length <= 1);
  const type = project.type || 'other';

  return {
    name: project.name || '',
    jurisdiction: detectJurisdiction(country || project.additionalInfos?.country).jurisdiction,
    solo,
    partnerCount: solo ? 1 : partnerCount,
    digital: DIGITAL_TYPES.includes(type),
    hasWebsite: DIGITAL_TYPES.includes(type) || type === 'enterprise',
    sellsOnline: type === 'ecommerce' || /e-?commerce|boutique en ligne|online shop|vente en ligne|marketplace/i.test(text),
    tech: TECH_TYPES.includes(type),
    fundraising: FUNDRAISING_RE.test(text),
    regulatedSector: BANK_RE.test(text) ? 'bank' : INSURANCE_RE.test(text) ? 'insurance' : null,
    publicListing: LISTING_RE.test(text),
    international: (project.scope || '').toLowerCase() === 'international',
    b2b: /business|government|entreprise|administration/.test(targets),
    b2c: /general-public|students|grand public|particulier/.test(targets) || type === 'ecommerce',
    health: /healthcare|santé|sante|health/.test(targets) || /\bsant[ée]\b|médical|medical|patient|clinique|clinic/i.test(text),
    hiring: ['2-5', '6-10', '10+'].includes(teamSize),
    bigTeam: ['6-10', '10+'].includes(teamSize),
  };
}

const r = (fr: string, en: string): LegalReason => ({ fr, en });

const TYPE_LABELS: Record<string, LegalReason> = {
  web: r('d’application web', 'web app'),
  mobile: r('d’application mobile', 'mobile app'),
  ai: r('d’intelligence artificielle', 'AI'),
  api: r('de plateforme technique', 'tech platform'),
  blockchain: r('blockchain', 'blockchain'),
  desktop: r('de logiciel', 'software'),
  iot: r('d’objets connectés', 'IoT'),
};

// ─────────────────────────────────────────────── Forme juridique

function recommendCivilForm(s: ProjectSignals, project: ProjectModel): LegalFormRecommendation {
  const reasons: LegalReason[] = [];

  if (s.regulatedSector || s.publicListing) {
    if (s.regulatedSector === 'bank') {
      reasons.push(r(
        'Votre projet touche à la banque ou à la microfinance : ces activités exigent la forme de société anonyme.',
        'Your project is in banking or microfinance: these activities require a public limited company.'
      ));
    } else if (s.regulatedSector === 'insurance') {
      reasons.push(r(
        'Votre projet touche à l’assurance : le secteur impose la forme de société anonyme.',
        'Your project is in insurance: the sector requires a public limited company.'
      ));
    } else {
      reasons.push(r(
        'Vous envisagez d’ouvrir votre capital au public ou à la bourse : seule la SA le permet.',
        'You plan to open your capital to the public or the stock market: only the SA allows it.'
      ));
    }
    reasons.push(r(
      'Prévoyez un capital d’au moins 10 000 000 FCFA et un commissaire aux comptes.',
      'Plan for at least 10,000,000 FCFA of capital and a statutory auditor.'
    ));
    return {
      code: 'sa',
      reasons,
      alternative: {
        code: s.solo ? 'sasu' : 'sas',
        reason: r(
          'Si l’activité réglementée n’est pas encore d’actualité, une SAS plus légère suffit pour démarrer.',
          'If the regulated activity is not on the table yet, a lighter SAS is enough to start.'
        ),
      },
    };
  }

  const growth = s.fundraising || s.tech || s.international;
  const typeLabel = TYPE_LABELS[project.type];

  if (s.solo) {
    reasons.push(r(
      'Vous portez le projet seul : une forme à associé unique vous évite de chercher un associé de façade.',
      'You are running the project alone: a single-member form spares you a nominee partner.'
    ));
    if (growth) {
      if (s.fundraising) {
        reasons.push(r(
          'Votre projet évoque des investisseurs : ils entrent bien plus facilement dans une SAS.',
          'Your project mentions investors: they come in far more easily in an SAS.'
        ));
      } else if (typeLabel) {
        reasons.push(r(
          `Un projet ${typeLabel.fr} vise souvent la croissance : la SASU accueille un investisseur sans changer de forme.`,
          `A ${typeLabel.en} project usually aims for growth: the SASU welcomes an investor without changing form.`
        ));
      }
      if (s.international) {
        reasons.push(r(
          'Votre ambition est internationale : la SAS est la forme la plus lisible pour des partenaires étrangers.',
          'Your ambition is international: the SAS is the form foreign partners read most easily.'
        ));
      }
      reasons.push(r(
        'Vos biens personnels restent protégés : vous ne risquez que ce que vous apportez.',
        'Your personal assets stay protected: you only risk what you put in.'
      ));
      return {
        code: 'sasu',
        reasons: reasons.slice(0, 4),
        alternative: {
          code: 'sarlu',
          reason: r(
            'Si vous ne comptez pas lever de fonds, la SARLU est plus simple à gérer.',
            'If you do not plan to raise funds, the SARLU is simpler to run.'
          ),
        },
      };
    }
    reasons.push(r(
      'Une structure simple à gérer, adaptée à une activité stable.',
      'A structure that is simple to run, suited to a steady business.'
    ));
    reasons.push(r(
      'Vos biens personnels restent protégés, et vous passerez en SARL le jour où un associé vous rejoint.',
      'Your personal assets stay protected, and you switch to a SARL the day a partner joins.'
    ));
    return {
      code: 'sarlu',
      reasons,
      alternative: {
        code: 'ei',
        reason: r(
          'Pour tester une petite activité avant de créer une société, l’entreprise individuelle suffit.',
          'To test a small activity before creating a company, a sole proprietorship is enough.'
        ),
      },
    };
  }

  const who = s.partnerCount > 2 ? `${s.partnerCount}` : 'plusieurs';
  const whoEn = s.partnerCount > 2 ? `${s.partnerCount}` : 'several';

  if (growth) {
    reasons.push(r(
      `Vous êtes ${who} à porter le projet et vous visez la croissance : la SAS laisse fixer vos propres règles.`,
      `You are ${whoEn} founders aiming for growth: the SAS lets you set your own rules.`
    ));
    if (s.fundraising) {
      reasons.push(r(
        'Votre projet évoque des investisseurs : c’est la forme qu’ils attendent.',
        'Your project mentions investors: it is the form they expect.'
      ));
    } else if (typeLabel) {
      reasons.push(r(
        `C’est la forme de référence des startups et des projets ${typeLabel.fr}.`,
        `It is the standard form for startups and ${typeLabel.en} projects.`
      ));
    }
    if (s.international) {
      reasons.push(r(
        'Votre ambition est internationale : la SAS est la plus lisible pour des partenaires étrangers.',
        'Your ambition is international: the SAS is the easiest for foreign partners to read.'
      ));
    }
    reasons.push(r(
      'Le capital est libre : vous démarrez avec le montant qui vous convient.',
      'Capital is free: you start with the amount that suits you.'
    ));
    return {
      code: 'sas',
      reasons: reasons.slice(0, 4),
      alternative: {
        code: 'sarl',
        reason: r(
          'Si vous ne comptez pas lever de fonds, la SARL est plus simple et plus encadrée.',
          'If you do not plan to raise funds, the SARL is simpler and more framed.'
        ),
      },
    };
  }

  reasons.push(r(
    `Vous êtes ${who} à porter le projet : la SARL encadre simplement les rapports entre associés.`,
    `You are ${whoEn} partners: the SARL frames your relationship simply.`
  ));
  reasons.push(r(
    'C’est la forme que banques et administrations connaissent le mieux en Afrique francophone.',
    'It is the form banks and administrations know best in French-speaking Africa.'
  ));
  reasons.push(r(
    'Peu de capital exigé, et chacun ne risque que ce qu’il apporte.',
    'Little capital required, and everyone only risks what they put in.'
  ));
  return {
    code: 'sarl',
    reasons,
    alternative: {
      code: 'sas',
      reason: r(
        'Si vous prévoyez d’accueillir des investisseurs, la SAS sera plus souple.',
        'If you plan to welcome investors, the SAS will be more flexible.'
      ),
    },
  };
}

function recommendCommonLawForm(s: ProjectSignals): LegalFormRecommendation {
  if (s.publicListing || s.regulatedSector) {
    return {
      code: 'plc',
      reasons: [
        s.publicListing
          ? r(
              'Vous envisagez d’ouvrir votre capital au public : seule la PLC le permet.',
              'You plan to offer shares to the public: only a PLC allows it.'
            )
          : r(
              'Votre secteur est réglementé : les autorités attendent une société publique.',
              'Your sector is regulated: authorities expect a public company.'
            ),
        r('Prévoyez un capital plus élevé et des comptes audités.', 'Plan for higher capital and audited accounts.'),
      ],
      alternative: {
        code: 'ltd',
        reason: r('Pour démarrer plus légèrement, une Ltd suffit.', 'To start lighter, a Ltd is enough.'),
      },
    };
  }
  const reasons = [
    r(
      'La Ltd est la forme standard dans votre pays : banques, clients et investisseurs la connaissent.',
      'The Ltd is the standard form in your country: banks, clients and investors know it.'
    ),
    s.solo
      ? r('Elle fonctionne avec un seul actionnaire : vous.', 'It works with a single shareholder: you.')
      : r(
          'Elle répartit clairement les actions entre les fondateurs.',
          'It splits shares clearly between the founders.'
        ),
    r(
      'Vos biens personnels restent protégés : vous ne risquez que vos apports.',
      'Your personal assets stay protected: you only risk your contribution.'
    ),
  ];
  return {
    code: 'ltd',
    reasons,
    alternative: s.solo && !s.tech && !s.fundraising
      ? {
          code: 'sole_trader',
          reason: r(
            'Pour tester une petite activité seul, le statut de sole trader suffit.',
            'To test a small activity alone, sole trader status is enough.'
          ),
        }
      : undefined,
  };
}

export function recommendLegalForm(project: ProjectModel, country?: string): LegalFormRecommendation {
  const s = readSignals(project, country);
  return s.jurisdiction === 'common_law' ? recommendCommonLawForm(s) : recommendCivilForm(s, project);
}

// ─────────────────────────────────────────────── Documents

function doc(type: LegalDocumentType, priority: LegalDocPriority, reason: LegalReason): LegalDocRecommendation {
  return { type, priority, reason };
}

export function recommendDocuments(
  project: ProjectModel,
  formCode: LegalFormCode,
  country?: string
): LegalDocRecommendation[] {
  const s = readSignals(project, country);
  const form = getLegalForm(formCode);
  const singlePartner = form?.partners === 'single' || s.solo;
  const out: LegalDocRecommendation[] = [];

  // Statuts
  if (form && !form.hasStatutes) {
    out.push(doc('statuts', 'not_applicable', r(
      `Une ${form.nameFr.toLowerCase()} n’a pas de statuts : vous exercez en votre nom.`,
      `A ${form.nameEn.toLowerCase()} has no articles: you trade under your own name.`
    )));
  } else {
    out.push(doc('statuts', 'essential', r(
      'Indispensables pour immatriculer la société : sans statuts, pas d’entreprise.',
      'Required to register the company: no articles, no company.'
    )));
  }

  // Pacte d'associés
  if (singlePartner || (form && !form.hasStatutes)) {
    out.push(doc('pacte_associes', 'not_applicable', r(
      'Un pacte se signe entre plusieurs associés ; vous êtes seul pour l’instant.',
      'An agreement is signed between several partners; you are alone for now.'
    )));
  } else if (s.fundraising) {
    out.push(doc('pacte_associes', 'essential', r(
      'Avant d’accueillir des investisseurs, fixez entre fondateurs qui décide et ce qui se passe si l’un part.',
      'Before welcoming investors, agree between founders who decides and what happens if one leaves.'
    )));
  } else {
    out.push(doc('pacte_associes', 'recommended', r(
      'Vous êtes plusieurs : le pacte règle à l’avance les désaccords et le départ d’un associé.',
      'There are several of you: the agreement settles disagreements and a partner leaving in advance.'
    )));
  }

  // CGU
  if (s.digital && project.type !== 'landing') {
    out.push(doc('cgu', 'essential', r(
      'Vos utilisateurs créent un compte ou utilisent un service en ligne : ils doivent accepter des règles.',
      'Your users sign up or use an online service: they must accept rules.'
    )));
  } else {
    out.push(doc('cgu', 'optional', r(
      'Utile seulement si vous ouvrez un espace en ligne à vos utilisateurs.',
      'Only useful if you open an online space to your users.'
    )));
  }

  // Politique de confidentialité
  if (s.health) {
    out.push(doc('privacy_policy', 'essential', r(
      'Vous traitez des données de santé, les plus protégées par la loi.',
      'You handle health data, the most protected by law.'
    )));
  } else if (s.digital) {
    out.push(doc('privacy_policy', 'essential', r(
      'Vous collectez des données personnelles en ligne : la loi exige d’informer vos utilisateurs.',
      'You collect personal data online: the law requires you to inform your users.'
    )));
  } else {
    out.push(doc('privacy_policy', 'recommended', r(
      'Dès que vous gardez un fichier clients, vous devez dire ce que vous en faites.',
      'As soon as you keep a customer file, you must say what you do with it.'
    )));
  }

  // Mentions légales
  out.push(
    s.hasWebsite
      ? doc('legal_mentions', 'essential', r(
          'Obligatoires sur tout site professionnel : qui édite, qui héberge.',
          'Required on any business website: who publishes, who hosts.'
        ))
      : doc('legal_mentions', 'optional', r(
          'À prévoir le jour où vous mettez un site en ligne.',
          'To plan for the day you put a website online.'
        ))
  );

  // CGV
  if (s.sellsOnline) {
    out.push(doc('cgv', 'essential', r(
      'Vous vendez en ligne : prix, livraison et retours doivent être écrits.',
      'You sell online: prices, delivery and returns must be written down.'
    )));
  } else if (s.b2c) {
    out.push(doc('cgv', 'recommended', r(
      'Vous vendez au grand public : des conditions claires évitent les litiges.',
      'You sell to the general public: clear terms prevent disputes.'
    )));
  } else {
    out.push(doc('cgv', 'optional', r(
      'Utile si vous vendez directement des produits ou des services.',
      'Useful if you sell products or services directly.'
    )));
  }

  // Contrat de prestation
  out.push(
    s.b2b
      ? doc('service_contract', 'recommended', r(
          'Vos clients sont des entreprises ou des administrations : chaque mission doit être encadrée.',
          'Your clients are businesses or administrations: every job must be framed.'
        ))
      : doc('service_contract', 'optional', r(
          'Utile si vous réalisez des missions pour d’autres entreprises.',
          'Useful if you carry out jobs for other businesses.'
        ))
  );

  // NDA
  out.push(
    s.fundraising || s.b2b || ['ai', 'blockchain'].includes(project.type)
      ? doc('nda', 'recommended', r(
          s.fundraising
            ? 'Vous allez présenter le projet à des investisseurs : protégez ce que vous partagez.'
            : 'Vous partagerez des informations sensibles avec des partenaires : protégez-les.',
          s.fundraising
            ? 'You will pitch the project to investors: protect what you share.'
            : 'You will share sensitive information with partners: protect it.'
        ))
      : doc('nda', 'optional', r(
          'Utile avant de partager une idée ou un savoir-faire avec un tiers.',
          'Useful before sharing an idea or know-how with a third party.'
        ))
  );

  // Contrat de travail
  out.push(
    s.bigTeam
      ? doc('employment_contract', 'recommended', r(
          'Votre équipe dépasse 5 personnes : chaque salarié a besoin d’un contrat écrit.',
          'Your team is over 5 people: every employee needs a written contract.'
        ))
      : doc('employment_contract', 'optional', r(
          s.hiring ? 'À prévoir dès votre premier recrutement salarié.' : 'À prévoir le jour où vous embauchez.',
          s.hiring ? 'To plan from your first salaried hire.' : 'To plan the day you hire.'
        ))
  );

  // Règlement intérieur
  out.push(
    project.teamSize === '10+'
      ? doc('internal_regulations', 'recommended', r(
          'Avec plus de 10 personnes, des règles communes écrites deviennent nécessaires.',
          'With more than 10 people, written shared rules become necessary.'
        ))
      : doc('internal_regulations', 'optional', r(
          'Utile quand l’équipe grandit.',
          'Useful as the team grows.'
        ))
  );

  const order: Record<LegalDocPriority, number> = { essential: 0, recommended: 1, optional: 2, not_applicable: 3 };
  return out.sort((a, b) => order[a.priority] - order[b.priority]);
}

// ─────────────────────────────────────────────── Pré-remplissage

/** Contexte déduit du projet : l'utilisateur n'a plus qu'à vérifier. */
export function prefillContext(project: ProjectModel, saved?: LegalDocsContext): LegalDocsContext {
  const info = project.additionalInfos;
  const country = saved?.country || info?.country || '';
  const detected = detectJurisdiction(country);
  const headOffice = [info?.address, info?.zipCode, info?.city].filter((v) => v && v.trim()).join(', ');
  const founders = (info?.teamMembers || [])
    .filter((m) => m?.name?.trim())
    .map((m) => ({ name: m.name.trim(), role: m.role || '', shares: '' }));

  return {
    country,
    ohadaZone: detected.jurisdiction === 'ohada',
    legalForm: normalizeLegalForm(saved?.legalForm) || '',
    capital: saved?.capital || '',
    currency: saved?.currency || project.currency || detected.currency || 'XAF',
    headOffice: saved?.headOffice || headOffice,
    companyEmail: saved?.companyEmail || info?.email || '',
    companyPhone: saved?.companyPhone || info?.phone || '',
    website: saved?.website || '',
    activityDescription: saved?.activityDescription || project.description || '',
    founders: saved?.founders?.length ? saved.founders : founders,
    additionalClauses: saved?.additionalClauses,
  };
}

export function buildRecommendations(project: ProjectModel, saved?: LegalDocsContext): LegalRecommendations {
  const prefill = prefillContext(project, saved);
  const jurisdiction = detectJurisdiction(prefill.country).jurisdiction;
  const form = recommendLegalForm(project, prefill.country);
  const chosen = getLegalForm(prefill.legalForm)?.code;
  return {
    jurisdiction,
    form,
    documents: recommendDocuments(project, chosen || form.code, prefill.country),
    prefill,
  };
}
