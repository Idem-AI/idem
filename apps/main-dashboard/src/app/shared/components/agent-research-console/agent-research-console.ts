import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import {
  AgentRole,
  AgentStatus,
  ConsoleActivity,
  ResearchConsoleState,
} from '../../models/sse-step.model';

/** Une section attendue du livrable, avec son libellé déjà traduit. */
export interface PlannedSection {
  /** Nom canonique (doit correspondre aux events backend). */
  name: string;
  /** Libellé lisible affiché à l'utilisateur. */
  label: string;
}

type SectionState = 'done' | 'current' | 'upcoming';

/** Segment de la frise de chapitres. */
interface Chapter {
  name: string;
  label: string;
  state: SectionState;
}

/** Panneau "en ce moment". */
interface NowVm {
  mode: 'active' | 'starting' | 'finalizing' | 'done';
  icon: string;
  role?: AgentRole;
  sectionLabel?: string;
  actionKey?: string;
  query?: string;
}

/** Élément du flux de découvertes (vue). */
interface FeedItem {
  key: string;
  icon: string;
  tone: 'query' | 'source' | 'finding' | 'section' | 'verify';
  leadKey: string;
  text: string;
  url?: string;
  domain?: string;
}

/** Kinds affichés dans le flux (les statuts d'agents pilotent le "maintenant"). */
const FEED_KINDS = new Set<ConsoleActivity['kind']>([
  'search_query',
  'source_found',
  'finding',
  'section_drafted',
  'verification',
]);

const FEED_ICON: Record<string, string> = {
  search_query: 'pi-search',
  source_found: 'pi-link',
  finding: 'pi-chart-bar',
  section_drafted: 'pi-file-edit',
  verification: 'pi-verified',
};

const FEED_TONE: Record<string, FeedItem['tone']> = {
  search_query: 'query',
  source_found: 'source',
  finding: 'finding',
  section_drafted: 'section',
  verification: 'verify',
};

const ROLE_ICON: Record<AgentRole, string> = {
  researcher: 'pi-search',
  writer: 'pi-pencil',
  verifier: 'pi-verified',
  orchestrator: 'pi-compass',
};

const ROLE_ACTION_KEY: Record<AgentRole, string> = {
  researcher: 'dashboard.researchConsole.action.researching',
  writer: 'dashboard.researchConsole.action.writing',
  verifier: 'dashboard.researchConsole.action.verifying',
  orchestrator: 'dashboard.researchConsole.action.analyzing',
};

const ACTIVE_STATUSES: AgentStatus[] = [
  'planning',
  'searching',
  'reading',
  'writing',
  'verifying',
];

/**
 * Génération en direct, pensée pour CAPTER l'utilisateur pendant l'attente:
 * le cœur est un flux vivant de découvertes réelles (sources et données
 * chiffrées qui arrivent en continu), surmonté d'un panneau "en ce moment" et
 * d'une frise de chapitres compacte. Simple à lire, toujours en mouvement.
 */
@Component({
  selector: 'app-agent-research-console',
  imports: [TranslateModule],
  templateUrl: './agent-research-console.html',
  styleUrl: './agent-research-console.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'arc-host' },
})
export class AgentResearchConsoleComponent {
  readonly state = input.required<ResearchConsoleState>();
  readonly planned = input<PlannedSection[]>([]);
  readonly phase = input<'running' | 'finalizing' | 'done'>('running');
  readonly variant = input<'businessPlan' | 'finance'>('businessPlan');

  protected readonly titleKey = computed(
    () => `dashboard.researchConsole.phase.${this.variant()}.${this.phase()}.title`,
  );
  protected readonly isRunning = computed(() => this.phase() === 'running');

  // --- Chapitres ----------------------------------------------------------
  private readonly rows = computed<{ name: string; label: string; state: SectionState }[]>(() => {
    const st = this.state();
    const done = new Set(st.sections.map((s) => s.name));
    const active = new Set(
      st.agents.filter((a) => a.section && ACTIVE_STATUSES.includes(a.status)).map((a) => a.section!),
    );
    const planned: PlannedSection[] =
      this.planned().length > 0
        ? this.planned()
        : st.sections.map((s) => ({ name: s.name, label: s.name }));
    return planned.map((p) => ({
      name: p.name,
      label: p.label,
      state: done.has(p.name) ? 'done' : active.has(p.name) ? 'current' : 'upcoming',
    }));
  });

  protected readonly chapters = computed<Chapter[]>(() => this.rows());
  protected readonly doneCount = computed(() => this.rows().filter((r) => r.state === 'done').length);
  protected readonly totalCount = computed(() => this.rows().length);
  protected readonly percent = computed(() => {
    const total = this.totalCount();
    if (this.phase() === 'done') return 100;
    if (total === 0) return 0;
    return Math.round((this.doneCount() / total) * 100);
  });

  // --- En ce moment -------------------------------------------------------
  private readonly latestQuery = computed<string | undefined>(() => {
    const acts = this.state().activities;
    for (let i = acts.length - 1; i >= 0; i--) {
      if (acts[i].kind === 'search_query') return acts[i].text;
    }
    return undefined;
  });

  protected readonly now = computed<NowVm>(() => {
    if (this.phase() === 'done') return { mode: 'done', icon: 'pi-check-circle' };
    if (this.phase() === 'finalizing') return { mode: 'finalizing', icon: 'pi-sparkles' };

    const active = this.rows().find((r) => r.state === 'current');
    if (!active) return { mode: 'starting', icon: 'pi-compass' };

    const agent = this.state().agents.find(
      (a) => a.section === active.name && ACTIVE_STATUSES.includes(a.status),
    );
    const role = agent?.role;
    return {
      mode: 'active',
      icon: role ? ROLE_ICON[role] : 'pi-search',
      role,
      sectionLabel: active.label,
      actionKey: role ? ROLE_ACTION_KEY[role] : 'dashboard.researchConsole.action.analyzing',
      query: role === 'researcher' ? this.latestQuery() : undefined,
    };
  });

  // --- Flux de découvertes ------------------------------------------------
  protected readonly feed = computed<FeedItem[]>(() => {
    const items: FeedItem[] = [];
    const acts = this.state().activities;
    acts.forEach((a, i) => {
      if (!FEED_KINDS.has(a.kind)) return;
      items.push({
        key: `${i}-${a.ts}`,
        icon: FEED_ICON[a.kind] ?? 'pi-circle-fill',
        tone: FEED_TONE[a.kind] ?? 'section',
        leadKey: `dashboard.researchConsole.kinds.${a.kind}`,
        text: a.text,
        url: a.source?.url,
        domain: a.source?.domain,
      });
    });
    return items;
  });

  protected readonly sourceCount = computed(() => this.state().sources.length);
  protected readonly queryCount = computed(() => this.state().queries.length);
}
