import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { InputTextModule } from 'primeng/inputtext';
import { FloatLabel } from 'primeng/floatlabel';
import { Select } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { ProjectModel } from '../../../../models/project.model';
import { SelectElement } from '../../datas';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-project-details',
  standalone: true,
  imports: [
    FormsModule,
    CommonModule,
    InputTextModule,
    FloatLabel,
    Select,
    MultiSelectModule,
    TranslateModule,
  ],
  templateUrl: './project-details.html',
  styleUrl: './project-details.css',
})
export class ProjectDetailsComponent {
  project = input<ProjectModel>();
  readonly groupedProjectTypes = input.required<SelectElement[]>();
  readonly groupedScopes = input.required<SelectElement[]>();
  readonly groupedTargets = input.required<SelectElement[]>();

  projectChange = output<ProjectModel>();
  readonly projectUpdate = output<Partial<ProjectModel>>();
  readonly nextStep = output<void>();
  readonly previousStep = output<void>();
  readonly constraintsChange = output<void>();

  protected goToNextStep(): void {
    this.nextStep.emit();
  }

  protected goToPreviousStep(): void {
    this.previousStep.emit();
  }

  protected onConstraintsChange(): void {
    this.constraintsChange.emit();
  }

  protected onNameChange(value: string): void {
    this.projectUpdate.emit({ name: value });
  }

  protected onTypeChange(value: any): void {
    this.projectUpdate.emit({ type: value });
  }

  protected onScopeChange(value: any): void {
    this.projectUpdate.emit({ scope: value });
  }

  protected onTargetsChange(value: any): void {
    this.projectUpdate.emit({ targets: value });
  }
}
