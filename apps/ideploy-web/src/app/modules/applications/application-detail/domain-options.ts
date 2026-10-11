import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { ApiService } from '../../../shared/services/api.service';
import { DomainOptions } from '../../../shared/models/ideploy.models';

/**
 * How the domains are served: HTTPS forced, HSTS, other domains redirected to
 * the first one, www or not. Each change is saved at once, and applied live
 * when the application's routes allow it.
 */
@Component({
  selector: 'app-domain-options',
  imports: [TranslateModule, IdemLoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (options(); as o) {
      <fieldset class="mt-4">
        <legend class="px-1 text-sm font-medium">{{ 'applications.detail.domainOptions.title' | translate }}</legend>
        <div class="space-y-4 text-sm">
          <!-- The design system styles label as inline-block: each row is a div, the label only names the box. -->
          <div class="flex items-start gap-3">
            <input type="checkbox" id="dom-https" class="mt-0.5 shrink-0" [checked]="o.forceHttps" [disabled]="saving()" (change)="save({ forceHttps: $any($event.target).checked, hsts: $any($event.target).checked ? o.hsts : false })" />
            <div>
              <label for="dom-https" class="!mb-0">{{ 'applications.detail.domainOptions.forceHttps' | translate }}</label>
              <p class="text-xs" style="color:var(--color-text-secondary);">{{ 'applications.detail.domainOptions.forceHttpsHint' | translate }}</p>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <input type="checkbox" id="dom-hsts" class="mt-0.5 shrink-0" [checked]="o.hsts" [disabled]="saving() || !o.forceHttps" (change)="save({ hsts: $any($event.target).checked })" />
            <div>
              <label for="dom-hsts" class="!mb-0">{{ 'applications.detail.domainOptions.hsts' | translate }}</label>
              <p class="text-xs" style="color:var(--color-text-secondary);">{{ 'applications.detail.domainOptions.hstsHint' | translate }}</p>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <input type="checkbox" id="dom-primary" class="mt-0.5 shrink-0" [checked]="o.redirectToPrimary" [disabled]="saving()" (change)="save({ redirectToPrimary: $any($event.target).checked })" />
            <div>
              <label for="dom-primary" class="!mb-0">{{ 'applications.detail.domainOptions.primary' | translate }}</label>
              <p class="text-xs" style="color:var(--color-text-secondary);">{{ 'applications.detail.domainOptions.primaryHint' | translate }}</p>
            </div>
          </div>
          <div>
            <label for="dom-redirect">{{ 'applications.detail.domainOptions.www' | translate }}</label>
            <select id="dom-redirect" class="!w-auto block" [value]="o.redirect" [disabled]="saving()" (change)="save({ redirect: $any($event.target).value })">
              <option value="both">{{ 'applications.detail.domainOptions.wwwBoth' | translate }}</option>
              <option value="non-www">{{ 'applications.detail.domainOptions.wwwToBare' | translate }}</option>
              <option value="www">{{ 'applications.detail.domainOptions.bareToWww' | translate }}</option>
            </select>
          </div>
        </div>
        <p class="mt-3 flex items-center gap-2 text-xs" role="status" style="color:var(--color-text-secondary);">
          @if (saving()) { <idem-loader size="xs" /> }
          @if (state() === 'applied') { <i class="pi pi-check text-xs" style="color:var(--color-success);" aria-hidden="true"></i>{{ 'applications.detail.domainOptions.applied' | translate }} }
          @if (state() === 'redeploy') { {{ 'applications.detail.domainOptions.redeploy' | translate }} }
          @if (error()) { <span role="alert" style="color:var(--color-danger);">{{ error() }}</span> }
        </p>
      </fieldset>
    }
  `,
})
export class DomainOptionsComponent implements OnInit {
  private api = inject(ApiService);
  readonly appUuid = input.required<string>();
  /** Saved but waiting for a deployment (routes still on the container). */
  readonly redeployNeeded = output<void>();

  protected readonly options = signal<DomainOptions | null>(null);
  protected readonly saving = signal(false);
  protected readonly state = signal<'applied' | 'redeploy' | null>(null);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.api.getDomainOptions(this.appUuid()).subscribe((o) => this.options.set(o));
  }

  protected save(patch: Partial<DomainOptions>): void {
    this.saving.set(true);
    this.error.set(null);
    this.api.updateDomainOptions(this.appUuid(), patch).subscribe({
      next: (r) => {
        this.options.set(r.options);
        this.saving.set(false);
        this.state.set(r.applied ? 'applied' : 'redeploy');
        if (!r.applied) this.redeployNeeded.emit();
      },
      error: (e) => {
        this.saving.set(false);
        this.error.set((e as { error?: { error?: { message?: string } } })?.error?.error?.message ?? 'Error');
        this.api.getDomainOptions(this.appUuid()).subscribe((o) => this.options.set(o));
      },
    });
  }
}
