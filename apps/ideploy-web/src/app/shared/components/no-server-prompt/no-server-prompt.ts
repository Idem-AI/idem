import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { IllustrationComponent } from '../illustration/illustration';

/**
 * Shown where "my own server" was chosen but the team has none yet: the
 * locked granary door, one sentence on what to do, and the way to do it.
 *
 * Both buttons carry `returnTo`, so adding the server hands the person back
 * to the deploy they were in the middle of instead of stranding them on the
 * server list.
 */
@Component({
  selector: 'app-no-server-prompt',
  imports: [RouterLink, TranslateModule, IllustrationComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col items-center rounded-xl border border-dashed px-5 py-6 text-center" style="border-color:var(--glass-border-medium);background:var(--glass-bg-subtle);">
      <app-illustration name="own-server" [width]="96" class="mb-3 block" />
      <p class="text-sm font-semibold text-text-primary">{{ 'noServerPrompt.title' | translate }}</p>
      <p class="mt-1 max-w-sm text-xs leading-relaxed" style="color:var(--color-text-secondary);">{{ 'noServerPrompt.body' | translate }}</p>
      <div class="mt-4 flex flex-wrap justify-center gap-2">
        <a class="inner-button" routerLink="/servers/new" [queryParams]="{ returnTo: returnTo() }">
          <i class="pi pi-plus mr-2 text-xs"></i>{{ 'noServerPrompt.add' | translate }}
        </a>
        <a class="outer-button" routerLink="/servers/new/cloud" [queryParams]="{ returnTo: returnTo() }">
          <i class="pi pi-cloud mr-2 text-xs"></i>{{ 'noServerPrompt.cloud' | translate }}
        </a>
      </div>
      <p class="mt-3 text-[11px]" style="color:var(--color-text-tertiary);">
        <i class="pi pi-replay mr-1 text-[10px]"></i>{{ 'noServerPrompt.comeBack' | translate }}
      </p>
    </div>
  `,
})
export class NoServerPromptComponent {
  /** The in-app URL to come back to once the server exists. */
  readonly returnTo = input.required<string>();
}
