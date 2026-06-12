import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { LogoModel } from '../../../dashboard/models/logo.model';
import { SafeHtmlPipe } from '../../../dashboard/pages/projects-list/safehtml.pipe';

/**
 * Carte de sélection de logo (concepts générés par l'IA) dans le fil de
 * conversation. Les SVG inline sont rendus directement, les URLs via <img>.
 */
@Component({
  selector: 'app-logo-options-card',
  standalone: true,
  imports: [TranslateModule, SafeHtmlPipe],
  templateUrl: './logo-options-card.html',
  styleUrl: './logo-options-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogoOptionsCardComponent {
  readonly options = input.required<LogoModel[]>();
  readonly selectedId = input<string | null>(null);
  readonly disabled = input<boolean>(false);

  readonly picked = output<LogoModel>();

  protected isInlineSvg(logo: LogoModel): boolean {
    return !!logo.svg && logo.svg.trimStart().startsWith('<');
  }

  protected pick(option: LogoModel): void {
    if (this.disabled() || this.selectedId()) return;
    this.picked.emit(option);
  }
}
