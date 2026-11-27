import { Injectable, WritableSignal, effect, inject, signal, untracked } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, Router } from '@angular/router';

type Params = Record<string, string>;

/**
 * L'ÉTAT DU MODULE COMMUNICATION DANS L'ADRESSE.
 *
 * Chaque endroit où l'on clique (écran, planning, publication ouverte, visuel agrandi, création en cours, filtre…)
 * est écrit dans les paramètres de l'URL : une actualisation retrouve l'endroit exact, un lien partagé aussi, et
 * « Précédent » / « Suivant » du navigateur reviennent pas à pas.
 *
 * Les écritures d'un même instant (un écran qui change ET ses paramètres qu'on vide) partent en UNE navigation.
 * Ce qui OUVRE quelque chose crée une entrée d'historique (`push`) ; un filtre ou une vue remplace l'entrée.
 */
@Injectable({ providedIn: 'root' })
export class CommunicationUrl {
  private readonly router = inject(Router);
  private queued = false;
  private push = false;

  /** Les paramètres actuels (relus à chaque navigation, mis à jour aussitôt qu'on les écrit). */
  readonly params = signal<Params>(this.read());
  /**
   * Compteur des navigations TERMINÉES. Seule une navigation (actualisation, Précédent, lien, menu) repousse
   * l'adresse dans les états — jamais nos propres écritures : sinon, un écran choisi en même temps qu'on vide les
   * paramètres était aussitôt remis à l'ancien (l'accueil de Communication ne menait plus nulle part).
   */
  readonly navigations = signal(0);

  constructor() {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd || event instanceof NavigationCancel || event instanceof NavigationError) {
        this.params.set(this.read());
        this.navigations.update((n) => n + 1);
      }
    });
  }

  private read(): Params {
    return { ...this.router.parseUrl(this.router.url).queryParams } as Params;
  }

  /** Écrit des paramètres (`null` ou `''` les retire) sur la page en cours, en une navigation groupée. */
  write(patch: Record<string, string | null>, opts: { push?: boolean } = {}): void {
    const next: Params = { ...this.params() };
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === '') delete next[key];
      else next[key] = value;
    }
    this.params.set(next);
    if (opts.push) this.push = true;
    if (this.queued) return;
    this.queued = true;
    queueMicrotask(() => this.flush());
  }

  private flush(): void {
    this.queued = false;
    const push = this.push;
    this.push = false;
    const tree = this.router.parseUrl(this.router.url);
    const wanted = this.params();
    const same = Object.keys(wanted).length === Object.keys(tree.queryParams).length && Object.entries(wanted).every(([k, v]) => tree.queryParams[k] === v);
    if (same) return;
    tree.queryParams = wanted;
    void this.router.navigateByUrl(tree, { replaceUrl: !push });
  }
}

export interface UrlParamOptions<T> {
  /** La valeur quand le paramètre est absent. */
  fallback: T;
  /** Texte de l'adresse → valeur (une valeur inconnue rend `fallback`). */
  parse?: (raw: string) => T;
  /** Valeur → texte de l'adresse (`null` : le paramètre disparaît, l'adresse reste courte). */
  format?: (value: T) => string | null;
  /** Ouvrir quelque chose : une entrée d'historique (sinon l'entrée est remplacée). */
  push?: boolean;
}

/**
 * Un signal relié à un paramètre de l'adresse, dans les deux sens : `set` écrit l'URL, une navigation (actualisation,
 * Précédent) redonne la valeur. À appeler dans un contexte d'injection (champ de composant).
 */
export function urlParam<T>(name: string, opts: UrlParamOptions<T>): WritableSignal<T> {
  const url = inject(CommunicationUrl);
  const parse = opts.parse ?? ((raw: string) => raw as unknown as T);
  const format = opts.format ?? ((value: T) => (value === null || value === undefined ? null : String(value)));
  const fromUrl = (): T => {
    const raw = url.params()[name];
    return raw === undefined ? opts.fallback : parse(raw);
  };
  const state = signal<T>(untracked(fromUrl));
  // Une navigation a eu lieu (Précédent, lien, actualisation) : l'état suit l'adresse.
  effect(() => {
    url.navigations();
    untracked(() => state.set(fromUrl()));
  });
  // L'état a changé (un clic) : l'adresse suit.
  effect(() => {
    const value = state();
    untracked(() => {
      const raw = format(value);
      if ((url.params()[name] ?? null) !== raw) url.write({ [name]: raw }, { push: opts.push });
    });
  });
  return state;
}

/** Un paramètre « drapeau » : présent (`1`) ou absent. */
export function urlFlag(name: string, opts: { push?: boolean } = {}): WritableSignal<boolean> {
  return urlParam<boolean>(name, { fallback: false, parse: (raw) => raw === '1', format: (on) => (on ? '1' : null), push: opts.push });
}

/** Un paramètre à valeurs connues ; `fallback` (la valeur par défaut) n'est pas écrite dans l'adresse. */
export function urlChoice<T extends string>(name: string, values: readonly T[], fallback: T, opts: { push?: boolean } = {}): WritableSignal<T> {
  return urlParam<T>(name, { fallback, parse: (raw) => (values.includes(raw as T) ? (raw as T) : fallback), format: (value) => (value === fallback ? null : value), push: opts.push });
}

/** Les paramètres propres aux écrans : vidés quand on change d'écran (un visuel ouvert ne doit pas revenir ailleurs). */
export const SCREEN_PARAMS = ['plan', 'post', 'cal', 'new', 'visual', 'format', 'origin', 'from', 'archived', 'chat', 'history'] as const;
