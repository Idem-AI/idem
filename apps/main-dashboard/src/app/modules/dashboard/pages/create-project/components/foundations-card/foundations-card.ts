import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { TranslateModule } from '@ngx-translate/core';
import { ProjectModel } from '@idem/shared-models';
import CreateProjectDatas, { SelectElement } from '../../datas';
import { environment } from '../../../../../../../environments/environment';

/**
 * Phase A de la création conversationnelle : carte « Fondations » compacte
 * (description + nom + type). Une fois validée, le projet est créé en base et
 * la conversation IA prend le relais.
 */
@Component({
  selector: 'app-foundations-card',
  standalone: true,
  imports: [CommonModule, FormsModule, InputTextModule, Select, TranslateModule],
  templateUrl: './foundations-card.html',
  styleUrl: './foundations-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FoundationsCardComponent {
  readonly project = input.required<ProjectModel>();
  readonly busy = input<boolean>(false);

  readonly projectUpdate = output<Partial<ProjectModel>>();
  readonly continue = output<void>();

  protected readonly projectTypes: SelectElement[] = CreateProjectDatas.groupedProjectTypes;
  protected readonly maxCharacters = environment.isBeta ? 500 : 2000;

  protected readonly description = computed(() => this.project().description ?? '');
  protected readonly name = computed(() => this.project().name ?? '');
  protected readonly type = computed(() => this.project().type);

  protected readonly canContinue = computed(() => {
    const p = this.project();
    return (
      !!p.description?.trim() &&
      p.description.trim().length >= 10 &&
      !!p.name?.trim() &&
      !!p.type &&
      !this.busy()
    );
  });

  protected onDescriptionChange(value: string): void {
    const trimmed = value.length > this.maxCharacters ? value.slice(0, this.maxCharacters) : value;
    this.projectUpdate.emit({ description: trimmed });
  }

  protected onNameChange(value: string): void {
    this.projectUpdate.emit({ name: value });
  }

  protected onTypeChange(value: unknown): void {
    this.projectUpdate.emit({ type: value as ProjectModel['type'] });
  }

  protected submit(): void {
    if (this.canContinue()) this.continue.emit();
  }
}
