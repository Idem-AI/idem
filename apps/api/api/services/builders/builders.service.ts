import { isValidObjectId } from 'mongoose';
import logger from '../../config/logger';
import { BuilderApplication, BuilderApplicationDocument } from '../../schemas/builderApplication.schema';
import { projectService } from '../project.service';
import { journeyService } from '../journey/journey.service';
import { walletService } from '../billing/wallet.service';
import type { IdemAuthUser } from '../identity/identity.service';
import {
  BUILDERS_LEGAL_VERSION,
  BUILDERS_PROGRAM,
  BUILDER_BUILDING_SIGNALS,
  BUILDER_OPERATING_SIGNALS,
  BuilderProfile,
  BuilderShowcaseEntry,
  BuilderSignal,
  BuilderSignals,
  isBuilderEligible,
} from '../../../../../packages/shared-models/src/builders/program';
import { slugify } from '../blog.service';
import { BuildersError } from './builder-errors';
import { isOwnCover } from './builder-cover';
import { ProjectExcerpt, brandOf, cityOf, inlineLogo, loadProjectExcerpts, storyOf, teamOf } from './builder-profile';

/**
 * Idem Builders : candidature (console), décision (panel admin), vitrine (landing).
 *
 * **La condition d'entrée est vérifiée ici, pas seulement affichée.** Un projet
 * entre s'il est géré avec IDEM — en ligne par iDeploy, ou sa communication
 * tenue dans IDEM, ou son domaine pris par iDomain. Les faits sont ceux de la
 * boucle IDEM (`journeyService`) : ils disent déjà, pour les recommandations,
 * ce qu'un projet a fait dans chaque application. Les relire ailleurs donnerait
 * deux réponses à la même question.
 *
 * **Le panel décide, l'API accorde.** Comme pour la bêta, la validation passe
 * par un endpoint interne : c'est ici que vit le portefeuille, donc le bonus de
 * bienvenue. Le panel envoie ensuite lui-même l'e-mail de félicitations — et
 * peut le renvoyer sans reverser le bonus.
 */

export { BuildersError };

export interface BuilderEligibility {
  project: { id: string; name: string; description?: string; country?: string };
  signals: BuilderSignals;
  eligible: boolean;
  /** Adresse publique déjà connue (site ou application mis en ligne par iCode). */
  suggestedUrl?: string;
  /** Candidature déjà ouverte ou acceptée pour ce projet. */
  current?: Record<string, unknown>;
}

export interface BuilderDecision {
  application: object;
  /** Montant versé par cette validation (0 si déjà versé pour un autre projet). */
  welcomeBonusXaf: number;
  /** Faux quand la candidature était déjà acceptée : rien n'a été accordé de nouveau. */
  changed: boolean;
  program: typeof BUILDERS_PROGRAM;
}

const URL_MAX = 300;

/** L'adresse publique d'une fiche : le nom, puis la fin de l'identifiant (unique). */
function slugFor(projectName: string, id: string): string {
  const base = slugify(projectName || 'projet', 60) || 'projet';
  return `${base}-${id.slice(-6)}`.toLowerCase();
}

/**
 * Le nom public du porteur : son nom affiché, jamais une adresse e-mail (un
 * compte sans nom affiché garde parfois l'adresse à la place).
 */
function ownerName(displayName?: string): string | undefined {
  const name = String(displayName ?? '').trim();
  if (!name || name.includes('@')) return undefined;
  return name.slice(0, 80);
}

/** Le logo ancien (SVG en base) d'une fiche, servi par l'API. */
function logoPath(slug: string): string {
  return `/builders/projects/${slug}/logo.svg`;
}

/** Ce que le candidat voit de sa candidature : rien de ce que l'équipe garde pour elle. */
function forApplicant(doc: BuilderApplicationDocument | Record<string, any>): Record<string, unknown> {
  return {
    id: String(doc._id),
    projectId: doc.projectId,
    projectName: doc.projectName,
    pitch: doc.pitch,
    publicUrl: doc.publicUrl,
    status: doc.status,
    decidedAt: doc.decidedAt,
    decisionNote: doc.status === 'rejected' ? doc.decisionNote : undefined,
    welcomeBonusXaf: doc.welcomeBonusXaf,
    showcase: { visible: !!doc.showcase?.visible },
    slug: doc.status === 'approved' ? doc.slug : undefined,
    publication: { showTeam: !!doc.publication?.showTeam },
    coverUrl: doc.cover?.url,
    createdAt: doc.createdAt,
  };
}

/** Une adresse publique acceptable : http(s), courte, sans espace. */
function normalizeUrl(input: unknown): string | undefined {
  const raw = String(input ?? '').trim();
  if (!raw) return undefined;
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.') || candidate.length > URL_MAX) throw new Error();
    return url.toString();
  } catch {
    throw new BuildersError(400, 'INVALID_URL', "L'adresse du projet n'est pas valide.");
  }
}

function signalsFrom(facts: Partial<Record<string, boolean>>): BuilderSignals {
  const signals = {} as BuilderSignals;
  for (const key of [...BUILDER_OPERATING_SIGNALS, ...BUILDER_BUILDING_SIGNALS]) signals[key] = facts[key] === true;
  return signals;
}

export class BuildersService {
  // ── Candidat ─────────────────────────────────────────────────────────────

  /** Le projet peut-il entrer ? Ce qu'il a déjà, et ce qui lui manque. */
  async eligibility(userId: string, projectId: string): Promise<BuilderEligibility> {
    const project = await projectService.getUserProjectById(userId, projectId).catch(() => null);
    if (!project) throw new BuildersError(404, 'PROJECT_NOT_FOUND', 'Projet introuvable.');

    const [facts, site, app, current] = await Promise.all([
      journeyService.projectFacts(userId, projectId),
      projectService.getAppDeployment(userId, projectId, 'site').catch(() => null),
      projectService.getAppDeployment(userId, projectId, 'app').catch(() => null),
      BuilderApplication.findOne({ projectId, status: { $in: ['pending', 'approved'] } }).lean(),
    ]);

    const signals = signalsFrom(facts as unknown as Record<string, boolean>);
    return {
      project: {
        id: projectId,
        name: project.name,
        description: project.description,
        country: project.additionalInfos?.country || undefined,
      },
      signals,
      eligible: isBuilderEligible(signals),
      suggestedUrl: site?.url || app?.url || undefined,
      current: current ? forApplicant(current) : undefined,
    };
  }

  /** Dépose une candidature. La condition d'entrée est revérifiée au dépôt. */
  async apply(
    user: IdemAuthUser,
    input: {
      projectId?: unknown;
      pitch?: unknown;
      publicUrl?: unknown;
      acceptTerms?: unknown;
      termsVersion?: unknown;
      showTeam?: unknown;
      coverUrl?: unknown;
    },
    context: { ipAddress?: string; userAgent?: string } = {}
  ): Promise<Record<string, unknown>> {
    // Les conditions et la politique de confidentialité, dans la version en
    // vigueur : une console restée ouverte sur une version antérieure doit
    // faire relire les textes, pas enregistrer l'accord à un texte remplacé.
    if (input.acceptTerms !== true) {
      throw new BuildersError(400, 'TERMS_REQUIRED', 'Acceptez les conditions et la politique de confidentialité du programme.');
    }
    if (input.termsVersion !== BUILDERS_LEGAL_VERSION) {
      throw new BuildersError(409, 'TERMS_OUTDATED', 'Les conditions du programme ont changé : rechargez la page pour lire la nouvelle version.');
    }

    const projectId = String(input.projectId ?? '').trim();
    if (!projectId) throw new BuildersError(400, 'PROJECT_REQUIRED', 'Choisissez un projet.');

    const pitch = String(input.pitch ?? '').trim();
    if (pitch.length < BUILDERS_PROGRAM.pitchMinLength) {
      throw new BuildersError(400, 'PITCH_TOO_SHORT', `Présentez votre projet en ${BUILDERS_PROGRAM.pitchMinLength} caractères au moins.`);
    }
    if (pitch.length > BUILDERS_PROGRAM.pitchMaxLength) {
      throw new BuildersError(400, 'PITCH_TOO_LONG', `La présentation dépasse ${BUILDERS_PROGRAM.pitchMaxLength} caractères.`);
    }

    const check = await this.eligibility(user.uid, projectId);
    if (check.current) {
      throw new BuildersError(409, 'ALREADY_APPLIED', check.current.status === 'approved' ? 'Ce projet fait déjà partie du programme.' : 'Une candidature est déjà en cours pour ce projet.');
    }
    if (!check.eligible) {
      throw new BuildersError(422, 'NOT_ELIGIBLE', "Ce projet n'est pas encore géré avec IDEM : mettez-le en ligne ou tenez sa communication dans IDEM, puis revenez.");
    }

    const publicUrl = normalizeUrl(input.publicUrl) ?? check.suggestedUrl;
    // La couverture doit avoir été envoyée par ce compte (POST /builders/covers).
    const coverUrl = typeof input.coverUrl === 'string' && input.coverUrl ? input.coverUrl : undefined;
    if (coverUrl && !isOwnCover(user.uid, coverUrl)) {
      throw new BuildersError(400, 'COVER_INVALID', 'La couverture doit être envoyée depuis ce formulaire.');
    }
    const created = await BuilderApplication.create({
      userId: user.uid,
      email: user.email ?? '',
      displayName: user.name,
      projectId,
      projectName: check.project.name,
      projectDescription: check.project.description,
      country: check.project.country,
      pitch,
      publicUrl,
      signals: check.signals,
      consent: {
        version: BUILDERS_LEGAL_VERSION,
        acceptedAt: new Date(),
        ipAddress: context.ipAddress?.slice(0, 64),
        userAgent: context.userAgent?.slice(0, 300),
      },
      status: 'pending',
      showcase: { visible: true, featured: false, tagline: check.project.description?.slice(0, 200) },
      publication: { showTeam: input.showTeam === true },
      ...(coverUrl ? { cover: { url: coverUrl, uploadedAt: new Date() } } : {}),
    });
    created.slug = slugFor(check.project.name, String(created._id));
    await created.save();

    logger.info('builders.applied', { event: 'builders.applied', userId: user.uid, projectId, applicationId: String(created._id) });
    return forApplicant(created);
  }

  /** Les candidatures du compte, la plus récente d'abord. */
  async mine(
    userId: string
  ): Promise<{ applications: Record<string, unknown>[]; isBuilder: boolean; program: typeof BUILDERS_PROGRAM; legalVersion: string }> {
    const docs = await BuilderApplication.find({ userId }).sort({ createdAt: -1 }).limit(50).lean();
    return {
      applications: docs.map(forApplicant),
      isBuilder: docs.some((doc) => doc.status === 'approved'),
      program: BUILDERS_PROGRAM,
      legalVersion: BUILDERS_LEGAL_VERSION,
    };
  }

  // ── Public ───────────────────────────────────────────────────────────────

  /**
   * La vitrine : les projets acceptés, mis en avant d'abord, avec leur
   * identité de marque lue en direct sur le projet. L'équipe n'y figure que si
   * le candidat a choisi de la publier.
   */
  async showcase(limit = 60): Promise<BuilderShowcaseEntry[]> {
    const docs = await BuilderApplication.find({ status: 'approved', 'showcase.visible': true })
      .sort({ 'showcase.featured': -1, decidedAt: -1 })
      .limit(Math.min(Math.max(limit, 1), 120))
      .select('projectId projectName projectDescription country publicUrl showcase publication cover slug displayName decidedAt createdAt')
      .lean();

    const projects = await loadProjectExcerpts(docs.map((doc) => doc.projectId)).catch(() => new Map<string, ProjectExcerpt>());
    const entries: BuilderShowcaseEntry[] = [];
    for (const doc of docs) {
      const slug = await this.ensureSlug(doc);
      const project = projects.get(doc.projectId);
      const entry: BuilderShowcaseEntry = {
        ...this.publicBase(doc, slug),
        brand: brandOf(project, logoPath(slug)),
      };
      if (doc.publication?.showTeam) {
        const team = teamOf(project);
        if (team.length > 0) entry.team = team.slice(0, 4).map(({ name, pictureUrl }) => ({ name, pictureUrl }));
      }
      entries.push(entry);
    }
    return entries;
  }

  /** La page publique d'un projet admis, par son adresse. */
  async profile(slug: string): Promise<BuilderProfile> {
    const doc = await this.publicBySlug(slug);
    const project = (await loadProjectExcerpts([doc.projectId]).catch(() => new Map<string, ProjectExcerpt>())).get(doc.projectId);
    const builtWith = (Object.entries(doc.signals ?? {}) as [BuilderSignal, boolean][])
      .filter(([, value]) => value === true)
      .map(([key]) => key);

    return {
      ...this.publicBase(doc, doc.slug!),
      brand: brandOf(project, logoPath(doc.slug!)),
      city: cityOf(project),
      story: storyOf(project) ?? doc.projectDescription,
      pitch: doc.pitch,
      team: doc.publication?.showTeam ? teamOf(project) : [],
      builtWith,
    };
  }

  /** Le SVG d'un logo ancien, enregistré dans la base plutôt qu'en fichier. */
  async legacyLogo(slug: string): Promise<string> {
    const doc = await this.publicBySlug(slug);
    const project = (await loadProjectExcerpts([doc.projectId])).get(doc.projectId);
    const svg = inlineLogo(project);
    if (!svg) throw new BuildersError(404, 'NO_LOGO', 'Ce projet n’a pas de logo enregistré.');
    return svg;
  }

  private async publicBySlug(slug: string) {
    const clean = String(slug ?? '').trim().toLowerCase();
    if (!/^[a-z0-9-]{3,120}$/.test(clean)) throw new BuildersError(404, 'NOT_FOUND', 'Projet introuvable.');
    const doc = await BuilderApplication.findOne({ slug: clean, status: 'approved', 'showcase.visible': true }).lean();
    if (!doc) throw new BuildersError(404, 'NOT_FOUND', 'Projet introuvable.');
    return doc;
  }

  private publicBase(doc: Record<string, any>, slug: string): BuilderShowcaseEntry {
    return {
      id: String(doc._id),
      slug,
      projectName: doc.projectName,
      tagline: doc.showcase?.tagline || doc.projectDescription || '',
      country: doc.country || undefined,
      url: doc.publicUrl || undefined,
      featured: !!doc.showcase?.featured,
      since: (doc.decidedAt ?? doc.createdAt).toISOString(),
      coverUrl: doc.cover?.url || undefined,
      owner: ownerName(doc.displayName),
    };
  }

  /** Les candidatures d'avant les adresses publiques en reçoivent une à la première lecture. */
  private async ensureSlug(doc: Record<string, any>): Promise<string> {
    if (doc.slug) return doc.slug;
    const slug = slugFor(doc.projectName, String(doc._id));
    await BuilderApplication.updateOne({ _id: doc._id, slug: { $exists: false } }, { $set: { slug } }).catch(() => undefined);
    return slug;
  }

  // ── Panel admin ──────────────────────────────────────────────────────────

  private async load(id: string): Promise<BuilderApplicationDocument> {
    if (!isValidObjectId(id)) throw new BuildersError(400, 'INVALID_ID', 'Identifiant de candidature invalide.');
    const doc = await BuilderApplication.findById(id);
    if (!doc) throw new BuildersError(404, 'NOT_FOUND', 'Candidature introuvable.');
    return doc;
  }

  /**
   * Accepte une candidature et accorde ce qui s'accorde une fois.
   *
   * Idempotent : valider deux fois ne reverse rien. Le bonus de bienvenue est
   * versé à la **première** candidature acceptée du compte — un candidat qui
   * fait entrer trois projets ne le touche pas trois fois. Les deux autres
   * avantages (bonus de recharge, réduction d'hébergement) n'ont rien à
   * verser : ils s'appliquent tant qu'une candidature du compte est acceptée.
   */
  async approve(id: string, actor: string, input: { tagline?: unknown } = {}): Promise<BuilderDecision> {
    const doc = await this.load(id);
    if (doc.status === 'approved') {
      return { application: doc.toObject(), welcomeBonusXaf: 0, changed: false, program: BUILDERS_PROGRAM };
    }

    const other = await BuilderApplication.exists({ projectId: doc.projectId, status: { $in: ['pending', 'approved'] }, _id: { $ne: doc._id } });
    if (other) throw new BuildersError(409, 'PROJECT_ALREADY_IN_REVIEW', 'Une autre candidature est déjà ouverte ou acceptée pour ce projet.');

    const tagline = String(input.tagline ?? '').trim().slice(0, 200);
    // Le passage à « accepté » est conditionnel : deux clics simultanés n'en font qu'un.
    const updated = await BuilderApplication.findOneAndUpdate(
      { _id: doc._id, status: doc.status },
      {
        $set: { status: 'approved', decidedAt: new Date(), decidedBy: actor, ...(tagline ? { 'showcase.tagline': tagline } : {}) },
        $unset: { decisionNote: '', leftProgramAt: '' },
      },
      { new: true }
    );
    if (!updated) {
      const fresh = await this.load(id);
      return { application: fresh.toObject(), welcomeBonusXaf: 0, changed: false, program: BUILDERS_PROGRAM };
    }

    const welcomeBonusXaf = await this.grantWelcomeBonus(updated);

    logger.info('builders.approved', { event: 'builders.approved', applicationId: id, userId: updated.userId, actor, welcomeBonusXaf });
    const fresh = (await BuilderApplication.findById(id)) ?? updated;
    return { application: fresh.toObject(), welcomeBonusXaf, changed: true, program: BUILDERS_PROGRAM };
  }

  /** Le bonus de bienvenue, une fois par compte. */
  private async grantWelcomeBonus(doc: BuilderApplicationDocument): Promise<number> {
    const amount = BUILDERS_PROGRAM.welcomeBonusXaf;
    // Réserver d'abord, verser ensuite : la réservation conditionnelle échoue
    // si une autre candidature du compte a déjà touché le bonus.
    const alreadyPaid = await BuilderApplication.exists({ userId: doc.userId, welcomeBonusAt: { $exists: true } });
    if (alreadyPaid || amount <= 0) return 0;

    const reserved = await BuilderApplication.findOneAndUpdate(
      { _id: doc._id, welcomeBonusAt: { $exists: false } },
      { $set: { welcomeBonusAt: new Date(), welcomeBonusXaf: amount } },
      { new: true }
    );
    if (!reserved) return 0;

    try {
      await walletService.credit(doc.userId, amount, 'bonus', {
        action: 'builders_welcome',
        projectId: doc.projectId,
        note: `Bienvenue dans Idem Builders (+${amount} F)`,
      });
      return amount;
    } catch (error: any) {
      // Le versement a échoué : on libère la réservation pour qu'une nouvelle
      // validation le retente, plutôt que d'annoncer un bonus jamais versé.
      await BuilderApplication.updateOne({ _id: doc._id }, { $unset: { welcomeBonusAt: '', welcomeBonusXaf: '' } });
      logger.error(`builders.welcome_bonus_failed: ${error?.message}`, { event: 'builders.welcome_bonus_failed', userId: doc.userId });
      throw new BuildersError(502, 'WELCOME_BONUS_FAILED', "La candidature est acceptée, mais le bonus n'a pas pu être versé. Validez de nouveau pour le retenter.");
    }
  }

  /**
   * Refuse une candidature, ou retire du programme un projet accepté.
   *
   * Le motif est obligatoire : il est transmis au candidat, et « refusé » sans
   * raison ne lui dit pas quoi changer pour revenir. Un bonus de bienvenue déjà
   * versé n'est pas repris.
   */
  async reject(id: string, actor: string, note: unknown): Promise<Record<string, unknown>> {
    const reason = String(note ?? '').trim().slice(0, 1_000);
    if (reason.length < 10) throw new BuildersError(400, 'REASON_REQUIRED', 'Expliquez le refus en une phrase : le candidat la recevra.');

    const doc = await this.load(id);
    if (doc.status === 'rejected') return doc.toObject();

    if (doc.status === 'approved') doc.leftProgramAt = new Date();
    doc.status = 'rejected';
    doc.decidedAt = new Date();
    doc.decidedBy = actor;
    doc.decisionNote = reason;
    await doc.save();

    logger.info('builders.rejected', { event: 'builders.rejected', applicationId: id, userId: doc.userId, actor });
    return doc.toObject();
  }

  /** Présence sur la vitrine : visible, mise en avant, phrase d'accroche. */
  async updateShowcase(
    id: string,
    patch: { visible?: unknown; featured?: unknown; tagline?: unknown; removeCover?: unknown }
  ): Promise<Record<string, unknown>> {
    const doc = await this.load(id);
    // Modération : la couverture retirée, la vitrine revient à celle composée depuis la charte.
    if (patch.removeCover === true) doc.set('cover', undefined);
    if (typeof patch.visible === 'boolean') doc.showcase.visible = patch.visible;
    if (typeof patch.featured === 'boolean') doc.showcase.featured = patch.featured;
    if (typeof patch.tagline === 'string') doc.showcase.tagline = patch.tagline.trim().slice(0, 200);
    doc.markModified('showcase');
    await doc.save();
    return doc.toObject();
  }
}

export const buildersService = new BuildersService();
export default buildersService;
