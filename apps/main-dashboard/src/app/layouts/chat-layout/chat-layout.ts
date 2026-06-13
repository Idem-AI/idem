import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ChatSidebarComponent } from '../../modules/chat/components/chat-sidebar/chat-sidebar';
import { ChatSessionService } from '../../modules/chat/services/chat-session.service';
import { ChatDeliverablesService } from '../../modules/chat/services/chat-deliverables.service';
import { UiModeService } from '../../shared/services/ui-mode.service';
import { NotificationService } from '../../shared/services/notification.service';

/**
 * Layout du mode Chat : sidebar à gauche (navigation, switch de mode),
 * header avec le nom du projet actif et les actions contextuelles
 * (tout exporter, passer en mode avancé), contenu conversationnel au centre.
 */
@Component({
  selector: 'app-chat-layout',
  standalone: true,
  imports: [CommonModule, TranslateModule, ChatSidebarComponent],
  templateUrl: './chat-layout.html',
  styleUrl: './chat-layout.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatLayoutComponent {
  protected readonly session = inject(ChatSessionService);
  private readonly deliverables = inject(ChatDeliverablesService);
  private readonly uiModeService = inject(UiModeService);
  private readonly notification = inject(NotificationService);
  private readonly translate = inject(TranslateService);

  protected readonly isMobileSidebarOpen = signal(false);
  protected readonly isExporting = signal(false);
  protected readonly isSidebarCollapsed = signal(this.readCollapsedState());

  private readCollapsedState(): boolean {
    try {
      return localStorage.getItem('chatSidebarCollapsed') === 'true';
    } catch {
      return false;
    }
  }

  protected toggleMobileSidebar(): void {
    this.isMobileSidebarOpen.update((open) => !open);
  }

  protected onSidebarCollapsedChange(collapsed: boolean): void {
    this.isSidebarCollapsed.set(collapsed);
  }

  protected switchToAdvanced(): void {
    const target = this.session.activeProjectId() ? '/project/dashboard' : '/console';
    this.uiModeService.switchToAdvanced(target);
  }

  /** Tout exporter : télécharge les PDF disponibles du projet actif. */
  protected async exportAll(): Promise<void> {
    const projectId = this.session.activeProjectId();
    if (!projectId || this.isExporting()) return;
    this.isExporting.set(true);
    this.notification.showInfo({
      title: this.translate.instant('chat.header.exportAll'),
      message: this.translate.instant('chat.export.started'),
    });
    try {
      const count = await this.deliverables.exportAll(
        projectId,
        this.session.activeProject()?.name,
      );
      if (count > 0) {
        this.notification.showSuccess({
          title: this.translate.instant('chat.header.exportAll'),
          message: this.translate.instant('chat.export.done', { count }),
        });
      } else {
        this.notification.showWarning({
          title: this.translate.instant('chat.header.exportAll'),
          message: this.translate.instant('chat.export.nothing'),
        });
      }
    } finally {
      this.isExporting.set(false);
    }
  }
}
