import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { Subscription, timer } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiService } from '../../../core/api.service';
import { HttpEventType } from '@angular/common/http';
import { Brand, ChatEvent, ChatMessage, ChatMode, ChatOptions, ChatSession, Creativity, MediaAsset, Montage, MontageUpload, MotionVideo, Reference, Visual } from '../../../core/models';
import { StudioState } from '../../../core/studio.state';
import { CreativitySelect } from '../../../shared/components/creativity-select';
import { BrandHint } from '../../../shared/components/brand-hint';
import { Illustration } from '../../../shared/components/illustration';
import { BrandChoice } from './brand-choice';
import { ProgressList, StageState } from './progress-list';
import { MontageResult } from './montage-result';
import { VideoResult } from './video-result';
import { VisualResult } from './visual-result';
import { brandFonts } from '../visual-edit/visual-adapter';

type TurnBody = Parameters<ApiService['turn']>[1];

const BRAND_KEY = 'iv_brand';
const VIDEO_FORMATS = ['story', 'square', 'portrait', 'landscape'];
const IMAGE_FORMATS = ['square', 'story', 'post', 'banner', 'a4'];
const DURATIONS = [6, 15, 30, 60];

/**
 * LA CONVERSATION. Un mode par conversation (images OU vidéos). L'atelier VIDÉO est unique : on
 * décrit sa vidéo (motion design), et/ou on ajoute ses vidéos — celles où l'on parle sont
 * MONTÉES (coupes, sous-titres, animations, intro et fin animées), les autres servent de matière. La marque n'est jamais exigée :
 * une ligne discrète propose le site, la charte ou des couleurs (`iv-brand-hint`), et sans
 * réponse la création se fait aux couleurs neutres. L'assistant ne demande que le modèle, et
 * l'utilisateur répond d'un geste, sans réécrire sa demande : le serveur la garde et la rejoue.
 */
@Component({
  selector: 'iv-chat',
  imports: [RouterLink, TranslateModule, IdemLoaderComponent, CreativitySelect, Illustration, BrandChoice, BrandHint, ProgressList, VideoResult, VisualResult, MontageResult],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chat.html',
})
export class ChatPage {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly state = inject(StudioState);
  protected readonly accountUrl = `${environment.services.dashboard.url}/account`;

  /** Paramètres de route (liaison des entrées du routeur). */
  readonly modeParam = input<string>('video', { alias: 'mode' });
  readonly sessionId = input<string | undefined>(undefined);
  /** `?project=<id>` (lien « Ouvrir dans iVision » d'IDEM) : la charte de ce projet est importée. */
  readonly project = input<string | undefined>(undefined);
  private importedProject: string | null = null;

  private readonly log = viewChild<ElementRef<HTMLElement>>('log');
  private readonly composer = viewChild<ElementRef<HTMLTextAreaElement>>('composer');
  private readonly referenceInput = viewChild<ElementRef<HTMLInputElement>>('referenceInput');
  private readonly videoInput = viewChild<ElementRef<HTMLInputElement>>('videoInput');

  protected readonly mode = computed<ChatMode>(() => (this.modeParam() === 'image' ? 'image' : 'video'));
  protected readonly session = signal<ChatSession | null>(null);
  protected readonly messages = signal<ChatMessage[]>([]);
  protected readonly loading = signal(false);
  protected readonly streaming = signal(false);
  protected readonly status = signal<string | null>(null);
  protected readonly stages = signal<StageState[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly payment = signal<{ cost?: number; balance?: number; missing?: number } | null>(null);
  protected readonly motionVideos = signal<Record<string, MotionVideo>>({});
  protected readonly visuals = signal<Record<string, Visual>>({});

  // Composer
  protected readonly text = signal('');
  protected readonly creativity = signal<Creativity>('medium');
  protected readonly durationSec = signal(15);
  protected readonly videoFormat = signal('story');
  protected readonly imageFormat = signal('square');
  protected readonly withPhoto = signal(true);
  /** Voix off dans la langue de l'interface (désactivée par défaut). */
  protected readonly voice = signal(false);
  protected readonly media = signal<MediaAsset[]>([]);
  /** Les vidéos ajoutées (déposées avec leur son) : avec de la parole, elles seront montées. */
  protected readonly videos = signal<MontageUpload[]>([]);
  protected readonly videoPercent = signal(0);
  /** Une vidéo jointe parle : la demande sera un montage (réglages du montage proposés). */
  protected readonly montaging = computed(() => this.mode() === 'video' && this.videos().some((v) => v.hasAudio));
  protected readonly removeSilences = signal(true);
  protected readonly montageMusic = signal(true);
  protected readonly montages = signal<Record<string, Montage>>({});
  /** La conversation a déjà une vidéo (montage ou motion design) : un message la retouche. */
  protected readonly revisingMontage = computed(() => {
    if (this.mode() !== 'video' || this.videos().length || this.media().length) return false;
    return this.messages().some((m) => m.result && (m.result.kind === 'montage' || m.result.kind === 'video'));
  });
  /** Montages retouchés pendant ce tour : la carte se recharge. */
  protected readonly montageVersions = signal<Record<string, number>>({});
  protected readonly uploading = signal(false);
  protected readonly reference = signal<Reference | null>(null);
  protected readonly recentReferences = signal<Reference[]>([]);
  protected readonly showRecent = signal(false);
  protected readonly price = signal<number | null>(null);
  protected readonly projects = signal<{ id: string; name: string; hasBrand: boolean; primary?: string }[] | null>(null);
  protected readonly importing = signal<string | null>(null);
  protected readonly brandMenu = signal(false);

  protected readonly durations = DURATIONS;
  protected readonly formats = computed(() => (this.mode() === 'video' ? VIDEO_FORMATS : IMAGE_FORMATS));
  /** La marque de la conversation, ou celle choisie pour la prochaine. */
  protected readonly preferredBrandId = signal<string | null>(this.readPreferred());
  /** La marque de la conversation ; pour une nouvelle, la dernière utilisée, sinon la plus récente. */
  /** Les polices de la marque, pour l'aperçu éditable des visuels. */
  protected readonly fonts = computed(() => brandFonts(this.brand()));
  /** La marque de la conversation, chargée à part quand c'est une marque provisoire (non listée). */
  protected readonly sessionBrand = signal<Brand | null>(null);
  /** Une marque choisie avant que la conversation n'existe (elle naît avec). */
  protected readonly pendingBrand = signal<Brand | null>(null);
  protected readonly brand = computed<Brand | null>(() => {
    if (this.session()) return this.sessionBrand();
    if (this.pendingBrand()) return this.pendingBrand();
    // Nouvelle conversation : la dernière charte utilisée, s'il y en a une (jamais imposée).
    const id = this.preferredBrandId();
    return this.state.brands().find((b) => b.id === id && b.source !== 'auto') ?? null;
  });
  protected readonly readyBrands = computed(() => this.state.brands().filter((b) => b.status === 'ready'));
  protected readonly canSend = computed(() => !this.streaming() && !this.uploading() && (this.text().trim().length >= 2 || (this.mode() === 'video' && this.videos().length > 0)));
  protected readonly lastAsk = computed(() => {
    const last = this.messages().at(-1);
    return last?.role === 'assistant' && last.ask ? last : null;
  });

  private turnSub: Subscription | null = null;
  private refPoll: Subscription | null = null;

  constructor() {
    // Conversation choisie, ou nouvelle (`?new=1`, ou aucune encore).
    effect(() => {
      const id = this.sessionId();
      const mode = this.mode();
      untracked(() => this.open(id, mode));
    });
    effect(() => {
      const project = this.project();
      if (!project || project === this.importedProject) return;
      this.importedProject = project;
      untracked(() => {
        this.importProject(project);
        void this.router.navigate([], { queryParams: { project: null }, queryParamsHandling: 'merge', replaceUrl: true });
      });
    });
    // Le prix suit les réglages (prix d'IDEM, calculés par le serveur).
    effect(() => {
      const mode = this.mode();
      const level = this.creativity();
      const scope = { durationSec: this.durationSec(), formats: [this.videoFormat()], quality: 'hd' };
      untracked(() => this.api.quote(mode, level, mode === 'video' ? scope : undefined).subscribe({ next: (q) => this.price.set(q.cost), error: () => this.price.set(null) }));
    });
    // La marque de la conversation : dans la liste, sinon chargée (marque provisoire).
    effect(() => {
      const id = this.session()?.brandId;
      const listed = this.state.brands().find((b) => b.id === id);
      untracked(() => {
        if (!id) return this.sessionBrand.set(null);
        if (listed) return this.sessionBrand.set(listed);
        if (this.sessionBrand()?.id !== id) this.api.brand(id).subscribe({ next: (b) => this.sessionBrand.set(b), error: () => this.sessionBrand.set(null) });
      });
    });
    // Le fil descend avec la conversation.
    effect(() => {
      this.messages();
      this.stages();
      untracked(() => queueMicrotask(() => this.log()?.nativeElement.scrollTo({ top: 1e9, behavior: 'smooth' })));
    });
    this.destroyRef.onDestroy(() => {
      this.turnSub?.unsubscribe();
      this.refPoll?.unsubscribe();
    });
  }

  private readPreferred(): string | null {
    try {
      return localStorage.getItem(BRAND_KEY);
    } catch {
      return null;
    }
  }

  private open(id: string | undefined, mode: ChatMode): void {
    // L'adresse vient de recevoir l'identifiant de la conversation en cours : rien à recharger.
    if (id && this.session()?.id === id) return;
    this.turnSub?.unsubscribe();
    this.streaming.set(false);
    this.error.set(null);
    this.payment.set(null);
    this.stages.set([]);
    this.status.set(null);
    this.media.set([]);
    this.videos.set([]);
    this.reference.set(null);
    if (!id) {
      this.session.set(null);
      this.messages.set([]);
      this.pendingBrand.set(null);
      return;
    }
    this.loading.set(true);
    this.api.session(id).subscribe({
      next: (session) => {
        if (session.mode !== mode) {
          void this.router.navigate(['/studio', session.mode, session.id], { replaceUrl: true });
          return;
        }
        this.session.set(session);
        this.messages.set(session.messages);
        this.loading.set(false);
        this.loadResults(session);
      },
      error: () => {
        this.loading.set(false);
        void this.router.navigate(['/studio', mode], { replaceUrl: true });
      },
    });
  }

  /** Les vidéos et visuels déjà produits dans la conversation (cartes de résultat). */
  private loadResults(session: ChatSession): void {
    for (const m of session.messages) {
      if (m.result?.kind === 'visual' && !this.visuals()[m.result.visualId]) {
        const id = m.result.visualId;
        this.api.visual(id).subscribe({ next: (v) => this.visuals.update((all) => ({ ...all, [id]: v })), error: () => undefined });
      }
      if (m.result?.kind === 'video' && session.brandId && !this.motionVideos()[m.result.videoId]) {
        const id = m.result.videoId;
        this.api.video(session.brandId, id).subscribe({ next: (v) => this.motionVideos.update((all) => ({ ...all, [id]: v })), error: () => undefined });
      }
    }
  }

  protected messageText(m: ChatMessage): string {
    if (!m.i18n) return m.text;
    const translated = this.translate.instant(m.i18n.key, m.i18n.params);
    return translated && translated !== m.i18n.key ? translated : m.text;
  }

  protected options(): ChatOptions {
    // Un montage : les réglages du montage (coupes, musique) ; sinon ceux du motion design.
    if (this.montaging()) return { creativity: this.creativity(), formats: [this.videoFormat()], quality: 'hd', cuts: this.removeSilences() ? 'tight' : 'none', ...(this.montageMusic() ? {} : { musicMood: 'none' }) };
    return this.mode() === 'video'
      ? { creativity: this.creativity(), durationSec: this.durationSec(), formats: [this.videoFormat()], quality: 'hd', voice: this.voice() }
      : { creativity: this.creativity(), format: this.imageFormat(), withPhoto: this.withPhoto() };
  }

  // ── Envoi ──

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      this.send();
    }
  }

  protected send(): void {
    if (!this.canSend()) return;
    const body: TurnBody = {
      text: this.text().trim(),
      options: this.options(),
      ...(this.media().length && this.mode() === 'video' ? { media: this.media() } : {}),
      ...(this.videos().length && this.mode() === 'video' ? { videos: this.videos().map((v) => ({ url: v.url, name: v.name, posterUrl: v.posterUrl })) } : {}),
      ...(this.mode() === 'image' && this.media()[0] ? { photoUrl: this.media()[0].url } : {}),
      ...(this.reference() && this.reference()!.status !== 'failed' ? { referenceId: this.reference()!.id } : {}),
    };
    this.text.set('');
    this.media.set([]);
    this.videos.set([]);
    this.reference.set(null);
    this.run(body);
  }

  /** Une idée de changement proposée sous un montage : envoyée comme un message. */
  protected say(key: string): void {
    this.text.set(this.translate.instant(`montage.suggestions.${key}`));
    this.send();
  }

  /** La carte d'une vidéo (montage ou motion design) n'apparaît qu'une fois : sous le dernier message qui la cite. */
  protected latestFor(message: ChatMessage): boolean {
    const idOf = (m: ChatMessage) => (m.result?.kind === 'montage' ? `m:${m.result.montageId}` : m.result?.kind === 'video' ? `v:${m.result.videoId}` : null);
    const id = idOf(message);
    if (!id) return false;
    const last = [...this.messages()].reverse().find((m) => idOf(m) === id);
    return last?.id === message.id;
  }

  protected videoAttachments(m: ChatMessage) {
    return (m.attachments ?? []).filter((a) => a.mimeType === 'video' && a.kind === 'media' && a.id.startsWith('video-'));
  }

  protected otherAttachments(m: ChatMessage) {
    return (m.attachments ?? []).filter((a) => !(a.mimeType === 'video' && a.kind === 'media' && a.id.startsWith('video-')));
  }

  protected chooseVideos(): void {
    this.videoInput()?.nativeElement.click();
  }

  /** Réponse à une question de l'assistant : la demande en attente reprend. */
  protected resume(extra: Partial<TurnBody> = {}): void {
    this.run({ resume: true, options: this.options(), ...extra });
  }

  private run(body: TurnBody): void {
    const session = this.session();
    if (!session) {
      // Première demande : la conversation naît avec la marque choisie.
      this.streaming.set(true);
      this.api.createSession(this.mode(), this.brand()?.id).subscribe({
        next: (created) => {
          // Le titre de la conversation est sa première demande (comme côté serveur).
          this.session.set(body.text ? { ...created, title: body.text.replace(/\s+/g, ' ').slice(0, 60) } : created);
          this.messages.set([]);
          void this.router.navigate(['/studio', created.mode, created.id], { replaceUrl: true });
          this.stream(created.id, body);
        },
        error: () => {
          this.streaming.set(false);
          this.error.set('errors.generic');
        },
      });
      return;
    }
    this.stream(session.id, body);
  }

  private stream(sessionId: string, body: TurnBody): void {
    this.streaming.set(true);
    this.error.set(null);
    this.payment.set(null);
    this.stages.set([]);
    this.status.set(null);
    this.turnSub?.unsubscribe();
    this.turnSub = this.api.turn(sessionId, body).subscribe({
      next: (event) => this.onEvent(event),
      complete: () => this.finish(),
      error: () => this.finish(),
    });
  }

  private onEvent(event: ChatEvent): void {
    switch (event.type) {
      case 'message':
        this.messages.update((list) => [...list.filter((m) => m.id !== event.message.id), event.message]);
        break;
      case 'status':
        this.status.set(this.translate.instant(event.key) !== event.key ? this.translate.instant(event.key) : event.text);
        break;
      case 'progress':
        this.status.set(null);
        this.stages.update((list) => [...list, { stage: event.stage, state: event.state }]);
        break;
      case 'brand':
        if (event.brand.source !== 'auto') {
          this.state.upsertBrand(event.brand);
          this.remember(event.brand.id);
        }
        this.sessionBrand.set(event.brand);
        this.session.update((s) => (s ? { ...s, brandId: event.brand.id } : s));
        break;
      case 'result':
        if (event.montage) {
          this.montages.update((all) => ({ ...all, [event.montage!.id]: event.montage! }));
          this.montageVersions.update((all) => ({ ...all, [event.montage!.id]: (all[event.montage!.id] || 0) + 1 }));
        }
        if (event.video) this.motionVideos.update((all) => ({ ...all, [event.video!.id]: event.video! }));
        if (event.visual) this.visuals.update((all) => ({ ...all, [event.visual!.id]: event.visual! }));
        this.messages.update((list) => [...list.filter((m) => m.id !== event.message.id), event.message]);
        break;
      case 'error':
        if (event.error === 'payment_required') this.payment.set(event.payment ?? {});
        else if (event.error !== 'turn_running') this.error.set('errors.generic');
        break;
      case 'done':
        break;
    }
  }

  private finish(): void {
    this.streaming.set(false);
    this.status.set(null);
    this.stages.set([]);
    this.state.refreshSessions(this.mode());
    this.state.refreshCredits();
  }

  // ── Marque ──

  private remember(brandId: string): void {
    try {
      localStorage.setItem(BRAND_KEY, brandId);
    } catch {
      /* préférence locale seulement */
    }
    this.preferredBrandId.set(brandId);
  }

  /** Une marque trouvée par la ligne discrète (site, charte, couleurs, marque enregistrée). */
  protected onHintBrand(brand: Brand): void {
    if (brand.source !== 'auto') this.remember(brand.id);
    if (!this.session()) {
      this.pendingBrand.set(brand);
      return;
    }
    this.sessionBrand.set(brand);
    this.pickBrand(brand);
  }

  protected pickBrand(brand: Brand): void {
    this.brandMenu.set(false);
    if (brand.source !== 'auto') this.remember(brand.id);
    const session = this.session();
    if (!session) return;
    this.api.setSessionBrand(session.id, brand.id).subscribe({
      next: (s) => {
        this.session.set({ ...s, messages: this.messages() });
        // Une demande attendait sa marque : elle reprend.
        if (this.lastAsk()?.ask?.kind === 'brand') this.resume();
      },
      error: () => this.error.set('errors.generic'),
    });
  }

  protected brandChosen(brand: Brand): void {
    this.state.upsertBrand(brand);
    this.remember(brand.id);
    this.resume();
  }

  protected brandOf(id: string): Brand | undefined {
    return this.state.brands().find((b) => b.id === id);
  }

  protected loadProjects(): void {
    if (this.projects()) return;
    this.api.idemProjects().subscribe({ next: ({ projects }) => this.projects.set(projects), error: () => this.projects.set([]) });
  }

  protected importProject(projectId: string): void {
    this.importing.set(projectId);
    this.api.importIdem(projectId).subscribe({
      next: (brand) => {
        this.importing.set(null);
        this.state.upsertBrand(brand);
        this.pickBrand(brand);
      },
      error: () => {
        this.importing.set(null);
        this.error.set('errors.generic');
      },
    });
  }

  protected focusComposer(placeholderUrl = false): void {
    if (placeholderUrl && !this.text()) this.text.set('https://');
    this.composer()?.nativeElement.focus();
  }

  // ── Modèle et médias ──

  protected chooseReferenceFile(): void {
    this.referenceInput()?.nativeElement.click();
  }

  /** Un modèle ajouté : analysé en tâche de fond ; s'il répond à la question, la demande reprend. */
  protected onReferenceFile(event: Event, answer: boolean): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    (event.target as HTMLInputElement).value = '';
    if (!file) return;
    this.uploading.set(true);
    this.api.uploadReference(file).subscribe({
      next: (ref) => {
        this.uploading.set(false);
        this.reference.set(ref);
        this.watchReference(ref.id);
        if (answer) {
          this.reference.set(null);
          this.resume({ referenceId: ref.id });
        }
      },
      error: () => {
        this.uploading.set(false);
        this.error.set('errors.upload');
      },
    });
  }

  private watchReference(id: string): void {
    this.refPoll?.unsubscribe();
    this.refPoll = timer(1500, 1500)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const current = this.reference();
        if (!current || current.id !== id || current.status !== 'analyzing') {
          this.refPoll?.unsubscribe();
          return;
        }
        this.api.reference(id).subscribe({ next: (ref) => this.reference.set(ref), error: () => undefined });
      });
  }

  protected toggleRecent(): void {
    this.showRecent.update((v) => !v);
    if (this.showRecent() && !this.recentReferences().length) {
      this.api.references().subscribe({
        next: ({ references }) => this.recentReferences.set(references.filter((r) => r.status === 'ready' && (r.kind === 'video') === (this.mode() === 'video')).slice(0, 8)),
        error: () => undefined,
      });
    }
  }

  protected useRecent(ref: Reference): void {
    this.showRecent.set(false);
    this.resume({ referenceId: ref.id });
  }

  protected onMediaFiles(event: Event): void {
    const all = Array.from((event.target as HTMLInputElement).files ?? []);
    (event.target as HTMLInputElement).value = '';
    // En vidéo, les vidéos sont déposées avec leur son (elles seront peut-être montées).
    const isVideo = (f: File) => f.type.startsWith('video/') || /\.(mp4|mov|webm|m4v|3gp|mkv)$/i.test(f.name);
    if (this.mode() === 'video' && all.some(isVideo)) this.uploadVideos(all.filter(isVideo));
    const files = this.mode() === 'video' ? all.filter((f) => !isVideo(f)) : all;
    if (!files.length) return;
    // Sans marque encore : une marque provisoire range les médias (et la conversation la prendra).
    const brand = this.brand();
    if (!brand) {
      this.uploading.set(true);
      this.api.autoBrand().subscribe({
        next: (auto) => {
          this.pendingBrand.set(auto);
          this.uploadMediaFiles(auto.id, files);
        },
        error: () => {
          this.uploading.set(false);
          this.error.set('errors.upload');
        },
      });
      return;
    }
    this.uploadMediaFiles(brand.id, files);
  }

  private uploadMediaFiles(brandId: string, files: File[]): void {
    this.uploading.set(true);
    this.api.uploadMedia(brandId, this.mode() === 'image' ? files.slice(0, 1) : files.slice(0, 8)).subscribe({
      next: ({ assets }) => {
        this.uploading.set(false);
        this.media.update((list) => (this.mode() === 'image' ? assets.slice(0, 1) : [...list, ...assets].slice(0, 12)));
      },
      error: () => {
        this.uploading.set(false);
        this.error.set('errors.upload');
      },
    });
  }

  protected onVideoFiles(event: Event): void {
    const files = Array.from((event.target as HTMLInputElement).files ?? []);
    (event.target as HTMLInputElement).value = '';
    this.uploadVideos(files);
  }

  private uploadVideos(files: File[]): void {
    const picked = files.slice(0, Math.max(0, 10 - this.videos().length));
    if (!picked.length) return;
    this.uploading.set(true);
    this.videoPercent.set(0);
    this.api.uploadMontageVideos(picked).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress && event.total) this.videoPercent.set(Math.round((event.loaded / event.total) * 100));
        if (event.type === HttpEventType.Response && event.body) {
          this.uploading.set(false);
          this.videos.update((list) => [...list, ...event.body!.uploads]);
          this.focusComposer();
        }
      },
      error: () => {
        this.uploading.set(false);
        this.error.set('errors.upload');
      },
    });
  }

  protected removeVideo(i: number): void {
    this.videos.update((list) => list.filter((_, k) => k !== i));
  }

  protected removeMedia(id: string): void {
    this.media.update((list) => list.filter((m) => m.id !== id));
  }

  protected useIdea(i: number): void {
    this.text.set(this.translate.instant(`chat.empty.ideas.${this.mode()}${i}`));
    this.focusComposer();
  }

  protected newConversation(): void {
    void this.router.navigate(['/studio', this.mode()], { queryParams: { new: Date.now() } });
  }

  protected openDrawer(): void {
    this.state.drawerOpen.set(true);
  }
}
