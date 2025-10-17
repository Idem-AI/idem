import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-terraform-viewer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './terraform-viewer.html',
})
export class TerraformViewer {
  // Angular-specific properties
  @Input({ required: true }) set mainFile(value: string) {
    this.mainFileContent.set(value || 'No main.tf file available');
  }
  
  @Input({ required: true }) set variablesFile(value: string) {
    this.variablesFileContent.set(value || 'No variables.tf file available');
  }
  
  @Input({ required: true }) set variablesMapFile(value: string) {
    this.variablesMapFileContent.set(value || 'No terraform.tfvars file available');
  }

  // Component state using signals
  protected readonly mainFileContent = signal<string>('No main.tf file available');
  protected readonly variablesFileContent = signal<string>('No variables.tf file available');
  protected readonly variablesMapFileContent = signal<string>('No terraform.tfvars file available');
  protected readonly activeTab = signal<'main' | 'variables' | 'variablesMap'>('main');

  // UI methods
  protected setActiveTab(tab: 'main' | 'variables' | 'variablesMap'): void {
    this.activeTab.set(tab);
  }

  protected getActiveFileContent(): string {
    switch (this.activeTab()) {
      case 'main':
        return this.mainFileContent();
      case 'variables':
        return this.variablesFileContent();
      case 'variablesMap':
        return this.variablesMapFileContent();
      default:
        return 'No content available';
    }
  }
  
  protected getActiveFileName(): string {
    switch (this.activeTab()) {
      case 'main':
        return 'main.tf';
      case 'variables':
        return 'variables.tf';
      case 'variablesMap':
        return 'terraform.tfvars';
      default:
        return 'terraform-file.txt';
    }
  }
  
  protected getDownloadHref(): string {
    return 'data:text/plain;charset=utf-8,' + encodeURIComponent(this.getActiveFileContent());
  }
}
