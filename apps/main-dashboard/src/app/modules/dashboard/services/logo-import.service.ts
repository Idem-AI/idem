import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpEvent, HttpEventType, HttpRequest } from '@angular/common/http';
import { Observable, map, filter } from 'rxjs';
import { environment } from '../../../../environments/environment';

/**
 * Response from the logo import API
 */
export interface LogoImportResponse {
  success: boolean;
  svg: string;
  width: number;
  height: number;
  extractedColors: string[];
  error?: string;
}

/**
 * Upload progress tracking
 */
export interface LogoUploadProgress {
  type: 'progress' | 'complete' | 'error';
  progress?: number;
  result?: LogoImportResponse;
  error?: string;
}

/**
 * Service for importing and vectorizing logos via the API.
 * Handles file upload with progress tracking and SVG-to-PNG export.
 */
@Injectable({
  providedIn: 'root',
})
export class LogoImportService {
  private readonly apiUrl = `${environment.services.api.url}/api/logo`;
  private readonly http = inject(HttpClient);

  /**
   * Accepted file types for logo import
   */
  static readonly ACCEPTED_TYPES = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp'];

  /**
   * Maximum file size in bytes (10MB)
   */
  static readonly MAX_FILE_SIZE = 10 * 1024 * 1024;

  /**
   * Upload a logo file with progress tracking.
   * The API will detect the file type, optimize SVGs, or vectorize raster images.
   */
  uploadLogo(file: File): Observable<LogoUploadProgress> {
    const formData = new FormData();
    formData.append('logo', file, file.name);

    const req = new HttpRequest('POST', `${this.apiUrl}/import`, formData, {
      reportProgress: true,
      withCredentials: true,
    });

    return this.http.request(req).pipe(
      filter((event: HttpEvent<any>) => {
        return event.type === HttpEventType.UploadProgress || event.type === HttpEventType.Response;
      }),
      map((event: HttpEvent<any>) => {
        if (event.type === HttpEventType.UploadProgress) {
          const progress = event.total ? Math.round((100 * event.loaded) / event.total) : 0;
          return { type: 'progress' as const, progress };
        }

        // HttpEventType.Response
        const body = (event as any).body as LogoImportResponse;
        if (body && body.success) {
          return { type: 'complete' as const, result: body };
        }

        return {
          type: 'error' as const,
          error: body?.error || 'Unknown error during logo processing',
        };
      }),
    );
  }

  /**
   * Export an SVG string as a PNG image (returns a Blob).
   */
  exportAsPng(svg: string, width?: number, height?: number): Observable<Blob> {
    return this.http.post(
      `${this.apiUrl}/export/png`,
      { svg, width, height },
      {
        responseType: 'blob',
        withCredentials: true,
      },
    );
  }

  /**
   * Validates a file before upload (client-side checks).
   * Returns null if valid, or an error message string.
   */
  validateFile(file: File): string | null {
    if (!file) {
      return 'No file selected';
    }

    if (file.size === 0) {
      return 'File is empty';
    }

    if (file.size > LogoImportService.MAX_FILE_SIZE) {
      return `File size exceeds ${LogoImportService.MAX_FILE_SIZE / (1024 * 1024)}MB limit`;
    }

    // Check extension as a basic client-side validation (server does real MIME check)
    const validExtensions = ['.svg', '.png', '.jpg', '.jpeg', '.webp'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!validExtensions.includes(ext)) {
      return `Unsupported file format. Accepted: SVG, PNG, JPG, WebP`;
    }

    return null;
  }
}
