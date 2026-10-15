import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';

import { EditorLang, EditorScene, EditorToPreview, PreviewSceneError, PreviewToEditor, SceneAction, formatSeconds, textLabel } from '../index';

type Edits = Record<string, Record<string, string>>;

const TEXT: Record<EditorLang, Record<string, string>> = {
  fr: {
    preview: 'Aperçu de la vidéo',
    play: 'Lire',
    pause: 'Pause',
    goTo: 'Aller à la scène',
    scenes: 'Scènes de la vidéo',
    hint: 'Cliquez dans un texte : la vidéo se place sur sa scène et change pendant que vous écrivez.',
    replace: 'Remplacer la photo',
    photo: 'Photo de la scène',
    noText: 'Cette scène n’a pas de texte.',
    broken: 'Cette scène ne s’exécute pas.',
    brokenAuthor: 'L’IA n’a pas pu écrire cette scène.',
    fix: 'Corriger',
    change: 'Changer cette scène',
    placeholder: 'Ex. : le titre arrive lettre par lettre, la photo occupe tout l’écran.',
    rewrite: 'Réécrire la scène',
    regenerate: 'Nouvelle version',
    working: 'L’IA réécrit cette scène…',
    last: 'Dernière demande :',
  },
  en: {
    preview: 'Video preview',
    play: 'Play',
    pause: 'Pause',
    goTo: 'Go to scene',
    scenes: 'Video scenes',
    hint: 'Click a text: the video jumps to its scene and changes as you type.',
    replace: 'Replace photo',
    photo: 'Scene photo',
    noText: 'This scene has no text.',
    broken: 'This scene does not run.',
    brokenAuthor: 'The AI could not write this scene.',
    fix: 'Fix',
    change: 'Change this scene',
    placeholder: 'E.g. the title arrives letter by letter, the photo fills the screen.',
    rewrite: 'Rewrite the scene',
    regenerate: 'New version',
    working: 'The AI is rewriting this scene…',
    last: 'Last request:',
  },
};

let nextId = 0;

/**
 * L'ÉDITEUR DE VIDÉO partagé par iVision et IDEM.
 *
 * À gauche, l'aperçu : la page autonome du moteur Motion Canvas (le même paquet que le MP4), jouée
 * dans un iframe isolé (`sandbox="allow-scripts"`), et la frise des scènes. À droite, chaque scène :
 * ses textes (des DONNÉES lues par le code de la scène : chaque frappe se voit aussitôt, le code ne
 * change pas), sa photo, et ce que l'utilisateur peut demander à l'IA — réécrire la scène selon une
 * consigne, en faire une nouvelle version, ou corriger une scène dont le code ne s'exécute pas.
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
  },
  template: `
    <div class="ve">
      <section class="ve__stage" [attr.aria-label]="t()['preview']">
        <div class="ve__frame" [style.aspect-ratio]="ratio()">
          <iframe #frame class="ve__iframe" sandbox="allow-scripts" allow="autoplay" [attr.title]="t()['preview']" [srcdoc]="safeHtml()"></iframe>
        </div>

        <div class="ve__timeline">
          <button type="button" class="button-icon ve__play" [attr.aria-label]="playing() ? t()['pause'] : t()['play']" (click)="togglePlay()">
            <i [class]="playing() ? 'pi pi-pause' : 'pi pi-play'" aria-hidden="true"></i>
          </button>
          <div class="ve__track" role="group" [attr.aria-label]="t()['scenes']">
            @for (s of scenes(); track s.key; let i = $index) {
              <button
                type="button"
                class="ve__segment"
                [class.ve__segment--active]="s.key === activeKey()"
                [class.ve__segment--error]="isBroken(s)"
                [style.flex-grow]="s.duration"
                [attr.aria-label]="t()['goTo'] + ' ' + (i + 1) + (isBroken(s) ? ' — ' + t()['broken'] : '')"
                [attr.aria-current]="s.key === activeKey() ? 'step' : null"
                (click)="goTo(s.key)"
              >
                @if (isBroken(s)) {
                  <i class="pi pi-exclamation-triangle" aria-hidden="true"></i>
                } @else {
                  <span>{{ i + 1 }}</span>
                }
              </button>
            }
            <span class="ve__cursor" [style.left.%]="cursor()" aria-hidden="true"></span>
          </div>
          <span class="ve__time">{{ clock() }}</span>
        </div>
      </section>

      <section class="ve__fields custom-scrollbar" [attr.aria-label]="t()['scenes']">
        <p class="ve__hint">{{ t()['hint'] }}</p>
        @for (scene of scenes(); track scene.key; let i = $index) {
          <article class="ve__scene" [class.ve__scene--active]="scene.key === activeKey()" [class.ve__scene--error]="isBroken(scene)" (focusin)="focusScene(scene.key)">
            <header class="ve__scene-head">
              @if (scene.thumbnail) {
                <img class="ve__thumb" [src]="scene.thumbnail" alt="" width="40" height="40" loading="lazy" />
              }
              <span class="ve__scene-index">{{ i + 1 }}</span>
              <span class="ve__scene-name">{{ scene.purpose }}</span>
              <span class="ve__scene-time">{{ format(scene.start) }}</span>
            </header>

            @if (isBroken(scene)) {
              <div class="ve__alert" role="alert">
                <p class="ve__alert-title">
                  <i class="pi pi-exclamation-triangle" aria-hidden="true"></i>
                  {{ scene.error?.stage === 'author' ? t()['brokenAuthor'] : t()['broken'] }}
                </p>
                <p class="ve__alert-detail">{{ errorOf(scene) }}</p>
                <button type="button" class="inner-button button-sm" [disabled]="isBusy(scene.key)" (click)="act({ kind: scene.error?.stage === 'author' ? 'regenerate' : 'fix', key: scene.key })">
                  @if (isBusy(scene.key)) {
                    <idem-loader size="xs" />
                  } @else {
                    <i class="pi pi-wrench" aria-hidden="true"></i>
                  }
                  {{ t()['fix'] }}
                </button>
              </div>
            }

            @for (key of textKeys(scene); track key) {
              <div class="ve__slot">
                <label class="ve__label" [attr.for]="fieldId(scene.key, key)">{{ textName(key) }}</label>
                @if (valueOf(scene, key).length > 60) {
                  <textarea rows="2" maxlength="220" [id]="fieldId(scene.key, key)" [value]="valueOf(scene, key)" (input)="type(scene.key, key, $any($event.target).value)"></textarea>
                } @else {
                  <input type="text" maxlength="220" [id]="fieldId(scene.key, key)" [value]="valueOf(scene, key)" (input)="type(scene.key, key, $any($event.target).value)" />
                }
              </div>
            } @empty {
              <p class="ve__empty">{{ t()['noText'] }}</p>
            }

            @if (allowImages() && imageOf(scene); as img) {
              <div class="ve__photo">
                <img [src]="img" [alt]="t()['photo'] + ' ' + (i + 1)" width="56" height="56" loading="lazy" />
                <button type="button" class="outer-button button-sm" (click)="replaceImage.emit({ key: scene.key })">
                  <i class="pi pi-image" aria-hidden="true"></i> {{ t()['replace'] }}
                </button>
              </div>
            }

            @if (isBusy(scene.key)) {
              <p class="ve__busy" role="status"><idem-loader size="xs" /> {{ t()['working'] }}</p>
            } @else {
              <details class="ve__more">
                <summary>{{ t()['change'] }}</summary>
                @if (scene.instruction) {
                  <p class="ve__last">{{ t()['last'] }} « {{ scene.instruction }} »</p>
                }
                <label class="sr-only" [attr.for]="fieldId(scene.key, '__ask')">{{ t()['change'] }}</label>
                <textarea rows="2" maxlength="800" [id]="fieldId(scene.key, '__ask')" [placeholder]="t()['placeholder']" [value]="askOf(scene.key)" (input)="setAsk(scene.key, $any($event.target).value)"></textarea>
                <div class="ve__actions">
                  <button type="button" class="inner-button button-sm" [disabled]="askOf(scene.key).trim().length < 3" (click)="rewrite(scene.key)">
                    <i class="pi pi-sparkles" aria-hidden="true"></i> {{ t()['rewrite'] }}
                  </button>
                  <button type="button" class="button-ghost button-sm" (click)="act({ kind: 'regenerate', key: scene.key })">
                    <i class="pi pi-refresh" aria-hidden="true"></i> {{ t()['regenerate'] }}
                  </button>
                </div>
              </details>
            }
          </article>
        }
      </section>
    </div>
  `,
  styles: `
    :host { display: block; }
    .ve { display: grid; gap: 1.25rem; grid-template-columns: minmax(0, 1fr); }
    @media (min-width: 960px) {
      .ve { grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr); align-items: start; }
      .ve__stage { position: sticky; top: 1rem; }
      .ve__fields { max-height: calc(100vh - 8rem); overflow-y: auto; padding-right: 0.25rem; }
    }
    .ve__frame { width: 100%; max-height: 72vh; margin-inline: auto; border-radius: 16px; overflow: hidden; border: 1px solid var(--glass-border-subtle); background: var(--color-surface-1); }
    .ve__iframe { width: 100%; height: 100%; border: 0; display: block; }
    .ve__timeline { display: flex; align-items: center; gap: 0.75rem; margin-top: 0.75rem; }
    .ve__play { flex: none; width: 2.25rem; height: 2.25rem; padding: 0; }
    .ve__track { position: relative; flex: 1; display: flex; gap: 3px; height: 2.25rem; }
    .ve__segment { min-width: 1.5rem; border: 1px solid var(--glass-border-subtle); border-radius: 8px; background: var(--glass-bg-light); color: var(--color-text-secondary); font-size: 0.75rem; display: flex; align-items: center; justify-content: center; transition: background 0.2s ease, border-color 0.2s ease; }
    .ve__segment:hover { border-color: var(--color-primary-400); }
    .ve__segment--active { border-color: var(--color-primary-500); color: var(--color-text-primary); background: color-mix(in oklch, var(--color-primary-500) 14%, transparent); }
    .ve__segment--error { border-color: var(--color-danger); color: var(--color-danger); }
    .ve__segment:focus-visible { outline: 2px solid var(--color-primary-500); outline-offset: 2px; }
    .ve__cursor { position: absolute; top: -4px; bottom: -4px; width: 2px; background: var(--color-primary-500); border-radius: 2px; pointer-events: none; transform: translateX(-1px); }
    .ve__time { flex: none; font-variant-numeric: tabular-nums; font-size: 0.8125rem; color: var(--color-text-secondary); min-width: 3.5rem; text-align: right; }
    .ve__hint { font-size: 0.8125rem; color: var(--color-text-secondary); margin: 0 0 0.75rem; }
    .ve__scene { border: 1px solid var(--glass-border-subtle); border-radius: 14px; padding: 0.875rem 1rem; margin-bottom: 0.75rem; transition: border-color 0.2s ease; }
    .ve__scene--active { border-color: var(--color-primary-500); }
    .ve__scene--error { border-color: var(--color-danger); }
    .ve__scene-head { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.625rem; min-width: 0; }
    .ve__thumb { width: 40px; height: 40px; object-fit: cover; border-radius: 8px; border: 1px solid var(--glass-border-subtle); flex: none; }
    .ve__scene-index { font-size: 0.75rem; font-weight: 600; color: var(--color-primary-500); flex: none; }
    .ve__scene-name { font-weight: 600; color: var(--color-text-primary); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ve__scene-time { margin-left: auto; font-size: 0.75rem; color: var(--color-text-tertiary); font-variant-numeric: tabular-nums; flex: none; }
    .ve__alert { border-radius: 10px; padding: 0.625rem 0.75rem; margin-bottom: 0.75rem; background: color-mix(in oklch, var(--color-danger) 8%, transparent); }
    .ve__alert-title { display: flex; align-items: center; gap: 0.375rem; margin: 0; font-size: 0.8125rem; font-weight: 600; color: var(--color-danger); }
    .ve__alert-detail { margin: 0.25rem 0 0.5rem; font-size: 0.75rem; color: var(--color-text-secondary); font-family: ui-monospace, monospace; overflow-wrap: anywhere; }
    .ve__photo { display: flex; align-items: center; gap: 0.75rem; margin-top: 0.625rem; }
    .ve__photo img { width: 56px; height: 56px; object-fit: cover; border-radius: 10px; border: 1px solid var(--glass-border-subtle); }
    .ve__slot + .ve__slot { margin-top: 0.5rem; }
    .ve__label { display: block; font-size: 0.75rem; color: var(--color-text-secondary); margin-bottom: 0.25rem; }
    .ve__slot input, .ve__slot textarea, .ve__more textarea { width: 100%; }
    .ve__empty { font-size: 0.8125rem; color: var(--color-text-tertiary); margin: 0; }
    .ve__more { margin-top: 0.75rem; }
    .ve__more summary { cursor: pointer; font-size: 0.8125rem; font-weight: 600; color: var(--color-text-secondary); }
    .ve__more[open] summary { margin-bottom: 0.5rem; }
    .ve__last { font-size: 0.75rem; color: var(--color-text-tertiary); margin: 0 0 0.5rem; }
    .ve__actions { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem; }
    .ve__busy { display: flex; align-items: center; gap: 0.5rem; margin: 0.75rem 0 0; font-size: 0.8125rem; color: var(--color-text-secondary); }
  `,
})
export class IdemVideoEditorComponent {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);
  private readonly frame = viewChild<ElementRef<HTMLIFrameElement>>('frame');
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
  /** Erreurs constatées par l'aperçu lui-même (une scène qui échoue en cours de lecture). */
  private readonly liveErrors = signal<Record<string, PreviewSceneError>>({});

  protected readonly activeKey = computed(() => {
    const t = this.now();
    const list = this.scenes();
    return list.find((s) => t >= s.start && t < s.start + s.duration)?.key ?? list[list.length - 1]?.key ?? null;
  });
  protected readonly cursor = computed(() => {
    const total = this.duration() || this.scenes().reduce((sum, s) => Math.max(sum, s.start + s.duration), 0) || 1;
    return Math.min(100, (this.now() / total) * 100);
  });
  protected readonly clock = computed(() => formatSeconds(this.now()));

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
    this.act({ kind: 'revise', key, instruction });
    this.asks.update((all) => ({ ...all, [key]: '' }));
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

  /** Le champ d'une scène prend le focus : la vidéo s'y place (une fois, pas à chaque champ). */
  protected focusScene(key: string): void {
    if (this.focused === key) return;
    this.goTo(key);
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
