import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, output, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { IllustrationComponent } from '../illustration/illustration';

interface SiteMatch {
  level: 'close' | 'partial' | 'distant';
  siteStyle: string;
}

/** Ce que l'API montre d'un projet IDEM relié à l'application. */
export interface LinkedProject {
  id: string;
  name: string;
  description?: string;
  logoSvg: string | null;
  primaryColor: string | null;
  fonts: { display: string | null; body: string | null };
  artDirection: { styleId: string; styleName: string; siteMatch?: SiteMatch } | null;
  keyFigures: Array<{ label: string; value: string }>;
  charter: boolean;
}

interface AppProjectState {
  app: { uuid: string; name: string; running: boolean; url: string | null } | null;
  project: LinkedProject | null;
  projects: Array<{ id: string; name: string }>;
}

interface JobAnswer {
  status: 'running' | 'done' | 'failed';
  step: string;
  project?: LinkedProject;
  result?: { warnings?: string[] };
  error?: { code: string; message: string };
}

/** Les étapes de la lecture, dans l'ordre où l'API les annonce (les autres sont regroupées sous la plus proche). */
const STEPS = ['open', 'project', 'logo-variations', 'typography', 'art-direction', 'done'] as const;
const STEP_OF: Record<string, (typeof STEPS)[number]> = {
  open: 'open',
  colors: 'open',
  fonts: 'open',
  logo: 'open',
  content: 'open',
  voice: 'open',
  art: 'open',
  pages: 'open',
  project: 'project',
  'logo-variations': 'logo-variations',
  typography: 'typography',
  'art-direction': 'art-direction',
  patterns: 'art-direction',
  assets: 'art-direction',
  done: 'done',
};

/** « Plus tard » : la proposition se tait 14 jours pour CETTE application (confort du navigateur, jamais bloquant). */
const LATER_MS = 14 * 24 * 3_600_000;
const laterKey = (uuid: string) => `idem-project-later:${uuid}`;

/**
 * LE PROJET IDEM D'UNE APPLICATION EN LIGNE.
 *
 * Une application publiée sur iDeploy sans iCode n'a pas de projet IDEM : personne pour l'aider à se faire
 * connaître, à structurer son activité. Dès qu'elle est en ligne, on le propose. L'utilisateur accepte les
 * politiques d'IDEM (case jamais cochée d'avance) ; l'API lit le site EN LIGNE (fiche, cible, chiffres affichés,
 * logo, couleurs, polices, direction artistique la plus proche du catalogue) et relie l'application au projet.
 *
 * Relié, le composant rappelle à quel projet l'application appartient — la carte « prochaine étape » de la boucle
 * IDEM (`app-journey-next`) fait le reste.
 */
@Component({
  selector: 'app-idem-project',
  imports: [TranslateModule, IdemLoaderComponent, IllustrationComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (project(); as p) {
      <!-- Relié : à quel projet IDEM appartient cette application. -->
      <section class="glass-card flex flex-wrap items-center gap-4 p-4" [attr.aria-label]="'idemProject.linked.label' | translate">
        @if (logoSrc(); as src) {
          <img [src]="src" alt="" width="40" height="40" class="h-10 w-10 flex-none object-contain" />
        }
        <div class="min-w-0 flex-1 basis-48">
          <p class="text-xs" style="color:var(--color-text-secondary);">{{ 'idemProject.linked.label' | translate }}</p>
          <p class="truncate font-semibold text-text-primary">{{ p.name }}</p>
          @if (p.artDirection; as da) {
            <p class="mt-0.5 text-xs" style="color:var(--color-text-secondary);">
              {{ 'idemProject.linked.direction' | translate: { name: da.styleName } }}
              @if (da.siteMatch) { · {{ 'idemProject.match.' + da.siteMatch.level | translate }} }
            </p>
          }
        </div>
        <a class="outer-button button-sm" [href]="consoleLink('/project/dashboard', p.id)" target="_blank" rel="noopener">
          {{ 'idemProject.linked.open' | translate }}
        </a>
      </section>
    } @else if (phase() === 'running') {
      <section class="glass-card p-5" aria-live="polite">
        <div class="flex items-center gap-3">
          <idem-loader size="sm" />
          <p class="font-semibold text-text-primary">{{ 'idemProject.running.title' | translate: { url: shortUrl() } }}</p>
        </div>
        <ol class="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-5">
          @for (s of steps; track s; let i = $index) {
            @if (s !== 'done') {
              <li class="flex items-center gap-2" [style.color]="i <= stepIndex() ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)'">
                @if (i < stepIndex()) {
                  <i class="pi pi-check text-xs" style="color:var(--color-success);" aria-hidden="true"></i>
                } @else if (i === stepIndex()) {
                  <idem-loader size="xs" />
                } @else {
                  <span class="status-dot" aria-hidden="true"></span>
                }
                {{ 'idemProject.step.' + s | translate }}
              </li>
            }
          }
        </ol>
        <p class="mt-3 text-xs" style="color:var(--color-text-secondary);">{{ 'idemProject.running.hint' | translate }}</p>
      </section>
    } @else if (phase() === 'done' && created(); as p) {
      <section class="glass-card grid grid-cols-1 gap-5 p-5 md:grid-cols-[120px_1fr]" aria-live="polite">
        <app-illustration name="stamp" [width]="120" class="hidden md:block" />
        <div class="min-w-0">
          <h2 class="text-lg font-semibold text-text-primary">{{ 'idemProject.done.title' | translate: { name: p.name } }}</h2>
          <p class="mt-1 text-sm" style="color:var(--color-text-secondary);">{{ 'idemProject.done.body' | translate }}</p>
          <dl class="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            @if (p.artDirection; as da) {
              <div>
                <dt class="text-xs" style="color:var(--color-text-secondary);">{{ 'idemProject.done.direction' | translate }}</dt>
                <dd class="font-medium text-text-primary">{{ da.styleName }}@if (da.siteMatch) { <span class="tag ml-2">{{ 'idemProject.match.' + da.siteMatch.level | translate }}</span> }</dd>
                @if (da.siteMatch?.siteStyle) {
                  <dd class="mt-1 text-xs" style="color:var(--color-text-secondary);">{{ da.siteMatch?.siteStyle }}</dd>
                }
              </div>
            }
            @if (p.fonts.display) {
              <div>
                <dt class="text-xs" style="color:var(--color-text-secondary);">{{ 'idemProject.done.fonts' | translate }}</dt>
                <dd class="font-medium text-text-primary">{{ p.fonts.display }}@if (p.fonts.body && p.fonts.body !== p.fonts.display) { · {{ p.fonts.body }} }</dd>
              </div>
            }
            @if (p.keyFigures.length) {
              <div class="sm:col-span-2">
                <dt class="text-xs" style="color:var(--color-text-secondary);">{{ 'idemProject.done.figures' | translate }}</dt>
                <dd class="mt-1 flex flex-wrap gap-2">
                  @for (f of p.keyFigures; track f.label + f.value) {
                    <span class="tag">{{ f.value }} · {{ f.label }}</span>
                  }
                </dd>
              </div>
            }
          </dl>
          @for (w of warnings(); track w) {
            <p class="mt-3 text-xs" style="color:var(--color-warning);">{{ w }}</p>
          }
          <div class="mt-5 flex flex-wrap gap-3">
            <a class="inner-button" [href]="consoleLink('/project/dashboard', p.id)" target="_blank" rel="noopener">{{ 'idemProject.done.open' | translate }}</a>
            @if (!p.charter) {
              <a class="outer-button" [href]="consoleLink('/project/branding', p.id)" target="_blank" rel="noopener">{{ 'idemProject.done.charter' | translate }}</a>
            }
          </div>
        </div>
      </section>
    } @else if (offer()) {
      <!-- La proposition : un projet IDEM tiré du site en ligne. -->
      <section class="glass-card grid grid-cols-1 gap-5 p-5 md:grid-cols-[120px_1fr]">
        <app-illustration name="stamp" [width]="120" class="hidden md:block" />
        <form class="min-w-0" (submit)="$event.preventDefault(); start()">
          <h2 class="text-lg font-semibold text-text-primary">{{ 'idemProject.offer.title' | translate }}</h2>
          <p class="mt-1 text-sm" style="color:var(--color-text-secondary);">{{ 'idemProject.offer.body' | translate: { url: shortUrl() } }}</p>

          @if (projects().length) {
            <fieldset class="mt-4 grid gap-2">
              <legend class="sr-only">{{ 'idemProject.offer.choice' | translate }}</legend>
              <label class="flex items-start gap-2 text-sm">
                <input type="radio" name="idem-project-mode" class="mt-1" [checked]="mode() === 'create'" (change)="mode.set('create')" />
                <span><span class="font-medium text-text-primary">{{ 'idemProject.offer.create' | translate }}</span> <span class="tag ml-1">{{ 'idemProject.offer.recommended' | translate }}</span></span>
              </label>
              <label class="flex items-start gap-2 text-sm">
                <input type="radio" name="idem-project-mode" class="mt-1" [checked]="mode() === 'attach'" (change)="mode.set('attach')" />
                <span class="font-medium text-text-primary">{{ 'idemProject.offer.attach' | translate }}</span>
              </label>
              @if (mode() === 'attach') {
                <select class="!w-full sm:!w-80" [attr.aria-label]="'idemProject.offer.attach' | translate" (change)="target.set($any($event.target).value)">
                  @for (p of projects(); track p.id) {
                    <option [value]="p.id" [selected]="p.id === target()">{{ p.name }}</option>
                  }
                </select>
              }
            </fieldset>
          }

          @if (mode() === 'create' || consentNeeded()) {
            <div class="mt-4 flex items-start gap-2 text-xs leading-relaxed" style="color:var(--color-text-secondary);">
              <input id="idem-project-consent" type="checkbox" class="mt-0.5 flex-none" [checked]="accepted()" (change)="accepted.set($any($event.target).checked)" />
              <label for="idem-project-consent" class="!mb-0 !text-xs !font-normal">
                {{ 'idemProject.consent.iAccept' | translate }}
                <a class="underline" [href]="landing + '/privacy-policy'" target="_blank" rel="noopener">{{ 'idemProject.consent.privacy' | translate }}</a>,
                <a class="underline" [href]="landing + '/terms-of-service'" target="_blank" rel="noopener">{{ 'idemProject.consent.terms' | translate }}</a>
                {{ 'idemProject.consent.and' | translate }}
                <a class="underline" [href]="landing + '/beta-policy'" target="_blank" rel="noopener">{{ 'idemProject.consent.beta' | translate }}</a>
                {{ 'idemProject.consent.ofIdem' | translate }}
              </label>
            </div>
          }

          @if (error(); as e) {
            <p class="mt-3 text-sm" role="alert" style="color:var(--color-danger);">{{ e | translate }}</p>
          }

          <div class="mt-5 flex flex-wrap items-center gap-3">
            <button type="submit" class="inner-button" [disabled]="!canStart() || starting()">
              @if (starting()) { <idem-loader size="xs" /> }
              {{ (mode() === 'attach' ? 'idemProject.offer.ctaAttach' : 'idemProject.offer.cta') | translate }}
            </button>
            <button type="button" class="button-ghost" (click)="later()">{{ 'idemProject.offer.later' | translate }}</button>
          </div>
          @if (mode() === 'create' && !accepted()) {
            <p class="mt-2 text-xs" style="color:var(--color-text-tertiary);">{{ 'idemProject.consent.needed' | translate }}</p>
          }
        </form>
      </section>
    }
  `,
})
export class IdemProjectComponent {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly base = `${environment.services.api.url.replace(/\/+$/, '')}/journey/app-project`;
  protected readonly landing = environment.services.landing.url.replace(/\/+$/, '');
  protected readonly steps = STEPS;

  /** L'application iDeploy affichée. */
  readonly appUuid = input.required<string>();
  /** L'application vient d'être reliée : la boucle IDEM peut proposer la suite. */
  readonly linked = output<string>();

  private readonly state = signal<AppProjectState | null>(null);
  protected readonly phase = signal<'idle' | 'running' | 'done'>('idle');
  protected readonly step = signal<string>('open');
  protected readonly created = signal<LinkedProject | null>(null);
  protected readonly warnings = signal<string[]>([]);
  protected readonly mode = signal<'create' | 'attach'>('create');
  protected readonly target = signal<string>('');
  protected readonly accepted = signal(false);
  protected readonly consentNeeded = signal(false);
  protected readonly starting = signal(false);
  protected readonly error = signal<string | null>(null);
  private readonly hidden = signal(false);
  private polling: ReturnType<typeof setTimeout> | null = null;

  protected readonly project = computed(() => (this.phase() === 'done' ? null : this.state()?.project ?? null));
  protected readonly projects = computed(() => this.state()?.projects ?? []);
  /** Proposé dès que l'application tourne et a une adresse publique, sauf « Plus tard » récent. */
  protected readonly offer = computed(() => {
    const s = this.state();
    return !!s?.app?.running && !!s.app.url && !s.project && !this.hidden();
  });
  protected readonly shortUrl = computed(() => (this.state()?.app?.url ?? '').replace(/^https?:\/\//, '').replace(/\/$/, ''));
  protected readonly stepIndex = computed(() => STEPS.indexOf(STEP_OF[this.step()] ?? 'open'));
  protected readonly canStart = computed(() => (this.mode() === 'attach' ? !!this.target() && (!this.consentNeeded() || this.accepted()) : this.accepted()));
  protected readonly logoSrc = computed(() => {
    const svg = this.state()?.project?.logoSvg;
    if (!svg) return null;
    // En image, jamais en HTML : un SVG affiché par <img> n'exécute rien.
    try {
      return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
    } catch {
      return null;
    }
  });

  constructor() {
    effect(() => {
      const uuid = this.appUuid();
      this.reset();
      if (!uuid) return;
      this.hidden.set(this.isLater(uuid));
      void this.load(uuid);
    });
    this.destroyRef.onDestroy(() => this.stopPolling());
  }

  protected consoleLink(path: string, projectId: string): string {
    const params = new HttpParams().set('projectId', projectId).set('from', 'ideploy');
    return `${environment.services.console.url.replace(/\/+$/, '')}${path}?${params.toString()}`;
  }

  protected async start(): Promise<void> {
    if (!this.canStart() || this.starting()) return;
    this.starting.set(true);
    this.error.set(null);
    const attach = this.mode() === 'attach';
    const body = {
      appUuid: this.appUuid(),
      ...(attach ? { projectId: this.target() } : {}),
      ...(this.accepted() ? { consent: { privacy: true, terms: true, beta: true } } : {}),
    };
    try {
      const answer = await firstValueFrom(this.http.post<{ jobId: string }>(this.base, body));
      this.phase.set('running');
      this.step.set('open');
      this.poll(answer.jobId);
    } catch (e) {
      const err = e as HttpErrorResponse;
      if (err.status === 403 && err.error?.error === 'consent_required') {
        // Le projet choisi n'a jamais reçu l'accord : il le faut maintenant.
        this.consentNeeded.set(true);
        this.error.set(err.error?.message ?? null);
      } else {
        this.error.set(err.error?.message ?? this.errorText(err.error?.error));
      }
    } finally {
      this.starting.set(false);
    }
  }

  protected later(): void {
    try {
      localStorage.setItem(laterKey(this.appUuid()), String(Date.now()));
    } catch {
      /* stockage indisponible : la proposition reviendra au prochain affichage */
    }
    this.hidden.set(true);
  }

  private isLater(uuid: string): boolean {
    try {
      const at = Number(localStorage.getItem(laterKey(uuid)) || 0);
      return at > 0 && Date.now() - at < LATER_MS;
    } catch {
      return false;
    }
  }

  private async load(uuid: string): Promise<void> {
    const params = new HttpParams().set('appUuid', uuid);
    const answer = await firstValueFrom(this.http.get<AppProjectState>(this.base, { params })).catch(() => null);
    if (this.appUuid() !== uuid) return;
    this.state.set(answer);
    if (answer?.projects.length) this.target.set(answer.projects[0].id);
  }

  private poll(jobId: string): void {
    this.stopPolling();
    const uuid = this.appUuid();
    const tick = async () => {
      const job = await firstValueFrom(this.http.get<JobAnswer>(`${this.base}/jobs/${encodeURIComponent(jobId)}`)).catch(() => null);
      if (this.appUuid() !== uuid) return;
      if (!job) {
        this.polling = setTimeout(tick, 4000);
        return;
      }
      this.step.set(job.step);
      if (job.status === 'running') {
        this.polling = setTimeout(tick, 2000);
        return;
      }
      if (job.status === 'done' && job.project) {
        this.created.set(job.project);
        this.warnings.set(job.result?.warnings ?? []);
        this.state.update((s) => (s ? { ...s, project: job.project ?? null, projects: [] } : s));
        this.phase.set('done');
        this.linked.emit(job.project.id);
        return;
      }
      this.phase.set('idle');
      this.error.set(this.errorText(job.error?.code));
    };
    this.polling = setTimeout(tick, 1500);
  }

  private errorText(code: string | undefined): string {
    // Le message vit dans les traductions ; la clé d'erreur inconnue retombe sur le message général.
    const known = ['unreachable', 'timeout', 'blocked_url', 'invalid_url', 'no_public_url', 'app_not_found'];
    return `idemProject.error.${known.includes(code ?? '') ? code : 'generic'}`;
  }

  private stopPolling(): void {
    if (this.polling) clearTimeout(this.polling);
    this.polling = null;
  }

  private reset(): void {
    this.stopPolling();
    this.state.set(null);
    this.phase.set('idle');
    this.created.set(null);
    this.error.set(null);
    this.accepted.set(false);
    this.consentNeeded.set(false);
    this.mode.set('create');
  }
}
