import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../auth/services/auth.service';
import { ChatSessionService } from '../../services/chat-session.service';
import { ModeToggleComponent } from '../mode-toggle/mode-toggle';
import { BetaBadgeComponent } from '../../../../shared/components/beta-badge/beta-badge';
import { LanguageSelectorComponent } from '../../../../shared/components/language-selector/language-selector';

/**
 * Sidebar du mode Chat, inspirée de Claude.ai : nouveau projet en haut,
 * liste des projets comme des conversations, switch de mode toujours visible
 * en bas.
 */
@Component({
  selector: 'app-chat-sidebar',
  standalone: true,
  imports: [CommonModule, TranslateModule, ModeToggleComponent, BetaBadgeComponent, LanguageSelectorComponent],
  templateUrl: './chat-sidebar.html',
  styleUrl: './chat-sidebar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatSidebarComponent {
  protected readonly session = inject(ChatSessionService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly mobileOpen = input<boolean>(false);
  readonly closeMobile = output<void>();

  protected readonly user = toSignal(this.auth.user$);

  protected newProject(): void {
    this.closeMobile.emit();
    this.router.navigate(['/chat/new']);
  }

  protected selectProject(projectId: string | undefined): void {
    if (!projectId) return;
    this.session.selectProject(projectId);
    this.closeMobile.emit();
    this.router.navigate(['/chat']);
  }

  protected async logout(): Promise<void> {
    try {
      await firstValueFrom(this.auth.logout());
    } catch (error) {
      console.error('Chat sidebar: logout error', error);
    } finally {
      this.router.navigate(['/login']);
    }
  }
}
