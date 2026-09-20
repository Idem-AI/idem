import { Injectable, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';

import { ToastService } from '../../../core/ui/toast.service';
import { SimulationGateway } from './simulation.gateway';

/**
 * Téléchargement du rapport en PDF.
 *
 * Deux écrans le proposent — la vue d'ensemble et le rapport lui-même — et le
 * document est composé par l'API, avec le template IDEM : l'impression
 * navigateur donnait un rendu différent d'un poste à l'autre, sans la charte.
 * Le service porte l'état d'attente pour que les deux boutons le montrent de
 * la même façon.
 */
@Injectable({ providedIn: 'root' })
export class ReportDownloadService {
  private readonly gateway = inject(SimulationGateway);
  private readonly toasts = inject(ToastService);
  private readonly translate = inject(TranslateService);

  private readonly inFlight = signal(false);
  /** Vrai pendant que l'API compose le PDF : le rendu prend quelques secondes. */
  readonly downloading = this.inFlight.asReadonly();

  async download(projectId: string, simulationId: string): Promise<void> {
    if (this.inFlight()) {
      return;
    }

    this.inFlight.set(true);
    try {
      const file = await firstValueFrom(this.gateway.downloadReport(projectId, simulationId));
      saveFile(file.blob, file.fileName);
    } catch (error) {
      this.toasts.error(
        this.translate.instant('report.downloadFailed') as string,
        error instanceof Error ? error.message : undefined,
      );
    } finally {
      this.inFlight.set(false);
    }
  }
}

/** Remet le document au navigateur, qui l'enregistre sous le nom donné. */
function saveFile(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
