import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { SseClient } from 'ngx-sse-client';
import { SSEStepEvent, SSEServiceEventType, SSEConnectionConfig } from '../models/sse-step.model';
import { readLocaleCookie } from '../utils/locale-cookie';

@Injectable({
  providedIn: 'root',
})
export class SSEService {
  private connections = new Map<SSEServiceEventType, any>();

  constructor(private sseClient: SseClient) {}

  /**
   * Create SSE connection for a specific service type
   * @param config Connection configuration
   * @param serviceType Type of service (diagram, branding, business-plan)
   * @returns Observable of SSE events
   */
  createConnection(
    config: SSEConnectionConfig,
    serviceType: SSEServiceEventType,
  ): Observable<SSEStepEvent> {
    // SSE bypasses the HttpClient auth interceptor, so the UI language cannot be
    // sent as an Accept-Language header. Carry it as a `lang` query param instead
    // so backend AI generation streams content in the user's language.
    const url = this.withLanguageParam(config.url);
    console.log(`Creating ${serviceType} SSE connection to:`, url);

    // Close existing connection if any
    this.closeConnection(serviceType);

    return new Observable<SSEStepEvent>((observer) => {
      // Fin propre = message de fin reçu. Toute autre fin du flux est une
      // coupure, jamais un succès : la présenter comme terminée afficherait un
      // document incomplet.
      let finished = false;
      const interrupted = (cause?: unknown) => {
        if (finished) return;
        finished = true;
        console.error(`${serviceType} SSE interrupted`, cause);
        observer.error(new Error('generation_stream_interrupted'));
      };

      const subscription = this.sseClient
        .stream(url, {
          // JAMAIS de reconnexion : ces flux sont des GET qui LANCENT une
          // génération. Se reconnecter la relançait depuis le début, la
          // refacturait, et tournait en boucle dès que le flux était coupé
          // (proxy, onglet en arrière-plan, réseau mobile).
          keepAlive: false,
          responseType: 'event',
        })
        .subscribe({
          next: (event: Event) => {
            if (finished) return;
            // La bibliothèque signale une coupure réseau par un événement
            // `error`, sans erreur d'observable.
            if (event.type === 'error') {
              interrupted(event);
              return;
            }
            if (event.type === 'message') {
              const messageEvent = event as MessageEvent;

              // Handle completion message first
              if (this.isCompletionMessage(messageEvent.data)) {
                console.log(
                  `${serviceType} generation completed - stepName: completion, data: all_steps_completed`,
                );
                finished = true;
                observer.complete();
                this.closeConnection(serviceType);
                return;
              }

              // Le serveur a échoué et le dit : on s'arrête là, avec son message.
              const serverError = this.serverError(messageEvent.data);
              if (serverError) {
                finished = true;
                observer.error(new Error(serverError));
                this.closeConnection(serviceType);
                return;
              }

              // Validate message data before parsing
              if (!this.isValidMessage(messageEvent.data)) {
                console.log(
                  `Received empty or invalid ${serviceType} SSE message, ignoring:`,
                  messageEvent.data,
                );
                return; // Just ignore invalid messages, don't complete
              }

              const data: SSEStepEvent = JSON.parse(messageEvent.data);
              console.log(`${serviceType} SSE message received:`, data);

              // Emit the event as-is (matches backend format exactly)
              observer.next(data);
            }
          },
          error: (error) => interrupted(error),
          // Réponse close sans message de fin.
          complete: () => interrupted('stream ended without completion message'),
        });

      this.connections.set(serviceType, subscription);
    });
  }

  /**
   * Append the current UI language as a `lang` query param, preserving any
   * existing query string.
   */
  private withLanguageParam(url: string): string {
    const lang = readLocaleCookie() ?? 'en';
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}lang=${lang}`;
  }

  /**
   * Close SSE connection for a specific service type
   * @param serviceType Type of service
   */
  closeConnection(serviceType: SSEServiceEventType): void {
    const connection = this.connections.get(serviceType);
    if (connection) {
      connection.unsubscribe();
      this.connections.delete(serviceType);
      console.log(`${serviceType} SSE connection closed`);
    }
  }

  /**
   * Cancel generation for a specific service type
   * @param serviceType Type of service
   */
  cancelGeneration(serviceType: SSEServiceEventType): void {
    this.closeConnection(serviceType);
  }

  /**
   * Check if message data is valid
   * @param data Message data
   * @returns True if valid
   */
  private isValidMessage(data: any): boolean {
    if (!data || data === 'undefined' || data.trim() === '') {
      return false;
    }
    try {
      const parsed = JSON.parse(data);
      return parsed && typeof parsed === 'object' && parsed.type;
    } catch {
      return false;
    }
  }

  /**
   * Message d'erreur envoyé par le serveur (`{ type: 'error', message }` ou
   * `{ error }`), ou `null` si le message n'en est pas un.
   */
  private serverError(data: any): string | null {
    try {
      const parsed = JSON.parse(data);
      if (!parsed || typeof parsed !== 'object') return null;
      if (parsed.type === 'error') return parsed.message || parsed.error || 'generation_failed';
      if (!parsed.type && typeof parsed.error === 'string') return parsed.error;
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Check if message indicates completion
   * Based on your data: stepName="completion" and data="all_steps_completed"
   * @param data Message data
   * @returns True if completion message
   */
  private isCompletionMessage(data: any): boolean {
    try {
      const parsed = JSON.parse(data);
      return parsed.stepName === 'completion' && parsed.data === 'all_steps_completed';
    } catch {
      return false;
    }
  }
}
