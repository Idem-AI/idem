/**
 * Le moteur de lecture : Motion Canvas piloté SANS son éditeur (ni Vite, ni fichiers .meta).
 *
 * Les scènes sont instanciées comme le fait le `Renderer` de Motion Canvas, puis avancées image
 * par image (rendu serveur) ou en temps réel (aperçu). Les erreurs et les effets sonores notés par
 * le harnais sont collectés ici.
 */
import { Logger, PlaybackManager, PlaybackState, PlaybackStatus, SharedWebGLContext, Stage, ValueDispatcher, Vector2 } from '@motion-canvas/core';
import { ReadOnlyTimeEvents } from '@motion-canvas/core/lib/scenes/timeEvents';
import type { AuthorScene } from './harness';
import { buildScenes } from './harness';
import type { FilmData, SceneErrorRecord, SfxCueRecord } from './film-data';

export class FilmEngine {
  readonly logger = new Logger();
  readonly playback = new PlaybackManager();
  readonly status = new PlaybackStatus(this.playback);
  readonly stage = new Stage();
  readonly errors = new Map<string, SceneErrorRecord>();
  private readonly cues = new Map<string, SfxCueRecord>();
  private readonly size: Vector2;
  private readonly gl: SharedWebGLContext;
  private readonly sceneList: { reload(d: object): void }[];
  /** Nombre d'images du film, après `init`. */
  frames = 0;

  constructor(modules: Record<string, AuthorScene | undefined>, readonly data: FilmData) {
    this.size = new Vector2(data.width, data.height);
    this.gl = new SharedWebGLContext(this.logger);
    this.logger.onLogged.subscribe((payload) => {
      if (payload.level !== 'error') return;
      // Une erreur levée hors du harnais (tâche lancée par le code d'une scène) : attribuée à la scène courante.
      const key = this.safeSceneName();
      if (key && !this.errors.has(key)) this.errors.set(key, { key, stage: 'runtime', message: String(payload.message || 'error') });
    });
    const descriptions = buildScenes(modules, data, {
      onError: (e) => {
        if (!this.errors.has(e.key)) this.errors.set(e.key, e);
      },
      onCue: (cue) => this.cues.set(`${cue.scene}:${cue.kind}:${cue.t.toFixed(3)}`, cue),
    });
    const scenes = descriptions.map((d) => {
      const desc = d as typeof d & { name: string; onReplaced?: ValueDispatcher<unknown> };
      desc.onReplaced ??= new ValueDispatcher(desc.config);
      return new desc.klass({
        ...desc,
        meta: desc.meta.clone(),
        logger: this.logger,
        playback: this.status,
        size: this.size,
        resolutionScale: data.resolutionScale ?? 1,
        timeEventsClass: ReadOnlyTimeEvents,
        sharedWebGLContext: this.gl,
        experimentalFeatures: false,
        variables: undefined as never,
        onReplaced: desc.onReplaced as never,
      } as never);
    });
    this.sceneList = scenes;
    this.playback.setup(scenes);
    this.playback.fps = data.fps;
    this.stage.configure({ size: this.size, resolutionScale: data.resolutionScale ?? 1, colorSpace: 'srgb', background: data.background });
  }

  private safeSceneName(): string | null {
    try {
      return this.playback.currentScene?.name ?? null;
    } catch {
      return null;
    }
  }

  get canvas(): HTMLCanvasElement {
    return this.stage.finalBuffer;
  }

  get frame(): number {
    return this.playback.frame;
  }

  get finished(): boolean {
    return this.playback.finished;
  }

  /** Charge les scènes et calcule le film entier (chaque scène est exécutée une fois). */
  async init(state: PlaybackState = PlaybackState.Rendering): Promise<void> {
    this.playback.state = state;
    for (const scene of this.sceneList) scene.reload({ size: this.size, resolutionScale: this.data.resolutionScale ?? 1 });
    await this.playback.recalculate();
    await this.playback.reset();
    this.frames = this.playback.duration;
  }

  setState(state: PlaybackState): void {
    this.playback.state = state;
  }

  async seek(frame: number): Promise<void> {
    await this.playback.seek(Math.max(0, Math.min(this.frames, Math.round(frame))));
  }

  /** Rejoue depuis le début jusqu'à l'image donnée (après une retouche des données). */
  async replay(frame: number): Promise<void> {
    await this.playback.reset();
    await this.seek(frame);
  }

  async next(): Promise<boolean> {
    return this.playback.progress();
  }

  async draw(): Promise<void> {
    await this.stage.render(this.playback.currentScene, this.playback.previousScene);
  }

  /** La scène affichée à une image donnée (d'après le minutage prévu). */
  sceneAt(frame: number): string | null {
    const t = frame / this.data.fps;
    const s = this.data.scenes.find((sc) => t >= sc.start && t < sc.start + sc.duration) || this.data.scenes[this.data.scenes.length - 1];
    return s?.key ?? null;
  }

  cueList(): SfxCueRecord[] {
    // Les sons des transitions planifiés par le film s'ajoutent à ceux que posent les scènes.
    return [...this.cues.values(), ...(this.data.cues || [])].sort((a, b) => a.t - b.t);
  }

  errorList(): SceneErrorRecord[] {
    return [...this.errors.values()];
  }
}

/** Attend que les polices de la marque soient prêtes (une police chargée trop tard fausse la mise en page). */
export async function loadFonts(families: string[]): Promise<void> {
  const loads = families.filter(Boolean).flatMap((f) => ['400', '600', '700', '800'].map((w) => document.fonts.load(`${w} 48px ${JSON.stringify(f)}`).catch(() => [])));
  await Promise.race([Promise.all(loads), new Promise((r) => setTimeout(r, 8000))]);
}
