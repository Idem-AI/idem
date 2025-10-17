import { Component, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DeploymentMode } from '../../../../../models/deployment.model';

@Component({
  selector: 'app-mode-selector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mode-selector.html',
  styleUrl: './mode-selector.css',
})
export class ModeSelector {
  // Define output event emitter with DeploymentMode type
  protected readonly onModeSelect = output<DeploymentMode>();

  protected selectMode(mode: DeploymentMode): void {
    // Emit the selected mode
    this.onModeSelect.emit(mode);
  }
}
