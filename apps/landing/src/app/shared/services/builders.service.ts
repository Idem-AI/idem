import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import type {
  BuilderBrand,
  BuilderProfile,
  BuilderShowcaseEntry,
} from '@idem/shared-models/builders/program';
import { environment } from '../../../environments/environment';

/**
 * Idem Builders, lu depuis l'API IDEM : la vitrine et la fiche d'un projet.
 *
 * Lu dans le navigateur, comme le blog : un projet admis ce matin apparaît ce
 * matin. Les logos anciens, servis par l'API, arrivent en chemin relatif ; ils
 * sont complétés ici, une fois, pour que les gabarits n'aient qu'une adresse.
 */
@Injectable({ providedIn: 'root' })
export class BuildersService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.services.api.url.replace(/\/$/, '');

  showcase(limit = 60): Observable<BuilderShowcaseEntry[]> {
    return this.http
      .get<{ builders: BuilderShowcaseEntry[] }>(`${this.api}/builders/showcase`, {
        params: new HttpParams().set('limit', String(limit)),
      })
      .pipe(map(({ builders }) => builders.map((entry) => ({ ...entry, brand: this.resolve(entry.brand) }))));
  }

  profile(slug: string): Observable<BuilderProfile> {
    return this.http
      .get<{ builder: BuilderProfile }>(`${this.api}/builders/projects/${encodeURIComponent(slug)}`)
      .pipe(map(({ builder }) => ({ ...builder, brand: this.resolve(builder.brand) })));
  }

  private resolve(brand: BuilderBrand | undefined): BuilderBrand | undefined {
    if (!brand) return brand;
    const absolute = (url?: string) => (url?.startsWith('/') ? `${this.api}${url}` : url);
    return { ...brand, logoOnBrand: absolute(brand.logoOnBrand), logoOnLight: absolute(brand.logoOnLight) };
  }
}
