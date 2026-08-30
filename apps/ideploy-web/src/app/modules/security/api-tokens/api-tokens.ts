import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../../shared/services/api.service';
import { ApiToken, CloudToken } from '../../../shared/models/ideploy.models';

/** Providers the API can provision against today. */
const PROVIDERS = ['hetzner', 'digitalocean', 'aws', 'scaleway'] as const;

/**
 * Credentials — personal API tokens and cloud provider keys.
 *
 * A freshly issued API token is the only moment its value exists outside the
 * hash, so it is shown once, prominently, with a copy control and a warning
 * that it will not be shown again. Everything else in this screen reports what
 * a credential is for, never what it is.
 */
@Component({
  selector: 'app-api-tokens',
  imports: [ReactiveFormsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="mb-6 text-2xl font-bold">{{ 'security.tokens.title' | translate }}</h1>

    @if (error()) {
      <p class="mb-4 text-sm" role="alert" style="color:var(--color-danger);">{{ error() }}</p>
    }

    <!-- Shown once. Losing it means issuing a new one. -->
    @if (issued(); as plain) {
      <div
        class="mb-6 rounded-lg p-4"
        role="status"
        style="background:color-mix(in srgb, var(--color-success) 12%, transparent);border:1px solid color-mix(in srgb, var(--color-success) 40%, transparent);"
      >
        <p class="mb-2 text-sm font-semibold" style="color:var(--color-success);">
          {{ 'security.tokens.copyNow' | translate }}
        </p>
        <div class="flex flex-wrap items-center gap-2">
          <code class="flex-1 overflow-x-auto rounded-md p-2 font-mono text-xs" style="background:var(--color-bg-dark);">{{ plain }}</code>
          <button class="button-secondary" (click)="copy(plain)">
            {{ (copied() ? 'security.tokens.copied' : 'security.tokens.copy') | translate }}
          </button>
          <button class="text-xs" style="color:var(--color-text-secondary);" (click)="dismissIssued()">
            {{ 'security.tokens.dismiss' | translate }}
          </button>
        </div>
      </div>
    }

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div>
        <section class="box mb-4">
          <h2 class="mb-3 text-sm font-semibold">{{ 'security.tokens.apiTokens' | translate }}</h2>
          @if (tokens().length === 0) {
            <p class="text-sm" style="color:var(--color-text-secondary);">{{ 'security.tokens.noTokens' | translate }}</p>
          } @else {
            <ul class="space-y-2 text-sm">
              @for (t of tokens(); track t.id) {
                <li class="flex flex-wrap items-center gap-2">
                  <span class="font-medium">{{ t.name }}</span>
                  <span class="rounded-full px-2 py-0.5 text-xs" style="background:var(--color-surface-2);color:var(--color-text-secondary);">
                    {{ t.abilities.join(', ') }}
                  </span>
                  @if (t.expiresAt) {
                    <span class="text-xs" style="color:var(--color-text-secondary);">
                      {{ 'security.tokens.expires' | translate }} {{ t.expiresAt }}
                    </span>
                  } @else {
                    <span class="text-xs" style="color:var(--color-warning);">
                      {{ 'security.tokens.neverExpires' | translate }}
                    </span>
                  }
                  <span class="text-xs" style="color:var(--color-text-secondary);">
                    {{ 'security.tokens.lastUsed' | translate }}
                    {{ t.lastUsedAt || ('security.tokens.never' | translate) }}
                  </span>
                  <button class="ml-auto text-xs" style="color:var(--color-danger);" (click)="revoke(t)">
                    {{ 'security.tokens.revoke' | translate }}
                  </button>
                </li>
              }
            </ul>
          }
        </section>

        <section class="box">
          <h2 class="mb-3 text-sm font-semibold">{{ 'security.tokens.cloudTokens' | translate }}</h2>
          @if (cloudTokens().length === 0) {
            <p class="text-sm" style="color:var(--color-text-secondary);">{{ 'security.tokens.noCloudTokens' | translate }}</p>
          } @else {
            <ul class="space-y-2 text-sm">
              @for (c of cloudTokens(); track c.id) {
                <li class="flex items-center gap-2">
                  <span class="rounded-full px-2 py-0.5 text-xs" style="background:var(--color-surface-2);">{{ c.provider }}</span>
                  <span>{{ c.name || ('security.tokens.unnamed' | translate) }}</span>
                  <button class="ml-auto text-xs" style="color:var(--color-danger);" (click)="removeCloudToken(c)">
                    {{ 'security.tokens.delete' | translate }}
                  </button>
                </li>
              }
            </ul>
          }
        </section>
      </div>

      <div>
        <form class="box mb-4 space-y-3" [formGroup]="tokenForm" (ngSubmit)="createToken()">
          <h2 class="text-sm font-semibold">{{ 'security.tokens.newToken' | translate }}</h2>
          <div>
            <label class="mb-1 block text-sm" for="token-name">{{ 'security.tokens.name' | translate }}</label>
            <input class="input" id="token-name" formControlName="name" [placeholder]="'security.tokens.namePlaceholder' | translate" />
          </div>
          <div>
            <label class="mb-1 block text-sm" for="token-abilities">{{ 'security.tokens.abilities' | translate }}</label>
            <select class="input" id="token-abilities" formControlName="ability">
              <option value="*">{{ 'security.tokens.ability.all' | translate }}</option>
              <option value="read">{{ 'security.tokens.ability.read' | translate }}</option>
              <option value="write">{{ 'security.tokens.ability.write' | translate }}</option>
              <option value="deploy">{{ 'security.tokens.ability.deploy' | translate }}</option>
            </select>
          </div>
          <div>
            <label class="mb-1 block text-sm" for="token-expiry">{{ 'security.tokens.expiryDays' | translate }}</label>
            <input class="input" id="token-expiry" type="number" min="1" max="3650" formControlName="expiresInDays" />
            <p class="mt-1 text-xs" style="color:var(--color-text-secondary);">
              {{ 'security.tokens.expiryHint' | translate }}
            </p>
          </div>
          <button class="button" type="submit" [disabled]="tokenForm.invalid || creating()">
            {{ (creating() ? 'security.tokens.creating' : 'security.tokens.create') | translate }}
          </button>
        </form>

        <form class="box space-y-3" [formGroup]="cloudForm" (ngSubmit)="createCloudToken()">
          <h2 class="text-sm font-semibold">{{ 'security.tokens.newCloudToken' | translate }}</h2>
          <div>
            <label class="mb-1 block text-sm" for="cloud-provider">{{ 'security.tokens.provider' | translate }}</label>
            <select class="input" id="cloud-provider" formControlName="provider">
              @for (p of providers; track p) {
                <option [value]="p">{{ p }}</option>
              }
            </select>
          </div>
          <div>
            <label class="mb-1 block text-sm" for="cloud-name">{{ 'security.tokens.name' | translate }}</label>
            <input class="input" id="cloud-name" formControlName="name" />
          </div>
          <div>
            <label class="mb-1 block text-sm" for="cloud-token">{{ 'security.tokens.tokenValue' | translate }}</label>
            <input class="input font-mono" id="cloud-token" type="password" autocomplete="off" formControlName="token" />
            <p class="mt-1 text-xs" style="color:var(--color-text-secondary);">
              {{ 'security.tokens.cloudTokenHint' | translate }}
            </p>
          </div>
          <button class="button" type="submit" [disabled]="cloudForm.invalid || savingCloud()">
            {{ (savingCloud() ? 'security.tokens.saving' : 'security.tokens.addCloudToken') | translate }}
          </button>
        </form>
      </div>
    </div>
  `,
})
export class ApiTokensComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  private translate = inject(TranslateService);

  protected readonly providers = PROVIDERS;

  protected readonly tokens = signal<ApiToken[]>([]);
  protected readonly cloudTokens = signal<CloudToken[]>([]);
  /** Plaintext of the token just issued — held in memory only, never persisted. */
  protected readonly issued = signal<string | null>(null);
  protected readonly copied = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly creating = signal(false);
  protected readonly savingCloud = signal(false);

  protected readonly tokenForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    ability: ['*'],
    expiresInDays: [90, [Validators.min(1), Validators.max(3650)]],
  });

  protected readonly cloudForm = this.fb.nonNullable.group({
    provider: ['hetzner', Validators.required],
    name: [''],
    token: ['', Validators.required],
  });

  ngOnInit(): void {
    this.api.listApiTokens().subscribe({
      next: (t) => this.tokens.set(t),
      error: (e) => this.report(e, 'security.tokens.loadError'),
    });
    this.api.listCloudTokens().subscribe({
      next: (c) => this.cloudTokens.set(c),
      error: (e) => this.report(e, 'security.tokens.cloudLoadError'),
    });
  }

  private report(err: unknown, fallbackKey: string): void {
    const message = (err as { error?: { error?: { message?: string } } })?.error?.error?.message;
    this.error.set(message ?? this.translate.instant(fallbackKey));
  }

  protected copy(value: string): void {
    navigator.clipboard?.writeText(value).then(
      () => this.copied.set(true),
      () => this.report(null, 'security.tokens.copyError')
    );
  }

  protected dismissIssued(): void {
    this.issued.set(null);
    this.copied.set(false);
  }

  protected createToken(): void {
    if (this.tokenForm.invalid) return;
    this.creating.set(true);
    this.error.set(null);
    const raw = this.tokenForm.getRawValue();
    this.api
      .createApiToken({
        name: raw.name,
        abilities: [raw.ability],
        expiresInDays: raw.expiresInDays || undefined,
      })
      .subscribe({
        next: (result) => {
          this.tokens.update((list) => [result.token, ...list]);
          this.issued.set(result.plainTextToken);
          this.copied.set(false);
          this.tokenForm.reset({ name: '', ability: '*', expiresInDays: 90 });
          this.creating.set(false);
        },
        error: (e) => {
          this.report(e, 'security.tokens.createError');
          this.creating.set(false);
        },
      });
  }

  protected revoke(token: ApiToken): void {
    this.api.revokeApiToken(token.id).subscribe({
      next: () => this.tokens.update((list) => list.filter((t) => t.id !== token.id)),
      error: (e) => this.report(e, 'security.tokens.revokeError'),
    });
  }

  protected createCloudToken(): void {
    if (this.cloudForm.invalid) return;
    this.savingCloud.set(true);
    this.error.set(null);
    const raw = this.cloudForm.getRawValue();
    this.api
      .createCloudToken({ provider: raw.provider, token: raw.token, name: raw.name || undefined })
      .subscribe({
        next: (c) => {
          this.cloudTokens.update((list) => [...list, c]);
          this.cloudForm.reset({ provider: 'hetzner', name: '', token: '' });
          this.savingCloud.set(false);
        },
        error: (e) => {
          this.report(e, 'security.tokens.cloudCreateError');
          this.savingCloud.set(false);
        },
      });
  }

  protected removeCloudToken(token: CloudToken): void {
    this.api.deleteCloudToken(token.id).subscribe({
      next: () => this.cloudTokens.update((list) => list.filter((c) => c.id !== token.id)),
      error: (e) => this.report(e, 'security.tokens.cloudDeleteError'),
    });
  }
}
