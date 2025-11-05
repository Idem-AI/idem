import { Component, output, signal, computed, inject } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LogoType, LogoPreferencesModel } from '../../../../models/logo.model';

@Component({
  selector: 'app-logo-preferences',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './logo-preferences.html',
  styleUrl: './logo-preferences.css',
})
export class LogoPreferences {
  // Outputs
  readonly preferencesSelected = output<LogoPreferencesModel>();

  // State
  protected readonly selectedType = signal<LogoType | null>(null);
  protected readonly generationMode = signal<'ai' | 'custom' | null>(null);
  protected readonly customDescription = signal<string>('');
  protected readonly currentStep = signal<'type' | 'mode' | 'description'>('type');

  // Computed
  protected readonly canProceed = computed(() => {
    const step = this.currentStep();
    if (step === 'type') return this.selectedType() !== null;
    if (step === 'mode') return this.generationMode() !== null;
    if (step === 'description') {
      return this.generationMode() === 'ai' || this.customDescription().trim().length > 10;
    }
    return false;
  });

  // Logo type options
  protected readonly logoTypes = [
    {
      type: 'icon' as LogoType,
      titleKey: 'dashboard.logoPreferences.types.icon.title',
      descriptionKey: 'dashboard.logoPreferences.types.icon.description',
      exampleKey: 'dashboard.logoPreferences.types.icon.example',
    },
    {
      type: 'name' as LogoType,
      titleKey: 'dashboard.logoPreferences.types.name.title',
      descriptionKey: 'dashboard.logoPreferences.types.name.description',
      exampleKey: 'dashboard.logoPreferences.types.name.example',
    },
    {
      type: 'initial' as LogoType,
      titleKey: 'dashboard.logoPreferences.types.initial.title',
      descriptionKey: 'dashboard.logoPreferences.types.initial.description',
      exampleKey: 'dashboard.logoPreferences.types.initial.example',
    },
  ];

  protected selectType(type: LogoType): void {
    this.selectedType.set(type);
  }

  protected selectGenerationMode(mode: 'ai' | 'custom'): void {
    this.generationMode.set(mode);
    if (mode === 'ai') {
      this.customDescription.set('');
    }
  }

  protected goToModeSelection(): void {
    if (this.selectedType()) {
      this.currentStep.set('mode');
    }
  }

  protected goToDescription(): void {
    if (this.generationMode() === 'custom') {
      this.currentStep.set('description');
    } else if (this.generationMode() === 'ai') {
      this.completePreferences();
    }
  }

  protected completePreferences(): void {
    const type = this.selectedType();
    const mode = this.generationMode();

    if (!type || !mode) return;

    const preferences: LogoPreferencesModel = {
      type,
      useAIGeneration: mode === 'ai',
      customDescription: mode === 'custom' ? this.customDescription() : undefined,
    };

    this.preferencesSelected.emit(preferences);
  }

  protected goBack(): void {
    const step = this.currentStep();
    if (step === 'mode') {
      this.currentStep.set('type');
      this.generationMode.set(null);
    } else if (step === 'description') {
      this.currentStep.set('mode');
    }
  }

  protected updateDescription(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    this.customDescription.set(target.value);
  }
}
