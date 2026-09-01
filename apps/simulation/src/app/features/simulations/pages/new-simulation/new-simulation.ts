import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '@env';

import { AuthService } from '../../../../core/auth';
import { ToastService } from '../../../../core/ui/toast.service';
import { SignInDialog } from '../../../auth/components/sign-in-dialog/sign-in-dialog';
import { DisclaimerNote } from '../../../../shared/components/disclaimer-note/disclaimer-note';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { SimulationGateway, SimulationStore } from '../../data-access';
import { canStashFile, saveDraft, takeDraft } from './new-run-draft';

/** Les seuls formats acceptés par l'API : PDF, Word et Markdown. */
const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.md', '.markdown'];
import {
  KnowledgeState,
  ProjectUnderstanding,
  SimulationConsent,
  SimulationOrigin,
  SimulationPlan,
  SimulationPricing,
  SimulationTier,
  groupKnowledge,
} from '../../models';

type Step = 'source' | 'analysis' | 'plan';

/**
 * The three things that must happen before a run is billed: pick the project,
 * agree on what the engine actually knows about it, and confirm the price.
 *
 * Analysis deliberately comes before payment. The user sees the gaps in their
 * own project before spending anything.
 *
 * C'est aussi la seule page publique du produit : on choisit sa source, et on
 * téléverse son business plan, sans compte. La connexion n'est demandée qu'à
 * l'action qui en a réellement besoin — lister ses projets IDEM, ou lancer
 * l'analyse — et le brouillon est mis de côté le temps de l'aller-retour.
 */
@Component({
  selector: 'sim-new-simulation',
  imports: [FormsModule, RouterLink, TranslatePipe, PageHeader, DisclaimerNote, SignInDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './new-simulation.html',
})
export class NewSimulation {
  private readonly gateway = inject(SimulationGateway);
  private readonly store = inject(SimulationStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toasts = inject(ToastService);
  private readonly auth = inject(AuthService);
  private readonly translate = inject(TranslateService);

  protected readonly step = signal<Step>('source');
  protected readonly origin = signal<SimulationOrigin>('idem-project');

  /**
   * Vrai une fois la source choisie. Rien n'est présélectionné : l'accueil
   * pose une question, et n'affiche la suite qu'une fois qu'on y a répondu.
   */
  protected readonly sourceChosen = signal(false);

  protected readonly authenticated = this.auth.isAuthenticated;
  /** Vrai tant que la session n'a pas été tranchée : ni connecté, ni anonyme. */
  protected readonly sessionPending = computed(() => this.auth.status() === 'initialising');
  /** Clé expliquant pourquoi la connexion est demandée ; null = pas de dialogue. */
  protected readonly signInReason = signal<string | null>(null);

  protected readonly projects = this.store.projects;
  /**
   * Vrai tant que la liste n'a pas été rendue : `idle` signifie « pas encore
   * demandée », ce qui n'est pas la même chose qu'un compte sans projet.
   */
  protected readonly projectsPending = computed(() => {
    const status = this.store.projectsStatus();
    return status === 'idle' || status === 'loading';
  });
  protected readonly selectedProjectId = signal<string | null>(null);
  protected readonly selectedFile = signal<File | null>(null);
  /**
   * Refus du document, en clair. L'API dit pourquoi — format non géré, fichier
   * illisible, ou document qui n'est pas un business plan — et ce motif reste
   * sous la zone de dépôt, là où l'utilisateur agit.
   */
  protected readonly documentError = signal<string | null>(null);

  protected readonly understanding = signal<ProjectUnderstanding | null>(null);
  protected readonly analysing = signal(false);
  protected readonly answers = signal<Record<string, string>>({});

  /**
   * Bêta produit : les tarifs restent à l'écran, barrés, et l'exécution est
   * annoncée gratuite. Le drapeau vient de l'environnement — `IS_BETA` — pour
   * que la sortie de bêta soit un redéploiement, pas une modification de code.
   */
  protected readonly isBeta = environment.isBeta;

  protected readonly pricing = signal<SimulationPricing | null>(null);
  protected readonly selectedTier = signal<SimulationTier>('pack');
  protected readonly launching = signal(false);

  /**
   * L'accord, redemandé à chaque lancement.
   *
   * Une simulation lit le projet — ou le business plan téléversé —, en crée le
   * projet IDEM correspondant et confie un extrait à plusieurs moteurs d'IA.
   * Ce n'est pas couvert par l'acceptation faite une fois à la création du
   * compte : les cases repartent donc vides à chaque exécution, et l'API refuse
   * le lancement sans elles.
   */
  protected readonly privacyAccepted = signal(false);
  protected readonly simulationTermsAccepted = signal(false);
  protected readonly betaAccepted = signal(false);

  /** Les documents à cocher, dans l'ordre où ils se lisent. */
  protected readonly consentDocuments: readonly {
    key: 'privacy' | 'simulationTerms' | 'beta';
    path: string;
  }[] = [
    { key: 'privacy', path: '/privacy-policy' },
    { key: 'simulationTerms', path: '/simulation-terms' },
    { key: 'beta', path: '/beta-policy' },
  ];

  /** Vrai quand tout ce qui est exigé est coché. La bêta ajoute sa politique. */
  protected readonly consentComplete = computed(
    () =>
      this.privacyAccepted() &&
      this.simulationTermsAccepted() &&
      (!this.isBeta || this.betaAccepted()),
  );

  protected readonly selectedProject = computed(() =>
    this.projects().find((project) => project.id === this.selectedProjectId()) ?? null,
  );

  protected readonly canAnalyse = computed(() => {
    if (!this.sourceChosen()) {
      return false;
    }
    return this.origin() === 'idem-project' ? !!this.selectedProjectId() : !!this.selectedFile();
  });

  /**
   * Grouped so the four states read as four different kinds of claim.
   *
   * « Ce que nous savons » ne retient que ce qui est écrit dans la source : une
   * estimation du moteur y voisinait avec une ligne du business plan, sans que
   * rien ne les distingue à l'écran.
   */
  protected readonly knowledgeGroups = computed(() =>
    groupKnowledge(this.understanding()?.items ?? []),
  );

  /**
   * Ce que la source dit et qu'aucun champ du profil n'accueille — un contrat
   * signé, une saisonnalité, une subvention. Affiché tel quel, et repris dans
   * le contexte de la simulation.
   */
  protected readonly extras = computed(() => this.understanding()?.extras ?? []);

  /** Declared here rather than inline in the template so both stay typed. */
  protected readonly steps: readonly { id: Step; index: number }[] = [
    { id: 'source', index: 1 },
    { id: 'analysis', index: 2 },
    { id: 'plan', index: 3 },
  ];

  /** Profile rows, skipping whatever the analysis could not fill in. */
  protected readonly profileRows = computed<readonly { labelKey: string; value: string }[]>(() => {
    const profile = this.understanding()?.profile;
    if (!profile) {
      return [];
    }
    const rows: { labelKey: string; value: string | undefined }[] = [
      { labelKey: 'profile.sector', value: profile.sector },
      { labelKey: 'profile.businessModel', value: profile.businessModel },
      { labelKey: 'profile.targetCustomer', value: profile.targetCustomer },
      { labelKey: 'profile.market', value: profile.market },
      { labelKey: 'profile.location', value: `${profile.location}, ${profile.country}` },
      { labelKey: 'profile.pricePoint', value: profile.pricePoint },
      { labelKey: 'profile.plannedFunding', value: profile.plannedFunding },
      { labelKey: 'profile.teamSize', value: profile.teamSize },
    ];
    return rows.filter((row): row is { labelKey: string; value: string } => !!row.value);
  });

  protected readonly openQuestions = computed(() =>
    (this.understanding()?.items ?? []).filter((item) => item.answerable),
  );

  /** Le document ne tiendra pas dans le brouillon : l'utilisateur est prévenu. */
  protected readonly draftAtRisk = computed(() => !canStashFile(this.selectedFile()));

  constructor() {
    // Page publique, hors de la coquille de l'espace de travail : personne
    // n'a résolu la session ni chargé les projets avant d'arriver ici.
    void this.loadProjects();
    // Retour du login : on reprend la source choisie avant le départ.
    void this.restoreDraft();

    // On choisit la sélection de départ dès que la liste arrive.
    effect(() => {
      const projects = this.projects();
      untracked(() => {
        // Un plan importé ne se rattache à aucun projet : rien à présélectionner.
        if (this.origin() !== 'idem-project' || this.selectedProjectId() || !projects.length) {
          return;
        }
        // Arrivée depuis le bouton « Simuler mon entreprise » du dashboard.
        const requested = this.route.snapshot.queryParamMap.get('projectId');
        const preselected =
          (requested && projects.some((project) => project.id === requested) && requested) ||
          this.store.projectId();
        this.selectedProjectId.set(
          preselected && projects.some((project) => project.id === preselected)
            ? preselected
            : projects[0].id,
        );
      });
    });
  }

  protected chooseOrigin(origin: SimulationOrigin): void {
    this.origin.set(origin);
    this.sourceChosen.set(true);
    // Lister ses projets IDEM demande l'identité : autant le dire au moment du
    // choix plutôt que de laisser l'utilisateur devant une liste vide.
    if (origin === 'idem-project') {
      void this.requireSignIn('signIn.reason.projects');
    }
  }

  /** Ouvre le dialogue depuis l'encart de la liste de projets. */
  protected askToSignIn(reason: string): void {
    this.signInReason.set(reason);
  }

  /**
   * Départ vers le login. Le brouillon part d'abord au stockage de session :
   * la connexion quitte la page, et le business plan téléversé ne doit pas
   * partir avec elle.
   */
  protected async confirmSignIn(): Promise<void> {
    await saveDraft({
      origin: this.origin(),
      projectId: this.selectedProjectId(),
      file: this.selectedFile(),
    });
    this.auth.redirectToLogin('/simulations/new', { force: true });
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.documentError.set(null);

    // Le format est vérifié avant l'envoi : inutile de faire monter un fichier
    // de plusieurs mégaoctets pour se le voir refuser.
    if (file && !ACCEPTED_EXTENSIONS.some((extension) => file.name.toLowerCase().endsWith(extension))) {
      this.selectedFile.set(null);
      this.documentError.set(this.translate.instant('newRun.source.unsupportedFormat') as string);
      return;
    }

    this.selectedFile.set(file);
  }

  protected async analyse(): Promise<void> {
    if (!this.canAnalyse()) {
      return;
    }
    // Première action qui touche l'API : c'est ici que le compte devient
    // nécessaire, pas avant.
    if (await this.requireSignIn('signIn.reason.analyse')) {
      return;
    }

    this.analysing.set(true);
    this.documentError.set(null);
    this.step.set('analysis');
    try {
      let understanding: ProjectUnderstanding;

      if (this.origin() === 'idem-project') {
        const projectId = this.selectedProjectId();
        if (!projectId) {
          throw new Error(this.translate.instant('newRun.noProject') as string);
        }
        understanding = await firstValueFrom(this.gateway.analyseProject(projectId));
      } else {
        // Un business plan importé ne dépend d'aucun projet : celui-ci sera
        // créé au lancement, à partir de ce que cette lecture livre.
        understanding = await firstValueFrom(
          this.gateway.analyseDocument(this.selectedFile() as File),
        );
      }

      this.understanding.set(understanding);
    } catch (error) {
      this.step.set('source');
      const rejection = documentRejection(error);
      if (rejection) {
        // Le document est en cause : le motif s'affiche là où l'on choisit le
        // fichier, pas dans une notification qui disparaît.
        this.documentError.set(rejection);
      } else {
        // Panne côté service : le message de l'API est déjà écrit pour
        // l'utilisateur, on ne le double pas d'un détail technique.
        this.toasts.error(
          this.translate.instant('newRun.analysisFailed') as string,
          serverMessage(error) ?? undefined,
        );
      }
    } finally {
      this.analysing.set(false);
    }
  }

  /**
   * L'intitulé de la catégorie « ce que nous savons » dépend de la source :
   * pour un plan importé, la phrase doit nommer le document, sans quoi elle
   * décrit une provenance que l'utilisateur n'a pas choisie.
   */
  protected knowledgeHintKey(state: KnowledgeState): string {
    if (state === 'known') {
      return this.origin() === 'imported-document'
        ? 'knowledgeHint.knownDocument'
        : 'knowledgeHint.knownProject';
    }
    return `knowledgeHint.${state}`;
  }

  protected setAnswer(itemId: string, value: string): void {
    this.answers.update((current) => ({ ...current, [itemId]: value }));
  }

  protected async goToPlan(): Promise<void> {
    this.step.set('plan');
    if (this.pricing()) {
      return;
    }
    const fromProject = this.origin() === 'idem-project';
    const projectId = this.selectedProjectId();
    if (fromProject && !projectId) {
      return;
    }
    try {
      const pricing = await firstValueFrom(
        this.gateway.getPricing(this.origin(), fromProject ? (projectId as string) : undefined),
      );
      this.pricing.set(pricing);
      this.selectedTier.set(
        pricing.plans.find((plan) => plan.recommended)?.tier ?? pricing.plans[0].tier,
      );
    } catch (error) {
      this.toasts.error(
        this.translate.instant('newRun.pricingFailed') as string,
        error instanceof Error ? error.message : undefined,
      );
    }
  }

  protected async launch(): Promise<void> {
    if (await this.requireSignIn('signIn.reason.launch')) {
      return;
    }
    const understanding = this.understanding();
    const fromProject = this.origin() === 'idem-project';
    const projectId = this.selectedProjectId();
    if ((fromProject && !projectId) || !understanding || !this.consentComplete()) {
      return;
    }

    const consent: SimulationConsent = {
      privacyPolicyAccepted: this.privacyAccepted(),
      simulationTermsAccepted: this.simulationTermsAccepted(),
      betaPolicyAccepted: this.betaAccepted(),
    };

    this.launching.set(true);
    try {
      const simulation = fromProject
        ? await this.store.create({
            name: this.runName(),
            origin: 'idem-project',
            // Le projet choisi ici devient le projet actif : tous les écrans
            // de l'exécution en dépendent.
            projectId: this.selectProjectAndReturn(projectId as string),
            tier: this.selectedTier(),
            answers: this.answers(),
            // La lecture que l'utilisateur vient de valider. Sans elle, le
            // moteur relisait le projet au lancement : un second appel, dont
            // le résultat pouvait ne plus correspondre à l'écran approuvé.
            understanding,
            consent,
          })
        : // Le plan importé n'a pas de projet : l'API crée celui que le
          // document décrit, puis simule dessus.
          await this.store.createFromDocument({
            name: this.runName(),
            tier: this.selectedTier(),
            documentName: this.selectedFile()?.name,
            answers: this.answers(),
            understanding,
            consent,
          });

      await this.router.navigate(['/simulations', simulation.id]);
    } catch (error) {
      this.toasts.error(
        this.translate.instant('newRun.launchFailed') as string,
        error instanceof Error ? error.message : undefined,
      );
    } finally {
      this.launching.set(false);
    }
  }

  protected back(): void {
    this.step.update((current) => (current === 'plan' ? 'analysis' : 'source'));
  }

  protected isConsentAccepted(key: 'privacy' | 'simulationTerms' | 'beta'): boolean {
    return this.consentSignal(key)();
  }

  protected toggleConsent(key: 'privacy' | 'simulationTerms' | 'beta'): void {
    this.consentSignal(key).update((accepted) => !accepted);
  }

  /** L'adresse du document, servi par le site public. */
  protected legalUrl(path: string): string {
    return `${environment.services.landing.url}${path}`;
  }

  protected planPrice(plan: SimulationPlan): string {
    return `${plan.price.toLocaleString('fr-FR')} ${plan.currency}`;
  }

  protected planListPrice(plan: SimulationPlan): string | null {
    return plan.listPrice ? `${plan.listPrice.toLocaleString('fr-FR')} ${plan.currency}` : null;
  }

  /**
   * Ouvre le dialogue de connexion si l'identité manque. Rend vrai quand
   * l'action appelante doit s'arrêter là.
   */
  private async requireSignIn(reason: string): Promise<boolean> {
    if (await this.auth.ensureLoaded()) {
      return false;
    }
    this.signInReason.set(reason);
    return true;
  }

  private consentSignal(key: 'privacy' | 'simulationTerms' | 'beta') {
    return key === 'privacy'
      ? this.privacyAccepted
      : key === 'simulationTerms'
        ? this.simulationTermsAccepted
        : this.betaAccepted;
  }

  /** Les projets IDEM appartiennent au compte : rien à charger sans session. */
  private async loadProjects(): Promise<void> {
    if (await this.auth.ensureLoaded()) {
      await this.store.loadProjects();
    }
  }

  private async restoreDraft(): Promise<void> {
    const draft = await takeDraft();
    if (!draft) {
      return;
    }
    this.origin.set(draft.origin);
    this.sourceChosen.set(true);
    if (draft.projectId) {
      this.selectedProjectId.set(draft.projectId);
    }
    if (draft.file) {
      this.selectedFile.set(draft.file);
    }
  }

  /** Sélectionne le projet et le rend, pour rester lisible dans l'appel. */
  private selectProjectAndReturn(projectId: string): string {
    this.store.selectProject(projectId);
    return projectId;
  }

  private runName(): string {
    if (this.origin() === 'idem-project') {
      const project = this.selectedProject();
      if (project) {
        return project.name;
      }
    }
    // Import : le nom vient de ce que le document a livré, c'est aussi celui
    // que portera le projet IDEM créé.
    const extracted = this.understanding()?.profile.name?.trim();
    if (extracted) {
      return extracted;
    }
    const file = this.selectedFile();
    return file ? file.name.replace(/\.[^.]+$/, '') : (this.translate.instant('newRun.title') as string);
  }
}

/**
 * Motif de refus d'un document, quand l'API en donne un.
 *
 * 415 : format non pris en charge. 422 : fichier illisible, ou document qui
 * n'est pas un business plan. Dans les deux cas le message est écrit pour
 * l'utilisateur et se suffit à lui-même.
 */
function documentRejection(error: unknown): string | null {
  const status = (error as { status?: number })?.status;
  if (status !== 415 && status !== 422) {
    return null;
  }
  return serverMessage(error);
}

/**
 * Le message rédigé par l'API. Elle en écrit un pour tout ce que
 * l'utilisateur peut comprendre — document refusé, service indisponible — et
 * garde le détail technique dans ses journaux.
 */
function serverMessage(error: unknown): string | null {
  return (error as { error?: { message?: string } })?.error?.message ?? null;
}
