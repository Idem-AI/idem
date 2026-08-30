import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../../shared/services/api.service';
import { PrivateKey, SshKeyType } from '../../../shared/models/ideploy.models';

/**
 * SSH keys — the credential every server registration needs.
 *
 * Two ways in, because they answer different situations: paste a key you
 * already have, or have one generated here. Generation is offered first: it
 * is the path that does not involve a private key travelling through a
 * clipboard, and the only half that leaves the API is the public one.
 */
@Component({
  selector: 'app-private-keys',
  imports: [ReactiveFormsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="mb-6 text-2xl font-bold">{{ 'security.privateKeys' | translate }}</h1>

    @if (error()) {
      <p class="mb-4 text-sm" role="alert" style="color:var(--color-danger);">{{ error() }}</p>
    }

    <!-- Shown after generating: this is what has to be installed on the host. -->
    @if (publicKey(); as pub) {
      <div
        class="mb-6 rounded-lg p-4"
        role="status"
        style="background:color-mix(in srgb, var(--color-success) 12%, transparent);border:1px solid color-mix(in srgb, var(--color-success) 40%, transparent);"
      >
        <p class="mb-2 text-sm font-semibold" style="color:var(--color-success);">
          {{ 'security.installPublicKey' | translate }}
        </p>
        <div class="flex flex-wrap items-center gap-2">
          <code class="flex-1 overflow-x-auto rounded-md p-2 font-mono text-xs" style="background:var(--color-bg-dark);">{{ pub }}</code>
          <button class="button-secondary" (click)="copy(pub)">
            {{ (copied() ? 'security.copied' : 'security.copy') | translate }}
          </button>
          <button class="text-xs" style="color:var(--color-text-secondary);" (click)="publicKey.set(null)">
            {{ 'security.dismiss' | translate }}
          </button>
        </div>
        <p class="mt-2 text-xs" style="color:var(--color-text-secondary);">
          {{ 'security.installHint' | translate }}
        </p>
      </div>
    }

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div>
        @if (loading()) {
          <p class="text-sm" style="color: var(--color-text-secondary)">{{ 'security.loading' | translate }}</p>
        } @else if (keys().length === 0) {
          <div class="box">{{ 'security.noKeys' | translate }}</div>
        } @else {
          <div class="space-y-4">
            @for (key of keys(); track key.uuid) {
              <div class="box">
                <div class="flex items-center justify-between gap-4">
                  <div class="min-w-0">
                    <div class="font-semibold">{{ key.name }}</div>
                    @if (key.description) {
                      <div class="mt-1 text-sm" style="color: var(--color-text-secondary)">{{ key.description }}</div>
                    }
                  </div>
                  <div class="flex shrink-0 items-center gap-4">
                    <button class="text-xs transition-colors hover:underline" style="color:var(--color-text-secondary);" (click)="showPublic(key)">
                      <i class="fa-solid fa-eye mr-1"></i>{{ 'security.showPublicKey' | translate }}
                    </button>
                    <button class="text-xs transition-colors hover:underline" style="color:var(--color-danger);" (click)="remove(key)">
                      <i class="fa-solid fa-trash mr-1"></i>{{ 'security.delete' | translate }}
                    </button>
                  </div>
                </div>
                @if (key.fingerprint || key.is_git_related) {
                  <div class="mt-3 flex flex-wrap items-center gap-2 border-t pt-3" style="border-color: var(--color-surface-2);">
                    @if (key.fingerprint) {
                      <code class="text-xs" style="color: var(--color-text-secondary)">{{ key.fingerprint }}</code>
                    }
                    @if (key.is_git_related) {
                      <span class="rounded-full px-2 py-0.5 text-xs" style="background:var(--color-surface-2);color:var(--color-text-secondary);">
                        {{ 'security.gitRelated' | translate }}
                      </span>
                    }
                  </div>
                }
              </div>
            }
          </div>
        }
      </div>

      <div>
        <form class="box mb-4 space-y-3" [formGroup]="generateForm" (ngSubmit)="generate()">
          <h2 class="text-sm font-semibold">{{ 'security.generateTitle' | translate }}</h2>
          <p class="text-xs" style="color:var(--color-text-secondary);">{{ 'security.generateHint' | translate }}</p>
          <div>
            <label class="mb-1 block text-sm" for="gen-name">{{ 'security.name' | translate }}</label>
            <input class="input" id="gen-name" formControlName="name" />
          </div>
          <div>
            <label class="mb-1 block text-sm" for="gen-type">{{ 'security.keyType' | translate }}</label>
            <select class="input" id="gen-type" formControlName="type">
              <option value="ed25519">ed25519</option>
              <option value="rsa">RSA</option>
            </select>
          </div>
          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" formControlName="is_git_related" />
            {{ 'security.forGitAccess' | translate }}
          </label>
          <button class="button" type="submit" [disabled]="generateForm.invalid || generating()">
            {{ (generating() ? 'security.generating' : 'security.generate') | translate }}
          </button>
        </form>

        <form class="box space-y-3" [formGroup]="form" (ngSubmit)="submit()">
          <h2 class="text-sm font-semibold">{{ 'security.addKeyTitle' | translate }}</h2>
          <div>
            <label class="mb-1 block text-sm" for="key-name">{{ 'security.name' | translate }}</label>
            <input class="input" id="key-name" formControlName="name" />
          </div>
          <div>
            <label class="mb-1 block text-sm" for="key-pem">{{ 'security.privateKeyPem' | translate }}</label>
            <textarea class="input font-mono" id="key-pem" rows="6" formControlName="private_key"></textarea>
          </div>
          <button class="button" type="submit" [disabled]="form.invalid || saving()">
            {{ saving() ? ('security.saving' | translate) : ('security.addKey' | translate) }}
          </button>
        </form>
      </div>
    </div>
  `,
})
export class PrivateKeysComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  private translate = inject(TranslateService);

  protected readonly keys = signal<PrivateKey[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly generating = signal(false);
  protected readonly error = signal<string | null>(null);
  /** The public half to install — held in memory only. */
  protected readonly publicKey = signal<string | null>(null);
  protected readonly copied = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    private_key: ['', Validators.required],
  });

  protected readonly generateForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    type: ['ed25519' as SshKeyType],
    is_git_related: [false],
  });

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.api.listPrivateKeys().subscribe({
      next: (keys) => {
        this.keys.set(keys);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private report(err: unknown, fallbackKey: string): void {
    const message = (err as { error?: { error?: { message?: string } } })?.error?.error?.message;
    this.error.set(message ?? this.translate.instant(fallbackKey));
  }

  protected copy(value: string): void {
    navigator.clipboard?.writeText(value).then(
      () => this.copied.set(true),
      () => this.report(null, 'security.copyError')
    );
  }

  protected submit(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.error.set(null);
    this.api.createPrivateKey(this.form.getRawValue()).subscribe({
      next: () => {
        this.form.reset();
        this.saving.set(false);
        this.load();
      },
      error: (e) => {
        this.report(e, 'security.addKeyFailed');
        this.saving.set(false);
      },
    });
  }

  protected generate(): void {
    if (this.generateForm.invalid) return;
    this.generating.set(true);
    this.error.set(null);
    this.copied.set(false);
    this.api.generatePrivateKey(this.generateForm.getRawValue()).subscribe({
      next: (key) => {
        this.publicKey.set(key.public_key);
        this.generateForm.reset({ name: '', type: 'ed25519', is_git_related: false });
        this.generating.set(false);
        this.load();
      },
      error: (e) => {
        this.report(e, 'security.generateFailed');
        this.generating.set(false);
      },
    });
  }

  protected showPublic(key: PrivateKey): void {
    this.error.set(null);
    this.copied.set(false);
    this.api.getPublicKey(key.uuid).subscribe({
      next: (pub) => this.publicKey.set(pub),
      error: (e) => this.report(e, 'security.publicKeyFailed'),
    });
  }

  /** Refused by the API while a server still uses the key, and that is shown. */
  protected remove(key: PrivateKey): void {
    this.error.set(null);
    this.api.deletePrivateKey(key.uuid).subscribe({
      next: () => this.keys.update((list) => list.filter((k) => k.uuid !== key.uuid)),
      error: (e) => this.report(e, 'security.deleteKeyFailed'),
    });
  }
}
