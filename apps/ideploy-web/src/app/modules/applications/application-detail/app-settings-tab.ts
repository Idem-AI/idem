import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { ApiService } from '../../../shared/services/api.service';
import { Application, DomainCheck, RegistryCredential, Tag } from '../../../shared/models/ideploy.models';

/** The Eloquent morph class this Node API expects for an application. */
const APPLICATION_TAGGABLE_TYPE = 'App\\Models\\Application';

/** Build packs the API knows, with the words a non-specialist would use. */
const BUILD_PACKS = ['nixpacks', 'dockerfile', 'dockercompose', 'static', 'dockerimage'] as const;

/**
 * Settings of one application, most-used first: where the code comes from
 * and its address; then its tags; then the diagnostic tools; and, last and
 * set apart, deletion — which asks for the name to be typed.
 */
@Component({
  selector: 'app-settings-tab',
  imports: [ReactiveFormsModule, TranslateModule, IdemLoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <!-- General -->
      <section class="glass-card overflow-hidden">
        <header class="px-5 py-4" style="border-bottom:1px solid var(--glass-border-subtle);">
          <h2 class="font-semibold text-text-primary">{{ 'applications.detail.general' | translate }}</h2>
          <p class="mt-1 text-sm leading-relaxed" style="color:var(--color-text-secondary);">{{ 'applications.detail.generalHint' | translate }}</p>
        </header>
        <form class="space-y-4 p-5" [formGroup]="configForm" (ngSubmit)="save()">
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="sm:col-span-2">
              <label class="mb-1 block text-sm" for="cfg-repo">{{ 'applications.detail.gitRepository' | translate }}</label>
              <input type="text" id="cfg-repo" class="font-mono text-sm" placeholder="https://github.com/org/repo" formControlName="git_repository" />
            </div>
            <div>
              <label class="mb-1 block text-sm" for="cfg-branch">{{ 'applications.branch' | translate }}</label>
              <input type="text" id="cfg-branch" class="font-mono text-sm" placeholder="main" formControlName="git_branch" />
            </div>
            <div>
              <label class="mb-1 block text-sm" for="cfg-pack">{{ 'applications.detail.buildPack' | translate }}</label>
              <select id="cfg-pack" formControlName="build_pack">
                @for (pack of buildPacks(); track pack) {
                  <option [value]="pack">{{ 'applications.detail.pack.' + pack | translate }}</option>
                }
              </select>
            </div>
            <div class="sm:col-span-2">
              <label class="mb-1 block text-sm" for="cfg-base-dir">{{ 'projects.import.rootDirectory' | translate }}</label>
              <input type="text" id="cfg-base-dir" class="font-mono text-sm" placeholder="./" formControlName="base_directory" />
              <p class="mt-1 text-xs" style="color:var(--color-text-secondary);">{{ 'applications.detail.baseDirectoryHint' | translate }}</p>
            </div>
            @if (configForm.controls.build_pack.value === 'dockerimage') {
              <div>
                <label class="mb-1 block text-sm" for="cfg-image">{{ 'applications.detail.imageName' | translate }}</label>
                <input type="text" id="cfg-image" class="font-mono text-sm" placeholder="registry.example.com/organisation/app" formControlName="docker_registry_image_name" />
              </div>
              <div>
                <label class="mb-1 block text-sm" for="cfg-image-tag">{{ 'applications.detail.imageTag' | translate }}</label>
                <input type="text" id="cfg-image-tag" class="font-mono text-sm" placeholder="latest" formControlName="docker_registry_image_tag" />
                <p class="mt-1 text-xs" style="color:var(--color-text-secondary);">{{ 'applications.detail.imageTagHint' | translate }}</p>
              </div>
            }
            @if (configForm.controls.build_pack.value === 'dockerfile') {
              <div>
                <label class="mb-1 block text-sm" for="cfg-dockerfile">{{ 'applications.detail.dockerfileLocation' | translate }}</label>
                <input type="text" id="cfg-dockerfile" class="font-mono text-sm" placeholder="Dockerfile" formControlName="dockerfile_location" />
                <p class="mt-1 text-xs" style="color:var(--color-text-secondary);">{{ 'applications.detail.dockerfileLocationHint' | translate }}</p>
              </div>
              <div>
                <label class="mb-1 block text-sm" for="cfg-target">{{ 'applications.detail.buildTarget' | translate }}</label>
                <input type="text" id="cfg-target" class="font-mono text-sm" placeholder="runtime" formControlName="dockerfile_target_build" />
                <p class="mt-1 text-xs" style="color:var(--color-text-secondary);">{{ 'applications.detail.buildTargetHint' | translate }}</p>
              </div>
            }
            <div class="sm:col-span-2">
              <label class="mb-1 block text-sm" for="cfg-watch">{{ 'applications.detail.watchPaths' | translate }}</label>
              <textarea id="cfg-watch" rows="3" class="font-mono text-sm w-full" placeholder="apps/api/**&#10;packages/**" formControlName="watch_paths"></textarea>
              <p class="mt-1 text-xs" style="color:var(--color-text-secondary);">{{ 'applications.detail.watchPathsHint' | translate }}</p>
            </div>
            <div class="sm:col-span-2">
              <label class="mb-1 block text-sm" for="cfg-port">{{ 'projects.import.portLabel' | translate }}</label>
              <input type="text" id="cfg-port" class="font-mono text-sm" inputmode="numeric" [placeholder]="'projects.import.portPlaceholder' | translate" formControlName="ports_exposes" />
              <p class="mt-1 text-xs" style="color:var(--color-text-secondary);">{{ 'projects.import.portHint' | translate }}</p>
            </div>
            <div class="sm:col-span-2">
              <label class="mb-1 block text-sm" for="cfg-fqdn">{{ 'applications.detail.fqdn' | translate }}</label>
              <input type="text" id="cfg-fqdn" class="font-mono text-sm" placeholder="https://app.mondomaine.com" formControlName="fqdn" />
              <p class="mt-1 text-xs" style="color:var(--color-text-secondary);">{{ 'applications.detail.fqdnHint' | translate }}</p>
              <!-- Where each new domain points, right after saving it. -->
              @for (check of domainCheck(); track check.host) {
                <p class="mt-1 text-xs" role="status" [style.color]="check.pointsHere ? 'var(--color-success)' : 'var(--color-warning)'">
                  @if (check.pointsHere) {
                    <i class="pi pi-check mr-1 text-xs" aria-hidden="true"></i>{{ 'applications.detail.dnsOk' | translate: { host: check.host } }}
                  } @else if (check.addresses.length) {
                    <i class="pi pi-exclamation-triangle mr-1 text-xs" aria-hidden="true"></i>{{ 'applications.detail.dnsElsewhere' | translate: { host: check.host, addresses: check.addresses.join(', ') } }}
                  } @else {
                    <i class="pi pi-exclamation-triangle mr-1 text-xs" aria-hidden="true"></i>{{ 'applications.detail.dnsMissing' | translate: { host: check.host } }}
                  }
                </p>
              }
            </div>
          </div>
          @if (saveError(); as message) {
            <p class="text-sm" role="alert" style="color:var(--color-danger);">{{ message }}</p>
          }
          @if (redeployRequired()) {
            <div class="flex flex-wrap items-center gap-3 rounded-lg p-3 text-sm" role="status" style="border:1px solid var(--color-surface-2);">
              <span>{{ 'applications.detail.domainRedeploy' | translate }}</span>
              <button class="outer-button ml-auto" type="button" (click)="redeploy()" [disabled]="redeploying()">
                {{ (redeploying() ? 'applications.detail.redeploying' : 'applications.detail.redeployNow') | translate }}
              </button>
            </div>
          }
          <div class="flex items-center justify-end gap-3">
            @if (saved()) {
              <span class="text-sm" style="color:var(--color-success);"><i class="pi pi-check mr-1 text-xs"></i>{{ 'applications.detail.saved' | translate }}</span>
            }
            <button class="inner-button" type="submit" [disabled]="saving() || configForm.pristine">
              @if (saving()) { <idem-loader size="xs" /> }
              {{ 'applications.detail.save' | translate }}
            </button>
          </div>
        </form>
      </section>

      <!-- Continuous deployment: a CI pipeline deploys this application with its own token. -->
      <section class="glass-card p-5">
        <h2 class="font-semibold text-text-primary">{{ 'applications.detail.ciTitle' | translate }}</h2>
        <p class="mb-4 mt-1 text-sm" style="color:var(--color-text-secondary);">{{ 'applications.detail.ciHint' | translate }}</p>
        @if (ci(); as c) {
          <p class="mb-1 text-xs" style="color:var(--color-text-secondary);">{{ 'applications.detail.ciUrl' | translate }}</p>
          <code class="mb-3 block overflow-x-auto rounded-lg p-2 text-xs font-mono" style="background:var(--color-surface-2);">POST {{ c.url }}</code>
          <p class="mb-1 text-xs" style="color:var(--color-text-secondary);">{{ 'applications.detail.ciToken' | translate }}</p>
          <code class="mb-3 block overflow-x-auto rounded-lg p-2 text-xs font-mono" style="background:var(--color-surface-2);">{{ c.secret }}</code>
          <p class="mb-1 text-xs" style="color:var(--color-text-secondary);">{{ 'applications.detail.ciExample' | translate }}</p>
          <pre class="mb-3 overflow-x-auto rounded-lg p-2 text-xs font-mono" style="background:var(--color-surface-2);">curl -X POST {{ c.url }} \
  -H 'X-Ideploy-Token: $IDEPLOY_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{{ '{' }}"image_tag": "'$GITHUB_SHA'"{{ '}' }}'</pre>
          <button type="button" class="outer-button text-xs px-3 py-1.5" (click)="rotateCi()">{{ 'applications.detail.ciRotate' | translate }}</button>
        } @else {
          <button type="button" class="inner-button" (click)="loadCi()">{{ 'applications.detail.ciShow' | translate }}</button>
        }
      </section>

      <!-- Logins to private registries, for image applications -->
      @if (configForm.controls.build_pack.value === 'dockerimage') {
        <section class="glass-card p-5">
          <h2 class="font-semibold text-text-primary">{{ 'applications.detail.registryTitle' | translate }}</h2>
          <p class="mb-4 mt-1 text-sm" style="color:var(--color-text-secondary);">{{ 'applications.detail.registryHint' | translate }}</p>
          <ul class="mb-3 space-y-1 text-sm">
            @for (r of registries(); track r.id) {
              <li class="flex items-center gap-3">
                <code class="font-mono">{{ r.registry }}</code><span style="color:var(--color-text-secondary);">{{ r.username }}</span>
                <button type="button" class="ml-auto text-xs" style="color:var(--color-danger);" (click)="removeRegistry(r.id)">{{ 'applications.detail.remove' | translate }}</button>
              </li>
            } @empty {
              <li style="color:var(--color-text-secondary);">{{ 'applications.detail.noRegistry' | translate }}</li>
            }
          </ul>
          <form class="grid gap-2 sm:grid-cols-4" [formGroup]="registryForm" (ngSubmit)="addRegistry()">
            <input type="text" class="font-mono text-sm" formControlName="registry" placeholder="registry.example.com" />
            <input type="text" class="font-mono text-sm" formControlName="username" [placeholder]="'projects.start.registryUser' | translate" autocomplete="off" />
            <input type="password" class="font-mono text-sm" formControlName="password" [placeholder]="'projects.start.registryToken' | translate" autocomplete="new-password" />
            <button class="inner-button" type="submit" [disabled]="registryForm.invalid">{{ 'applications.detail.save' | translate }}</button>
          </form>
        </section>
      }

      <!-- Tags -->
      <section class="glass-card p-5">
        <h2 class="font-semibold text-text-primary">{{ 'applications.detail.tags' | translate }}</h2>
        <p class="mb-4 mt-1 text-sm" style="color:var(--color-text-secondary);">{{ 'applications.detail.tagsHint' | translate }}</p>
        <div class="flex flex-wrap items-center gap-2">
          @for (tag of appTags(); track tag.uuid) {
            <span class="inline-flex items-center gap-2 rounded-full border py-1 pl-3 pr-1 text-sm" style="border-color:var(--glass-border);background:var(--glass-bg-subtle);">
              <i class="pi pi-tag text-[10px]" style="color:var(--color-primary-500);"></i>{{ tag.name }}
              <button type="button" class="flex h-6 w-6 items-center justify-center rounded-full transition-smooth hover:bg-[var(--glass-bg-light)]" style="color:var(--color-text-tertiary);"
                [attr.aria-label]="'tags.remove' | translate: { name: tag.name }" (click)="detachTag(tag)">
                <i class="pi pi-times text-[10px]"></i>
              </button>
            </span>
          }
          @if (availableTags().length > 0) {
            <select class="!w-48" [attr.aria-label]="'applications.detail.attachTag' | translate" (change)="attachTag($any($event.target).value); $any($event.target).value = ''">
              <option value="">{{ 'applications.detail.attachTag' | translate }}</option>
              @for (tag of availableTags(); track tag.uuid) {
                <option [value]="tag.uuid">{{ tag.name }}</option>
              }
            </select>
          } @else if (appTags().length === 0) {
            <span class="text-sm" style="color:var(--color-text-tertiary);">{{ 'applications.detail.noTagsYet' | translate }}</span>
          }
        </div>
      </section>

      <!-- Diagnostics: for when something is off and the terminal is too much. -->
      <section class="glass-card p-5">
        <h2 class="font-semibold text-text-primary">{{ 'applications.detail.operations' | translate }}</h2>
        <p class="mb-4 mt-1 text-sm" style="color:var(--color-text-secondary);">{{ 'applications.detail.operationsHint' | translate }}</p>
        <div class="mb-3 flex flex-wrap gap-2">
          <button type="button" class="outer-button button-sm" (click)="refreshStatus()"><i class="pi pi-heart mr-1.5 text-xs"></i>{{ 'applications.detail.status' | translate }}</button>
          <button type="button" class="outer-button button-sm" (click)="refreshMetrics()"><i class="pi pi-chart-line mr-1.5 text-xs"></i>{{ 'applications.detail.metrics' | translate }}</button>
        </div>
        <form class="flex gap-2" [formGroup]="execForm" (ngSubmit)="runExec()">
          <input type="text" class="min-w-0 flex-1 !w-auto font-mono text-sm" [attr.aria-label]="'applications.detail.execPlaceholder' | translate" [placeholder]="'applications.detail.execPlaceholder' | translate" formControlName="command" />
          <button class="outer-button" type="submit" [disabled]="execForm.invalid || busy()">{{ 'applications.detail.exec' | translate }}</button>
        </form>
        @if (busy()) {
          <div class="mt-3"><idem-loader size="sm" /></div>
        } @else if (output()) {
          <pre class="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg p-3 font-mono text-xs" style="background:var(--glass-bg-subtle);color:var(--color-text-secondary);">{{ output() }}</pre>
        }
      </section>

      <!-- Danger zone -->
      <section id="danger-zone" class="glass-card p-5" style="border-color:color-mix(in srgb, var(--color-danger) 35%, transparent);">
        <h2 class="font-semibold" style="color:var(--color-danger);">{{ 'applications.detail.dangerZone' | translate }}</h2>
        <p class="mb-4 mt-1 text-sm leading-relaxed" style="color:var(--color-text-secondary);">{{ 'applications.detail.deleteHint' | translate }}</p>
        @if (confirmingDelete()) {
          <label class="mb-2 block text-sm" for="delete-confirm">{{ 'applications.detail.deleteConfirmLabel' | translate: { name: app().name } }}</label>
          <div class="flex flex-wrap gap-2">
            <input id="delete-confirm" type="text" class="min-w-0 flex-1 !w-auto" autocomplete="off" [value]="deleteConfirmText()" (input)="deleteConfirmText.set($any($event.target).value)" />
            <button type="button" class="outer-button" (click)="cancelDelete()" [disabled]="deleting()">{{ 'applications.detail.cancel' | translate }}</button>
            <button type="button" class="outer-button" style="color:var(--color-danger);border-color:var(--color-danger);" (click)="remove()" [disabled]="deleting() || deleteConfirmText().trim() !== app().name">
              @if (deleting()) { <idem-loader size="xs" /> }
              {{ (deleting() ? 'applications.detail.deleting' : 'applications.detail.deleteConfirm') | translate }}
            </button>
          </div>
        } @else {
          <button type="button" class="outer-button" style="color:var(--color-danger);" (click)="confirmingDelete.set(true)">
            <i class="pi pi-trash mr-2 text-xs"></i>{{ 'applications.detail.deleteApplication' | translate }}
          </button>
        }
        @if (deleteError(); as message) {
          <p class="mt-2 text-sm" role="alert" style="color:var(--color-danger);">{{ message }}</p>
        }
      </section>
    </div>
  `,
})
export class AppSettingsTabComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private translate = inject(TranslateService);

  readonly app = input.required<Application>();
  /** The application as the API returned it after a save — the header shows it right away. */
  readonly updated = output<Application>();

  protected readonly ci = signal<{ url: string; secret: string } | null>(null);
  protected readonly registries = signal<RegistryCredential[]>([]);
  protected readonly registryForm = this.fb.nonNullable.group({
    registry: ['', Validators.required],
    username: ['', Validators.required],
    password: ['', Validators.required],
  });
  protected readonly saving = signal(false);
  protected readonly saved = signal(false);
  protected readonly saveError = signal<string | null>(null);
  /** Set when the domain changed: it only reaches the proxy with a deployment. */
  protected readonly redeployRequired = signal(false);
  protected readonly redeploying = signal(false);
  protected readonly domainCheck = signal<DomainCheck[]>([]);
  protected readonly appTags = signal<Tag[]>([]);
  private readonly allTags = signal<Tag[]>([]);
  protected readonly availableTags = computed(() => {
    const attached = new Set(this.appTags().map((t) => t.uuid));
    return this.allTags().filter((t) => !attached.has(t.uuid));
  });
  protected readonly output = signal('');
  protected readonly busy = signal(false);

  protected readonly confirmingDelete = signal(false);
  protected readonly deleteConfirmText = signal('');
  protected readonly deleting = signal(false);
  protected readonly deleteError = signal<string | null>(null);

  /** The known packs, plus whatever this app already uses if it's something else. */
  protected readonly buildPacks = computed(() => {
    const current = this.app().build_pack;
    return current && !(BUILD_PACKS as readonly string[]).includes(current) ? [...BUILD_PACKS, current] : [...BUILD_PACKS];
  });

  protected readonly configForm = this.fb.nonNullable.group({
    git_repository: [''],
    git_branch: [''],
    build_pack: [''],
    base_directory: [''],
    dockerfile_location: [''],
    dockerfile_target_build: [''],
    watch_paths: [''],
    docker_registry_image_name: [''],
    docker_registry_image_tag: [''],
    ports_exposes: [''],
    fqdn: [''],
  });
  protected readonly execForm = this.fb.nonNullable.group({ command: [''] });

  ngOnInit(): void {
    const a = this.app();
    this.configForm.reset({
      git_repository: a.git_repository ?? '',
      git_branch: a.git_branch ?? '',
      build_pack: a.build_pack ?? 'nixpacks',
      base_directory: a.base_directory ?? '',
      dockerfile_location: a.dockerfile_location ?? '',
      dockerfile_target_build: a.dockerfile_target_build ?? '',
      watch_paths: a.watch_paths ?? '',
      docker_registry_image_name: a.docker_registry_image_name ?? '',
      docker_registry_image_tag: a.docker_registry_image_tag ?? '',
      ports_exposes: a.ports_exposes ?? '',
      fqdn: a.fqdn ?? '',
    });
    this.reloadTags();
    this.loadRegistries();
  }

  protected save(): void {
    this.saving.set(true);
    this.saved.set(false);
    this.saveError.set(null);
    this.api.updateApplication(this.app().uuid, this.configForm.getRawValue()).subscribe({
      next: (a) => {
        this.saving.set(false);
        this.saved.set(true);
        this.configForm.markAsPristine();
        this.domainCheck.set(a.domainCheck ?? []);
        if (a.redeployRequired) this.redeployRequired.set(true);
        this.updated.emit(a);
      },
      // A taken or invalid domain says which, and why.
      error: (e) => {
        this.saving.set(false);
        const message = (e as { error?: { error?: { message?: string } } })?.error?.error?.message;
        this.saveError.set(message ?? this.translate.instant('applications.detail.saveError'));
      },
    });
  }

  protected loadCi(): void {
    this.api.ciDeployToken(this.app().uuid).subscribe((c) => this.ci.set(c));
  }

  protected rotateCi(): void {
    this.api.ciDeployToken(this.app().uuid, true).subscribe((c) => this.ci.set(c));
  }

  private loadRegistries(): void {
    this.api.listRegistryCredentials().subscribe((r) => this.registries.set(r));
  }

  protected addRegistry(): void {
    if (this.registryForm.invalid) return;
    this.api.saveRegistryCredential(this.registryForm.getRawValue()).subscribe({
      next: () => {
        this.registryForm.patchValue({ username: '', password: '' });
        this.loadRegistries();
      },
      error: (e) => {
        const message = (e as { error?: { error?: { message?: string } } })?.error?.error?.message;
        this.saveError.set(message ?? this.translate.instant('applications.detail.saveError'));
      },
    });
  }

  protected removeRegistry(id: number): void {
    this.api.deleteRegistryCredential(id).subscribe(() => this.loadRegistries());
  }

  protected redeploy(): void {
    this.redeploying.set(true);
    this.api.deploy(this.app().uuid).subscribe({
      next: () => {
        this.redeploying.set(false);
        this.redeployRequired.set(false);
      },
      error: (e) => {
        this.redeploying.set(false);
        const message = (e as { error?: { error?: { message?: string } } })?.error?.error?.message;
        this.saveError.set(message ?? this.translate.instant('applications.detail.redeployError'));
      },
    });
  }

  private reloadTags(): void {
    this.api.listTags().subscribe((all) => this.allTags.set(all));
    this.api.listTagsForResource(APPLICATION_TAGGABLE_TYPE, this.app().id).subscribe((tags) => this.appTags.set(tags));
  }

  protected attachTag(tagUuid: string): void {
    if (!tagUuid) return;
    this.api
      .attachTag(tagUuid, { taggable_type: APPLICATION_TAGGABLE_TYPE, taggable_id: this.app().id })
      .subscribe(() => this.reloadTags());
  }

  protected detachTag(tag: Tag): void {
    this.api
      .detachTag(tag.uuid, { taggable_type: APPLICATION_TAGGABLE_TYPE, taggable_id: this.app().id })
      .subscribe(() => this.reloadTags());
  }

  protected refreshStatus(): void {
    this.busy.set(true);
    this.api.appStatus(this.app().uuid).subscribe({
      next: (s) => this.show(s.status),
      error: () => this.busy.set(false),
    });
  }

  protected refreshMetrics(): void {
    this.busy.set(true);
    this.api.appMetrics(this.app().uuid).subscribe({
      next: (m) => this.show(m.metrics),
      error: () => this.busy.set(false),
    });
  }

  protected runExec(): void {
    const command = this.execForm.getRawValue().command.trim();
    if (!command) return;
    this.busy.set(true);
    this.api.appExec(this.app().uuid, command).subscribe({
      next: (r) => this.show(r.output),
      error: () => this.busy.set(false),
    });
  }

  private show(text: string): void {
    this.output.set(text);
    this.busy.set(false);
  }

  protected cancelDelete(): void {
    this.confirmingDelete.set(false);
    this.deleteConfirmText.set('');
    this.deleteError.set(null);
  }

  protected remove(): void {
    this.deleting.set(true);
    this.deleteError.set(null);
    this.api.deleteApplication(this.app().uuid).subscribe({
      next: (res) =>
        this.router.navigate(['/applications'], {
          queryParams: res.serverCleanup === 'failed' ? { cleanup: 'failed' } : {},
        }),
      error: (e) => {
        const message = (e as { error?: { error?: { message?: string } } })?.error?.error?.message;
        this.deleteError.set(message ?? this.translate.instant('applications.detail.deleteError'));
        this.deleting.set(false);
      },
    });
  }
}
