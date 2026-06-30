import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../shared/services/api.service';

interface ChannelState {
  channel: string;
  label: string;
  enabled: boolean;
  webhook: string;
}

@Component({
  selector: 'app-notifications',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="mb-6 text-2xl font-bold">Notifications</h1>
    <div class="space-y-4">
      @for (ch of channels(); track ch.channel) {
        <div class="box">
          <h2 class="mb-2 font-semibold">{{ ch.label }}</h2>
          <label class="mb-2 flex items-center gap-2 text-sm">
            <input type="checkbox" [(ngModel)]="ch.enabled" />
            Enabled
          </label>
          <input
            class="input mb-2"
            placeholder="Webhook URL / token"
            [(ngModel)]="ch.webhook"
          />
          <div class="flex gap-2">
            <button class="button" (click)="save(ch)">Save</button>
            <button class="button-secondary" (click)="test(ch)">Send test</button>
          </div>
          @if (status()[ch.channel]; as st) {
            <p class="mt-2 text-xs" [class.text-green-400]="st.ok" [class.text-red-400]="!st.ok">
              {{ st.message }}
            </p>
          }
        </div>
      }
    </div>
  `,
})
export class NotificationsComponent implements OnInit {
  private api = inject(ApiService);

  protected readonly channels = signal<ChannelState[]>([
    { channel: 'slack', label: 'Slack', enabled: false, webhook: '' },
    { channel: 'discord', label: 'Discord', enabled: false, webhook: '' },
    { channel: 'telegram', label: 'Telegram (token)', enabled: false, webhook: '' },
    { channel: 'pushover', label: 'Pushover (user key)', enabled: false, webhook: '' },
  ]);

  protected readonly status = signal<Record<string, { ok: boolean; message: string }>>({});

  ngOnInit(): void {
    for (const ch of this.channels()) {
      this.api.getNotificationSettings(ch.channel).subscribe((s) => {
        ch.enabled = Boolean(s['enabled']);
      });
    }
  }

  private setStatus(channel: string, ok: boolean, message: string): void {
    this.status.update((m) => ({ ...m, [channel]: { ok, message } }));
  }

  protected save(ch: ChannelState): void {
    const body: Record<string, unknown> = { enabled: ch.enabled };
    if (ch.channel === 'slack') body['slack_webhook_url'] = ch.webhook;
    if (ch.channel === 'discord') body['discord_webhook_url'] = ch.webhook;
    if (ch.channel === 'telegram') body['telegram_token'] = ch.webhook;
    if (ch.channel === 'pushover') body['pushover_user_key'] = ch.webhook;
    this.api.updateNotificationSettings(ch.channel, body).subscribe(() =>
      this.setStatus(ch.channel, true, 'Saved')
    );
  }

  protected test(ch: ChannelState): void {
    this.api.testNotification(ch.channel).subscribe({
      next: () => this.setStatus(ch.channel, true, 'Test sent ✓'),
      error: (e) => this.setStatus(ch.channel, false, e?.error?.error?.message ?? 'Test failed'),
    });
  }
}
