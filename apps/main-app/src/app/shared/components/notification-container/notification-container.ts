import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService, Notification } from '../../services/notification.service';
import { trigger, transition, style, animate } from '@angular/animations';

@Component({
  selector: 'app-notification-container',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('slideInOut', [
      transition(':enter', [
        style({ transform: 'translateX(100%)', opacity: 0 }),
        animate('300ms ease-out', style({ transform: 'translateX(0)', opacity: 1 }))
      ]),
      transition(':leave', [
        animate('300ms ease-in', style({ transform: 'translateX(100%)', opacity: 0 }))
      ])
    ])
  ],
  template: `
    <div class="fixed top-4 right-4 z-[9999] space-y-3 max-w-sm">
      @for (notification of notifications(); track notification.id) {
        <div 
          [@slideInOut]
          class="notification-item rounded-lg shadow-lg border backdrop-blur-sm p-4 cursor-pointer"
          [class]="getNotificationClasses(notification)"
          (click)="onNotificationClick(notification)"
        >
          <!-- Header avec icône et titre -->
          <div class="flex items-start justify-between">
            <div class="flex items-center">
              <div class="flex-shrink-0 mr-3">
                <svg class="w-5 h-5" [class]="getIconClasses(notification)" fill="currentColor" viewBox="0 0 20 20">
                  @switch (notification.type) {
                    @case ('success') {
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                    }
                    @case ('error') {
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
                    }
                    @case ('warning') {
                      <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                    }
                    @default {
                      <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path>
                    }
                  }
                </svg>
              </div>
              
              <div class="flex-1">
                <h4 class="text-sm font-medium" [class]="getTitleClasses(notification)">
                  {{ notification.title }}
                </h4>
                <p class="text-sm mt-1" [class]="getMessageClasses(notification)">
                  {{ notification.message }}
                </p>
              </div>
            </div>
            
            <!-- Bouton fermer -->
            <button 
              (click)="closeNotification($event, notification.id)"
              class="flex-shrink-0 ml-2 p-1 rounded-full hover:bg-black/10 transition-colors"
              [class]="getCloseButtonClasses(notification)"
            >
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
              </svg>
            </button>
          </div>
          
          <!-- Actions -->
          @if (notification.actions && notification.actions.length > 0) {
            <div class="mt-3 flex space-x-2">
              @for (action of notification.actions; track action.label) {
                <button 
                  (click)="executeAction($event, action.action)"
                  class="text-xs px-3 py-1 rounded-full font-medium transition-colors"
                  [class]="getActionButtonClasses(notification)"
                >
                  {{ action.label }}
                </button>
              }
            </div>
          }
        </div>
      }
    </div>
  `
})
export class NotificationContainerComponent {
  private readonly notificationService = inject(NotificationService);

  protected readonly notifications = this.notificationService.notifications;

  protected closeNotification(event: Event, id: string): void {
    event.stopPropagation();
    this.notificationService.removeNotification(id);
  }

  protected onNotificationClick(notification: Notification): void {
    // Optionnel: action au clic sur la notification
  }

  protected executeAction(event: Event, action: () => void): void {
    event.stopPropagation();
    action();
  }

  protected getNotificationClasses(notification: Notification): string {
    const baseClasses = 'border-l-4';
    
    switch (notification.type) {
      case 'success':
        return `${baseClasses} bg-green-50/90 border-green-500 border-green-200`;
      case 'error':
        return `${baseClasses} bg-red-50/90 border-red-500 border-red-200`;
      case 'warning':
        return `${baseClasses} bg-yellow-50/90 border-yellow-500 border-yellow-200`;
      default:
        return `${baseClasses} bg-blue-50/90 border-blue-500 border-blue-200`;
    }
  }

  protected getIconClasses(notification: Notification): string {
    switch (notification.type) {
      case 'success':
        return 'text-green-500';
      case 'error':
        return 'text-red-500';
      case 'warning':
        return 'text-yellow-500';
      default:
        return 'text-blue-500';
    }
  }

  protected getTitleClasses(notification: Notification): string {
    switch (notification.type) {
      case 'success':
        return 'text-green-800';
      case 'error':
        return 'text-red-800';
      case 'warning':
        return 'text-yellow-800';
      default:
        return 'text-blue-800';
    }
  }

  protected getMessageClasses(notification: Notification): string {
    switch (notification.type) {
      case 'success':
        return 'text-green-700';
      case 'error':
        return 'text-red-700';
      case 'warning':
        return 'text-yellow-700';
      default:
        return 'text-blue-700';
    }
  }

  protected getCloseButtonClasses(notification: Notification): string {
    switch (notification.type) {
      case 'success':
        return 'text-green-500 hover:text-green-700';
      case 'error':
        return 'text-red-500 hover:text-red-700';
      case 'warning':
        return 'text-yellow-500 hover:text-yellow-700';
      default:
        return 'text-blue-500 hover:text-blue-700';
    }
  }

  protected getActionButtonClasses(notification: Notification): string {
    switch (notification.type) {
      case 'success':
        return 'bg-green-100 text-green-800 hover:bg-green-200';
      case 'error':
        return 'bg-red-100 text-red-800 hover:bg-red-200';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200';
      default:
        return 'bg-blue-100 text-blue-800 hover:bg-blue-200';
    }
  }
}
