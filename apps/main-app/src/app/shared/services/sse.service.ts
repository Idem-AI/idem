import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { SseClient } from 'ngx-sse-client';
import {
  SSEStepEvent,
  SSEServiceEventType,
  SSEConnectionConfig,
} from '../models/sse-step.model';

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
    serviceType: SSEServiceEventType
  ): Observable<SSEStepEvent> {
    console.log(`Creating ${serviceType} SSE connection to:`, config.url);

    // Close existing connection if any
    this.closeConnection(serviceType);

    return new Observable<SSEStepEvent>((observer) => {
      const subscription = this.sseClient
        .stream(config.url, {
          keepAlive: config.keepAlive || true,
          reconnectionDelay: config.reconnectionDelay || 1000,
        })
        .subscribe({
          next: (event: Event) => {
            if (event.type === 'message') {
              const messageEvent = event as MessageEvent;

              // Handle completion message first
              if (this.isCompletionMessage(messageEvent.data)) {
                console.log(`${serviceType} generation completed - stepName: completion, data: all_steps_completed`);
                observer.complete();
                this.closeConnection(serviceType);
                return;
              }

              // Validate message data before parsing
              if (!this.isValidMessage(messageEvent.data)) {
                console.log(
                  `Received empty or invalid ${serviceType} SSE message, ignoring:`,
                  messageEvent.data
                );
                return; // Just ignore invalid messages, don't complete
              }

              const data: SSEStepEvent = JSON.parse(messageEvent.data);
              console.log(`${serviceType} SSE message received:`, data);

              // Emit the event as-is (matches backend format exactly)
              observer.next(data);
            }
          },
          error: (error) => {
            console.error(`${serviceType} SSE connection error:`, error);
            observer.error(error);
          },
          complete: () => {
            console.log(`${serviceType} SSE connection completed`);
            observer.complete();
          },
        });

      this.connections.set(serviceType, subscription);
    });
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
