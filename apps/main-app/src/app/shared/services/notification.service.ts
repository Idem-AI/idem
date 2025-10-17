import { Injectable, signal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface NotificationAction {
  label: string;
  action: () => void;
}

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
  actions?: NotificationAction[];
  timestamp: Date;
}

export interface NotificationOptions {
  title: string;
  message: string;
  duration?: number;
  actions?: NotificationAction[];
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private readonly notifications$ = new BehaviorSubject<Notification[]>([]);
  public readonly notifications = signal<Notification[]>([]);

  constructor() {
    this.notifications$.subscribe(notifications => {
      this.notifications.set(notifications);
    });
  }

  private addNotification(notification: Notification): void {
    const current = this.notifications$.value;
    this.notifications$.next([...current, notification]);

    // Auto-remove après la durée spécifiée
    if (notification.duration && notification.duration > 0) {
      setTimeout(() => {
        this.removeNotification(notification.id);
      }, notification.duration);
    }
  }

  public removeNotification(id: string): void {
    const current = this.notifications$.value;
    const filtered = current.filter(n => n.id !== id);
    this.notifications$.next(filtered);
  }

  public clearAll(): void {
    this.notifications$.next([]);
  }

  public showSuccess(options: NotificationOptions): string {
    const id = this.generateId();
    const notification: Notification = {
      id,
      type: 'success',
      timestamp: new Date(),
      duration: options.duration || 3000,
      ...options
    };
    
    this.addNotification(notification);
    return id;
  }

  public showError(options: NotificationOptions): string {
    const id = this.generateId();
    const notification: Notification = {
      id,
      type: 'error',
      timestamp: new Date(),
      duration: options.duration || 5000,
      ...options
    };
    
    this.addNotification(notification);
    return id;
  }

  public showWarning(options: NotificationOptions): string {
    const id = this.generateId();
    const notification: Notification = {
      id,
      type: 'warning',
      timestamp: new Date(),
      duration: options.duration || 4000,
      ...options
    };
    
    this.addNotification(notification);
    return id;
  }

  public showInfo(options: NotificationOptions): string {
    const id = this.generateId();
    const notification: Notification = {
      id,
      type: 'info',
      timestamp: new Date(),
      duration: options.duration || 3000,
      ...options
    };
    
    this.addNotification(notification);
    return id;
  }

  private generateId(): string {
    return `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
