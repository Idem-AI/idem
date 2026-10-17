import { DatePipe, DOCUMENT, isPlatformBrowser } from '@angular/common';
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
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EMPTY, catchError, map, switchMap, tap } from 'rxjs';
import { landingUrl } from '@idem/shared-seo';
import { BlogPost, BlogPostSummary } from '../../shared/models/blog.model';
import { BlogService } from '../../shared/services/blog.service';
import { SeoService } from '../../shared/services/seo.service';

type State = 'loading' | 'ready' | 'notfound' | 'error';

/**
 * Un billet du blog.
 *
 * Le texte arrive **déjà rendu et assaini** par l'API (Markdown → HTML, liste
 * blanche de balises). C'est pourquoi il est injecté tel quel : le
 * désinfectant d'Angular, lui, retire les attributs `id` — et avec eux les
 * ancres de la table des matières — alors qu'il n'a plus rien à nettoyer.
 *
 * Comme la liste, le billet est lu dans le navigateur : un billet publié ce
 * matin doit être lisible ce matin, sans attendre une nouvelle version du site.
 */
@Component({
  selector: 'app-blog-post-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe],
  templateUrl: './blog-post-page.html',
  styleUrls: ['../../shared/styles/editorial-page.css', './blog-post-page.css'],
})
export class BlogPostPage {
  private readonly blog = inject(BlogService);
  private readonly seo = inject(SeoService);
  private readonly route = inject(ActivatedRoute);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly state = signal<State>('loading');
  protected readonly post = signal<BlogPost | null>(null);
  protected readonly related = signal<BlogPostSummary[]>([]);
  protected readonly copied = signal(false);
  private slug = '';

  protected readonly html = computed<SafeHtml>(() =>
    this.sanitizer.bypassSecurityTrustHtml(this.post()?.contentHtml ?? '')
  );

  /** Une table des matières n'aide que sur un texte assez long pour s'y perdre. */
  protected readonly showToc = computed(() => (this.post()?.toc.length ?? 0) >= 3);

  protected readonly byline = computed(() => {
    const author = this.post()?.authorName ?? '';
    return $localize`:@@blog-post-page.by:By ${author}:author:`;
  });

  protected readonly readingTime = computed(() => {
    const minutes = this.post()?.readingMinutes ?? 1;
    return $localize`:@@blog-page.reading:${minutes}:n: min read`;
  });

  /** L'adresse publique du billet, celle qu'on partage. */
  protected readonly shareUrl = computed(() => {
    const post = this.post();
    return post ? landingUrl(`/blog/${post.slug}`, this.seo.locale()) : '';
  });

  protected readonly xUrl = computed(
    () =>
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(this.shareUrl())}&text=${encodeURIComponent(this.post()?.title ?? '')}`
  );

  protected readonly linkedinUrl = computed(
    () => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(this.shareUrl())}`
  );

  protected readonly skeletonLines = [0, 1, 2, 3, 4];

  constructor() {
    this.route.paramMap
      .pipe(
        map((params) => params.get('slug') ?? ''),
        tap((slug) => {
          this.slug = slug;
          this.state.set('loading');
        }),
        switchMap((slug) =>
          this.isBrowser
            ? this.blog.post(slug).pipe(
                catchError((error: HttpErrorResponse) => {
                  this.fail(error.status === 404 ? 'notfound' : 'error');
                  return EMPTY;
                })
              )
            : EMPTY
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(({ post, related }) => {
        this.post.set(post);
        this.related.set(related);
        this.state.set('ready');
        this.seo.applyPost(post);
      });
  }

  protected retry(): void {
    this.state.set('loading');
    this.blog.post(this.slug).subscribe({
      next: ({ post, related }) => {
        this.post.set(post);
        this.related.set(related);
        this.state.set('ready');
        this.seo.applyPost(post);
      },
      error: (error: HttpErrorResponse) => this.fail(error.status === 404 ? 'notfound' : 'error'),
    });
  }

  /** Un billet introuvable ne doit pas être indexé sous le titre d'un autre. */
  private fail(state: 'notfound' | 'error'): void {
    this.state.set(state);
    this.seo.apply('not-found');
  }

  /**
   * Défile jusqu'à une section sans passer par le routeur : l'adresse du site
   * porte un `<base href>`, et un lien `#ancre` nu y renverrait à la racine.
   */
  protected jump(event: Event, id: string): void {
    event.preventDefault();
    const target = this.document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    history.replaceState(null, '', `${location.pathname}${location.search}#${id}`);
  }

  protected copyLink(): void {
    void navigator.clipboard?.writeText(this.shareUrl()).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    });
  }

  protected tocHref(id: string): string {
    return `${this.isBrowser ? location.pathname : ''}#${id}`;
  }
}
