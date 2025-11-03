import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Configure PDF.js worker for ngx-extended-pdf-viewer
declare const window: any;
if (typeof window !== 'undefined') {
  (window as any).pdfWorkerSrc = '/assets/pdf.worker.min.js';
}

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
