import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { ContentChannel, PlanBrief } from '../../../../models/communication.model';
import { addDaysIso, channelIcon, daysBetweenIso, expectedItemCount } from '../../communication-ui';

export type PlanStage = 'context' | 'research' | 'brief' | 'content' | 'videos';
export const PLAN_STAGES: PlanStage[] = ['context', 'research', 'brief', 'content', 'videos'];

/** Ce que le flux de génération a déjà livré — alimenté par le panneau des périodes, événement par événement. */
export interface PlanProgressState {
  /** Étape en cours, ou terminée. */
  stages: Partial<Record<PlanStage, 'running' | 'done'>>;
  trends: { label: string; description?: string }[];
  occasions: { occasion: string; date?: string }[];
  brief?: PlanBrief;
  /** Les idées déjà écrites, posées sur leur jour. */
  items: { id: string; title: string; channel: ContentChannel; format: string; scheduledFor: string }[];
  /** Les vidéos dont le plan est annoncé, et celles déjà écrites. */
  videos: { id: string; title: string; done: boolean }[];
}

export const EMPTY_PLAN_PROGRESS: PlanProgressState = { stages: {}, trends: [], occasions: [], items: [], videos: [] };

interface DayCell {
  iso: string;
  day: number;
  inside: boolean;
  items: PlanProgressState['items'];
  occasion?: string;
}

/**
 * La génération d'une période, suivie EN DIRECT (flux SSE) : le calendrier de la période se dessine,
 * les occasions s'y posent, les tendances trouvées sur le web apparaissent, la ligne éditoriale se
 * dévoile, puis chaque publication s'inscrit sur son jour dès que l'IA l'a écrite.
 *
 * Même grammaire que la création d'une vidéo ou d'un visuel : un aperçu qui se construit à gauche,
 * les étapes à droite, une barre qui additionne le réel (jamais une durée inventée).
 */
@Component({
  selector: 'app-plan-composing',
  imports: [TranslateModule, IdemLoaderComponent],
  templateUrl: './plan-composing.html',
  styleUrl: './plan-composing.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class PlanComposing {
  readonly start = input.required<string>();
  readonly end = input.required<string>();
  readonly postsPerWeek = input(3);
  readonly name = input('');
  readonly progress = input<PlanProgressState>(EMPTY_PLAN_PROGRESS);

  protected readonly stages = PLAN_STAGES;
  protected readonly channelIcon = channelIcon;
  protected readonly weekdays = [0, 1, 2, 3, 4, 5, 6];

  protected state(stage: PlanStage): 'waiting' | 'running' | 'done' {
    return this.progress().stages[stage] ?? 'waiting';
  }

  protected readonly expected = computed(() => expectedItemCount(this.start(), this.end(), this.postsPerWeek()));

  /** Le calendrier : semaines pleines (lundi → dimanche) autour de la période, une case par jour. */
  protected readonly cells = computed<DayCell[]>(() => {
    const start = this.start();
    const end = this.end();
    const days = daysBetweenIso(start, end);
    if (days > 400) return [];
    const startDow = (new Date(`${start}T00:00:00Z`).getUTCDay() + 6) % 7; // lundi = 0
    const endDow = (new Date(`${end}T00:00:00Z`).getUTCDay() + 6) % 7;
    const from = addDaysIso(start, -startDow);
    const total = startDow + days + (6 - endDow);
    const byDay = new Map<string, PlanProgressState['items']>();
    for (const item of this.progress().items) byDay.set(item.scheduledFor, [...(byDay.get(item.scheduledFor) ?? []), item]);
    const occasionOf = new Map(this.progress().occasions.filter((o) => o.date).map((o) => [o.date!, o.occasion]));
    return Array.from({ length: total }, (_, i) => {
      const iso = addDaysIso(from, i);
      return { iso, day: Number(iso.slice(8, 10)), inside: iso >= start && iso <= end, items: byDay.get(iso) ?? [], occasion: occasionOf.get(iso) };
    });
  });

  /** Pastille « mois » au-dessus du calendrier, quand la période en couvre plusieurs. */
  protected readonly monthLabel = computed(() => {
    const first = this.start();
    const last = this.end();
    return first.slice(0, 7) === last.slice(0, 7) ? first.slice(0, 7) : `${first.slice(0, 7)} → ${last.slice(0, 7)}`;
  });

  protected readonly written = computed(() => this.progress().items.length);
  protected readonly videosDone = computed(() => this.progress().videos.filter((v) => v.done).length);

  /** Avancement réel : les étapes closes pèsent leur poids, les publications avancent au nombre écrit. */
  protected readonly percent = computed(() => {
    const p = this.progress();
    const weight: Record<PlanStage, number> = { context: 8, research: 18, brief: 14, content: 45, videos: 15 };
    let value = 0;
    for (const stage of PLAN_STAGES) {
      const state = p.stages[stage];
      if (state === 'done') value += weight[stage];
      else if (state === 'running') {
        if (stage === 'content') value += weight[stage] * Math.min(0.95, this.written() / Math.max(1, this.expected()));
        else if (stage === 'videos') value += weight[stage] * (p.videos.length ? this.videosDone() / p.videos.length : 0.1);
        else value += weight[stage] * 0.4;
      }
    }
    return Math.min(99, Math.round(value));
  });

  /** Le détail dit sous chaque étape : un chiffre réel, jamais une promesse. */
  protected detail(stage: PlanStage): { key: string; params: Record<string, number | string> } | null {
    const p = this.progress();
    switch (stage) {
      case 'research':
        if (p.stages.research !== 'done' && !p.trends.length && !p.occasions.length) return null;
        return { key: 'research', params: { trends: p.trends.length, occasions: p.occasions.length } };
      case 'brief':
        return p.brief?.themes?.length ? { key: 'brief', params: { count: p.brief.themes.length } } : null;
      case 'content':
        return this.written() ? { key: 'content', params: { done: this.written(), total: this.expected() } } : null;
      case 'videos':
        return p.videos.length ? { key: 'videos', params: { done: this.videosDone(), total: p.videos.length } } : null;
      default:
        return null;
    }
  }
}
