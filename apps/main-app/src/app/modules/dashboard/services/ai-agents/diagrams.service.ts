import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../../environments/environment';
import { DiagramModel } from '../../models/diagram.model';
import { DiagramStepEvent } from '../../models/diagram-step.model';
import { SSEService } from '../../../../shared/services/sse.service';
import {
  SSEStepEvent,
  SSEConnectionConfig,
} from '../../../../shared/models/sse-step.model';

@Injectable({
  providedIn: 'root',
})
export class DiagramsService {
  private readonly apiUrl = `${environment.services.api.url}/project/diagrams`;
  private readonly http = inject(HttpClient);
  private readonly sseService = inject(SSEService);

  /**
   * Close SSE connection
   */
  closeSSEConnection(): void {
    this.sseService.closeConnection('diagram');
  }

  /**
   * Create a new diagram using Server-Sent Events for real-time updates
   * @param projectId Project ID
   * @returns Observable with SSE events
   */
  createDiagramModel(projectId: string): Observable<SSEStepEvent> {
    console.log('Creating diagram model with SSE for project:', projectId);

    // Close any existing connection
    this.closeSSEConnection();

    const config: SSEConnectionConfig = {
      url: `${this.apiUrl}/generate-stream/${projectId}`,
      keepAlive: true,
      reconnectionDelay: 1000,
    };

    return this.sseService.createConnection(config, 'diagram');
  }

  /**
   * Cancel ongoing SSE connection
   */    
  cancelGeneration(): void {
    this.sseService.cancelGeneration('diagram');
  }
  /**
   * Get all diagrams for a project
   * @param projectId Project ID
   * @returns Observable with array of diagram models
   */
  getDiagrams(projectId: string): Observable<DiagramModel[]> {
    return this.http.get<DiagramModel[]>(`${this.apiUrl}/${projectId}`);
  }

  /**
   * Get a specific diagram by ID
   * @param diagramId Diagram ID
   * @returns Observable with the diagram model
   */
  getDiagram(diagramId: string): Observable<DiagramModel> {
    return this.http.get<DiagramModel>(`${this.apiUrl}/getAll/${diagramId}`);
  }

  /**
   * Update an existing diagram
   * @param diagramId Diagram ID
   * @param updates Partial diagram updates
   * @returns Observable with the updated diagram model
   */
  updateDiagram(
    diagramId: string,
    updates: Partial<DiagramModel>
  ): Observable<DiagramModel> {
    return this.http.put<DiagramModel>(
      `${this.apiUrl}/diagram/${diagramId}`,
      updates
    );
  }

  /**
   * Delete a diagram
   * @param diagramId Diagram ID
   * @returns Observable with void
   */
  deleteDiagram(diagramId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/diagram/${diagramId}`);
  }
}
