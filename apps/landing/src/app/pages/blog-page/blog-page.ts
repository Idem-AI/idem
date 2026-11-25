import { DatePipe, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EMPTY, catchError, map, switchMap, tap } from 'rxjs';
import { BlogKind, BlogList, BlogPostSummary } from '../../shared/models/blog.model';
import { BlogService } from '../../shared/services/blog.service';
import { SeoService } from '../../shared/services/seo.service';
import {
  eventDay,
  eventPlace,
  eventWhen,
  isPastEvent,
  kindDescription,
  kindLabel,
  kindPlural,
  parseKind,
} from '../../shared/blog/blog-kinds';
import { PageArtComponent } from '../../shared/components/page-art/page-art';

type State = 'loading' | 'ready' | 'error';

interface KindFilter {
  value: BlogKind | null;
  label: string;
  count: number;
}

/**
 * Le blog : articles, nouveautés, annonces, événements, guides, témoignages, presse.
 *
 * **Le type ne doit pas embrouiller.** Seuls les types qui ont des billets sont proposés en
 * filtre, avec leur nombre ; chaque billet porte son type quand la liste les mélange ; un type
 * choisi est expliqué en une phrase. Les événements à venir ont leur bloc en tête, avec leur date
 * en pastille, et ne réapparaissent pas dans le fil ; un événement passé y est marqué comme tel.
 *
 * La liste est lue **dans le navigateur**, pas au prérendu : le landing est un
 * site statique reconstruit à chaque version, et un billet publié ce matin ne
 * doit pas attendre la prochaine. Le filtre (type, sujet, page) vit dans
 * l'adresse — `?kind=release&tag=produit&page=2` — pour pouvoir être partagé.
 */
@Component({
  selector: 'app-blog-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, PageArtComponent],
  templateUrl: './blog-page.html',
  styleUrls: ['../../shared/styles/editorial-page.css', './blog-page.css'],
})
export class BlogPage {
  private readonly blog = inject(BlogService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly seo = inject(SeoService);
  protected readonly locale = this.seo.locale();
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly rssUrl = this.blog.rssUrl;
  protected readonly state = signal<State>('loading');
  protected readonly list = signal<BlogList | null>(null);
  protected readonly kind = signal<BlogKind | null>(null);
  protected readonly tag = signal<string | null>(null);
  protected readonly page = signal(1);

  /** « Tout », puis les types qui ont au moins un billet (et celui choisi, même vide). */
  protected readonly kinds = computed<KindFilter[]>(() => {
    const counts = this.list()?.kinds ?? [];
    const total = counts.reduce((sum, k) => sum + k.count, 0);
    return [
      { value: null, label: $localize`:@@blog-page.filter.all:All`, count: total },
      ...counts
        .filter((k) => k.count > 0 || k.kind === this.kind())
        .map((k) => ({ value: k.kind, label: kindPlural(k.kind, this.locale), count: k.count })),
    ];
  });

  /** La phrase qui dit ce que contient le type choisi. */
  protected readonly kindIntro = computed(() => {
    const kind = this.kind();
    return kind ? kindDescription(kind, this.locale) : null;
  });

  protected readonly upcoming = computed(() => this.list()?.upcoming ?? []);

  /** Le filtre Événements : le fil ne contient que les événements passés. */
  protected readonly eventsOnly = computed(() => this.kind() === 'event');

  protected readonly filtered = computed(() => this.kind() !== null || this.tag() !== null);

  /** Sur la première page, sans filtre, le billet le plus récent passe en avant. */
  protected readonly featured = computed(() => {
    const list = this.list();
    if (!list || this.filtered() || this.page() !== 1 || list.posts.length < 2) return null;
    return list.posts[0];
  });

  protected readonly rows = computed(() => {
    const list = this.list();
    if (!list) return [];
    return this.featured() ? list.posts.slice(1) : list.posts;
  });

  protected readonly skeletonRows = [0, 1, 2, 3];

  protected readonly previous = computed(() => (this.page() > 1 ? this.page() - 1 : null));
  protected readonly next = computed(() => {
    const list = this.list();
    return list && this.page() < list.pages ? this.page() + 1 : null;
  });

  protected readonly pageLabel = computed(() => {
    const n = this.page();
    const p = this.list()?.pages ?? 1;
    return $localize`:@@blog-page.pagination.status:Page ${n}:n: of ${p}:p:`;
  });

  constructor() {
    this.route.queryParamMap
      .pipe(
        map((params) => {
          const kind = params.get('kind');
          return {
            kind: parseKind(kind),
            tag: params.get('tag'),
            page: Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1),
          };
        }),
        tap((filter) => {
          this.kind.set(filter.kind);
          this.tag.set(filter.tag);
          this.page.set(filter.page);
          this.state.set('loading');
        }),
        // Pas d'appel au prérendu : la liste se charge chez le visiteur.
        switchMap((filter) =>
          this.isBrowser
            ? this.blog
                .list({ kind: filter.kind ?? undefined, tag: filter.tag ?? undefined, page: filter.page })
                .pipe(
                  catchError(() => {
                    this.state.set('error');
                    return EMPTY;
                  })
                )
            : EMPTY
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((list) => {
        this.list.set(list);
        this.state.set('ready');
      });
  }

  protected retry(): void {
    this.state.set('loading');
    this.blog
      .list({ kind: this.kind() ?? undefined, tag: this.tag() ?? undefined, page: this.page() })
      .subscribe({
        next: (list) => {
          this.list.set(list);
          this.state.set('ready');
        },
        error: () => this.state.set('error'),
      });
  }

  protected label(post: BlogPostSummary): string {
    return kindLabel(post.kind, this.locale);
  }

  protected when(post: BlogPostSummary): string {
    return post.event ? eventWhen(post.event, this.locale) : '';
  }

  protected place(post: BlogPostSummary): string {
    return post.event ? eventPlace(post.event, this.locale) : '';
  }

  protected day(post: BlogPostSummary): { day: string; month: string } | null {
    return post.event ? eventDay(post.event, this.locale) : null;
  }

  protected past(post: BlogPostSummary): boolean {
    return isPastEvent(post.event);
  }

  protected readingTime(minutes: number): string {
    return $localize`:@@blog-page.reading:${minutes}:n: min read`;
  }
}
