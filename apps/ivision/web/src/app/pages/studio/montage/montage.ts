import { HttpEventType } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { Subscription } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiService } from '../../../core/api.service';
import { Creativity, CutMode } from '../../../core/models';
import { StudioState } from '../../../core/studio.state';
import { CreativitySelect } from '../../../shared/components/creativity-select';
import { Illustration } from '../../../shared/components/illustration';

const FORMATS = ['story', 'square', 'portrait', 'landscape'];
const CUTS: CutMode[] = ['tight', 'natural', 'none'];

/**
 * L'atelier « Montage » : la personne importe une vidéo où elle parle, dit ce qu'elle veut (en
 * option), et reçoit une vidéo coupée, sous-titrée et habillée, prête à publier. Le prix dépend
 * de la durée (lue ici, dans le navigateur, avant l'envoi).
 */
@Component({
  selector: 'iv-montage',
  imports: [RouterLink, TranslateModule, IdemLoaderComponent, Illustration, CreativitySelect],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './montage.html',
})
export class MontagePage {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly state = inject(StudioState);
  protected readonly accountUrl = `${environment.services.dashboard.url}/account`;

  protected readonly formats = FORMATS;
  protected readonly cutModes = CUTS;

  protected readonly available = signal<boolean | null>(null);
  protected readonly limits = signal({ maxBytes: 600 * 1024 * 1024, maxDurationSec: 300, minDurationSec: 3 });
  protected readonly file = signal<File | null>(null);
  protected readonly fileUrl = signal<string | null>(null);
  protected readonly durationSec = signal<number | null>(null);
  protected readonly fileError = signal<string | null>(null);
  protected readonly brandId = signal<string>('');
  protected readonly prompt = signal('');
  protected readonly format = signal('story');
  protected readonly cuts = signal<CutMode>('tight');
  protected readonly music = signal(true);
  protected readonly creativity = signal<Creativity>('medium');
  protected readonly price = signal<number | null>(null);
  protected readonly uploading = signal(false);
  protected readonly uploadPercent = signal(0);
  protected readonly error = signal<string | null>(null);
  protected readonly needCredits = signal(false);

  protected readonly canSend = computed(() => !!this.file() && !!this.durationSec() && !this.fileError() && !!this.brandId() && !this.uploading() && this.available() === true);
  private upload: Subscription | null = null;

  constructor() {
    this.api.montageStatus().subscribe({
      next: (s) => {
        this.available.set(s.available);
        this.limits.set(s.limits);
      },
      error: () => this.available.set(false),
    });
    this.state.refreshMontages();
    // La première marque par défaut, dès que la liste arrive.
    effect(() => {
      const brands = this.state.brands();
      if (!untracked(() => this.brandId()) && brands.length) this.brandId.set(brands[0].id);
    });
    // Le prix suit la durée et le cran.
    effect(() => {
      const d = this.durationSec();
      const level = this.creativity();
      if (!d) return this.price.set(null);
      untracked(() => this.api.montageQuote(d, level).subscribe({ next: (q) => this.price.set(q.cost), error: () => this.price.set(null) }));
    });
    this.destroyRef.onDestroy(() => {
      this.upload?.unsubscribe();
      const url = this.fileUrl();
      if (url) URL.revokeObjectURL(url);
    });
  }

  protected onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    const old = this.fileUrl();
    if (old) URL.revokeObjectURL(old);
    this.file.set(file);
    this.durationSec.set(null);
    this.fileError.set(null);
    this.error.set(null);
    this.fileUrl.set(file ? URL.createObjectURL(file) : null);
    if (file && file.size > this.limits().maxBytes) this.fileError.set('montage.errors.tooBig');
  }

  /** La durée, lue par le lecteur du navigateur (sans envoyer le fichier). */
  protected onMetadata(event: Event): void {
    const d = (event.target as HTMLVideoElement).duration;
    if (!Number.isFinite(d)) return;
    this.durationSec.set(Math.round(d * 10) / 10);
    const { minDurationSec, maxDurationSec } = this.limits();
    if (d < minDurationSec) this.fileError.set('montage.errors.tooShort');
    else if (d > maxDurationSec + 1) this.fileError.set('montage.errors.tooLong');
  }

  protected onVideoError(): void {
    // Certains formats ne se lisent pas dans le navigateur (HEVC) : le serveur saura les lire.
    if (!this.durationSec()) this.durationSec.set(0);
  }

  protected send(): void {
    const file = this.file();
    if (!file || !this.canSend()) return;
    this.uploading.set(true);
    this.uploadPercent.set(0);
    this.error.set(null);
    this.needCredits.set(false);
    this.upload = this.api
      .createMontage(file, {
        brandId: this.brandId(),
        prompt: this.prompt().trim(),
        format: this.format(),
        cuts: this.cuts(),
        music: String(this.music()),
        creativity: this.creativity(),
      })
      .subscribe({
        next: (event) => {
          if (event.type === HttpEventType.UploadProgress && event.total) this.uploadPercent.set(Math.round((event.loaded / event.total) * 100));
          if (event.type === HttpEventType.Response && event.body) {
            this.uploading.set(false);
            this.state.upsertMontage(event.body);
            this.state.refreshCredits();
            void this.router.navigate(['/studio/montage', event.body.id]);
          }
        },
        error: (err) => {
          this.uploading.set(false);
          if (err?.status === 402) this.needCredits.set(true);
          else this.error.set(err?.error?.message || 'montage.errors.upload');
        },
      });
  }

  protected minutes(sec: number): string {
    return `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
  }
}
