import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { ApiService } from '../../../shared/services/api.service';

@Component({
  selector: 'app-sources-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="heading-serif mb-6" style="font-size:32px;font-weight:700;color:#fff;">Git Sources</h1>
    @if (sources().length === 0) {
      <div class="box">No Git sources configured (GitHub / GitLab apps).</div>
    } @else {
      <div class="space-y-3">
        @for (s of sources(); track s.uuid) {
          <div class="box flex items-center gap-3">
            <i class="fa-brands" [class.fa-github]="s.provider === 'github'" [class.fa-gitlab]="s.provider === 'gitlab'"></i>
            <div>
              <div class="font-semibold">{{ s.name }}</div>
              <div class="text-sm" style="color: var(--color-text-secondary)">{{ s.organization }} · {{ s.html_url }}</div>
            </div>
          </div>
        }
      </div>
    }
  `,
})
export class SourcesListComponent implements OnInit {
  private api = inject(ApiService);
  protected readonly sources = signal<{ uuid: string; name: string; provider: string; organization: string | null; html_url: string }[]>([]);
  ngOnInit(): void {
    this.api.listSources().subscribe((s) => this.sources.set(s));
  }
}
