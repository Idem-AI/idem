import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { ChatChip } from '../../models/chat.model';

/**
 * Chips de suggestions rapides affichées sous la dernière réponse de l'IA.
 * Elles proposent la prochaine action logique et disparaissent dès qu'une
 * réponse est donnée (le parent ne les rend que sur le dernier message).
 */
@Component({
  selector: 'app-suggestion-chips',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './suggestion-chips.html',
  styleUrl: './suggestion-chips.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SuggestionChipsComponent {
  readonly chips = input.required<ChatChip[]>();
  readonly disabled = input<boolean>(false);

  readonly chipSelected = output<ChatChip>();

  protected select(chip: ChatChip): void {
    if (this.disabled()) return;
    this.chipSelected.emit(chip);
  }
}
