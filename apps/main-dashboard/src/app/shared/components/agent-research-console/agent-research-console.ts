import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
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
  sectionName?: string;
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
      sectionName: active.name,
      sectionLabel: active.label,
      actionKey: role ? ROLE_ACTION_KEY[role] : 'dashboard.researchConsole.action.analyzing',
      query: role === 'researcher' ? toReadableText(this.latestQuery(), QUERY_LIMIT) : undefined,
    };
  });

  /**
   * Aperçu du texte en cours de rédaction.
   *
   * Le rédacteur produit du HTML : le montrer tel quel affichait des balises et
   * des classes CSS à quelqu'un qui attend de lire son business plan. On n'en
   * garde que le texte visible.
   */
  protected readonly draftPreview = computed<string | undefined>(() => {
    const n = this.now();
    const d = this.state().draft;
    if (n.mode !== 'active' || n.role !== 'writer' || !d || d.section !== n.sectionName) {
      return undefined;
    }
    const readable = toReadableText(d.preview);
    return readable.length >= MIN_PREVIEW_CHARS ? readable : undefined;
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
        text: toReadableText(a.text, FEED_TEXT_LIMIT),
        url: a.source?.url,
        domain: a.source?.domain,
      });
    });
    return items;
  });

  /**
   * Les sources trouvées, de la plus récente à la plus ancienne.
   *
   * C'est la seule liste que l'écran montre désormais. Le flux mêlait
   * recherches, sections rédigées et vérifications : un journal technique, là
   * où l'utilisateur veut savoir une chose — sur quoi repose son document.
   */
  protected readonly sources = computed(() =>
    [...this.state().sources].reverse().slice(0, MAX_VISIBLE_SOURCES),
  );

  protected readonly sourceCount = computed(() => this.state().sources.length);
  protected readonly queryCount = computed(() => this.state().queries.length);

  // --- Tenir compagnie pendant l'attente ----------------------------------
  //
  // L'opération dure plusieurs minutes et le flux d'événements a des trous :
  // sans rien à voir bouger, on croit l'écran figé et on ferme. Ces trois
  // éléments occupent l'attente sans jamais rien inventer sur le travail en
  // cours — ils décrivent la démarche, ils n'annoncent pas de résultat.

  /** Secondes écoulées, pour que l'attente soit lisible plutôt que subie. */
  private readonly tick = signal(0);

  protected readonly elapsed = computed(() => {
    const seconds = this.tick();
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
  });

  /**
   * Scène illustrée, choisie sur ce que fait réellement l'équipe : elle
   * change quand le rôle actif change, elle ne tourne pas toute seule.
   */
  protected readonly scene = computed<SceneName>(() => {
    const now = this.now();
    if (now.mode === 'done') return 'done';
    if (now.mode === 'finalizing') return 'finalizing';
    switch (now.role) {
      case 'researcher':
        return 'searching';
      case 'writer':
        return 'writing';
      case 'verifier':
        return 'verifying';
      default:
        return 'planning';
    }
  });

  /** Explication de l'étape en cours, renouvelée pour soutenir l'attention. */
  protected readonly reassuranceKey = computed(() => {
    const index = Math.floor(this.tick() / REASSURANCE_ROTATION_SECONDS) % REASSURANCE_COUNT;
    return `dashboard.researchConsole.reassurance.${this.scene()}.${index}`;
  });

  constructor() {
    // Compteur arrêté dès la fin : rien ne doit continuer à tourner derrière
    // un écran terminé.
    const timer = setInterval(() => {
      if (this.phase() !== 'done') {
        this.tick.update((value) => value + 1);
      }
    }, 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
}

/** Les cinq scènes illustrées, dans l'ordre où on les traverse. */
export type SceneName = 'planning' | 'searching' | 'writing' | 'verifying' | 'finalizing' | 'done';

/** Nombre de formulations par scène, et cadence de rotation. */
const REASSURANCE_COUNT = 3;
const REASSURANCE_ROTATION_SECONDS = 8;

/** Au-delà, la liste devient un mur : les plus récentes suffisent à rassurer. */
const MAX_VISIBLE_SOURCES = 8;

/** En deçà, l'aperçu clignoterait plus qu'il n'informerait. */
const MIN_PREVIEW_CHARS = 12;
const FEED_TEXT_LIMIT = 160;
const QUERY_LIMIT = 90;

/**
 * Marqueurs de nos consignes internes. Un texte qui en porte un n'est pas
 * destiné à l'utilisateur : il vaut mieux ne rien montrer que de lui afficher
 * la façon dont on parle au modèle.
 */
const INTERNAL_MARKERS = [
  'CONTEXTE PROJET',
  'DONNÉES À TROUVER',
  "N'invente rien",
  'Tu es un',
  'Réponds UNIQUEMENT',
];

/**
 * Rend un texte présentable : balises HTML retirées, entités décodées, espaces
 * normalisés, longueur bornée.
 *
 * Le rédacteur produit du HTML et les agents s'échangent des consignes ; ni
 * l'un ni l'autre n'a sa place devant quelqu'un qui attend son business plan.
 */
function toReadableText(raw: string | undefined, limit?: number): string {
  if (!raw) {
    return '';
  }

  if (INTERNAL_MARKERS.some((marker) => raw.includes(marker))) {
    return '';
  }

  // Le flux arrive par morceaux : la fenêtre commence souvent APRÈS l'ouverture
  // d'une balise et se termine AVANT sa fermeture. Ces deux fragments-là ne
  // ressemblent pas à des balises complètes, et survivaient au nettoyage —
  // c'est ce qui laissait passer `...>` en tête et `<div class="stat-ca` en fin.
  let windowed = raw.replace(/^[\s.…]+/, '');
  const firstOpen = windowed.indexOf('<');
  const firstClose = windowed.indexOf('>');
  if (firstClose !== -1 && (firstOpen === -1 || firstClose < firstOpen)) {
    windowed = windowed.slice(firstClose + 1);
  }
  windowed = windowed.replace(/<[^>]*$/, ' ');

  const text = windowed
    // Blocs sans contenu lisible, retirés avec leur contenu.
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    // Une balise fermante de bloc vaut une séparation de mots.
    .replace(/<\/(p|div|li|h[1-6]|tr|section)>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();

  if (!limit || text.length <= limit) {
    return text;
  }
  // Coupe au dernier mot entier : une phrase tranchée au milieu d'un mot se lit mal.
  const cut = text.slice(0, limit);
  const lastSpace = cut.lastIndexOf(' ');
  return `${lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut}…`;
}
