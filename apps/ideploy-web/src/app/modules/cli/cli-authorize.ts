import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../shared/services/api.service';

type State = 'loading' | 'ask' | 'approved' | 'denied' | 'error';

/**
 * `idem login` opens this page with the code its terminal shows. The developer
 * checks that both codes match and approves: the CLI receives a token in
 * their name. Nothing is issued without that click.
 */
@Component({
  selector: 'app-cli-authorize',
  imports: [TranslateModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-md py-10">
      <section class="glass-card p-6 text-center">
        <i class="pi pi-desktop mb-3 text-3xl" style="color:var(--color-primary-500);" aria-hidden="true"></i>
        <h1 class="mb-2 text-xl font-bold">{{ 'cli.authorize.title' | translate }}</h1>

        @switch (state()) {
          @case ('loading') {
            <p class="text-sm" style="color:var(--color-text-secondary);">{{ 'cli.authorize.loading' | translate }}</p>
          }
          @case ('ask') {
            <p class="mb-4 text-sm" style="color:var(--color-text-secondary);">
              {{ 'cli.authorize.question' | translate: { host: host() } }}
            </p>
            <p class="mb-1 text-xs" style="color:var(--color-text-tertiary);">{{ 'cli.authorize.checkCode' | translate }}</p>
            <p class="mb-6 font-mono text-2xl font-bold tracking-widest">{{ code() }}</p>
            <div class="flex justify-center gap-3">
              <button type="button" class="outer-button" [disabled]="busy()" (click)="answer(false)">{{ 'cli.authorize.deny' | translate }}</button>
              <button type="button" class="inner-button" [disabled]="busy()" (click)="answer(true)">{{ 'cli.authorize.approve' | translate }}</button>
            </div>
            <p class="mt-4 text-xs" style="color:var(--color-text-tertiary);">{{ 'cli.authorize.warning' | translate }}</p>
          }
          @case ('approved') {
            <p class="text-sm" role="status" style="color:var(--color-success);">{{ 'cli.authorize.approved' | translate }}</p>
          }
          @case ('denied') {
            <p class="text-sm" role="status" style="color:var(--color-text-secondary);">{{ 'cli.authorize.denied' | translate }}</p>
          }
          @case ('error') {
            <p class="mb-4 text-sm" role="alert" style="color:var(--color-danger);">{{ error() }}</p>
            <a class="outer-button" routerLink="/dashboard">{{ 'cli.authorize.back' | translate }}</a>
          }
        }
      </section>
    </div>
  `,
})
export class CliAuthorizeComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);

  protected readonly state = signal<State>('loading');
  protected readonly code = signal('');
  protected readonly host = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  ngOnInit(): void {
    const code = this.route.snapshot.queryParamMap.get('code') ?? '';
    this.api.cliAuthRequest(code).subscribe({
      next: (r) => {
        this.code.set(r.userCode);
        this.host.set(r.host);
        this.state.set(r.status === 'pending' ? 'ask' : r.status === 'approved' ? 'approved' : 'denied');
      },
      error: (e) => this.fail(e),
    });
  }

  protected answer(approve: boolean): void {
    this.busy.set(true);
    this.api.cliAuthAnswer(this.code(), approve).subscribe({
      next: () => this.state.set(approve ? 'approved' : 'denied'),
      error: (e) => this.fail(e),
    });
  }

  private fail(e: unknown): void {
    this.busy.set(false);
    this.error.set((e as { error?: { error?: { message?: string } } })?.error?.error?.message ?? 'Error');
    this.state.set('error');
  }
}
