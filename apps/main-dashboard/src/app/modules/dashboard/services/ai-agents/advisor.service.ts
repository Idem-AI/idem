import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import {
  AdvisorConversationModel,
  AdvisorReplyResult,
} from '../../models/advisor.model';

@Injectable({ providedIn: 'root' })
export class AdvisorService {
  private readonly apiUrl = `${environment.services.api.url}/project/advisor`;
  private readonly http = inject(HttpClient);

  getConversation(projectId: string): Observable<AdvisorConversationModel> {
    return this.http.get<AdvisorConversationModel>(`${this.apiUrl}/${projectId}`);
  }

  clearConversation(projectId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${projectId}`);
  }

  sendMessage(projectId: string, content: string): Observable<AdvisorReplyResult> {
    return this.http.post<AdvisorReplyResult>(
      `${this.apiUrl}/${projectId}/messages`,
      { content },
    );
  }
}
