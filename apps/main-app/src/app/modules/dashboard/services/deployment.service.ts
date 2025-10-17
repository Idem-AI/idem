import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { SseClient } from 'ngx-sse-client';
import {
  DeploymentModel,
  QuickDeploymentModel,
  TemplateDeploymentModel,
  AiAssistantDeploymentModel,
  ExpertDeploymentModel,
  ChatMessage,
  StoreSensitiveVariablesRequest,
  StoreSensitiveVariablesResponse,
} from '../models/deployment.model';

// Interfaces nécessaires après la suppression de deployment.api.model.ts
interface GitRepositoryValidationRequest {
  repoUrl: string;
  accessToken?: string;
}

interface GitRepositoryValidationResponse {
  valid: boolean;
  branches: string[];
  error?: string;
}

// SSE event payload for deployment execution streaming
export interface DeploymentExecutionEvent {
  type:
    | 'connected'
    | 'start'
    | 'status'
    | 'log'
    | 'error'
    | 'end'
    | 'completed'
    | 'info'
    | 'stdout'
    | 'stderr'
    | 'complete'
    | 'success';
  level?: 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
  step?: string;
  deploymentId: string;
  status?: 'finished' | 'failed';
  errorCode?: string;
  // Allow additional backend-provided fields
  [key: string]: unknown;
}

@Injectable({
  providedIn: 'root',
})
export class DeploymentService {
  private readonly http = inject(HttpClient);
  private readonly sseClient = inject(SseClient);
  private readonly apiUrl = `${environment.services.api.url}/project`;

  /**
   * Create a new quick deployment
   * @param deployment The quick deployment configuration
   */
  createQuickDeployment(
    deployment: Partial<QuickDeploymentModel>
  ): Observable<QuickDeploymentModel> {
    console.log('Creating quick deployment:', deployment);
    return this.createDeployment<QuickDeploymentModel>(deployment);
  }

  /**
   * Create a new template-based deployment
   * @param deployment The template deployment configuration
   */
  createTemplateDeployment(
    deployment: Partial<TemplateDeploymentModel>
  ): Observable<TemplateDeploymentModel> {
    console.log('Creating template deployment:', deployment);
    return this.createDeployment<TemplateDeploymentModel>(deployment);
  }

  /**
   * Create a new AI assistant deployment
   * @param deployment The AI assistant deployment configuration
   */
  createAiAssistantDeployment(
    deployment: Partial<AiAssistantDeploymentModel>
  ): Observable<AiAssistantDeploymentModel> {
    console.log('Creating AI assistant deployment:', deployment);
    return this.createDeployment<AiAssistantDeploymentModel>(deployment);
  }

  /**
   * Create a new expert deploymentƒ√
   * @param deployment The expert deployment configuration
   */
  createExpertDeployment(
    deployment: Partial<ExpertDeploymentModel>
  ): Observable<ExpertDeploymentModel> {
    console.log('Creating expert deployment:', deployment);
    return this.createDeployment<ExpertDeploymentModel>(deployment);
  }

  /**
   * Create a new deployment
   * @param deployment The deployment configuration
   */
  private createDeployment<T extends DeploymentModel>(
    deployment: Partial<T>
  ): Observable<T> {
    console.log('Creating deployment:', deployment);
    return this.http
      .post<T>(`${this.apiUrl}/deployments/create`, deployment)
      .pipe(
        tap((createdDeployment) =>
          console.log('Created deployment', createdDeployment)
        ),
        catchError((error) => {
          console.error('Error creating deployment', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Get all deployments for a project
   * @param projectId The ID of the project
   */
  getProjectDeployments(projectId: string): Observable<DeploymentModel[]> {
    return this.http
      .get<DeploymentModel[]>(`${this.apiUrl}/deployments/${projectId}`)
      .pipe(
        tap((deployments) => console.log('Fetched deployments', deployments)),
        catchError((error) => {
          console.error('Error fetching deployments', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Get a deployment by its ID
   * @param projectId The ID of the project
   * @param deploymentId The ID of the deployment
   */
  getDeploymentById(
    projectId: string,
    deploymentId: string
  ): Observable<DeploymentModel> {
    return this.http
      .get<DeploymentModel>(
        `${this.apiUrl}/deployments/${projectId}/${deploymentId}`
      )
      .pipe(
        tap((deployment) => console.log('Fetched deployment', deployment)),
        catchError((error) => {
          console.error('Error fetching deployment', error);
          return throwError(() => error);
        })
      );
  }

  executeDeployment(deploymentId: string): Observable<DeploymentModel> {
    return this.http
      .post<DeploymentModel>(
        `${this.apiUrl}/deployments/execute/${deploymentId}`,
        {}
      )
      .pipe(
        tap((deployment) => console.log('Executed deployment', deployment)),
        catchError((error) => {
          console.error('Error executing deployment', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Stream live execution logs and statuses for a deployment using Server-Sent Events.
   * Mirrors native EventSource example but via ngx-sse-client.
   *
   * Backend is expected to emit JSON messages with fields like:
   * { type: "connected" | "start" | "status" | "log" | "error" | "end" | "completed", level, message, ... }
   *
   * @param deploymentId The deployment ID to execute/stream
   * @param token Optional auth token if required as query param (use proxy/cookie when possible)
   */
  executeDeploymentStream(
    deploymentId: string,
    token?: string
  ): Observable<DeploymentExecutionEvent> {
    let url = `${this.apiUrl}/deployments/execute/stream/${deploymentId}`;
    if (token) {
      const sep = url.includes('?') ? '&' : '?';
      url = `${url}${sep}token=${encodeURIComponent(token)}`;
    }

    return new Observable<DeploymentExecutionEvent>((observer) => {
      const sub = this.sseClient
        .stream(url, {
          keepAlive: true,
          reconnectionDelay: 1500,
          responseType: 'event',
        })
        .subscribe({
          next: (ev: Event) => {
            try {
              // Only MessageEvent carries data
              const anyEv = ev as MessageEvent<string>;
              if (anyEv && typeof anyEv.data === 'string') {
                // Handle special termination messages
                if (anyEv.data === '[DONE]') {
                  observer.next({
                    type: 'completed',
                    message: 'Stream completed successfully',
                    timestamp: new Date().toISOString(),
                    deploymentId: deploymentId,
                    status: 'finished',
                  });
                  observer.complete();
                  return;
                }

                if (anyEv.data === '[ERROR]') {
                  observer.next({
                    type: 'error',
                    message: 'Stream terminated with error',
                    timestamp: new Date().toISOString(),
                    deploymentId: deploymentId,
                    status: 'failed',
                  });
                  observer.complete();
                  return;
                }

                const parsed = JSON.parse(
                  anyEv.data
                ) as DeploymentExecutionEvent;

                // Ensure required fields are present
                if (
                  parsed.type &&
                  parsed.message &&
                  parsed.timestamp &&
                  parsed.deploymentId
                ) {
                  observer.next(parsed);
                } else {
                  console.warn('Invalid SSE event format:', parsed);
                }
              } else {
                // Fallback minimal event
                observer.next({
                  type: 'status',
                  message: 'heartbeat',
                  timestamp: new Date().toISOString(),
                  deploymentId: deploymentId,
                });
              }
            } catch (e) {
              console.error('SSE parsing error:', e);
              observer.next({
                type: 'error',
                level: 'error',
                message: `Parsing error: ${(e as Error).message}`,
                timestamp: new Date().toISOString(),
                deploymentId: deploymentId,
              });
            }
          },
          error: (err) => {
            observer.error(err);
          },
          complete: () => observer.complete(),
        });

      return () => sub.unsubscribe();
    });
  }

  /**
   * Update an existing deployment configuration
   * @param projectId The ID of the project
   * @param deploymentId The ID of the deployment
    );
  }

  /**
   * Update an existing deployment configuration
   * @param projectId The ID of the project
   * @param deploymentId The ID of the deployment
   * @param updates The deployment updates
   */
  updateDeployment(
    projectId: string,
    deploymentId: string,
    updates: Partial<DeploymentModel>
  ): Observable<DeploymentModel> {
    return this.http
      .patch<DeploymentModel>(
        `${this.apiUrl}/projects/${projectId}/deployments/${deploymentId}`,
        updates
      )
      .pipe(
        tap((updatedDeployment) =>
          console.log('Updated deployment', updatedDeployment)
        ),
        catchError((error) => {
          console.error('Error updating deployment', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Cancel an ongoing deployment
   * @param projectId The ID of the project
   * @param deploymentId The ID of the deployment
   */
  cancelDeployment(
    projectId: string,
    deploymentId: string
  ): Observable<DeploymentModel> {
    return this.http
      .post<DeploymentModel>(
        `${this.apiUrl}/projects/${projectId}/deployments/${deploymentId}/cancel`,
        {}
      )
      .pipe(
        tap((deployment) => console.log('Cancelled deployment', deployment)),
        catchError((error) => {
          console.error('Error cancelling deployment', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Trigger a redeployment of an existing deployment
   * @param projectId The ID of the project
   * @param deploymentId The ID of the deployment
   */
  redeployDeployment(
    projectId: string,
    deploymentId: string
  ): Observable<DeploymentModel> {
    return this.http
      .post<DeploymentModel>(
        `${this.apiUrl}/projects/${projectId}/deployments/${deploymentId}/redeploy`,
        {}
      )
      .pipe(
        tap((deployment) => console.log('Redeployed', deployment)),
        catchError((error) => {
          console.error('Error redeploying', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Get deployment logs
   * @param projectId The ID of the project
   * @param deploymentId The ID of the deployment
   */
  getDeploymentLogs(
    projectId: string,
    deploymentId: string
  ): Observable<string> {
    return this.http
      .get(
        `${this.apiUrl}/projects/${projectId}/deployments/${deploymentId}/logs`,
        { responseType: 'text' }
      )
      .pipe(
        tap((logs) => console.log('Fetched logs')),
        catchError((error) => {
          console.error('Error fetching logs', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Validate Git repository and fetch available branches
   * @param repoUrl The repository URL
   * @param accessToken Optional access token for private repositories
   */
  validateGitRepository(
    repoUrl: string,
    accessToken?: string
  ): Observable<string[]> {
    const request: GitRepositoryValidationRequest = {
      repoUrl,
      accessToken,
    };

    return this.http
      .post<string[]>(`${this.apiUrl}/git/validate`, request)
      .pipe(
        tap((branches) => console.log('Fetched branches', branches)),
        catchError((error) => {
          console.error('Error validating repository', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Get cloud provider regions
   * @param provider The cloud provider type
   */
  getProviderRegions(
    provider: 'aws' | 'gcp' | 'azure'
  ): Observable<{ id: string; name: string }[]> {
    return this.http
      .get<{ id: string; name: string }[]>(
        `${this.apiUrl}/cloud/${provider}/regions`
      )
      .pipe(
        tap((regions) => console.log(`Fetched ${provider} regions`, regions)),
        catchError((error) => {
          console.error(`Error fetching ${provider} regions`, error);
          return throwError(() => error);
        })
      );
  }

  sendChatMessage(
    message: ChatMessage,
    projectId: string
  ): Observable<ChatMessage> {
    return this.http
      .post<ChatMessage>(`${this.apiUrl}/deployments/chat`, {
        message,
        projectId,
      })
      .pipe(
        // Process the response to parse JSON format and handle different response types
        map((response) => {
          if (response.sender === 'ai') {
            console.log('Processing AI response for JSON parsing and formatting');
            
            try {
              // Try to parse the response text as JSON
              const parsedResponse = JSON.parse(response.text);
              
              // Handle different response types based on the JSON structure
              if (parsedResponse.isRequestingDetails) {
                response.isRequestingDetails = true;
                response.text = parsedResponse.message;
              } else if (parsedResponse.isProposingArchitecture) {
                response.isProposingArchitecture = true;
                response.text = parsedResponse.message;
                response.asciiArchitecture = parsedResponse.asciiArchitecture;
                response.archetypeUrl = parsedResponse.archetypeUrl;
                response.proposedComponents = parsedResponse.proposedComponents;
              } else if (parsedResponse.isRequestingSensitiveVariables) {
                response.isRequestingSensitiveVariables = true;
                response.text = parsedResponse.message;
                response.requestedSensitiveVariables = parsedResponse.requestedSensitiveVariables;
              } else {
                // Regular conversational response
                response.text = parsedResponse.message;
              }
            } catch (e) {
              // If not JSON, treat as regular text and format markdown
              console.log('Response is not JSON, treating as regular text');
              
              // Ensure code blocks are properly formatted with language identifiers
              response.text = response.text.replace(
                /```(\s*)(\w+)?\s*([\s\S]*?)```/g,
                (match, space, lang, code) => {
                  const language = lang || 'text';
                  return `\`\`\`${language}\n${code}\`\`\``;
                }
              );

              // Ensure inline code is properly formatted
              response.text = response.text.replace(
                /`([^`]+)`/g,
                (match, code) => {
                  return `\`${code}\``;
                }
              );
            }
          }
          return response;
        }),
        tap((message) => console.log('Processed chat message', message)),
        catchError((error) => {
          console.error('Error processing chat message', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Generate a deployment pipeline for an existing deployment
   * @param projectId The ID of the project
   * @param deploymentId The ID of the deployment
   */
  generatePipeline(
    projectId: string,
    deploymentId: string
  ): Observable<DeploymentModel> {
    return this.http
      .post<DeploymentModel>(
        `${this.apiUrl}/deployments/startPipeline/${deploymentId}`,
        {}
      )
      .pipe(
        tap((deployment) =>
          console.log('Generated pipeline for deployment', deployment)
        ),
        catchError((error) => {
          console.error('Error generating pipeline', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Generate Terraform files for an existing deployment
   * @param projectId The ID of the project
   * @param deploymentId The ID of the deployment
   */
  generateTerraformFiles(
    projectId: string,
    deploymentId: string
  ): Observable<DeploymentModel> {
    return this.http
      .post<DeploymentModel>(`${this.apiUrl}/deployments/generate`, {
        projectId,
        deploymentId,
      })
      .pipe(
        tap((deployment) =>
          console.log('Generated Terraform files for deployment', deployment)
        ),
        catchError((error) => {
          console.error('Error generating Terraform files', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Store sensitive variables for a deployment securely
   * @param projectId The ID of the project
   * @param deploymentId The ID of the deployment
   * @param request The sensitive variables to store
   */
  storeSensitiveVariables(
    projectId: string,
    deploymentId: string,
    request: StoreSensitiveVariablesRequest
  ): Observable<StoreSensitiveVariablesResponse> {
    return this.http
      .post<StoreSensitiveVariablesResponse>(
        `${this.apiUrl}/deployments/${projectId}/${deploymentId}/sensitive-variables`,
        request
      )
      .pipe(
        tap((response) =>
          console.log('Stored sensitive variables:', response)
        ),
        catchError((error) => {
          console.error('Error storing sensitive variables:', error);
          return throwError(() => error);
        })
      );
  }
}
