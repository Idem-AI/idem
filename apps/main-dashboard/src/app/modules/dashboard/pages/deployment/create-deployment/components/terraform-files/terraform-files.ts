import { Component, Input, Output, EventEmitter, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FileContentEditor } from '../../../../../../../shared/components/file-content-editor/file-content-editor';
import {
  DeploymentModel,
  FileContent,
  FileContentConfig,
} from '../../../../../models/deployment.model';

@Component({
  selector: 'app-terraform-files',
  standalone: true,
  imports: [CommonModule, FileContentEditor],
  templateUrl: './terraform-files.html',
})
export class TerraformFiles implements OnInit {
  // Angular-specific properties
  @Input({ required: true }) deployment: DeploymentModel | null = null;
  @Output() readonly terraformContentChanged = new EventEmitter<{
    fileId: string;
    newContent: string;
  }>();
  @Output() readonly terraformFileDownloaded = new EventEmitter<{
    fileId: string;
    fileName: string;
    content: string;
  }>();

  // Component state using signals
  protected readonly hasFiles = signal<boolean>(false);
  protected readonly fileContents = signal<FileContent[]>([]);
  protected readonly fileConfig = signal<FileContentConfig>({
    showLineNumbers: true,
    enableSyntaxHighlighting: true,
    enableEditing: true,
    enableDownload: true,
    maxHeight: '500px',
    theme: 'dark',
  });

  // Computed property for visibility
  protected readonly showComponent = computed(() => this.hasFiles());

  ngOnInit(): void {
    console.log('deployment tfvars', this.deployment?.generatedTerraformTfvarsFileContent);
    this.checkForTerraformFiles();
  }

  /**
   * Check if the deployment has Terraform files and populate signals
   * Focus on tfvars file only as requested by user
   */
  protected checkForTerraformFiles(): void {
    if (!this.deployment) {
      this.hasFiles.set(false);
      return;
    }

    const files: FileContent[] = [];

    // Priority 1: Check new flexible fileContents structure
    if (this.deployment.fileContents && this.deployment.fileContents.length > 0) {
      // Filter to show only terraform-tfvars files as requested
      const tfvarsFiles = this.deployment.fileContents.filter(
        (file: FileContent) => file.type === 'terraform-tfvars',
      );
      files.push(...tfvarsFiles);
    }
    // Fallback: Check legacy generatedTerraformFiles structure
    else if (this.deployment.generatedTerraformFiles?.variablesMap) {
      files.push({
        id: 'terraform-tfvars-legacy',
        name: 'terraform.tfvars',
        type: 'terraform-tfvars',
        content: this.deployment.generatedTerraformFiles.variablesMap,
        language: 'hcl',
        isEditable: true,
        lastModified: new Date(),
      });
    }
    // Fallback 2: Check generatedTerraformTfvarsFileContent
    else if (this.deployment.generatedTerraformTfvarsFileContent) {
      console.log(
        '==========deployment tfvars',
        this.deployment?.generatedTerraformTfvarsFileContent,
      );
      files.push({
        id: 'terraform-tfvars-content',
        name: 'terraform.tfvars',
        type: 'terraform-tfvars',
        content: this.deployment.generatedTerraformTfvarsFileContent,
        language: 'hcl',
        isEditable: true,
        lastModified: new Date(),
      });
    }

    if (files.length > 0) {
      this.hasFiles.set(true);
      this.fileContents.set(files);
    } else {
      this.hasFiles.set(false);
      this.fileContents.set([]);
    }
  }

  /**
   * Handle file content changes from the editor
   */
  protected onFileContentChanged(event: { fileId: string; newContent: string }): void {
    // Update local file content
    this.fileContents.update((files) =>
      files.map((file: FileContent) =>
        file.id === event.fileId
          ? { ...file, content: event.newContent, lastModified: new Date() }
          : file,
      ),
    );

    // Emit event to parent component
    this.terraformContentChanged.emit(event);
  }

  /**
   * Handle file downloads from the editor
   */
  protected onFileDownloaded(event: { fileId: string; fileName: string; content: string }): void {
    this.terraformFileDownloaded.emit(event);
  }
}
