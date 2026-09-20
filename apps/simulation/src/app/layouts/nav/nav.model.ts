/** Un item de navigation. `route` est relative à la racine de l'app. */
export interface NavItem {
  labelKey: string;
  icon: string;
  route: string;
  /** Vrai si la route ne doit être active qu'en correspondance exacte. */
  exact?: boolean;
  /** Laboratoire correspondant, pour afficher l'état « déjà exécuté ». */
  lab?: string;
}

export interface NavGroup {
  labelKey: string;
  items: NavItem[];
}

/** Destinations disponibles sans exécution ouverte. */
export const WORKSPACE_NAV: NavItem[] = [
  { labelKey: 'nav.simulations', icon: 'pi pi-server', route: '/simulations', exact: true },
  { labelKey: 'nav.new', icon: 'pi pi-plus-circle', route: '/simulations/new' },
];

/**
 * Destinations d'une exécution. Les libellés parlent de ce que l'écran répond,
 * pas du module qui le produit : « Ce qui peut tuer le projet » plutôt que
 * « Red Team ».
 */
export function simulationNav(id: string): NavGroup[] {
  const base = `/simulations/${id}`;
  return [
    {
      labelKey: 'nav.group.analysis',
      items: [
        { labelKey: 'nav.overview', icon: 'pi pi-compass', route: base, exact: true },
        { labelKey: 'nav.understanding', icon: 'pi pi-eye', route: `${base}/understanding` },
        { labelKey: 'nav.factors', icon: 'pi pi-sitemap', route: `${base}/factors` },
        { labelKey: 'nav.scenarios', icon: 'pi pi-share-alt', route: `${base}/scenarios` },
        { labelKey: 'nav.financials', icon: 'pi pi-chart-line', route: `${base}/financials` },
      ],
    },
    {
      labelKey: 'nav.group.labs',
      items: [
        {
          labelKey: 'nav.lab.redTeam',
          icon: 'pi pi-bolt',
          route: `${base}/labs/red-team`,
          lab: 'redTeam',
        },
        {
          labelKey: 'nav.lab.customers',
          icon: 'pi pi-users',
          route: `${base}/labs/customers`,
          lab: 'customers',
        },
        {
          labelKey: 'nav.lab.investors',
          icon: 'pi pi-briefcase',
          route: `${base}/labs/investors`,
          lab: 'investors',
        },
        {
          labelKey: 'nav.lab.blackSwan',
          icon: 'pi pi-exclamation-triangle',
          route: `${base}/labs/black-swan`,
          lab: 'blackSwan',
        },
        {
          labelKey: 'nav.lab.universes',
          icon: 'pi pi-clone',
          route: `${base}/labs/universes`,
          lab: 'universes',
        },
        {
          labelKey: 'nav.lab.timeMachine',
          icon: 'pi pi-history',
          route: `${base}/labs/time-machine`,
          lab: 'timeMachine',
        },
        {
          labelKey: 'nav.lab.experiments',
          icon: 'pi pi-flag',
          route: `${base}/labs/experiments`,
          lab: 'experiments',
        },
      ],
    },
    {
      labelKey: 'nav.group.deliverables',
      items: [
        { labelKey: 'nav.report', icon: 'pi pi-file', route: `${base}/report` },
        { labelKey: 'nav.compare', icon: 'pi pi-arrows-h', route: `${base}/compare` },
      ],
    },
  ];
}
