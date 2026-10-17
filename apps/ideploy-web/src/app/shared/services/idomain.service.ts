import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';

/**
 * iDomain, vu d'iDeploy : acheter un nom pour une application, ou brancher celui qu'on a déjà.
 * iDeploy ouvre un parcours (`domain-sessions`) avec l'application et l'adresse de retour ;
 * l'utilisateur fait tout dans iDomain, avec la même session IDEM, puis revient ici.
 * Contrat : `GET {idomain-api}/v1/openapi.json`.
 */
@Injectable({ providedIn: 'root' })
export class IdomainService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.services.idomain.api}/v1`;

  /** L'adresse iDomain où envoyer l'utilisateur pour cette application. */
  openSession(appUuid: string, returnUrl: string): Observable<string> {
    return this.http
      .post<{ id: string; url: string }>(`${this.api}/domain-sessions`, { source: 'ideploy', appUuid, returnUrl }, { withCredentials: true })
      .pipe(map((r) => r.url));
  }
}
