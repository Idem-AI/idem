import { Component, inject, output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { LogoImportService, LogoUploadProgress } from '../../../../services/logo-import.service';
import { Loader } from '../../../../../../shared/components/loader/loader';

/**
 * Component for importing an existing logo file.
 * Supports drag & drop, file input fallback, local preview,
 * upload with progress, and sanitized SVG display.
 */
@Component({
  selector: 'app-logo-import',
  standalone: true,
  imports: [CommonModule, TranslateModule, Loader],
  templateUrl: './logo-import.html',
  styleUrl: './logo-import.css',
})
export class LogoImportComponent {
  // Services
  private readonly logoImportService = inject(LogoImportService);
  // Outputs
  readonly svgImported = output<string>();
  readonly colorsExtracted = output<string[]>();

  // State
  protected readonly isDragOver = signal(false);
  protected readonly selectedFile = signal<File | null>(null);
  protected readonly localPreviewUrl = signal<string | null>(null);
  protected readonly uploadProgress = signal<number>(0);
  protected readonly isUploading = signal(false);
  protected readonly isProcessing = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly importedSvg = signal<string | null>(null);
  protected readonly importedWidth = signal<number>(0);
  protected readonly importedHeight = signal<number>(0);
  protected readonly extractedColors = signal<string[]>([]);

  // Computed
  protected readonly hasResult = computed(() => !!this.importedSvg());
  protected readonly canUpload = computed(() => !!this.selectedFile() && !this.isUploading());

  // --- Drag & Drop handlers ---

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(true);
  }

  protected onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFileSelection(files[0]);
    }
  }

  // --- File input handler ---

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFileSelection(input.files[0]);
    }
  }

  // --- Core logic ---

  private handleFileSelection(file: File): void {
    // Reset state
    this.errorMessage.set(null);
    this.importedSvg.set(null);
    this.uploadProgress.set(0);

    // Client-side validation
    const validationError = this.logoImportService.validateFile(file);
    if (validationError) {
      this.errorMessage.set(validationError);
      return;
    }

    this.selectedFile.set(file);

    // Generate local preview
    this.generateLocalPreview(file);
  }

  private generateLocalPreview(file: File): void {
    // Revoke previous URL if any
    const prev = this.localPreviewUrl();
    if (prev) {
      URL.revokeObjectURL(prev);
    }

    if (file.type === 'image/svg+xml') {
      // For SVG, read as text and create a blob URL
      const reader = new FileReader();
      reader.onload = () => {
        const blob = new Blob([reader.result as string], { type: 'image/svg+xml' });
        this.localPreviewUrl.set(URL.createObjectURL(blob));
      };
      reader.readAsText(file);
    } else {
      this.localPreviewUrl.set(URL.createObjectURL(file));
    }
  }

  /**
   * Upload the selected file to the API for processing
   */
  protected uploadFile(): void {
    const file = this.selectedFile();
    if (!file) return;

    this.isUploading.set(true);
    this.isProcessing.set(false);
    this.errorMessage.set(null);
    this.uploadProgress.set(0);

    this.logoImportService.uploadLogo(file).subscribe({
      next: (event: LogoUploadProgress) => {
        switch (event.type) {
          case 'progress':
            this.uploadProgress.set(event.progress || 0);
            // Once upload is done, server is processing
            if ((event.progress || 0) >= 100) {
              this.isProcessing.set(true);
            }
            break;

          case 'complete':
            this.isUploading.set(false);
            this.isProcessing.set(false);
            this.uploadProgress.set(100);

            if (event.result) {
              this.importedSvg.set(event.result.svg);
              this.importedWidth.set(event.result.width);
              this.importedHeight.set(event.result.height);
              this.extractedColors.set(event.result.extractedColors || []);
              // Emit the SVG and extracted colors to parent
              this.svgImported.emit(event.result.svg);
              this.colorsExtracted.emit(event.result.extractedColors || []);
            }
            break;

          case 'error':
            this.isUploading.set(false);
            this.isProcessing.set(false);
            this.errorMessage.set(event.error || 'Upload failed');
            break;
        }
      },
      error: (err) => {
        this.isUploading.set(false);
        this.isProcessing.set(false);
        this.errorMessage.set(err?.error?.error || err?.message || 'An unexpected error occurred');
      },
    });
  }

  /**
   * Reset the component to allow selecting a new file
   */
  protected reset(): void {
    const prev = this.localPreviewUrl();
    if (prev) {
      URL.revokeObjectURL(prev);
    }

    this.selectedFile.set(null);
    this.localPreviewUrl.set(null);
    this.importedSvg.set(null);
    this.uploadProgress.set(0);
    this.isUploading.set(false);
    this.isProcessing.set(false);
    this.errorMessage.set(null);
    this.importedWidth.set(0);
    this.importedHeight.set(0);
    this.extractedColors.set([]);
  }
}
