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

const STAGES: VideoProgressStage[] = ['plan', 'copy', 'layout', 'media', 'music', 'sfx', 'voice', 'storyboard', 'animation', 'critique', 'code'];
/** Le film d'auteur (Ultra) : le directeur invente le film, chaque plan est écrit, revu, corrigé. */
const AUTHORED_STAGES: VideoProgressStage[] = ['media', 'direction', 'music', 'sfx', 'voice', 'shots', 'storyboard'];
const ALL_STAGES: VideoProgressStage[] = [...STAGES, 'direction', 'shots'];

/** Poids de chaque étape dans la barre, proportionnels à leur coût réel. */
const WEIGHT: Record<VideoProgressStage, number> = { plan: 4, copy: 22, layout: 8, media: 40, music: 20, sfx: 6, voice: 10, storyboard: 4, animation: 6, critique: 4, code: 30, direction: 20, shots: 90 };
/** Durée attendue d'une étape (ms) : la barre avance doucement pendant qu'elle tourne. */
// Les médias générés (images, puis clips animés à partir d'elles) prennent une à trois minutes.
const EXPECTED_MS: Record<VideoProgressStage, number> = { plan: 500, copy: 9000, layout: 5000, media: 90000, music: 15000, sfx: 6000, voice: 15000, storyboard: 1500, animation: 4000, critique: 4000, code: 60000, direction: 30000, shots: 180000 };

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

  /**
   * Les étapes affichées : celles du film d'auteur quand le serveur annonce son directeur (Ultra),
   * sinon celles du pipeline des menus (« écriture des scènes » seulement si le serveur l'annonce).
   */
  protected readonly stages = computed(() => {
    const p = this.progress();
    // Effets, voix off et plans écrits par l'IA : seulement quand le serveur les annonce.
    const announced = (s: VideoProgressStage) => !['sfx', 'voice', 'code'].includes(s) || !!p[s];
    if (p['direction'] && !p['direction']?.data?.fallback) return AUTHORED_STAGES.filter(announced);
    return STAGES.filter(announced);
  });
  protected readonly ratio = computed(() => RATIOS[this.format()] ?? '9 / 16');

  /** Horloge (rafraîchie 4 fois par seconde) : l'avancée douce des étapes en cours. */
  private readonly now = signal(Date.now());
  private readonly startedAt: Partial<Record<VideoProgressStage, number>> = {};

  constructor() {
    const timer = setInterval(() => this.now.set(Date.now()), 250);
    this.destroyRef.onDestroy(() => clearInterval(timer));
    effect(() => {
      const p = this.progress();
      for (const stage of ALL_STAGES) {
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
    const total = this.stages().reduce((n, s) => n + WEIGHT[s], 0);
    let value = 0;
    for (const stage of this.stages()) {
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

  /** Noms traduits, sans doublon, des trois premiers éléments d'une liste (mises en page, transitions). */
  private names(group: 'layouts' | 'transitions', ids: string[]): string {
    const unique = [...new Set(ids)];
    const shown = unique.slice(0, 3).map((id) => this.translate.instant(`dashboard.showCommunication.video.${group}.${id}`));
    return unique.length > 3 ? `${shown.join(', ')}…` : shown.join(', ');
  }

  /** Ligne de détail d'une étape terminée (paramètres de traduction). */
  protected detail(stage: VideoProgressStage): { key: string; params: Record<string, unknown> } | null {
    const d = this.data(stage);
    // Les plans du film d'auteur se suivent en direct : plan en cours et ce qui lui arrive.
    if (stage === 'shots' && this.state(stage) === 'running' && d.total) {
      return { key: d.current ? `shots_${d.step ?? 'writing'}` : 'shotsStart', params: { current: d.current ?? 0, total: d.total, done: d.done ?? 0, coded: d.coded ?? 0 } };
    }
    // Les médias générés se suivent en direct : plans produits sur plans demandés.
    if (stage === 'media' && this.state(stage) === 'running' && d.total) {
      return { key: 'mediaGenerating', params: { done: d.done ?? 0, total: d.total } };
    }
    if (this.state(stage) !== 'done') return null;
    switch (stage) {
      case 'direction':
        return d.fallback ? { key: 'directionFallback', params: {} } : { key: 'direction', params: { title: d.title ?? '', count: (d.shots ?? []).length } };
      case 'shots':
        return { key: 'shots', params: { coded: d.coded ?? 0, total: d.total ?? 0, reviewed: d.reviewed ?? 0 } };
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
        if (d.none) return { key: 'musicNone', params: {} };
        return { key: d.pickedBy === 'agent' ? 'musicAgent' : 'music', params: { title: d.title, artist: d.artist, bpm: d.bpm ? Math.round(d.bpm) : '—' } };
      case 'sfx':
        return { key: 'sfx', params: { count: (d.sounds ?? []).length } };
      case 'voice':
        return d.unavailable ? { key: 'voiceUnavailable', params: {} } : { key: 'voice', params: { count: d.lines ?? 0, language: (d.language ?? '').toUpperCase() } };
      case 'layout': {
        // Les mises en page retenues par les directeurs artistiques, nommées en clair.
        const layouts = d.layouts ?? [];
        if (!layouts.length) return { key: 'layoutClassic', params: {} };
        return { key: 'layout', params: { count: layouts.length, names: this.names('layouts', layouts) } };
      }
      case 'animation':
        return {
          key: 'animation',
          params: {
            names: this.names('transitions', d.transitions ?? []),
            camera: d.camera ? this.translate.instant(`dashboard.showCommunication.video.cameras.${d.camera}`) : '—',
          },
        };
      case 'critique':
        return d.fixes ? { key: 'critique', params: { count: d.fixes } } : { key: 'critiqueOk', params: {} };
      case 'code':
        return { key: 'code', params: { coded: d.coded ?? 0, tried: d.tried ?? 0 } };
      default:
        return { key: 'storyboard', params: { count: (d.scenes ?? []).length, bpm: d.bpm ? Math.round(d.bpm) : '—' } };
    }
  }
}
