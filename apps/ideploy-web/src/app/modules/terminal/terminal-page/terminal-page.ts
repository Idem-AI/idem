import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { environment } from '../../../../environments/environment';

/** What the page was asked to attach to, taken from the route. */
type TargetKind = 'server' | 'application';

/**
 * Interactive shell on a server or inside an application's container.
 *
 * The socket carries the session cookie of the API's own origin, so no token is
 * placed in the URL — a WebSocket URL ends up in proxy logs and browser history
 * the same way any other URL does.
 *
 * The page sends the target once, then only keystrokes and resizes. It never
 * sends a command: the API builds that from what the team owns.
 */
@Component({
  selector: 'app-terminal-page',
  imports: [RouterLink, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a
      class="mb-4 inline-flex items-center gap-2 text-sm"
      style="color:var(--color-text-secondary);"
      [routerLink]="backLink()"
    >
      <i class="pi pi-chevron-left text-[10px]"></i>
      {{ 'terminal.back' | translate }}
    </a>

    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="heading-serif" style="font-size:32px;font-weight:700;color:var(--color-text-primary);">
          {{ 'terminal.title' | translate }}
        </h1>
        <p class="mt-1 text-sm" style="color:var(--color-text-secondary);">
          {{ 'terminal.target.' + kind | translate }} · <code class="font-mono">{{ uuid }}</code>
        </p>
      </div>
      <div class="flex items-center gap-3">
        <span class="text-sm" [style.color]="statusColor()">
          <span aria-hidden="true">●</span> {{ 'terminal.status.' + status() | translate }}
        </span>
        @if (status() === 'closed' || status() === 'error') {
          <button class="inner-button" (click)="connect()">{{ 'terminal.reconnect' | translate }}</button>
        } @else {
          <button class="outer-button" (click)="disconnect()">{{ 'terminal.disconnect' | translate }}</button>
        }
      </div>
    </div>

    @if (error()) {
      <p class="mb-3 text-sm" role="alert" style="color:var(--color-danger);">{{ error() }}</p>
    }

    <!-- The terminal owns its own scrolling; the page must not also scroll. -->
    <div
      class="rounded-lg p-2"
      style="background:#000;border:1px solid var(--color-surface-2);"
      #host
    ></div>

    <p class="mt-2 text-xs" style="color:var(--color-text-secondary);">
      {{ 'terminal.idleHint' | translate }}
    </p>
  `,
})
export class TerminalPageComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private translate = inject(TranslateService);

  private readonly hostRef = viewChild.required<ElementRef<HTMLDivElement>>('host');

  protected kind: TargetKind = 'server';
  protected uuid = '';

  protected readonly status = signal<'connecting' | 'open' | 'closed' | 'error'>('connecting');
  protected readonly error = signal<string | null>(null);

  private term?: Terminal;
  private fit?: FitAddon;
  private socket?: WebSocket;
  private resizeObserver?: ResizeObserver;

  ngOnInit(): void {
    this.kind = (this.route.snapshot.data['kind'] as TargetKind) ?? 'server';
    this.uuid = this.route.snapshot.paramMap.get('uuid') ?? '';

    this.term = new Terminal({
      convertEol: true,
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      theme: { background: '#000000' },
    });
    this.fit = new FitAddon();
    this.term.loadAddon(this.fit);
    this.term.open(this.hostRef().nativeElement);
    this.fit.fit();

    // Keystrokes go straight out; nothing is interpreted locally.
    this.term.onData((data) => this.send({ type: 'data', data }));

    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(this.hostRef().nativeElement);

    this.connect();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.socket?.close();
    this.term?.dispose();
  }

  protected backLink(): unknown[] {
    return this.kind === 'application' ? ['/applications', this.uuid] : ['/servers', this.uuid];
  }

  protected statusColor(): string {
    const status = this.status();
    if (status === 'open') return 'var(--color-success)';
    if (status === 'error') return 'var(--color-danger)';
    if (status === 'connecting') return 'var(--color-warning)';
    return 'var(--color-text-secondary)';
  }

  /** The API's own origin, so the session cookie is sent with the upgrade. */
  private socketUrl(): string {
    const api = new URL(environment.api.url, window.location.origin);
    api.protocol = api.protocol === 'https:' ? 'wss:' : 'ws:';
    api.pathname = '/ws/terminal';
    return api.toString();
  }

  protected connect(): void {
    this.error.set(null);
    this.status.set('connecting');
    this.term?.clear();

    const socket = new WebSocket(this.socketUrl());
    this.socket = socket;

    socket.onopen = () => {
      // First frame names the target; the server opens the session from it.
      const dims = this.fit?.proposeDimensions();
      socket.send(
        JSON.stringify({
          kind: this.kind,
          uuid: this.uuid,
          cols: dims?.cols,
          rows: dims?.rows,
        })
      );
    };

    socket.onmessage = (event) => {
      let frame: { type?: string; data?: string; message?: string; code?: number | null };
      try {
        frame = JSON.parse(event.data as string);
      } catch {
        return;
      }

      if (frame.type === 'ready') {
        this.status.set('open');
        this.onResize();
        this.term?.focus();
      } else if (frame.type === 'data' && typeof frame.data === 'string') {
        this.term?.write(frame.data);
      } else if (frame.type === 'exit') {
        this.status.set('closed');
        this.term?.writeln(`\r\n\x1b[90m${this.translate.instant('terminal.sessionEnded')}\x1b[0m`);
      } else if (frame.type === 'error') {
        this.status.set('error');
        this.error.set(frame.message ?? this.translate.instant('terminal.genericError'));
      }
    };

    socket.onerror = () => {
      this.status.set('error');
      this.error.set(this.translate.instant('terminal.connectionError'));
    };

    socket.onclose = () => {
      if (this.status() !== 'error') this.status.set('closed');
    };
  }

  protected disconnect(): void {
    this.socket?.close();
    this.status.set('closed');
  }

  private send(payload: Record<string, unknown>): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(payload));
  }

  private onResize(): void {
    if (!this.fit || !this.term) return;
    this.fit.fit();
    this.send({ type: 'resize', cols: this.term.cols, rows: this.term.rows });
  }
}
