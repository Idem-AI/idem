import { Injectable, signal } from '@angular/core';

export type ToastTone = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
  /** Optional detail line, already translated. */
  detail?: string;
}

const DISMISS_AFTER_MS = 6000;

/** Transient, non-blocking feedback. Never used for anything the user must act on. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 0;
  private readonly items = signal<readonly Toast[]>([]);
  readonly toasts = this.items.asReadonly();

  show(tone: ToastTone, message: string, detail?: string): void {
    const toast: Toast = { id: this.nextId++, tone, message, detail };
    this.items.update((current) => [...current, toast]);
    setTimeout(() => this.dismiss(toast.id), DISMISS_AFTER_MS);
  }

  success(message: string, detail?: string): void {
    this.show('success', message, detail);
  }

  error(message: string, detail?: string): void {
    this.show('error', message, detail);
  }

  dismiss(id: number): void {
    this.items.update((current) => current.filter((toast) => toast.id !== id));
  }
}
