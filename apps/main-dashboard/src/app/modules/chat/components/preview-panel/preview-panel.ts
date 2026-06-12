import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { PdfViewer } from '../../../../shared/components/pdf-viewer/pdf-viewer';
import { Loader } from '../../../../shared/components/loader/loader';

/**
 * Panneau latéral de prévisualisation d'un livrable : l'utilisateur lit,
 * fait défiler et referme sans quitter la conversation.
 */
@Component({
  selector: 'app-preview-panel',
  standalone: true,
  imports: [TranslateModule, PdfViewer, Loader],
  templateUrl: './preview-panel.html',
  styleUrl: './preview-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PreviewPanelComponent {
  readonly title = input.required<string>();
  readonly pdfUrl = input<string | null>(null);
  readonly isLoading = input<boolean>(false);
  readonly error = input<string | null>(null);

  readonly closed = output<void>();
  readonly downloadRequested = output<void>();
}
