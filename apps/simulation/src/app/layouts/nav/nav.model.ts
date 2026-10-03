/** Un item de navigation. `route` est relative à la racine de l'app. */
export interface NavItem {
  labelKey: string;
  icon: string;
  route: string;
  /** Vrai si la route ne doit être active qu'en correspondance exacte. */
  exact?: boolean;
}

export interface NavGroup {
  labelKey: string;
  items: NavItem[];
}

/** Destinations disponibles sans simulation ouverte. */
export const WORKSPACE_NAV: NavItem[] = [
  { labelKey: 'nav.simulations', icon: 'pi pi-list', route: '/simulations', exact: true },
  { labelKey: 'nav.new', icon: 'pi pi-plus-circle', route: '/simulations/new' },
];

/**
 * Destinations d'une simulation, nommées par ce que l'écran répond et non par
 * le module qui le produit. Huit entrées au plus : la personne qui découvre le
 * produit doit pouvoir tout lire d'un coup d'œil. Les sept tests
 * complémentaires vivent derrière une seule entrée, « Aller plus loin ».
 */
export function simulationNav(id: string, hasPrevious: boolean): NavGroup[] {
  const base = `/simulations/${id}`;
  const share: NavItem[] = [{ labelKey: 'nav.report', icon: 'pi pi-file', route: `${base}/report` }];
  if (hasPrevious) {
    share.push({ labelKey: 'nav.compare', icon: 'pi pi-arrows-h', route: `${base}/compare` });
  }
  return [
    {
      labelKey: 'nav.group.result',
      items: [
        { labelKey: 'nav.overview', icon: 'pi pi-flag', route: base, exact: true },
        { labelKey: 'nav.understanding', icon: 'pi pi-briefcase', route: `${base}/understanding` },
        { labelKey: 'nav.factors', icon: 'pi pi-key', route: `${base}/factors` },
        { labelKey: 'nav.scenarios', icon: 'pi pi-question-circle', route: `${base}/scenarios` },
        { labelKey: 'nav.financials', icon: 'pi pi-wallet', route: `${base}/financials` },
      ],
    },
    {
      labelKey: 'nav.group.more',
      items: [{ labelKey: 'nav.labs', icon: 'pi pi-compass', route: `${base}/labs` }],
    },
    { labelKey: 'nav.group.share', items: share },
  ];
}
