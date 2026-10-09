import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

import {
  EditorLang,
  EditorScene,
  EditorSlotDefs,
  EditorToPreview,
  PreviewToEditor,
  formatSeconds,
  sceneLabel,
  slotLabel,
} from '../index';

type Edits = Record<string, Record<string, string>>;

const TEXT: Record<EditorLang, Record<string, string>> = {
  fr: {
    preview: 'Aperçu de la vidéo',
    play: 'Lire',
    pause: 'Pause',
    goTo: 'Aller à la scène',
    scene: 'Scène',
    texts: 'Textes de la vidéo',
    hint: 'Cliquez dans un texte : la vidéo se place à l’instant où il s’affiche, et change pendant que vous écrivez.',
    replace: 'Remplacer la photo',
    saving: 'Enregistrement…',
    saved: 'Enregistré',
    photo: 'Photo de la scène',
    noText: 'Cette scène n’a pas de texte.',
  },
  en: {
    preview: 'Video preview',
    play: 'Play',
    pause: 'Pause',
    goTo: 'Go to scene',
    scene: 'Scene',
    texts: 'Video texts',
    hint: 'Click a text: the video jumps to the moment it shows, and changes as you type.',
    replace: 'Replace photo',
    saving: 'Saving…',
    saved: 'Saved',
    photo: 'Scene photo',
    noText: 'This scene has no text.',
  },
};

let nextId = 0;

/**
 * L'ÉDITEUR DE VIDÉO partagé par iVision et IDEM.
 *
 * À gauche, l'aperçu : la page autonome du moteur (le même que le MP4), jouée dans un iframe
 * isolé (`sandbox="allow-scripts"`). À droite, les textes de chaque scène, bornés à la longueur
 * que la mise en page supporte. Cliquer dans un texte pose la vidéo à l'instant où il est à
 * l'écran ; chaque frappe le redessine aussitôt (pont `postMessage`, cf. `../index.ts`).
 *
 * Le composant ne parle pas au serveur : il émet `edit` (toutes les retouches de texte en
 * attente, après une pause de frappe) et `replaceImage` (la scène dont l'utilisateur veut
 * changer la photo). L'hôte enregistre, puis, si le minutage a changé, recharge l'aperçu.
 *
 * @example
 * ```html
 * <idem-video-editor
 *   [html]="previewHtml()" [scenes]="scenes()" [slotDefs]="options().scenes"
 *   [ratio]="9 / 16" lang="fr" [saving]="saving()"
 *   (edit)="saveTexts($event)" (replaceImage)="pickPhoto($event.key)" />
 * ```
 */
@Component({
  selector: 'idem-video-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'idem-video-editor',
    '(window:message)': 'onMessage($event)',
  },
  template: `
    <div class="ve">
      <section class="ve__stage" [attr.aria-label]="t()['preview']">
        <div class="ve__frame" [style.aspect-ratio]="ratio()">
          <iframe
            #frame
            class="ve__iframe"
            sandbox="allow-scripts"
            [attr.title]="t()['preview']"
            [srcdoc]="safeHtml()"
          ></iframe>
        </div>

        <div class="ve__timeline">
          <button type="button" class="button-icon ve__play" [attr.aria-label]="playing() ? t()['pause'] : t()['play']" (click)="togglePlay()">
            <i [class]="playing() ? 'pi pi-pause' : 'pi pi-play'" aria-hidden="true"></i>
          </button>
          <div class="ve__track" role="group" [attr.aria-label]="t()['texts']">
            @for (s of timeline(); track s.key; let i = $index) {
              <button
                type="button"
                class="ve__segment"
                [class.ve__segment--active]="s.key === activeKey()"
                [style.flex-grow]="s.duration"
                [attr.aria-label]="t()['goTo'] + ' ' + (i + 1) + ' — ' + s.label"
                [attr.aria-current]="s.key === activeKey() ? 'step' : null"
                (click)="focusScene(s.key)"
              >
                <span class="ve__segment-index">{{ i + 1 }}</span>
              </button>
            }
            <span class="ve__cursor" [style.left.%]="cursor()" aria-hidden="true"></span>
          </div>
          <span class="ve__time">{{ clock() }}</span>
        </div>
      </section>

      <section class="ve__fields custom-scrollbar" [attr.aria-label]="t()['texts']">
        <p class="ve__hint">{{ t()['hint'] }}</p>
        @for (scene of scenes(); track scene.key; let i = $index) {
          <article class="ve__scene" [class.ve__scene--active]="scene.key === activeKey()" (focusin)="focusScene(scene.key)">
            <header class="ve__scene-head">
              <span class="ve__scene-index">{{ i + 1 }}</span>
              <span class="ve__scene-name">{{ label(scene.sceneId) }}</span>
              <span class="ve__scene-time">{{ format(scene.start) }}</span>
            </header>

            @if (scene.image && allowImages()) {
              <div class="ve__photo">
                <img [src]="scene.image" [alt]="t()['photo'] + ' ' + (i + 1)" width="56" height="56" loading="lazy" />
                <button type="button" class="outer-button button-sm" (click)="replaceImage.emit({ key: scene.key })">
                  <i class="pi pi-image" aria-hidden="true"></i> {{ t()['replace'] }}
                </button>
              </div>
            }

            @for (slot of slotsOf(scene); track slot.key) {
              <div class="ve__slot">
                <label class="ve__label" [attr.for]="fieldId(scene.key, slot.key)">
                  <span>{{ slotName(slot.key) }}</span>
                  <span class="ve__count" [class.ve__count--full]="valueOf(scene, slot.key).length >= slot.max">
                    {{ valueOf(scene, slot.key).length }}/{{ slot.max }}
                  </span>
                </label>
                @if (slot.max > 60) {
                  <textarea
                    rows="2"
                    [id]="fieldId(scene.key, slot.key)"
                    [attr.maxlength]="slot.max"
                    [value]="valueOf(scene, slot.key)"
                    (input)="type(scene.key, slot.key, $any($event.target).value)"
                  ></textarea>
                } @else {
                  <input
                    type="text"
                    [id]="fieldId(scene.key, slot.key)"
                    [attr.maxlength]="slot.max"
                    [value]="valueOf(scene, slot.key)"
                    (input)="type(scene.key, slot.key, $any($event.target).value)"
                  />
                }
              </div>
            } @empty {
              <p class="ve__empty">{{ t()['noText'] }}</p>
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
    .ve__segment:focus-visible { outline: 2px solid var(--color-primary-500); outline-offset: 2px; }
    .ve__cursor { position: absolute; top: -4px; bottom: -4px; width: 2px; background: var(--color-primary-500); border-radius: 2px; pointer-events: none; transform: translateX(-1px); }
    .ve__time { flex: none; font-variant-numeric: tabular-nums; font-size: 0.8125rem; color: var(--color-text-secondary); min-width: 3.5rem; text-align: right; }
    .ve__hint { font-size: 0.8125rem; color: var(--color-text-secondary); margin: 0 0 0.75rem; }
    .ve__scene { border: 1px solid var(--glass-border-subtle); border-radius: 14px; padding: 0.875rem 1rem; margin-bottom: 0.75rem; transition: border-color 0.2s ease; }
    .ve__scene--active { border-color: var(--color-primary-500); }
    .ve__scene-head { display: flex; align-items: baseline; gap: 0.5rem; margin-bottom: 0.625rem; }
    .ve__scene-index { font-size: 0.75rem; font-weight: 600; color: var(--color-primary-500); }
    .ve__scene-name { font-weight: 600; color: var(--color-text-primary); }
    .ve__scene-time { margin-left: auto; font-size: 0.75rem; color: var(--color-text-tertiary); font-variant-numeric: tabular-nums; }
    .ve__photo { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.625rem; }
    .ve__photo img { width: 56px; height: 56px; object-fit: cover; border-radius: 10px; border: 1px solid var(--glass-border-subtle); }
    .ve__slot + .ve__slot { margin-top: 0.5rem; }
    .ve__label { display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--color-text-secondary); margin-bottom: 0.25rem; }
    .ve__count { font-variant-numeric: tabular-nums; }
    .ve__count--full { color: var(--color-warning); }
    .ve__slot input, .ve__slot textarea { width: 100%; }
    .ve__empty { font-size: 0.8125rem; color: var(--color-text-tertiary); margin: 0; }
  `,
})
export class IdemVideoEditorComponent {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);
  private readonly frame = viewChild<ElementRef<HTMLIFrameElement>>('frame');
  private readonly uid = `ve${++nextId}`;

  /** La page d'aperçu du moteur (`GET …/videos/:id/preview` → `html`). */
  readonly html = input.required<string>();
  readonly scenes = input.required<EditorScene[]>();
  /** Les cases de chaque type de scène, avec leur longueur maximale. */
  readonly slotDefs = input<EditorSlotDefs>({});
  /** Largeur / hauteur du format affiché (9/16 pour une story). */
  readonly ratio = input<number>(9 / 16);
  readonly lang = input<EditorLang>('fr');
  readonly allowImages = input<boolean>(true);

  /** Les retouches de texte en attente (clé de scène → case → texte), après une pause de frappe. */
  readonly edit = output<Edits>();
  readonly replaceImage = output<{ key: string }>();

  protected readonly t = computed(() => TEXT[this.lang()] ?? TEXT.fr);
  protected readonly safeHtml = computed(() => this.sanitizer.bypassSecurityTrustHtml(this.html()));
  protected readonly edits = signal<Edits>({});
  protected readonly now = signal(0);
  protected readonly playing = signal(false);
  protected readonly duration = signal(0);
  /** Les instants où les textes de chaque scène sont à l'écran (envoyés par l'aperçu). */
  private readonly moments = signal<Record<string, { start: number; end: number; moment: number | null }>>({});

  protected readonly timeline = computed(() =>
    this.scenes().map((s) => ({ key: s.key, duration: Math.max(0.3, s.duration), label: sceneLabel(s.sceneId, this.lang()) })),
  );
  protected readonly activeKey = computed(() => {
    const t = this.now();
    const moments = this.moments();
    const list = this.scenes();
    const found = list.find((s) => {
      const m = moments[s.key];
      const start = m?.start ?? s.start;
      const end = m?.end ?? s.start + s.duration;
      return t >= start && t < end;
    });
    return found?.key ?? list[list.length - 1]?.key ?? null;
  });
  protected readonly cursor = computed(() => {
    const total = this.duration() || this.scenes().reduce((sum, s) => Math.max(sum, s.start + s.duration), 0) || 1;
    return Math.min(100, (this.now() / total) * 100);
  });
  protected readonly clock = computed(() => formatSeconds(this.now()));

  private debounce: ReturnType<typeof setTimeout> | null = null;
  /** La scène où l'utilisateur travaille : l'aperçu rechargé y revient. */
  private focused: string | null = null;
  /** Les cases tapées depuis le dernier envoi (« clé|case »). */
  private typedSinceFlush = new Set<string>();

  constructor() {
    // Nouvelles scènes (vidéo rechargée, retouche enregistrée) : le formulaire repart de leurs textes.
    // Ce qui a été tapé PENDANT l'enregistrement est gardé : la réponse du serveur ne l'efface pas.
    effect(() => {
      const scenes = this.scenes();
      untracked(() => {
        const typing = this.typedSinceFlush;
        const current = this.edits();
        this.edits.set(
          Object.fromEntries(
            scenes.map((s) => [s.key, { ...s.slots, ...Object.fromEntries(Object.entries(current[s.key] || {}).filter(([slot]) => typing.has(`${s.key}|${slot}`))) }]),
          ),
        );
      });
    });
    // Nouvel aperçu : on attend son `ivision:ready`.
    effect(() => {
      this.html();
      untracked(() => {
        this.playing.set(false);
        this.now.set(0);
      });
    });
    this.destroyRef.onDestroy(() => this.flush());
  }

  protected label(sceneId: string): string {
    return sceneLabel(sceneId, this.lang());
  }

  protected slotName(key: string): string {
    return slotLabel(key, this.lang());
  }

  protected format(t: number): string {
    return formatSeconds(t);
  }

  protected fieldId(sceneKey: string, slot: string): string {
    return `${this.uid}-${sceneKey}-${slot}`;
  }

  /** Les cases d'une scène : celles du type de scène, sinon celles qu'elle porte. */
  protected slotsOf(scene: EditorScene): { key: string; max: number }[] {
    const defs = this.slotDefs()[scene.sceneId];
    if (defs?.length) return defs;
    return Object.keys(scene.slots).map((key) => ({ key, max: 80 }));
  }

  protected valueOf(scene: EditorScene, slot: string): string {
    return this.edits()[scene.key]?.[slot] ?? scene.slots[slot] ?? '';
  }

  /** Une frappe : la vidéo change tout de suite, l'enregistrement attend une pause. */
  protected type(sceneKey: string, slot: string, value: string): void {
    this.edits.update((all) => ({ ...all, [sceneKey]: { ...(all[sceneKey] || {}), [slot]: value } }));
    this.typedSinceFlush.add(`${sceneKey}|${slot}`);
    this.post({ type: 'ivision:edit', key: sceneKey, slots: { [slot]: value } });
    if (this.debounce) clearTimeout(this.debounce);
    this.debounce = setTimeout(() => this.flush(), 800);
  }

  protected focusScene(key: string): void {
    this.focused = key;
    this.post({ type: 'ivision:focus', key });
  }

  protected togglePlay(): void {
    this.post({ type: this.playing() ? 'ivision:pause' : 'ivision:play' });
  }

  /** L'hôte a remplacé la photo d'une scène : l'aperçu la montre sans être rechargé. */
  previewImage(key: string, url: string): void {
    this.post({ type: 'ivision:edit', key, image: url });
  }

  protected onMessage(event: MessageEvent): void {
    const win = this.frame()?.nativeElement.contentWindow;
    if (!win || event.source !== win) return;
    const m = event.data as PreviewToEditor;
    if (m?.type === 'ivision:ready') {
      this.duration.set(m.duration);
      this.moments.set(Object.fromEntries(m.scenes.map((s) => [s.key, { start: s.start, end: s.end, moment: s.moment }])));
      // Retouches pas encore enregistrées : l'aperçu rechargé les montre aussi.
      const pending = Object.entries(this.pendingEdits());
      for (const [key, slots] of pending) this.post({ type: 'ivision:edit', key, slots, focus: false });
      // L'aperçu s'ouvre sur des textes à l'écran : la scène en cours d'édition, sinon la première.
      const first = this.focused ?? pending[0]?.[0] ?? this.scenes()[0]?.key;
      if (first) this.post({ type: 'ivision:focus', key: first });
    } else if (m?.type === 'ivision:time') {
      this.now.set(m.t);
      this.playing.set(m.playing);
    }
  }

  /** Les textes qui diffèrent de ceux de la vidéo enregistrée. */
  private pendingEdits(): Edits {
    const out: Edits = {};
    for (const scene of this.scenes()) {
      const changed = Object.entries(this.edits()[scene.key] || {}).filter(([k, v]) => (scene.slots[k] ?? '') !== v);
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
