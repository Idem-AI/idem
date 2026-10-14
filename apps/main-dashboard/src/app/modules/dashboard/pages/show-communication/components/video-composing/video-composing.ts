import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { VideoFormat, VideoProgressData, VideoProgressStage } from '../../../../models/motion-video.model';

export type VideoProgressState = Partial<Record<VideoProgressStage, { state: 'running' | 'done'; data?: VideoProgressData }>> & {
  /** Les scènes déjà écrites par l'IA (clé → code exécutable ou non), reçues au fil de l'étape « code ». */
  authored?: Record<string, boolean>;
};

const STAGES: VideoProgressStage[] = ['plan', 'concept', 'storyboard', 'media', 'music', 'voice', 'code', 'check'];
/** Étapes montrées seulement quand le serveur les annonce (elles dépendent du cran et de la demande). */
const OPTIONAL: VideoProgressStage[] = ['concept', 'media', 'music', 'voice'];

/** Poids de chaque étape dans la barre, proportionnels à leur coût réel. */
const WEIGHT: Record<VideoProgressStage, number> = { plan: 6, concept: 12, storyboard: 16, media: 30, music: 8, sfx: 1, voice: 10, code: 60, check: 8 };
/** Durée attendue d'une étape (ms) : la barre avance doucement pendant qu'elle tourne. */
const EXPECTED_MS: Record<VideoProgressStage, number> = { plan: 6000, concept: 25000, storyboard: 40000, media: 90000, music: 15000, sfx: 3000, voice: 15000, code: 120000, check: 15000 };

const RATIOS: Record<VideoFormat, string> = { story: '9 / 16', square: '1 / 1', portrait: '4 / 5', landscape: '16 / 9' };

/**
 * La création d'une vidéo, suivie EN DIRECT (flux SSE) : la demande comprise, le concept inventé
 * par le directeur, le storyboard (une case par scène), les médias, la musique, la voix, puis chaque
 * scène écrite en code par l'IA — la frise s'allume scène par scène — et le contrôle technique.
 *
 * La barre ne ment pas : elle additionne les étapes terminées et n'avance que doucement (jamais
 * au-delà de 85 % de son poids) pendant qu'une étape tourne.
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

  readonly format = input<VideoFormat>('story');
  readonly progress = input<VideoProgressState>({});

  protected readonly stages = computed(() => {
    const p = this.progress();
    return STAGES.filter((s) => !OPTIONAL.includes(s) || !!p[s]);
  });
  protected readonly ratio = computed(() => RATIOS[this.format()] ?? '9 / 16');

  private readonly now = signal(Date.now());
  private readonly startedAt: Partial<Record<VideoProgressStage, number>> = {};

  constructor() {
    const timer = setInterval(() => this.now.set(Date.now()), 250);
    this.destroyRef.onDestroy(() => clearInterval(timer));
    effect(() => {
      const p = this.progress();
      for (const stage of STAGES) if (p[stage] && this.startedAt[stage] === undefined) this.startedAt[stage] = Date.now();
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
    const total = this.stages().reduce((n, s) => n + WEIGHT[s], 0);
    let value = 0;
    for (const stage of this.stages()) {
      const entry = p[stage];
      if (entry?.state === 'done') value += WEIGHT[stage];
      else if (entry?.state === 'running') {
        // L'écriture des scènes avance au nombre de scènes écrites, pas au temps.
        const d = entry.data;
        const ratio = stage === 'code' && d?.total ? (d.done ?? 0) / d.total : (now - (this.startedAt[stage] ?? now)) / EXPECTED_MS[stage];
        value += WEIGHT[stage] * Math.min(0.85, ratio);
      }
    }
    return Math.min(97, Math.round((value / total) * 100));
  });

  /** Le titre du film, dès que le directeur (ou le planificateur) l'a trouvé. */
  protected readonly title = computed(() => this.data('storyboard').title || this.data('concept').title || '');
  protected readonly concept = computed(() => this.data('concept').concept || '');

  /** La frise : une case par scène du storyboard, allumée quand son code est écrit. */
  protected readonly timeline = computed(() => {
    const scenes = this.data('storyboard').scenes;
    if (!Array.isArray(scenes)) return [];
    const total = scenes.reduce((n, s) => n + s.duration, 0) || 1;
    const authored = this.progress().authored ?? {};
    return scenes.map((s, i) => {
      const key = `s${i + 1}`;
      return { key, purpose: s.purpose, width: (s.duration / total) * 100, state: key in authored ? (authored[key] ? 'ok' : 'error') : 'waiting' };
    });
  });

  protected readonly beat = computed(() => {
    const bpm = this.data('music').bpm;
    return bpm ? `${(60 / bpm).toFixed(3)}s` : '0.5s';
  });
  protected readonly bars = [0, 1, 2, 3, 4, 5, 6];

  /** Ligne de détail d'une étape (paramètres de traduction). */
  protected detail(stage: VideoProgressStage): { key: string; params: Record<string, unknown> } | null {
    const d = this.data(stage);
    if (stage === 'code' && this.state(stage) === 'running' && d.total) return { key: 'codeRunning', params: { done: d.done ?? 0, total: d.total } };
    if (stage === 'media' && this.state(stage) === 'running' && d.total) return { key: 'mediaGenerating', params: { done: d.done ?? 0, total: d.total } };
    if (this.state(stage) !== 'done') return null;
    switch (stage) {
      case 'plan':
        return { key: d.scripted ? 'planScripted' : 'plan', params: { media: d.media ?? 0, language: (d.language ?? '').toUpperCase() } };
      case 'concept':
        return d.failed ? { key: 'conceptFailed', params: {} } : { key: 'concept', params: { title: d.title ?? '' } };
      case 'storyboard':
        return { key: 'storyboard', params: { count: Array.isArray(d.scenes) ? d.scenes.length : 0 } };
      case 'media':
        return d.missing ? { key: 'mediaMissing', params: { missing: d.missing } } : { key: 'media', params: { count: (d.generatedImages ?? 0) + (d.generatedVideos ?? 0) + (d.stockPhotos ?? 0) + (d.stockVideos ?? 0) } };
      case 'music':
        return d.none ? { key: 'musicNone', params: {} } : { key: 'music', params: { title: d.title, artist: d.artist, bpm: d.bpm ? Math.round(d.bpm) : '—' } };
      case 'voice':
        return d.unavailable ? { key: 'voiceUnavailable', params: {} } : { key: 'voice', params: { count: d.lines ?? 0 } };
      case 'code': {
        const errors = Array.isArray(d.errors) ? d.errors.length : 0;
        return errors ? { key: 'codeErrors', params: { ready: d.ready ?? 0, errors } } : { key: 'code', params: { ready: d.ready ?? 0 } };
      }
      case 'check': {
        const errors = Array.isArray(d.errors) ? d.errors.length : 0;
        return errors ? { key: 'checkErrors', params: { errors } } : { key: 'checkOk', params: {} };
      }
      default:
        return null;
    }
  }
}
