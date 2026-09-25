import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../../shared/services/api.service';
import { PrivateKey, SshKeyType } from '../../../shared/models/ideploy.models';

/**
 * Three-step server registration — Identity → SSH → Options.
 *
 * The private key is picked from the team's existing keys, never typed as a raw
 * id: an inline generator covers the common case of not having one yet, so the
 * flow never dead-ends into "go create a key somewhere else and come back".
 */
@Component({
  selector: 'app-server-create',
  imports: [RouterLink, ReactiveFormsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-2xl">
      <a routerLink="/servers" class="mb-4 inline-flex items-center gap-2 text-sm" style="color:var(--color-text-secondary);">
        <i class="pi pi-chevron-left text-[10px]"></i>
        {{ 'servers.create.back' | translate }}
      </a>

      <h1 class="heading-serif mb-1" style="font-size:28px;font-weight:700;color:var(--color-text-primary);">
        {{ 'servers.create.title' | translate }}
      </h1>
      <p class="mb-6 text-sm" style="color:var(--color-text-secondary);">
        {{ 'servers.create.subtitle' | translate }}
      </p>

      <ol class="mb-6 flex items-center gap-2 text-xs" style="color:var(--color-text-secondary);">
        <li class="flex items-center gap-1.5" [style.color]="step() === 1 ? 'var(--color-primary-400)' : undefined">
          <span class="flex h-5 w-5 items-center justify-center rounded-full border text-[10px]" [style.border-color]="step() >= 1 ? 'var(--color-primary-400)' : 'currentColor'">
            @if (step() > 1) {<i class="pi pi-check"></i>} @else {1}
          </span>
          {{ 'servers.create.stepIdentity' | translate }}
        </li>
        <li class="h-px w-6" style="background:var(--color-surface-2);"></li>
        <li class="flex items-center gap-1.5" [style.color]="step() === 2 ? 'var(--color-primary-400)' : undefined">
          <span class="flex h-5 w-5 items-center justify-center rounded-full border text-[10px]" [style.border-color]="step() >= 2 ? 'var(--color-primary-400)' : 'currentColor'">
            @if (step() > 2) {<i class="pi pi-check"></i>} @else {2}
          </span>
          {{ 'servers.create.stepSsh' | translate }}
        </li>
        <li class="h-px w-6" style="background:var(--color-surface-2);"></li>
        <li class="flex items-center gap-1.5" [style.color]="step() === 3 ? 'var(--color-primary-400)' : undefined">
          <span class="flex h-5 w-5 items-center justify-center rounded-full border text-[10px]" [style.border-color]="step() >= 3 ? 'var(--color-primary-400)' : 'currentColor'">3</span>
          {{ 'servers.create.stepOptions' | translate }}
        </li>
      </ol>

      <form class="glass-card p-4 space-y-4" [formGroup]="form" (ngSubmit)="submit()">
        @if (step() === 1) {
          <div>
            <label class="mb-1 block text-sm" for="srv-name">{{ 'servers.create.name' | translate }}</label>
            <input type="text" id="srv-name"  formControlName="name" [placeholder]="'servers.create.namePlaceholder' | translate" autocomplete="off" />
          </div>
          <div>
            <label class="mb-1 block text-sm" for="srv-description">{{ 'servers.create.description' | translate }}</label>
            <textarea id="srv-description"  rows="3" formControlName="description" [placeholder]="'servers.create.descriptionPlaceholder' | translate"></textarea>
          </div>
          <button class="inner-button" type="button" [disabled]="form.controls.name.invalid" (click)="step.set(2)">
            {{ 'servers.create.next' | translate }}
          </button>
        }

        @if (step() === 2) {
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div class="sm:col-span-2">
              <label class="mb-1 block text-sm" for="srv-host">{{ 'servers.create.host' | translate }}</label>
              <input type="text" id="srv-host" class="font-mono" formControlName="ip" [placeholder]="'servers.create.hostPlaceholder' | translate" autocomplete="off" />
            </div>
            <div>
              <label class="mb-1 block text-sm" for="srv-port">{{ 'servers.create.port' | translate }}</label>
              <input id="srv-port"  type="number" formControlName="port" />
            </div>
          </div>
          <div>
            <label class="mb-1 block text-sm" for="srv-user">{{ 'servers.create.user' | translate }}</label>
            <input type="text" id="srv-user" class="font-mono" formControlName="user" />
          </div>

          <div>
            <label class="mb-1 block text-sm" for="srv-key">{{ 'servers.create.privateKey' | translate }}</label>

            @if (keysLoading()) {
              <p class="text-sm" style="color:var(--color-text-secondary);">{{ 'servers.create.loading' | translate }}</p>
            } @else if (keys().length === 0 && !showKeyGenerator()) {
              <div class="rounded-lg p-3 text-sm" style="background:color-mix(in srgb, var(--color-warning) 12%, transparent);border:1px solid color-mix(in srgb, var(--color-warning) 35%, transparent);">
                <p class="mb-2 font-semibold" style="color:var(--color-warning);">
                  <i class="pi pi-key mr-1"></i>{{ 'servers.create.noKeysWarningTitle' | translate }}
                </p>
                <p class="mb-3" style="color:var(--color-text-secondary);">{{ 'servers.create.noKeysWarningDesc' | translate }}</p>
                <button class="inner-button" type="button" (click)="showKeyGenerator.set(true)">
                  {{ 'servers.create.createKeyButton' | translate }}
                </button>
              </div>
            } @else {
              @if (keys().length > 0) {
                <select id="srv-key"  formControlName="private_key_id">
                  <option [ngValue]="0" disabled>{{ 'servers.create.choosePrivateKey' | translate }}</option>
                  @for (key of keys(); track key.id) {
                    <option [ngValue]="key.id">{{ key.name }}</option>
                  }
                </select>
                @if (!showKeyGenerator()) {
                  <button class="mt-2 text-xs" type="button" style="color:var(--color-primary-400);" (click)="showKeyGenerator.set(true)">
                    {{ 'servers.create.addAnotherKey' | translate }}
                  </button>
                }
              }
            }

            @if (showKeyGenerator()) {
              <div class="mt-3 space-y-3 rounded-lg p-3" style="border:1px solid var(--color-surface-2);">
                @if (generatedPublicKey(); as pub) {
                  <div class="rounded-lg p-3 text-sm" style="background:color-mix(in srgb, var(--color-success) 12%, transparent);border:1px solid color-mix(in srgb, var(--color-success) 40%, transparent);">
                    <p class="mb-2 font-semibold" style="color:var(--color-success);">{{ 'servers.create.publicKeyReady' | translate }}</p>
                    <div class="flex flex-wrap items-center gap-2">
                      <code class="flex-1 overflow-x-auto rounded-md p-2 font-mono text-xs" style="background:var(--color-bg-dark);">{{ pub }}</code>
                      <button class="outer-button" type="button" (click)="copyPublicKey(pub)">
                        {{ (copied() ? 'servers.create.copied' : 'servers.create.copy') | translate }}
                      </button>
                    </div>
                    <p class="mt-2 text-xs" style="color:var(--color-text-secondary);">{{ 'servers.create.publicKeyHint' | translate }}</p>
                  </div>
                } @else {
                  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label class="mb-1 block text-sm" for="gen-key-name">{{ 'servers.create.keyName' | translate }}</label>
                      <input type="text" id="gen-key-name"  [formControl]="generateForm.controls.name" autocomplete="off" />
                    </div>
                    <div>
                      <label class="mb-1 block text-sm" for="gen-key-type">{{ 'servers.create.keyType' | translate }}</label>
                      <select id="gen-key-type"  [formControl]="generateForm.controls.type">
                        <option value="ed25519">ed25519</option>
                        <option value="rsa">RSA</option>
                      </select>
                    </div>
                  </div>
                  @if (keyGenerateError()) {
                    <p class="text-sm" style="color:var(--color-danger);">{{ keyGenerateError() }}</p>
                  }
                  <div class="flex gap-2">
                    <button class="inner-button" type="button" [disabled]="generateForm.invalid || generatingKey()" (click)="generateKey()">
                      {{ (generatingKey() ? 'servers.create.generating' : 'servers.create.generateKey') | translate }}
                    </button>
                    @if (keys().length > 0) {
                      <button class="outer-button" type="button" (click)="showKeyGenerator.set(false)">{{ 'servers.create.back' | translate }}</button>
                    }
                  </div>
                }
              </div>
            }
          </div>

          <div class="flex gap-2">
            <button class="outer-button" type="button" (click)="step.set(1)">{{ 'servers.create.back' | translate }}</button>
            <button class="inner-button" type="button" [disabled]="!canGoToOptions()" (click)="step.set(3)">{{ 'servers.create.next' | translate }}</button>
          </div>
        }

        @if (step() === 3) {
          <div class="rounded-lg p-3" style="border:1px solid var(--color-surface-2);">
            <label class="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" formControlName="is_build_server" (change)="onBuildServerToggle()" />
              {{ 'servers.create.buildServer' | translate }}
            </label>
            <p class="mt-1 text-xs" style="color:var(--color-text-secondary);">{{ 'servers.create.buildServerHint' | translate }}</p>
          </div>

          <div class="rounded-lg p-3" style="border:1px solid var(--color-surface-2);" [class.opacity-50]="form.controls.is_build_server.value">
            <div class="mb-2 flex items-center gap-2">
              <span class="text-sm font-semibold">{{ 'servers.create.swarmTitle' | translate }}</span>
              <span class="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase" style="background:var(--color-surface-2);color:var(--color-text-secondary);">
                {{ 'servers.create.swarmBadge' | translate }}
              </span>
            </div>
            <p class="mb-3 text-xs" style="color:var(--color-text-secondary);">{{ 'servers.create.swarmHint' | translate }}</p>
            <div class="space-y-2">
              <label class="flex items-center gap-2 text-sm">
                <input type="checkbox" formControlName="is_swarm_manager" [disabled]="form.controls.is_build_server.value" (change)="onSwarmToggle('is_swarm_manager')" />
                {{ 'servers.create.swarmManager' | translate }}
              </label>
              <label class="flex items-center gap-2 text-sm">
                <input type="checkbox" formControlName="is_swarm_worker" [disabled]="form.controls.is_build_server.value" (change)="onSwarmToggle('is_swarm_worker')" />
                {{ 'servers.create.swarmWorker' | translate }}
              </label>
            </div>
          </div>

          @if (error()) {
            <p class="text-sm" style="color:var(--color-danger);">{{ error() }}</p>
          }

          <div class="flex gap-2">
            <button class="outer-button" type="button" (click)="step.set(2)">{{ 'servers.create.back' | translate }}</button>
            <button class="inner-button" type="submit" [disabled]="submitting() || !canSubmit()">
              {{ (submitting() ? 'servers.create.submitting' : 'servers.create.submit') | translate }}
            </button>
          </div>
        }
      </form>
    </div>
  `,
})
export class ServerCreateComponent implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private router = inject(Router);
  private translate = inject(TranslateService);

  protected readonly step = signal<1 | 2 | 3>(1);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly keys = signal<PrivateKey[]>([]);
  protected readonly keysLoading = signal(true);
  protected readonly showKeyGenerator = signal(false);
  protected readonly generatingKey = signal(false);
  protected readonly keyGenerateError = signal<string | null>(null);
  protected readonly generatedPublicKey = signal<string | null>(null);
  protected readonly copied = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    description: [''],
    ip: ['', Validators.required],
    port: [22, [Validators.required, Validators.min(1), Validators.max(65535)]],
    user: ['root', Validators.required],
    private_key_id: [0, Validators.required],
    is_build_server: [false],
    is_swarm_manager: [false],
    is_swarm_worker: [false],
  });

  protected readonly generateForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    type: ['ed25519' as SshKeyType],
  });

  ngOnInit(): void {
    this.loadKeys();
  }

  private loadKeys(): void {
    this.keysLoading.set(true);
    this.api.listPrivateKeys().subscribe({
      next: (keys) => {
        this.keys.set(keys);
        this.keysLoading.set(false);
        if (keys.length === 0) this.showKeyGenerator.set(true);
      },
      error: () => this.keysLoading.set(false),
    });
  }

  protected canGoToOptions(): boolean {
    return (
      this.form.controls.ip.valid &&
      this.form.controls.port.valid &&
      this.form.controls.user.valid &&
      this.form.controls.private_key_id.value > 0
    );
  }

  protected canSubmit(): boolean {
    return this.form.controls.name.valid && this.canGoToOptions();
  }

  /** A build server carries no Swarm role — mirrors the server-side reconciliation. */
  protected onBuildServerToggle(): void {
    if (this.form.controls.is_build_server.value) {
      this.form.patchValue({ is_swarm_manager: false, is_swarm_worker: false });
    }
  }

  /** Manager and worker are mutually exclusive. */
  protected onSwarmToggle(toggled: 'is_swarm_manager' | 'is_swarm_worker'): void {
    if (!this.form.controls[toggled].value) return;
    const other = toggled === 'is_swarm_manager' ? 'is_swarm_worker' : 'is_swarm_manager';
    this.form.controls[other].setValue(false);
  }

  protected generateKey(): void {
    if (this.generateForm.invalid) return;
    this.generatingKey.set(true);
    this.keyGenerateError.set(null);
    this.api.generatePrivateKey(this.generateForm.getRawValue()).subscribe({
      next: (key) => {
        this.generatingKey.set(false);
        this.generatedPublicKey.set(key.public_key);
        this.keys.update((list) => [...list, key]);
        this.form.patchValue({ private_key_id: key.id });
      },
      error: (e) => {
        this.generatingKey.set(false);
        this.keyGenerateError.set(
          e?.error?.error?.message ?? this.translate.instant('servers.create.keyGenerateError')
        );
      },
    });
  }

  protected copyPublicKey(value: string): void {
    navigator.clipboard?.writeText(value).then(() => this.copied.set(true));
  }

  protected submit(): void {
    if (!this.canSubmit()) return;
    this.submitting.set(true);
    this.error.set(null);
    const raw = this.form.getRawValue();
    this.api
      .createServer({
        name: raw.name,
        description: raw.description || undefined,
        ip: raw.ip,
        port: raw.port,
        user: raw.user,
        private_key_id: raw.private_key_id,
        is_build_server: raw.is_build_server,
        is_swarm_manager: raw.is_swarm_manager,
        is_swarm_worker: raw.is_swarm_worker,
      })
      .subscribe({
        next: () => this.router.navigate(['/servers']),
        error: (e) => {
          this.error.set(e?.error?.error?.message ?? this.translate.instant('servers.create.submitError'));
          this.submitting.set(false);
        },
      });
  }
}
