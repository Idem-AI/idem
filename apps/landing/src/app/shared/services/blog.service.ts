import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BlogKind, BlogList, BlogPostResponse } from '../models/blog.model';
import { SeoService } from './seo.service';

/**
 * Le blog, lu depuis l'API IDEM.
 *
 * Chaque version du landing (`/fr/`, `/en/`) ne montre que les billets de sa
 * langue : la langue vient du build, jamais d'un choix du visiteur ici.
 */
@Injectable({ providedIn: 'root' })
export class BlogService {
  private readonly http = inject(HttpClient);
  private readonly seo = inject(SeoService);
  private readonly base = `${environment.services.api.url}/blog`;

  /** L'adresse du flux RSS de la langue en cours. */
  readonly rssUrl = `${this.base}/rss.xml?locale=${this.seo.locale()}`;

  list(filter: { kind?: BlogKind; tag?: string; page?: number }): Observable<BlogList> {
    let params = new HttpParams().set('locale', this.seo.locale()).set('limit', '12');
    if (filter.kind) params = params.set('kind', filter.kind);
    if (filter.tag) params = params.set('tag', filter.tag);
    if (filter.page && filter.page > 1) params = params.set('page', String(filter.page));
    return this.http.get<BlogList>(`${this.base}/posts`, { params });
  }

  post(slug: string): Observable<BlogPostResponse> {
    return this.http.get<BlogPostResponse>(`${this.base}/posts/${encodeURIComponent(slug)}`, {
      params: new HttpParams().set('locale', this.seo.locale()),
    });
  }
}
