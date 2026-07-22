import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
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

type SectionStatus = 'done' | 'active' | 'pending';

/** Nœud du fil d'étapes. */
interface JourneyNode {
  index: number;
  name: string;
  label: string;
  state: 'done' | 'current' | 'upcoming';
  actionKey?: string;
  sourceCount?: number;
}

/** Preuve concrète de travail affichée en direct (requête ou source). */
interface Evidence {
  kind: 'query' | 'source';
  icon: string;
  text: string;
  url?: string;
  domain?: string;
}

/** Modèle du panneau focal "en ce moment". */
interface FocusVm {
  mode: 'active' | 'starting' | 'finalizing' | 'done';
  icon: string;
  role?: AgentRole;
  sectionLabel?: string;
  actionKey?: string;
  evidence?: Evidence;
}

/** Entrée du flux détaillé. */
interface ActivityVm {
  ts: string;
  icon: string;
  kindKey: string;
  text: string;
  url?: string;
  domain?: string;
  tone: 'default' | 'source' | 'query' | 'verify';
}

const KIND_ICON: Record<ConsoleActivity['kind'], string> = {
  agent_status: 'pi-circle-fill',
  search_query: 'pi-search',
  source_found: 'pi-link',
  finding: 'pi-bookmark',
  section_drafted: 'pi-file-edit',
  verification: 'pi-shield',
  note: 'pi-info-circle',
};

/** Icône du panneau focal selon le rôle de l'agent actif. */
const ROLE_FOCUS_ICON: Record<AgentRole, string> = {
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
 * Génération en direct, pensée pour être comprise sans effort:
 *  - un panneau focal "En direct" qui dit, à l'instant T, quelle section est
 *    traitée, quelle action est en cours, et une preuve concrète (requête web ou
 *    source trouvée);
 *  - un fil d'étapes numéroté (où en est-on);
 *  - un anneau de progression;
 *  - un bandeau de confiance sur les sources.
 * Le détail technique reste disponible mais replié.
 */
@Component({
  selector: 'app-agent-research-console',
  imports: [DatePipe, TranslateModule],
  templateUrl: './agent-research-console.html',
  styleUrl: './agent-research-console.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'arc-host' },
})
export class AgentResearchConsoleComponent {
  /** État de la salle de contrôle (dérivé du flux SSE). */
  readonly state = input.required<ResearchConsoleState>();
  /** Sections attendues, avec libellés traduits (pour le fil d'étapes). */
  readonly planned = input<PlannedSection[]>([]);
  /** Phase courante, pilote l'en-tête et le panneau focal. */
  readonly phase = input<'running' | 'finalizing' | 'done'>('running');
  /** Variante de copie ('businessPlan' | 'finance'). */
  readonly variant = input<'businessPlan' | 'finance'>('businessPlan');

  protected readonly detailsOpen = signal(false);
  protected readonly sourcesOpen = signal(false);

  // --- En-tête ------------------------------------------------------------
  protected readonly titleKey = computed(
    () => `dashboard.researchConsole.phase.${this.variant()}.${this.phase()}.title`,
  );
  protected readonly isRunning = computed(() => this.phase() === 'running');

  // --- Sections dérivées --------------------------------------------------
  private readonly sectionRows = computed<
    { name: string; label: string; status: SectionStatus; actionKey?: string; sourceCount?: number }[]
  >(() => {
    const st = this.state();
    const doneMap = new Map(st.sections.map((s) => [s.name, s.sourceCount ?? 0]));

    const activeBySection = new Map<string, AgentRole>();
    for (const a of st.agents) {
      if (a.section && ACTIVE_STATUSES.includes(a.status)) {
        activeBySection.set(a.section, a.role);
      }
    }

    const planned: PlannedSection[] =
      this.planned().length > 0
        ? this.planned()
        : st.sections.map((s) => ({ name: s.name, label: s.name }));

    return planned.map((p) => {
      if (doneMap.has(p.name)) {
        return { name: p.name, label: p.label, status: 'done' as const, sourceCount: doneMap.get(p.name) };
      }
      const role = activeBySection.get(p.name);
      if (role) {
        return { name: p.name, label: p.label, status: 'active' as const, actionKey: ROLE_ACTION_KEY[role] };
      }
      return { name: p.name, label: p.label, status: 'pending' as const };
    });
  });

  protected readonly journey = computed<JourneyNode[]>(() =>
    this.sectionRows().map((r, i) => ({
      index: i + 1,
      name: r.name,
      label: r.label,
      state: r.status === 'done' ? 'done' : r.status === 'active' ? 'current' : 'upcoming',
      actionKey: r.actionKey,
      sourceCount: r.sourceCount,
    })),
  );

  protected readonly doneCount = computed(
    () => this.sectionRows().filter((s) => s.status === 'done').length,
  );
  protected readonly totalCount = computed(() => this.sectionRows().length);
  protected readonly percent = computed(() => {
    const total = this.totalCount();
    if (total === 0) return this.phase() === 'done' ? 100 : 0;
    if (this.phase() === 'done') return 100;
    return Math.round((this.doneCount() / total) * 100);
  });

  // --- Panneau focal "en direct" -----------------------------------------
  private readonly latestEvidence = computed<Evidence | undefined>(() => {
    const acts = this.state().activities;
    for (let i = acts.length - 1; i >= 0; i--) {
      const a = acts[i];
      if (a.kind === 'search_query') {
        return { kind: 'query', icon: 'pi-search', text: a.text };
      }
      if (a.kind === 'source_found') {
        return {
          kind: 'source',
          icon: 'pi-link',
          text: a.source?.title ?? a.text,
          url: a.source?.url,
          domain: a.source?.domain,
        };
      }
    }
    return undefined;
  });

  protected readonly focus = computed<FocusVm>(() => {
    if (this.phase() === 'done') return { mode: 'done', icon: 'pi-check-circle' };
    if (this.phase() === 'finalizing') return { mode: 'finalizing', icon: 'pi-sparkles' };

    const active = this.sectionRows().find((r) => r.status === 'active');
    const st = this.state();
    let role: AgentRole | undefined;
    if (active) {
      const agent = st.agents.find(
        (a) => a.section === active.name && ACTIVE_STATUSES.includes(a.status),
      );
      role = agent?.role;
    }
    const evidence = this.latestEvidence();

    if (!active) {
      return { mode: 'starting', icon: 'pi-compass', evidence };
    }
    return {
      mode: 'active',
      icon: role ? ROLE_FOCUS_ICON[role] : 'pi-search',
      role,
      sectionLabel: active.label,
      actionKey: active.actionKey ?? 'dashboard.researchConsole.action.analyzing',
      evidence,
    };
  });

  // --- Sources & détail technique ----------------------------------------
  protected readonly sources = computed(() => this.state().sources);
  protected readonly sourceCount = computed(() => this.sources().length);
  protected readonly queryCount = computed(() => this.state().queries.length);
  protected readonly activities = computed<ActivityVm[]>(() =>
    this.state().activities.map((x) => this.toActivityVm(x)),
  );

  protected toggleDetails(): void {
    this.detailsOpen.update((v) => !v);
  }
  protected toggleSources(): void {
    this.sourcesOpen.update((v) => !v);
  }

  private toActivityVm(x: ConsoleActivity): ActivityVm {
    const tone: ActivityVm['tone'] =
      x.kind === 'source_found'
        ? 'source'
        : x.kind === 'search_query'
          ? 'query'
          : x.kind === 'verification'
            ? 'verify'
            : 'default';
    return {
      ts: x.ts,
      icon: KIND_ICON[x.kind] ?? 'pi-circle-fill',
      kindKey: `dashboard.researchConsole.kinds.${x.kind}`,
      text: x.text,
      url: x.source?.url,
      domain: x.source?.domain,
      tone,
    };
  }
}
