import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  computed,
  inject,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FileContent, FileContentConfig } from '../../../modules/dashboard/models/deployment.model';
import { TfVarsFormEditor } from '../tfvars-form-editor/tfvars-form-editor';
import { TfVarsParserService } from '../../services/tfvars-parser.service';
import { TfVarsFormData, TfVarsEditMode } from '../../models/tfvars-parser.model';

@Component({
  selector: 'app-file-content-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, TfVarsFormEditor],
  templateUrl: './file-content-editor.html',
  styleUrl: './file-content-editor.css',
})
export class FileContentEditor implements OnInit {
  private readonly tfVarsParser = inject(TfVarsParserService);

  ngOnInit(): void {
    if (this.fileContentsSignal().length > 0) {
      this.activeFileIdSignal.set(this.fileContentsSignal()[0].id);
    }
  }

  // Angular-specific properties
  @Input({ required: true }) set fileContents(value: FileContent[]) {
    this.fileContentsSignal.set(value || []);
  }

  @Input() set config(value: FileContentConfig | null) {
    this.configSignal.set(value || this.getDefaultConfig());
  }

  @Input() set activeFileId(value: string | null) {
    if (value && this.fileContentsSignal().some((f) => f.id === value)) {
      this.activeFileIdSignal.set(value);
    } else if (this.fileContentsSignal().length > 0) {
      // Auto-select first file if no valid activeFileId provided
      this.activeFileIdSignal.set(this.fileContentsSignal()[0].id);
    }
  }

  @Output() readonly fileContentChanged = new EventEmitter<{
    fileId: string;
    newContent: string;
  }>();

  @Output() readonly fileDownloaded = new EventEmitter<{
    fileId: string;
    fileName: string;
    content: string;
  }>();

  // Component state using signals
  protected readonly fileContentsSignal = signal<FileContent[]>([]);
  protected readonly configSignal = signal<FileContentConfig>(this.getDefaultConfig());
  protected readonly activeFileIdSignal = signal<string>('');
  protected readonly editingSignal = signal<boolean>(false);
  protected readonly editContentSignal = signal<string>('');
  protected readonly tfVarsEditModeSignal = signal<TfVarsEditMode>('code');
  protected readonly tfVarsFormDataSignal = signal<TfVarsFormData | null>(null);

  // Computed properties
  protected readonly activeFile = computed(() => {
    const files = this.fileContentsSignal();
    const activeId = this.activeFileIdSignal();
    return files.find((f) => f.id === activeId) || null;
  });

  protected readonly hasMultipleFiles = computed(() => {
    return this.fileContentsSignal().length > 1;
  });

  protected readonly canEdit = computed(() => {
    const file = this.activeFile();
    const config = this.configSignal();
    return file?.isEditable && config.enableEditing;
  });

  protected readonly canDownload = computed(() => {
    const config = this.configSignal();
    return config.enableDownload;
  });

  protected readonly isTfVarsFile = computed(() => {
    const file = this.activeFile();
    return file?.type === 'terraform-tfvars' || file?.name.endsWith('.tfvars');
  });

  protected readonly showModeToggle = computed(() => {
    return this.isTfVarsFile() && this.canEdit();
  });

  protected readonly currentEditMode = computed(() => {
    return this.isTfVarsFile() ? this.tfVarsEditModeSignal() : 'code';
  });

  protected readonly displayContent = computed(() => {
    const activeFile = this.activeFile();
    const isEditing = this.editingSignal();
    const editedContent = this.editContentSignal();

    if (!activeFile) return '';
    return isEditing ? editedContent : activeFile.content;
  });

  /**
   * Set active file by ID
   */
  protected setActiveFile(fileId: string): void {
    const file = this.fileContentsSignal().find((f) => f.id === fileId);
    if (file) {
      this.activeFileIdSignal.set(fileId);
      this.editingSignal.set(false);
      this.editContentSignal.set('');
      this.tfVarsFormDataSignal.set(null);
    }
  }

  /**
   * Start editing the active file
   */
  protected startEdit(): void {
    const activeFile = this.activeFile();
    if (activeFile) {
      this.editingSignal.set(true);
      this.editContentSignal.set(activeFile.content);

      // If it's a tfvars file, parse it for form mode
      if (this.isTfVarsFile()) {
        try {
          const parsed = this.tfVarsParser.parseTfVarsContent(activeFile.content);
          const formData = this.tfVarsParser.convertToFormData(parsed);
          this.tfVarsFormDataSignal.set(formData);
        } catch (error) {
          console.error('Error parsing tfvars content:', error);
          this.tfVarsFormDataSignal.set(null);
        }
      }
    }
  }

  /**
   * Save edited content
   */
  protected saveEdit(): void {
    const activeFile = this.activeFile();
    let newContent = this.editContentSignal();

    if (activeFile) {
      // If we're in form mode for tfvars, serialize form data back to content
      if (this.isTfVarsFile() && this.tfVarsEditModeSignal() === 'form') {
        const formData = this.tfVarsFormDataSignal();
        if (formData) {
          try {
            newContent = this.tfVarsParser.convertFormDataToTfVars(formData);
          } catch (error) {
            console.error('Error serializing form data:', error);
            return;
          }
        }
      }

      // Update the file content
      activeFile.content = newContent;

      // Emit change event
      this.fileContentChanged.emit({
        fileId: activeFile.id,
        newContent: newContent,
      });

      // Exit edit mode
      this.editingSignal.set(false);
      this.editContentSignal.set('');
      this.tfVarsFormDataSignal.set(null);
    }
  }

  /**
   * Cancel editing
   */
  protected cancelEdit(): void {
    this.editingSignal.set(false);
    this.editContentSignal.set('');
    this.tfVarsFormDataSignal.set(null);
  }

  /**
   * Switch between code and form editing modes for tfvars
   */
  protected switchEditMode(mode: TfVarsEditMode): void {
    if (!this.isTfVarsFile()) return;

    const currentMode = this.tfVarsEditModeSignal();
    if (currentMode === mode) return;

    try {
      if (mode === 'form') {
        // Switching from code to form - parse current content
        const content = this.editContentSignal();
        const parsed = this.tfVarsParser.parseTfVarsContent(content);
        const formData = this.tfVarsParser.convertToFormData(parsed);
        this.tfVarsFormDataSignal.set(formData);
      } else {
        // Switching from form to code - serialize form data
        const formData = this.tfVarsFormDataSignal();
        if (formData) {
          const content = this.tfVarsParser.convertFormDataToTfVars(formData);
          this.editContentSignal.set(content);
        }
      }

      this.tfVarsEditModeSignal.set(mode);
    } catch (error) {
      console.error('Error switching edit mode:', error);
      // Stay in current mode if there's an error
    }
  }

  /**
   * Handle form data changes from TfVarsFormEditor
   */
  protected onTfVarsFormDataChanged(formData: TfVarsFormData): void {
    this.tfVarsFormDataSignal.set(formData);

    // Also update the code content for consistency
    try {
      const content = this.tfVarsParser.convertFormDataToTfVars(formData);
      this.editContentSignal.set(content);
    } catch (error) {
      console.error('Error updating code content from form:', error);
    }
  }

  /**
   * Download file
   */
  protected downloadFile(): void {
    const activeFile = this.activeFile();
    if (activeFile) {
      const blob = new Blob([activeFile.content], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = activeFile.name;
      link.click();
      window.URL.revokeObjectURL(url);

      // Emit download event
      this.fileDownloaded.emit({
        fileId: activeFile.id,
        fileName: activeFile.name,
        content: activeFile.content,
      });
    }
  }

  /**
   * Get icon for file type
   */
  protected getFileTypeIcon(type: FileContent['type']): string {
    switch (type) {
      case 'terraform-main':
        return '';
      case 'terraform-variables':
        return '';
      case 'terraform-tfvars':
        return '';
      case 'docker-compose':
        return '';
      case 'kubernetes-yaml':
        return '';
      case 'config-json':
        return '';
      default:
        return '';
    }
  }

  /**
   * Get display label for language
   */
  protected getLanguageLabel(language: FileContent['language']): string {
    switch (language) {
      case 'hcl':
        return 'HCL';
      case 'yaml':
        return 'YAML';
      case 'json':
        return 'JSON';
      case 'dockerfile':
        return 'Dockerfile';
      default:
        return 'Text';
    }
  }

  /**
   * Get default configuration
   */
  protected getDefaultConfig(): FileContentConfig {
    return {
      showLineNumbers: true,
      enableSyntaxHighlighting: true,
      enableEditing: true,
      enableDownload: true,
      maxHeight: '500px',
      theme: 'dark',
    };
  }
}
