import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import {
  VideoFormat,
  VideoProgressData,
  VideoProgressStage,
} from '../../../../models/motion-video.model';

export type VideoProgressState = Partial<Record<VideoProgressStage, { state: 'running' | 'done'; data?: VideoProgressData }>>;

const STAGES: VideoProgressStage[] = ['plan', 'copy', 'media', 'music', 'sfx', 'storyboard'];

/** Poids de chaque étape dans la barre, proportionnels à leur coût réel. */
const WEIGHT: Record<VideoProgressStage, number> = { plan: 4, copy: 26, media: 30, music: 22, sfx: 8, storyboard: 10 };
/** Durée attendue d'une étape (ms) : la barre avance doucement pendant qu'elle tourne. */
const EXPECTED_MS: Record<VideoProgressStage, number> = { plan: 500, copy: 9000, media: 20000, music: 15000, sfx: 6000, storyboard: 1500 };

const RATIOS: Record<VideoFormat, string> = { story: '9 / 16', square: '1 / 1', portrait: '4 / 5', landscape: '16 / 9' };

/**
 * La création d'une vidéo, suivie EN DIRECT.
 *
 * Contrairement à une barre qui tourne, chaque élément affiché vient du serveur au
 * moment où il est produit (flux SSE) : la liste des scènes prévues, le texte
 * d'accroche écrit, les photos et clips trouvés sur Pexels, la musique choisie
 * (titre, artiste, tempo), les effets sonores retenus, puis le montage calé sur le
 * rythme. Médias, musique et effets tournent en parallèle : on les voit avancer
 * ensemble, comme sur le serveur.
 *
 * La barre ne ment pas : elle additionne les étapes terminées et n'avance que
 * doucement (jamais au-delà de 85 % de son poids) pendant qu'une étape tourne.
 */
@Component({
  selector: 'app-video-composing',
  imports: [TranslateModule, IdemLoaderComponent],
  templateUrl: './video-composing.html',
  styleUrl: './video-composing.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class VideoComposing {
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);

  readonly format = input<VideoFormat>('story');
  readonly progress = input<VideoProgressState>({});

  protected readonly stages = STAGES;
  protected readonly ratio = computed(() => RATIOS[this.format()] ?? '9 / 16');

  /** Horloge (rafraîchie 4 fois par seconde) : l'avancée douce des étapes en cours. */
  private readonly now = signal(Date.now());
  private readonly startedAt: Partial<Record<VideoProgressStage, number>> = {};

  constructor() {
    const timer = setInterval(() => this.now.set(Date.now()), 250);
    this.destroyRef.onDestroy(() => clearInterval(timer));
    effect(() => {
      const p = this.progress();
      for (const stage of STAGES) {
        if (p[stage] && this.startedAt[stage] === undefined) this.startedAt[stage] = Date.now();
      }
    });
  }

  protected state(stage: VideoProgressStage): 'waiting' | 'running' | 'done' {
    return this.progress()[stage]?.state ?? 'waiting';
  }

  protected data(stage: VideoProgressStage): VideoProgressData {
    return this.progress()[stage]?.data ?? {};
  }

  protected readonly percent = computed(() => {
    const now = this.now();
    const p = this.progress();
    const total = STAGES.reduce((n, s) => n + WEIGHT[s], 0);
    let value = 0;
    for (const stage of STAGES) {
      const entry = p[stage];
      if (entry?.state === 'done') value += WEIGHT[stage];
      else if (entry?.state === 'running') {
        const elapsed = now - (this.startedAt[stage] ?? now);
        value += WEIGHT[stage] * Math.min(0.85, elapsed / EXPECTED_MS[stage]);
      }
    }
    return Math.min(97, Math.round((value / total) * 100));
  });

  /** Scènes du montage : prévues d'abord (largeurs égales), puis minutées. */
  protected readonly timeline = computed(() => {
    const board = this.data('storyboard').scenes as { sceneId: string; duration: number }[] | undefined;
    if (board?.length) {
      const total = board.reduce((n, s) => n + s.duration, 0) || 1;
      return board.map((s) => ({ id: s.sceneId, width: (s.duration / total) * 100, seconds: s.duration }));
    }
    const planned = (this.data('plan').scenes as string[] | undefined) ?? [];
    return planned.map((id) => ({ id, width: 100 / Math.max(1, planned.length), seconds: 0 }));
  });

  protected readonly title = computed(() => (this.state('copy') === 'done' ? this.data('copy').title ?? '' : ''));
  protected readonly thumbs = computed(() => (this.data('media').items ?? []).filter((m) => !!m.url).slice(0, 4));
  /** Les barres de l'égaliseur battent au tempo de la piste choisie. */
  protected readonly beat = computed(() => {
    const bpm = this.data('music').bpm;
    return bpm ? `${(60 / bpm).toFixed(3)}s` : '0.5s';
  });
  protected readonly sounds = computed(() => this.data('sfx').sounds ?? []);
  protected readonly bars = [0, 1, 2, 3, 4, 5, 6];

  /** Ligne de détail d'une étape terminée (paramètres de traduction). */
  protected detail(stage: VideoProgressStage): { key: string; params: Record<string, unknown> } | null {
    const d = this.data(stage);
    if (this.state(stage) !== 'done') return null;
    switch (stage) {
      case 'plan':
        // Le type choisi (par l'utilisateur ou par le modèle) est dit en clair.
        if (!d.type) return { key: 'plan', params: { count: (d.scenes ?? []).length, seconds: d.durationSec } };
        {
          const type = this.translate.instant(`dashboard.showCommunication.video.types.${d.type}.label`);
          // Le concept narratif retenu (par le modèle, ou par le graphe) est dit en clair.
          return d.concept
            ? { key: 'planConcept', params: { type, concept: this.translate.instant(`dashboard.showCommunication.video.concepts.${d.concept}`), count: (d.scenes ?? []).length, seconds: d.durationSec } }
            : { key: 'planType', params: { type, count: (d.scenes ?? []).length, seconds: d.durationSec } };
        }
      case 'copy':
        return { key: d.source === 'llm' ? 'copyLlm' : 'copyHeuristic', params: { lines: d.lines } };
      case 'media': {
        const items = d.items ?? [];
        if (!items.length) return { key: 'mediaNone', params: {} };
        return {
          key: 'media',
          params: {
            own: items.filter((i) => i.origin === 'upload' || i.origin === 'visual').length,
            photos: d.stockPhotos ?? 0,
            videos: d.stockVideos ?? 0,
            generated: (d.generatedVideos ?? 0) + (d.generatedImages ?? 0),
            query: d.query,
          },
        };
      }
      case 'music':
        return d.none ? { key: 'musicNone', params: {} } : { key: 'music', params: { title: d.title, artist: d.artist, bpm: d.bpm ? Math.round(d.bpm) : '—' } };
      case 'sfx':
        return { key: 'sfx', params: { count: (d.sounds ?? []).length } };
      default:
        return { key: 'storyboard', params: { count: (d.scenes ?? []).length, bpm: d.bpm ? Math.round(d.bpm) : '—' } };
    }
  }
}
