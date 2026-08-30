import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../../shared/services/api.service';
import {
  CloudInitScript,
  CloudToken,
  HetznerLocation,
  HetznerServerType,
} from '../../../shared/models/ideploy.models';

/** Images the API accepts; Hetzner's catalogue is far larger but these are the supported ones. */
const IMAGES = ['ubuntu-24.04', 'ubuntu-22.04', 'debian-12'] as const;

/**
 * Provision a server from a cloud provider.
 *
 * Hetzner today, because that is the only provider the API can actually create
 * a machine on. The credential never reaches the browser: the form sends the
 * token's id and the API decrypts it server-side to make the call.
 *
 * The catalogue (locations, machine types) is fetched with that same id, so
 * nothing is offered until a token is chosen — the alternative is a form full
 * of empty pickers that fail on submit.
 */
@Component({
  selector: 'app-server-provision',
  imports: [RouterLink, ReactiveFormsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a
      routerLink="/servers"
      class="mb-4 inline-flex items-center gap-2 text-sm"
      style="color:var(--color-text-secondary);"
    >
      <i class="fa-solid fa-chevron-left text-[10px]"></i>
      {{ 'provision.backToServers' | translate }}
    </a>

    <div class="mb-6">
      <h1 class="heading-serif" style="font-size:32px;font-weight:700;color:var(--color-text-primary);">
        {{ 'provision.title' | translate }}
      </h1>
      <p class="mt-1 text-sm" style="color:var(--color-text-secondary);">{{ 'provision.subtitle' | translate }}</p>
    </div>

    @if (error()) {
      <p class="mb-4 text-sm" role="alert" style="color:var(--color-danger);">{{ error() }}</p>
    }
    @if (created()) {
      <div class="mb-4 rounded-lg p-3 text-sm" role="status" style="background:color-mix(in srgb, var(--color-success) 12%, transparent);color:var(--color-success);">
        <strong>{{ 'provision.createdTitle' | translate }}</strong> — {{ 'provision.createdBody' | translate }}
      </div>
    }

    @if (tokens().length === 0) {
      <div class="box">
        <p>{{ 'provision.noToken' | translate }}</p>
        <a class="button mt-3 inline-flex" routerLink="/security/tokens">{{ 'provision.addToken' | translate }}</a>
      </div>
    } @else {
      <form class="grid gap-4 lg:grid-cols-2" [formGroup]="form" (ngSubmit)="submit()">
        <section class="box">
          <h2 class="mb-3 text-sm font-semibold">{{ 'provision.provider' | translate }}</h2>
          <div class="mb-3">
            <label class="mb-1 block text-sm" for="p-token">{{ 'provision.token' | translate }}</label>
            <select class="input" id="p-token" formControlName="token_id">
              <option [value]="0">{{ 'provision.chooseToken' | translate }}</option>
              @for (t of tokens(); track t.id) {
                <option [value]="t.id">{{ t.name || t.provider }} ({{ t.provider }})</option>
              }
            </select>
          </div>

          @if (loadingCatalogue()) {
            <p class="text-sm" style="color:var(--color-text-secondary);">{{ 'provision.loadingCatalogue' | translate }}</p>
          }

          <div class="mb-3">
            <label class="mb-1 block text-sm" for="p-location">{{ 'provision.location' | translate }}</label>
            <select class="input" id="p-location" formControlName="location" [disabled]="locations().length === 0">
              @for (l of locations(); track l.id) {
                <option [value]="l.name">{{ l.city }}, {{ l.country }} ({{ l.name }})</option>
              }
            </select>
          </div>

          <div>
            <label class="mb-1 block text-sm" for="p-image">{{ 'provision.image' | translate }}</label>
            <select class="input" id="p-image" formControlName="image">
              @for (img of images; track img) {
                <option [value]="img">{{ img }}</option>
              }
            </select>
          </div>
        </section>

        <section class="box">
          <h2 class="mb-3 text-sm font-semibold">{{ 'provision.machine' | translate }}</h2>
          <div class="mb-3">
            <label class="mb-1 block text-sm" for="p-name">{{ 'provision.name' | translate }}</label>
            <input class="input" id="p-name" formControlName="name" [placeholder]="'provision.namePlaceholder' | translate" />
          </div>

          <div class="mb-3">
            <label class="mb-1 block text-sm" for="p-type">{{ 'provision.serverType' | translate }}</label>
            <select class="input" id="p-type" formControlName="server_type" [disabled]="serverTypes().length === 0">
              @for (t of serverTypes(); track t.id) {
                <option [value]="t.name">
                  {{ t.name }} — {{ t.cores }} vCPU · {{ t.memory }} GB · {{ t.disk }} GB
                </option>
              }
            </select>
            @if (selectedType(); as t) {
              <p class="mt-1 text-xs" style="color:var(--color-text-secondary);">{{ t.description }}</p>
            }
          </div>

          <div>
            <label class="mb-1 block text-sm" for="p-init">{{ 'provision.initScript' | translate }}</label>
            <select class="input" id="p-init" formControlName="init_script_id">
              <option [value]="0">{{ 'provision.noInitScript' | translate }}</option>
              @for (s of initScripts(); track s.id) {
                <option [value]="s.id">{{ s.name }}</option>
              }
            </select>
            <p class="mt-1 text-xs" style="color:var(--color-text-secondary);">{{ 'provision.initScriptHint' | translate }}</p>
          </div>
        </section>

        <div class="lg:col-span-2">
          <button class="button" type="submit" [disabled]="form.invalid || submitting()">
            {{ (submitting() ? 'provision.creating' : 'provision.create') | translate }}
          </button>
          <p class="mt-2 text-xs" style="color:var(--color-text-secondary);">{{ 'provision.afterHint' | translate }}</p>
        </div>
      </form>
    }
  `,
})
export class ServerProvisionComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  private translate = inject(TranslateService);

  protected readonly images = IMAGES;

  protected readonly tokens = signal<CloudToken[]>([]);
  protected readonly locations = signal<HetznerLocation[]>([]);
  protected readonly serverTypes = signal<HetznerServerType[]>([]);
  protected readonly initScripts = signal<CloudInitScript[]>([]);

  protected readonly error = signal<string | null>(null);
  protected readonly created = signal(false);
  protected readonly submitting = signal(false);
  protected readonly loadingCatalogue = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    token_id: [0, [Validators.required, Validators.min(1)]],
    name: ['', Validators.required],
    server_type: ['', Validators.required],
    image: ['ubuntu-24.04', Validators.required],
    location: [''],
    init_script_id: [0],
  });

  protected readonly selectedType = computed(() =>
    this.serverTypes().find((t) => t.name === this.form.controls.server_type.value) ?? null
  );

  ngOnInit(): void {
    // Only Hetzner can be provisioned today, so only those tokens are offered.
    this.api.listCloudTokens().subscribe({
      next: (t) => this.tokens.set(t.filter((x) => x.provider === 'hetzner')),
      error: (e) => this.report(e, 'provision.tokensError'),
    });
    this.api.listInitScripts().subscribe({
      next: (s) => this.initScripts.set(s),
      error: () => this.initScripts.set([]),
    });

    // The catalogue depends on the credential, so it is fetched when one is picked.
    this.form.controls.token_id.valueChanges.subscribe((id) => this.loadCatalogue(Number(id)));
  }

  private report(err: unknown, fallbackKey: string): void {
    const message = (err as { error?: { error?: { message?: string } } })?.error?.error?.message;
    this.error.set(message ?? this.translate.instant(fallbackKey));
  }

  private loadCatalogue(tokenId: number): void {
    this.locations.set([]);
    this.serverTypes.set([]);
    if (!tokenId) return;

    this.loadingCatalogue.set(true);
    this.error.set(null);
    let pending = 2;
    const done = (): void => {
      if (--pending === 0) this.loadingCatalogue.set(false);
    };

    this.api.hetznerLocations(tokenId).subscribe({
      next: (l) => {
        this.locations.set(l);
        if (l[0]) this.form.controls.location.setValue(l[0].name);
        done();
      },
      error: (e) => {
        this.report(e, 'provision.catalogueError');
        done();
      },
    });
    this.api.hetznerServerTypes(tokenId).subscribe({
      next: (t) => {
        this.serverTypes.set(t);
        done();
      },
      error: (e) => {
        this.report(e, 'provision.catalogueError');
        done();
      },
    });
  }

  protected submit(): void {
    if (this.form.invalid) return;
    this.submitting.set(true);
    this.error.set(null);
    this.created.set(false);

    const raw = this.form.getRawValue();
    this.api
      .hetznerCreateServer({
        token_id: Number(raw.token_id),
        name: raw.name,
        server_type: raw.server_type,
        image: raw.image,
        location: raw.location || undefined,
      })
      .subscribe({
        next: () => {
          this.created.set(true);
          this.submitting.set(false);
          this.form.reset({
            token_id: Number(raw.token_id),
            name: '',
            server_type: '',
            image: 'ubuntu-24.04',
            location: raw.location,
            init_script_id: 0,
          });
        },
        error: (e) => {
          this.report(e, 'provision.createError');
          this.submitting.set(false);
        },
      });
  }
}
