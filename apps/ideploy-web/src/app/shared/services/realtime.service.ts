import { Injectable } from '@angular/core';
import Pusher, { Channel } from 'pusher-js';
import { environment } from '../../../environments/environment';

/**
 * Realtime client (Soketi / Pusher protocol) — the same websocket server the
 * Laravel app and the Node API use. Subscribes to deployment log streams.
 *
 * Backend emits: pusher.trigger('deployment.{uuid}', 'log', { line, at }).
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private pusher: Pusher | null = null;

  private client(): Pusher {
    if (!this.pusher) {
      this.pusher = new Pusher(environment.realtime.key, {
        wsHost: environment.realtime.wsHost,
        wsPort: environment.realtime.wsPort,
        forceTLS: environment.realtime.forceTLS,
        enabledTransports: ['ws', 'wss'],
        disableStats: true,
        cluster: '',
      });
    }
    return this.pusher;
  }

  /** Subscribe to a deployment's live log stream. Returns an unsubscribe fn. */
  subscribeToDeployment(
    deploymentUuid: string,
    onLog: (line: string) => void,
    onStatus?: (status: string) => void
  ): () => void {
    const channelName = `deployment.${deploymentUuid}`;
    const channel: Channel = this.client().subscribe(channelName);
    channel.bind('log', (e: { line: string }) => onLog(e.line));
    if (onStatus) channel.bind('status', (e: { status: string }) => onStatus(e.status));
    return () => {
      channel.unbind_all();
      this.client().unsubscribe(channelName);
    };
  }
}
