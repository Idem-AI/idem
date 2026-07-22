import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import {
  AgentRole,
  AgentStatus,
  ConsoleActivity,
  ConsoleAgent,
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

/** Ligne de la liste des sections (vue utilisateur simple). */
interface SectionRow {
  name: string;
  label: string;
  status: SectionStatus;
  /** Clé i18n de l'action en cours (section active uniquement). */
  actionKey?: string;
  sourceCount?: number;
}

/** Agent enrichi pour la vue détaillée. */
interface AgentVm {
  agentId: string;
  role: AgentRole;
  icon: string;
  roleKey: string;
  section?: string;
  status: AgentStatus;
  statusKey: string;
  active: boolean;
  message?: string;
  queryCount: number;
  sourceCount: number;
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

const ROLE_ICON: Record<AgentRole, string> = {
  orchestrator: 'pi-sitemap',
  researcher: 'pi-search',
  writer: 'pi-pencil',
  verifier: 'pi-verified',
};

const KIND_ICON: Record<ConsoleActivity['kind'], string> = {
  agent_status: 'pi-circle-fill',
  search_query: 'pi-search',
  source_found: 'pi-link',
  finding: 'pi-bookmark',
  section_drafted: 'pi-file-edit',
  verification: 'pi-shield',
  note: 'pi-info-circle',
};

const ACTIVE_STATUSES: AgentStatus[] = [
  'planning',
  'searching',
  'reading',
  'writing',
  'verifying',
];

/** Rôle de l'agent actif → clé d'action en langage courant. */
const ROLE_ACTION_KEY: Record<AgentRole, string> = {
  researcher: 'dashboard.researchConsole.action.researching',
  writer: 'dashboard.researchConsole.action.writing',
  verifier: 'dashboard.researchConsole.action.verifying',
  orchestrator: 'dashboard.researchConsole.action.analyzing',
};

/**
 * Expérience de génération en direct, pensée pour être comprise par tous
 * (pas de jargon). Vue principale: un titre rassurant, une liste de sections
 * avec un statut clair, et un bandeau de confiance sur les sources. Le détail
 * technique (agents, recherches web) est disponible mais replié par défaut.
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
  /** Sections attendues, avec libellés traduits (pour la checklist). */
  readonly planned = input<PlannedSection[]>([]);
  /** Phase courante, pilote l'en-tête. */
  readonly phase = input<'running' | 'finalizing' | 'done'>('running');
  /** Variante de copie ('businessPlan' | 'finance'). */
  readonly variant = input<'businessPlan' | 'finance'>('businessPlan');

  protected readonly detailsOpen = signal(false);
  protected readonly sourcesOpen = signal(false);

  // --- En-tête ------------------------------------------------------------
  protected readonly titleKey = computed(
    () => `dashboard.researchConsole.phase.${this.variant()}.${this.phase()}.title`,
  );
  protected readonly subtitleKey = computed(
    () => `dashboard.researchConsole.phase.subtitle.${this.phase()}`,
  );
  protected readonly isRunning = computed(() => this.phase() !== 'done');

  // --- Sections (vue simple) ---------------------------------------------
  protected readonly sectionRows = computed<SectionRow[]>(() => {
    const st = this.state();
    const doneMap = new Map(st.sections.map((s) => [s.name, s.sourceCount ?? 0]));

    const activeBySection = new Map<string, ConsoleAgent>();
    for (const a of st.agents) {
      if (a.section && ACTIVE_STATUSES.includes(a.status)) {
        const prev = activeBySection.get(a.section);
        if (!prev || a.lastUpdate > prev.lastUpdate) activeBySection.set(a.section, a);
      }
    }

    const planned: PlannedSection[] =
      this.planned().length > 0
        ? this.planned()
        : st.sections.map((s) => ({ name: s.name, label: s.name }));

    return planned.map((p) => {
      if (doneMap.has(p.name)) {
        return { name: p.name, label: p.label, status: 'done', sourceCount: doneMap.get(p.name) };
      }
      const active = activeBySection.get(p.name);
      if (active) {
        return {
          name: p.name,
          label: p.label,
          status: 'active',
          actionKey: ROLE_ACTION_KEY[active.role],
        };
      }
      return { name: p.name, label: p.label, status: 'pending' };
    });
  });

  protected readonly doneCount = computed(
    () => this.sectionRows().filter((s) => s.status === 'done').length,
  );
  protected readonly totalCount = computed(() => this.sectionRows().length);
  protected readonly percent = computed(() => {
    const total = this.totalCount();
    if (total === 0) return this.phase() === 'done' ? 100 : 0;
    return Math.round((this.doneCount() / total) * 100);
  });

  // --- Sources ------------------------------------------------------------
  protected readonly sources = computed(() => this.state().sources);
  protected readonly sourceCount = computed(() => this.sources().length);

  // --- Détail technique ---------------------------------------------------
  protected readonly queryCount = computed(() => this.state().queries.length);
  protected readonly agents = computed<AgentVm[]>(() =>
    this.state().agents.map((a) => this.toAgentVm(a)),
  );
  protected readonly activities = computed<ActivityVm[]>(() =>
    this.state().activities.map((x) => this.toActivityVm(x)),
  );

  protected toggleDetails(): void {
    this.detailsOpen.update((v) => !v);
  }
  protected toggleSources(): void {
    this.sourcesOpen.update((v) => !v);
  }

  private toAgentVm(a: ConsoleAgent): AgentVm {
    return {
      agentId: a.agentId,
      role: a.role,
      icon: ROLE_ICON[a.role] ?? 'pi-cog',
      roleKey: `dashboard.researchConsole.roles.${a.role}`,
      section: a.section,
      status: a.status,
      statusKey: `dashboard.researchConsole.agentStatus.${a.status}`,
      active: ACTIVE_STATUSES.includes(a.status),
      message: a.message,
      queryCount: a.queryCount,
      sourceCount: a.sourceCount,
    };
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
