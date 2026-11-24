import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';

import { EditorLang, EditorScene, EditorToPreview, PreviewSceneError, PreviewToEditor, SceneAction, ScenePoint, formatSeconds, pointLabel, textLabel } from '../index';

type Edits = Record<string, Record<string, string>>;

const TEXT: Record<EditorLang, Record<string, string>> = {
  fr: {
    preview: 'Aperçu de la vidéo',
    play: 'Lire',
    pause: 'Pause',
    seek: 'Position dans la vidéo',
    fullscreen: 'Plein écran',
    loading: 'Chargement du son et des images…',
    goTo: 'Aller à la scène',
    scene: 'Scène',
    scenes: 'Scènes de la vidéo',
    edit: 'Modifier cette scène',
    close: 'Fermer',
    texts: 'Textes',
    replace: 'Remplacer la photo',
    photo: 'Photo de la scène',
    broken: 'Cette scène ne s’exécute pas.',
    brokenAuthor: 'L’IA n’a pas pu écrire cette scène.',
    fix: 'Corriger',
    change: 'Demander un changement à l’IA',
    placeholder: 'Ex. : le titre plus grand, la photo en plein écran.',
    rewrite: 'Appliquer',
    regenerate: 'Autre version',
    working: 'L’IA réécrit cette scène…',
    point: 'Pointer un endroit de la vidéo',
    pointHint: 'Tracez une zone sur l’image, ou cliquez dessus. Échap pour annuler.',
    pointed: 'Zone pointée',
    removePoint: 'Retirer la zone pointée',
  },
  en: {
    preview: 'Video preview',
    play: 'Play',
    pause: 'Pause',
    seek: 'Position in the video',
    fullscreen: 'Full screen',
    loading: 'Loading sound and pictures…',
    goTo: 'Go to scene',
    scene: 'Scene',
    scenes: 'Video scenes',
    edit: 'Edit this scene',
    close: 'Close',
    texts: 'Texts',
    replace: 'Replace photo',
    photo: 'Scene photo',
    broken: 'This scene does not run.',
    brokenAuthor: 'The AI could not write this scene.',
    fix: 'Fix',
    change: 'Ask the AI for a change',
    placeholder: 'E.g. a bigger title, the photo full screen.',
    rewrite: 'Apply',
    regenerate: 'Another version',
    working: 'The AI is rewriting this scene…',
    point: 'Point at a spot in the video',
    pointHint: 'Draw a box on the picture, or click it. Esc to cancel.',
    pointed: 'Pointed area',
    removePoint: 'Remove the pointed area',
  },
};

let nextId = 0;

/**
 * L'ÉDITEUR DE VIDÉO partagé par iVision et IDEM.
 *
 * Un LECTEUR d'abord (24/11/2026 : l'ancienne colonne listait toutes les scènes, leurs descriptions et tous leurs
 * textes — trop de texte) : la page autonome du moteur HyperFrames (la même composition que le MP4), jouée dans un
 * iframe isolé (`sandbox="allow-scripts"`), une barre de lecture (progression cliquable, repères de scènes, plein
 * écran) et la bande des vignettes de scènes. Rien d'autre à l'écran : « Modifier cette scène » ouvre, pour la
 * seule scène choisie, ses textes (des DONNÉES lues par son code : chaque frappe se voit aussitôt), sa photo, et
 * la demande à l'IA (réécrire selon une consigne, autre version). Une scène en panne garde son bouton « Corriger ».
 *
 * Le composant ne parle pas au serveur : il émet `edit` (textes en attente, après une pause de
 * frappe), `replaceImage` et `action` (réécrire, nouvelle version, corriger). L'hôte enregistre.
 *
 * @example
 * ```html
 * <idem-video-editor [html]="previewHtml()" [scenes]="scenes()" [ratio]="9 / 16" lang="fr"
 *   [busy]="rewriting()" (edit)="saveTexts($event)" (replaceImage)="pickPhoto($event.key)"
 *   (action)="sceneAction($event)" />
 * ```
 */
@Component({
  selector: 'idem-video-editor',
  imports: [IdemLoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'idem-video-editor',
    '(window:message)': 'onMessage($event)',
    '(document:keydown.escape)': 'pointing() && togglePoint()',
  },
  template: `
    <div class="ve" [class.ve--editing]="!!editingScene()" [style.--r]="ratio()">
      <section class="ve__player" [attr.aria-label]="t()['preview']">
        <div #box class="ve__frame" [style.aspect-ratio]="ratio()">
          <iframe #frame class="ve__iframe" sandbox="allow-scripts" allow="autoplay; fullscreen" [attr.title]="t()['preview']" [srcdoc]="safeHtml()"></iframe>
          @if (!playing() && !pointing()) {
            <button type="button" class="ve__big-play" [attr.aria-label]="t()['play']" (click)="togglePlay()">
              <span class="ve__big-play-disc"><i class="pi pi-play" aria-hidden="true"></i></span>
              @if (loading(); as l) {
                <span class="ve__loading"><idem-loader size="xs" /> {{ t()['loading'] }} {{ l.loaded }}/{{ l.total }}</span>
              }
            </button>
          }
          @if (pointing()) {
            <div class="ve__pick" (pointerdown)="pickStart($event)" (pointermove)="pickMove($event)" (pointerup)="pickEnd($event)" (pointercancel)="drag.set(null)">
              @if (drag(); as d) {
                <span class="ve__pick-zone" [style.left.%]="min(d.x0, d.x) * 100" [style.top.%]="min(d.y0, d.y) * 100" [style.width.%]="abs(d.x - d.x0) * 100" [style.height.%]="abs(d.y - d.y0) * 100"></span>
              }
              <p class="ve__pick-hint" role="status">{{ t()['pointHint'] }}</p>
            </div>
          }
        </div>

        <div class="ve__bar">
          <button type="button" class="button-icon ve__btn" [attr.aria-label]="playing() ? t()['pause'] : t()['play']" (click)="togglePlay()">
            <i [class]="playing() ? 'pi pi-pause' : 'pi pi-play'" aria-hidden="true"></i>
          </button>
          <div
            class="ve__progress"
            role="slider"
            tabindex="0"
            [attr.aria-label]="t()['seek']"
            aria-valuemin="0"
            [attr.aria-valuemax]="total()"
            [attr.aria-valuenow]="now()"
            [attr.aria-valuetext]="clock() + ' / ' + format(total())"
            (click)="seekAt($event)"
            (keydown.arrowright)="nudge(1)"
            (keydown.arrowleft)="nudge(-1)"
          >
            <span class="ve__progress-fill" [style.width.%]="cursor()"></span>
            @for (s of scenes(); track s.key; let first = $first) {
              @if (!first) {
                <span class="ve__tick" [style.left.%]="(s.start / total()) * 100" aria-hidden="true"></span>
              }
            }
          </div>
          <span class="ve__time">{{ clock() }} / {{ format(total()) }}</span>
          <button type="button" class="button-icon ve__btn" [class.ve__btn--on]="pointing()" [attr.aria-pressed]="pointing()" [attr.aria-label]="t()['point']" [attr.title]="t()['point']" (click)="togglePoint()">
            <i class="pi pi-bullseye" aria-hidden="true"></i>
          </button>
          <button type="button" class="button-icon ve__btn" [attr.aria-label]="t()['fullscreen']" [attr.title]="t()['fullscreen']" (click)="fullscreen()">
            <i class="pi pi-window-maximize" aria-hidden="true"></i>
          </button>
        </div>

        <div class="ve__strip custom-scrollbar" role="group" [attr.aria-label]="t()['scenes']">
          @for (s of scenes(); track s.key; let i = $index) {
            <button
              type="button"
              class="ve__shot"
              [class.ve__shot--active]="s.key === activeKey()"
              [class.ve__shot--error]="isBroken(s)"
              [attr.aria-label]="t()['goTo'] + ' ' + (i + 1) + (isBroken(s) ? ' — ' + t()['broken'] : '')"
              [attr.aria-current]="s.key === activeKey() ? 'step' : null"
              (click)="pickScene(s.key)"
            >
              @if (s.thumbnail) {
                <img [src]="s.thumbnail" alt="" width="56" height="56" loading="lazy" />
              }
              <span class="ve__shot-num">
                @if (isBroken(s)) { <i class="pi pi-exclamation-triangle" aria-hidden="true"></i> } @else { {{ i + 1 }} }
              </span>
            </button>
          }
        </div>

        @if (!editingScene()) {
          <div class="ve__actions-row">
            @if (activeScene(); as a) {
              <button type="button" class="outer-button button-sm" (click)="openEdit(a.key)">
                <i class="pi pi-pencil" aria-hidden="true"></i> {{ t()['edit'] }} {{ indexOf(a.key) + 1 }}
              </button>
            }
          </div>
        }
      </section>

      @if (editingScene(); as scene) {
        <section class="ve__panel glass-card" [attr.aria-label]="t()['scene'] + ' ' + (indexOf(scene.key) + 1)">
          <header class="ve__panel-head">
            @if (scene.thumbnail) {
              <img class="ve__thumb" [src]="scene.thumbnail" alt="" width="40" height="40" />
            }
            <h3 class="ve__panel-title">{{ t()['scene'] }} {{ indexOf(scene.key) + 1 }} <span>· {{ format(scene.start) }}</span></h3>
            <button type="button" class="button-icon ve__btn" [attr.aria-label]="t()['close']" (click)="closeEdit()">
              <i class="pi pi-times" aria-hidden="true"></i>
            </button>
          </header>

          @if (isBroken(scene)) {
            <div class="ve__alert" role="alert">
              <p class="ve__alert-title">
                <i class="pi pi-exclamation-triangle" aria-hidden="true"></i>
                {{ scene.error?.stage === 'author' ? t()['brokenAuthor'] : t()['broken'] }}
              </p>
              <button type="button" class="inner-button button-sm" [disabled]="isBusy(scene.key)" (click)="act({ kind: scene.error?.stage === 'author' ? 'regenerate' : 'fix', key: scene.key })">
                @if (isBusy(scene.key)) { <idem-loader size="xs" /> } @else { <i class="pi pi-wrench" aria-hidden="true"></i> }
                {{ t()['fix'] }}
              </button>
            </div>
          }

          @if (textKeys(scene).length) {
            <div class="ve__group">
              @for (key of textKeys(scene); track key) {
                <div class="ve__slot">
                  <label class="ve__label" [attr.for]="fieldId(scene.key, key)">{{ textName(key) }}</label>
                  @if (valueOf(scene, key).length > 60) {
                    <textarea rows="2" maxlength="220" [id]="fieldId(scene.key, key)" [value]="valueOf(scene, key)" (input)="type(scene.key, key, $any($event.target).value)"></textarea>
                  } @else {
                    <input type="text" maxlength="220" [id]="fieldId(scene.key, key)" [value]="valueOf(scene, key)" (input)="type(scene.key, key, $any($event.target).value)" />
                  }
                </div>
              }
            </div>
          }

          @if (allowImages() && imageOf(scene); as img) {
            <div class="ve__photo">
              <img [src]="img" [alt]="t()['photo'] + ' ' + (indexOf(scene.key) + 1)" width="48" height="48" loading="lazy" />
              <button type="button" class="outer-button button-sm" (click)="replaceImage.emit({ key: scene.key })">
                <i class="pi pi-image" aria-hidden="true"></i> {{ t()['replace'] }}
              </button>
            </div>
          }

          <div class="ve__group">
            @if (isBusy(scene.key)) {
              <p class="ve__busy" role="status"><idem-loader size="xs" /> {{ t()['working'] }}</p>
            } @else {
              <label class="ve__label" [attr.for]="fieldId(scene.key, '__ask')">{{ t()['change'] }}</label>
              @if (pointOf(scene.key); as p) {
                <p class="ve__point">
                  <i class="pi pi-bullseye" aria-hidden="true"></i>
                  <span>{{ t()['pointed'] }} · {{ pointName(p) }}</span>
                  <button type="button" class="button-icon ve__point-off" [attr.aria-label]="t()['removePoint']" (click)="clearPoint(scene.key)">
                    <i class="pi pi-times" aria-hidden="true"></i>
                  </button>
                </p>
              }
              <textarea rows="2" maxlength="800" [id]="fieldId(scene.key, '__ask')" [placeholder]="t()['placeholder']" [value]="askOf(scene.key)" (input)="setAsk(scene.key, $any($event.target).value)"></textarea>
              <div class="ve__actions">
                <button type="button" class="inner-button button-sm" [disabled]="askOf(scene.key).trim().length < 3" (click)="rewrite(scene.key)">
                  <i class="pi pi-sparkles" aria-hidden="true"></i> {{ t()['rewrite'] }}
                </button>
                <button type="button" class="button-ghost button-sm" (click)="act({ kind: 'regenerate', key: scene.key })">
                  <i class="pi pi-refresh" aria-hidden="true"></i> {{ t()['regenerate'] }}
                </button>
              </div>
            }
          </div>
        </section>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .ve { display: grid; gap: 1.25rem; grid-template-columns: minmax(0, 1fr); justify-items: center; }
    @media (min-width: 960px) {
      .ve--editing { grid-template-columns: minmax(0, 1fr) minmax(18rem, 24rem); align-items: start; }
      .ve--editing .ve__panel { position: sticky; top: 1rem; }
    }
    /* Le lecteur garde la largeur de la vidéo : une story ne dépasse jamais l'écran en hauteur. */
    .ve__player { width: min(100%, max(calc(70vh * var(--r, 0.5625)), 21rem)); }
    .ve__frame { position: relative; width: 100%; border-radius: 16px; overflow: hidden; border: 1px solid var(--glass-border-subtle); background: var(--color-surface-1); }
    .ve__frame:fullscreen { border-radius: 0; border: 0; aspect-ratio: auto !important; width: 100%; height: 100%; }
    .ve__iframe { width: 100%; height: 100%; border: 0; display: block; }
    .ve__big-play { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.75rem; background: color-mix(in oklch, var(--color-text-primary) 8%, transparent); border: 0; cursor: pointer; }
    .ve__big-play-disc { display: flex; align-items: center; justify-content: center; width: 4rem; height: 4rem; border-radius: 999px; background: var(--color-primary-500); color: var(--color-on-primary); font-size: 1.4rem; box-shadow: 0 6px 24px color-mix(in oklch, var(--color-primary-500) 40%, transparent); transition: transform 0.15s ease; }
    .ve__big-play-disc .pi { margin-left: 0.2rem; }
    .ve__big-play:hover .ve__big-play-disc { transform: scale(1.06); }
    .ve__big-play:focus-visible .ve__big-play-disc { outline: 3px solid var(--color-primary-300, var(--color-primary-500)); outline-offset: 3px; }
    .ve__loading { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.3rem 0.7rem; border-radius: 999px; background: var(--color-surface-1); color: var(--color-text-secondary); font-size: 0.75rem; }
    .ve__bar { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.6rem; }
    .ve__btn { flex: none; width: 2.1rem; height: 2.1rem; padding: 0; }
    .ve__btn--on { border-color: var(--color-primary-500); color: var(--color-primary-500); background: color-mix(in oklch, var(--color-primary-500) 14%, transparent); }
    .ve__progress { position: relative; flex: 1; height: 0.4rem; border-radius: 999px; background: var(--glass-bg-medium, var(--glass-bg-light)); cursor: pointer; }
    .ve__progress::before { content: ''; position: absolute; inset: -0.6rem 0; }
    .ve__progress:focus-visible { outline: 2px solid var(--color-primary-500); outline-offset: 4px; }
    .ve__progress-fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: inherit; background: var(--color-primary-500); pointer-events: none; }
    .ve__tick { position: absolute; top: -2px; bottom: -2px; width: 2px; background: var(--color-surface-1); pointer-events: none; }
    .ve__time { flex: none; font-variant-numeric: tabular-nums; font-size: 0.75rem; color: var(--color-text-secondary); }
    .ve__strip { display: flex; gap: 0.4rem; margin-top: 0.75rem; overflow-x: auto; padding-bottom: 0.25rem; }
    .ve__shot { position: relative; flex: none; width: 3.5rem; height: 3.5rem; border-radius: 10px; overflow: hidden; border: 2px solid transparent; background: var(--glass-bg-light); padding: 0; transition: border-color 0.15s ease, opacity 0.15s ease; opacity: 0.75; }
    .ve__shot img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .ve__shot:hover { opacity: 1; }
    .ve__shot--active { border-color: var(--color-primary-500); opacity: 1; }
    .ve__shot--error { border-color: var(--color-danger); opacity: 1; }
    .ve__shot:focus-visible { outline: 2px solid var(--color-primary-500); outline-offset: 2px; }
    .ve__shot-num { position: absolute; left: 0.25rem; bottom: 0.2rem; min-width: 1.1rem; padding: 0 0.25rem; border-radius: 6px; background: var(--color-surface-1); color: var(--color-text-primary); font-size: 0.65rem; font-weight: 700; line-height: 1.1rem; text-align: center; }
    .ve__shot--error .ve__shot-num { color: var(--color-danger); }
    .ve__actions-row { display: flex; justify-content: center; margin-top: 0.75rem; }
    .ve__panel { width: 100%; padding: 1rem; }
    .ve__panel-head { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.75rem; }
    .ve__panel-title { flex: 1; margin: 0; font-size: 0.95rem; font-weight: 700; color: var(--color-text-primary); }
    .ve__panel-title span { font-weight: 500; font-size: 0.8rem; color: var(--color-text-tertiary); font-variant-numeric: tabular-nums; }
    .ve__thumb { width: 40px; height: 40px; object-fit: cover; border-radius: 8px; flex: none; }
    .ve__group { display: flex; flex-direction: column; gap: 0.5rem; }
    .ve__group + .ve__group, .ve__photo + .ve__group, .ve__group + .ve__photo { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--glass-border-subtle); }
    .ve__label { display: block; font-size: 0.75rem; font-weight: 600; color: var(--color-text-secondary); margin-bottom: 0.25rem; }
    .ve__slot input, .ve__slot textarea, .ve__group textarea { width: 100%; }
    .ve__alert { border-radius: 10px; padding: 0.625rem 0.75rem; margin-bottom: 0.75rem; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.5rem; background: color-mix(in oklch, var(--color-danger) 8%, transparent); }
    .ve__alert-title { display: flex; align-items: center; gap: 0.375rem; margin: 0; font-size: 0.8125rem; font-weight: 600; color: var(--color-danger); }
    .ve__photo { display: flex; align-items: center; gap: 0.75rem; }
    .ve__photo img { width: 48px; height: 48px; object-fit: cover; border-radius: 10px; }
    .ve__actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .ve__pick { position: absolute; inset: 0; cursor: crosshair; touch-action: none; background: color-mix(in oklch, var(--color-primary-500) 6%, transparent); }
    .ve__pick-zone { position: absolute; border: 2px solid var(--color-primary-500); border-radius: 6px; background: color-mix(in oklch, var(--color-primary-500) 14%, transparent); pointer-events: none; }
    .ve__pick-hint { position: absolute; left: 0.5rem; right: 0.5rem; bottom: 0.5rem; margin: 0; padding: 0.4rem 0.6rem; border-radius: 8px; background: var(--color-surface-1); color: var(--color-text-secondary); font-size: 0.75rem; text-align: center; pointer-events: none; }
    .ve__point { display: flex; align-items: center; gap: 0.375rem; margin: 0; font-size: 0.75rem; color: var(--color-text-secondary); }
    .ve__point span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ve__point-off { flex: none; width: 1.5rem; height: 1.5rem; padding: 0; margin-left: auto; }
    .ve__busy { display: flex; align-items: center; gap: 0.5rem; margin: 0; font-size: 0.8125rem; color: var(--color-text-secondary); }
  `,
})
export class IdemVideoEditorComponent {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);
  private readonly frame = viewChild<ElementRef<HTMLIFrameElement>>('frame');
  private readonly box = viewChild<ElementRef<HTMLElement>>('box');
  private readonly uid = `ve${++nextId}`;

  /** La page d'aperçu du moteur (`GET …/videos/:id/preview` → `html`). */
  readonly html = input.required<string>();
  /** Les scènes du film (`editorScenes(video)`). */
  readonly scenes = input.required<EditorScene[]>();
  /** Largeur / hauteur du format affiché (9/16 pour une story). */
  readonly ratio = input<number>(9 / 16);
  readonly lang = input<EditorLang>('fr');
  readonly allowImages = input<boolean>(true);
  /** Les scènes que l'IA est en train de réécrire (leur bouton attend). */
  readonly busy = input<string[]>([]);

  /** Les retouches de texte en attente (clé de scène → clé de texte → texte), après une pause de frappe. */
  readonly edit = output<Edits>();
  readonly replaceImage = output<{ key: string }>();
  /** Réécrire une scène selon une consigne, en faire une nouvelle version, ou corriger son code. */
  readonly action = output<SceneAction>();

  protected readonly t = computed(() => TEXT[this.lang()] ?? TEXT.fr);
  protected readonly safeHtml = computed(() => this.sanitizer.bypassSecurityTrustHtml(this.html()));
  protected readonly edits = signal<Edits>({});
  protected readonly asks = signal<Record<string, string>>({});
  protected readonly now = signal(0);
  protected readonly playing = signal(false);
  protected readonly duration = signal(0);
  /** Le mode « pointer » : une zone se trace sur l'aperçu (en fractions de l'iframe). */
  protected readonly pointing = signal(false);
  protected readonly drag = signal<{ x0: number; y0: number; x: number; y: number } | null>(null);
  /** Les endroits pointés, par scène, en attente de leur consigne. */
  protected readonly points = signal<Record<string, ScenePoint>>({});
  /** La scène ouverte dans le panneau « Modifier cette scène » (aucune : le lecteur seul). */
  protected readonly editing = signal<string | null>(null);
  /** Sons, photos et clips en cours de mise en mémoire (null : tout est prêt). */
  protected readonly loading = signal<{ loaded: number; total: number } | null>(null);
  protected readonly min = Math.min;
  protected readonly abs = Math.abs;
  /** Erreurs constatées par l'aperçu lui-même (une scène qui échoue en cours de lecture). */
  private readonly liveErrors = signal<Record<string, PreviewSceneError>>({});

  protected readonly activeKey = computed(() => {
    const t = this.now();
    const list = this.scenes();
    return list.find((s) => t >= s.start && t < s.start + s.duration)?.key ?? list[list.length - 1]?.key ?? null;
  });
  protected readonly cursor = computed(() => {
    return Math.min(100, (this.now() / this.total()) * 100);
  });
  protected readonly clock = computed(() => formatSeconds(this.now()));
  protected readonly total = computed(() => this.duration() || this.scenes().reduce((sum, s) => Math.max(sum, s.start + s.duration), 0) || 1);
  protected readonly activeScene = computed(() => this.scenes().find((s) => s.key === this.activeKey()) ?? null);
  protected readonly editingScene = computed(() => this.scenes().find((s) => s.key === this.editing()) ?? null);

  private debounce: ReturnType<typeof setTimeout> | null = null;
  private focused: string | null = null;
  private typedSinceFlush = new Set<string>();

  constructor() {
    // Nouvelles scènes (vidéo rechargée, retouche enregistrée) : le formulaire repart de leurs textes ;
    // ce qui a été tapé PENDANT l'enregistrement est gardé.
    effect(() => {
      const scenes = this.scenes();
      untracked(() => {
        const typing = this.typedSinceFlush;
        const current = this.edits();
        this.edits.set(Object.fromEntries(scenes.map((s) => [s.key, { ...s.texts, ...Object.fromEntries(Object.entries(current[s.key] || {}).filter(([k]) => typing.has(`${s.key}|${k}`))) }])));
      });
    });
    effect(() => {
      this.html();
      untracked(() => {
        this.playing.set(false);
        this.now.set(0);
        this.liveErrors.set({});
        this.loading.set(null);
      });
    });
    this.destroyRef.onDestroy(() => this.flush());
  }

  protected isBroken(scene: EditorScene): boolean {
    return scene.status === 'error' || !!this.liveErrors()[scene.key];
  }

  protected errorOf(scene: EditorScene): string {
    return scene.error?.message || this.liveErrors()[scene.key]?.message || '';
  }

  protected isBusy(key: string): boolean {
    return this.busy().includes(key);
  }

  protected textKeys(scene: EditorScene): string[] {
    return Object.keys(scene.texts);
  }

  protected textName(key: string): string {
    return textLabel(key, this.lang());
  }

  protected imageOf(scene: EditorScene): string | null {
    return scene.media.find((m) => m.kind === 'image')?.url ?? null;
  }

  protected format(t: number): string {
    return formatSeconds(t);
  }

  protected fieldId(sceneKey: string, key: string): string {
    return `${this.uid}-${sceneKey}-${key}`;
  }

  protected valueOf(scene: EditorScene, key: string): string {
    return this.edits()[scene.key]?.[key] ?? scene.texts[key] ?? '';
  }

  protected askOf(key: string): string {
    return this.asks()[key] ?? '';
  }

  protected setAsk(key: string, value: string): void {
    this.asks.update((all) => ({ ...all, [key]: value }));
  }

  protected rewrite(key: string): void {
    const instruction = this.askOf(key).trim();
    if (instruction.length < 3) return;
    const point = this.points()[key];
    this.act({ kind: 'revise', key, instruction, ...(point ? { point } : {}) });
    this.asks.update((all) => ({ ...all, [key]: '' }));
    this.clearPoint(key);
  }

  protected pointOf(key: string): ScenePoint | null {
    return this.points()[key] ?? null;
  }

  protected pointName(point: ScenePoint): string {
    return pointLabel(point, this.lang());
  }

  protected clearPoint(key: string): void {
    this.points.update((all) => Object.fromEntries(Object.entries(all).filter(([k]) => k !== key)));
  }

  protected indexOf(key: string): number {
    return this.scenes().findIndex((s) => s.key === key);
  }

  /** Une vignette : la vidéo va à la scène ; si le panneau est ouvert, il suit. */
  protected pickScene(key: string): void {
    this.goTo(key);
    if (this.editing()) this.openEdit(key);
  }

  /** Ouvre le panneau d'une scène : la lecture s'arrête sur elle. */
  protected openEdit(key: string): void {
    if (this.playing()) this.post({ type: 'ivision:pause' });
    this.editing.set(key);
    this.goTo(key);
  }

  protected closeEdit(): void {
    this.flush();
    this.editing.set(null);
  }

  /** Un clic sur la barre de progression : la vidéo va à cet instant. */
  protected seekAt(event: MouseEvent): void {
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (event.clientX - box.left) / (box.width || 1)));
    this.post({ type: 'ivision:seek', t: f * this.total() });
  }

  protected nudge(seconds: number): void {
    this.post({ type: 'ivision:seek', t: Math.min(this.total(), Math.max(0, this.now() + seconds)) });
  }

  protected fullscreen(): void {
    const el = this.box()?.nativeElement;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.().catch(() => undefined);
  }

  protected togglePoint(): void {
    this.drag.set(null);
    this.pointing.update((on) => !on);
    if (this.pointing() && this.playing()) this.post({ type: 'ivision:pause' });
  }

  private fraction(event: PointerEvent): { x: number; y: number } {
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (event.clientX - box.left) / (box.width || 1))), y: Math.min(1, Math.max(0, (event.clientY - box.top) / (box.height || 1))) };
  }

  protected pickStart(event: PointerEvent): void {
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    const p = this.fraction(event);
    this.drag.set({ x0: p.x, y0: p.y, x: p.x, y: p.y });
  }

  protected pickMove(event: PointerEvent): void {
    const d = this.drag();
    if (!d) return;
    const p = this.fraction(event);
    this.drag.set({ ...d, x: p.x, y: p.y });
  }

  /** La zone tracée part à l'aperçu ; un simple clic vaut une petite zone autour du point. */
  protected pickEnd(event: PointerEvent): void {
    const d = this.drag();
    this.drag.set(null);
    if (!d) return;
    const p = this.fraction(event);
    let x = Math.min(d.x0, p.x), y = Math.min(d.y0, p.y), w = Math.abs(p.x - d.x0), h = Math.abs(p.y - d.y0);
    if (w < 0.02 && h < 0.02) {
      x = Math.max(0, p.x - 0.04);
      y = Math.max(0, p.y - 0.03);
      w = 0.08;
      h = 0.06;
    }
    this.post({ type: 'ivision:pick', x, y, w, h });
  }

  protected act(action: SceneAction): void {
    this.flush();
    this.action.emit(action);
  }

  /** Une frappe : la vidéo change tout de suite, l'enregistrement attend une pause. */
  protected type(sceneKey: string, key: string, value: string): void {
    this.edits.update((all) => ({ ...all, [sceneKey]: { ...(all[sceneKey] || {}), [key]: value } }));
    this.typedSinceFlush.add(`${sceneKey}|${key}`);
    this.post({ type: 'ivision:edit', key: sceneKey, texts: { [key]: value } });
    if (this.debounce) clearTimeout(this.debounce);
    this.debounce = setTimeout(() => this.flush(), 800);
  }

  protected goTo(key: string): void {
    this.focused = key;
    this.post({ type: 'ivision:focus', key });
  }

  protected togglePlay(): void {
    this.post({ type: this.playing() ? 'ivision:pause' : 'ivision:play' });
  }

  /** L'hôte a remplacé la photo d'une scène : l'aperçu la montre sans être rechargé. */
  previewImage(key: string, url: string): void {
    const scene = this.scenes().find((s) => s.key === key);
    const image = scene?.media.find((m) => m.kind === 'image');
    if (image) this.post({ type: 'ivision:edit', key, media: [{ id: image.id, url }] });
  }

  protected onMessage(event: MessageEvent): void {
    const win = this.frame()?.nativeElement.contentWindow;
    if (!win || event.source !== win) return;
    const m = event.data as PreviewToEditor;
    if (m?.type === 'ivision:ready') {
      this.duration.set(m.duration);
      this.recordErrors(m.errors);
      const pending = Object.entries(this.pendingEdits());
      for (const [key, texts] of pending) this.post({ type: 'ivision:edit', key, texts, focus: false });
      const first = this.focused ?? pending[0]?.[0];
      if (first) this.post({ type: 'ivision:focus', key: first });
    } else if (m?.type === 'ivision:time') {
      this.now.set(m.t);
      this.playing.set(m.playing);
    } else if (m?.type === 'ivision:errors') {
      this.recordErrors(m.errors);
    } else if (m?.type === 'ivision:loading') {
      this.loading.set(m.loaded >= m.total ? null : { loaded: m.loaded, total: m.total });
    } else if (m?.type === 'ivision:playable') {
      this.loading.set(null);
    } else if (m?.type === 'ivision:picked' && this.scenes().some((s) => s.key === m.key)) {
      // L'aperçu a relevé la scène et ce qui se trouve sous la zone : la consigne de cette scène s'ouvre, prête.
      this.points.update((all) => ({ ...all, [m.key]: { at: m.at, zone: m.zone, roles: m.roles, ...(m.texts?.length ? { texts: m.texts } : {}) } }));
      this.pointing.set(false);
      this.focused = m.key;
      this.editing.set(m.key);
      setTimeout(() => (document.getElementById(this.fieldId(m.key, '__ask')) as HTMLTextAreaElement | null)?.focus(), 0);
    }
  }

  private recordErrors(errors: PreviewSceneError[] = []): void {
    const known = new Set(this.scenes().map((s) => s.key));
    this.liveErrors.set(Object.fromEntries(errors.filter((e) => known.has(e.key)).map((e) => [e.key, e])));
  }

  private pendingEdits(): Edits {
    const out: Edits = {};
    for (const scene of this.scenes()) {
      const changed = Object.entries(this.edits()[scene.key] || {}).filter(([k, v]) => (scene.texts[k] ?? '') !== v);
      if (changed.length) out[scene.key] = Object.fromEntries(changed);
    }
    return out;
  }

  private flush(): void {
    if (this.debounce) clearTimeout(this.debounce);
    this.debounce = null;
    const pending = this.pendingEdits();
    this.typedSinceFlush = new Set();
    if (Object.keys(pending).length) this.edit.emit(pending);
  }

  private post(message: EditorToPreview): void {
    // L'aperçu est un document `srcdoc` sandboxé (origine opaque) : `*` est la seule cible possible ;
    // le message ne contient que ce que l'utilisateur vient d'écrire.
    this.frame()?.nativeElement.contentWindow?.postMessage(message, '*');
  }
}
