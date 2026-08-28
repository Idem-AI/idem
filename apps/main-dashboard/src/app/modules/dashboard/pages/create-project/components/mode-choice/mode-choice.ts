import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

export type CreateMode = 'chat' | 'form';

@Component({
  selector: 'app-mode-choice',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './mode-choice.html',
  styleUrl: './mode-choice.css',
})
export class ModeChoiceComponent {
  readonly projectDescription = input<string>('');
  readonly selectMode = output<CreateMode>();
  readonly back = output<void>();

  protected onSelectForm(): void {
    this.selectMode.emit('form');
  }

  protected onSelectChat(): void {
    this.selectMode.emit('chat');
  }

  protected onBack(): void {
    this.back.emit();
  }
}
