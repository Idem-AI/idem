import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export type PublishNetwork = 'linkedin' | 'facebook' | 'instagram' | 'x';

export interface WhatsappStatus {
  /** WhatsApp est-il activé côté IDEM (identifiants Meta présents) ? */
  available: boolean;
  /** Le compte a-t-il un forfait payant ? */
  entitled: boolean;
  reason?: 'free_plan' | 'welcome_only';
  linked: boolean;
  phoneLast4?: string;
  dailyProposals: boolean;
  sendHour: number;
  utcOffsetMinutes: number;
  language: 'fr' | 'en';
  defaultProjectId?: string;
  pending: number;
  networks: { network: PublishNetwork; configured: boolean }[];
}

export interface WhatsappLinkStart {
  code: string;
  waUrl: string | null;
  expiresAt: string;
}

export interface WhatsappHistoryItem {
  _id: string;
  kind: 'planned' | 'adhoc';
  status: string;
  networks: string[];
  mediaKind: 'image' | 'video';
  caption: string;
  forDay?: string;
  createdAt: string;
}

export interface SocialAccountView {
  network: PublishNetwork;
  accountName?: string;
  status: string;
}

/** Publier depuis WhatsApp : liaison du numéro, réglages, réseaux connectés. */
@Injectable({ providedIn: 'root' })
export class WhatsappService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.services.api.url;

  status(): Observable<WhatsappStatus> {
    return this.http.get<WhatsappStatus>(`${this.api}/whatsapp/status`);
  }

  startLink(projectId: string): Observable<WhatsappLinkStart> {
    return this.http.post<WhatsappLinkStart>(`${this.api}/whatsapp/link`, { projectId });
  }

  unlink(): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.api}/whatsapp/link`);
  }

  updateSettings(patch: { dailyProposals?: boolean; sendHour?: number; utcOffsetMinutes?: number; defaultProjectId?: string }): Observable<{ ok: boolean }> {
    return this.http.put<{ ok: boolean }>(`${this.api}/whatsapp/settings`, patch);
  }

  history(): Observable<{ items: WhatsappHistoryItem[] }> {
    return this.http.get<{ items: WhatsappHistoryItem[] }>(`${this.api}/whatsapp/history`);
  }

  accounts(projectId: string): Observable<{ accounts: SocialAccountView[] }> {
    return this.http.get<{ accounts: SocialAccountView[] }>(`${this.api}/social/accounts`, { params: { projectId } });
  }

  connectUrl(network: PublishNetwork, projectId: string): Observable<{ url: string }> {
    return this.http.get<{ url: string }>(`${this.api}/social/${network}/connect`, { params: { projectId } });
  }

  disconnect(network: PublishNetwork, projectId: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.api}/social/${network}`, { params: { projectId } });
  }
}
