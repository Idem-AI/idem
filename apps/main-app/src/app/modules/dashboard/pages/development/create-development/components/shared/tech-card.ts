import { Component, Input, Output, EventEmitter, signal, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { Select } from "primeng/select";

export interface TechCardModel {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  badges: string[];
  versions?: string[];
  isAvailable: boolean;
}

@Component({
  selector: 'app-tech-card',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, Select],
  templateUrl: './tech-card.html',
  styleUrl: './tech-card.css'
})
export class TechCardComponent {
  readonly tech = input.required<TechCardModel>();
  readonly selected = input<boolean>();
  readonly selectedVersion = input<string | null>();
  readonly showAdvancedOptions = input<boolean>();

  readonly techSelect = output<string>();
  readonly versionSelect = output<string>();
  
  protected advancedOptionsVisible = signal(false);
  
  protected isAdvancedOptionsVisible = computed(() => this.advancedOptionsVisible());

  protected toggleAdvancedOptions(): void {
    this.advancedOptionsVisible.update(current => !current);
  }

  protected selectTech(): void {
    if (this.tech().isAvailable) {
      this.techSelect.emit(this.tech().id);
    }
  }

  protected selectVersion(version: string): void {
    this.versionSelect.emit(version);
  }
}
