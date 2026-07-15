import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../../shared/services/api.service';

@Component({
  selector: 'app-storages-list',
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="heading-serif mb-6" style="font-size:32px;font-weight:700;color:#fff;">{{ 'storages.title' | translate }}</h1>
    @if (storages().length === 0) {
      <div class="box">{{ 'storages.empty' | translate }}</div>
    } @else {
      <div class="space-y-3">
        @for (s of storages(); track s.uuid) {
          <div class="box flex items-center gap-3">
            <i class="fa-solid fa-box-archive" style="color:#60a5fa;"></i>
            <div>
              <div class="font-semibold">{{ s.name }}</div>
              <div class="text-sm" style="color: var(--color-text-secondary)">{{ s.region }} · {{ s.endpoint ?? 'AWS S3' }}</div>
            </div>
          </div>
        }
      </div>
    }
  `,
})
export class StoragesListComponent implements OnInit {
  private api = inject(ApiService);
  protected readonly storages = signal<{ uuid: string; name: string; region: string; endpoint: string | null }[]>([]);
  ngOnInit(): void {
    this.api.listS3Storages().subscribe((s) => this.storages.set(s));
  }
}
