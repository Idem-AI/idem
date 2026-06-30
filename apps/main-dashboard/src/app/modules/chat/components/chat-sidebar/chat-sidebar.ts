import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../auth/services/auth.service';
import { ChatSessionService } from '../../services/chat-session.service';
import { ChatConversationStoreService } from '../../services/chat-conversation-store.service';
import {
  CATEGORY_ICONS,
  CATEGORY_ORDER,
} from '../../services/chat-categorizer.service';
import { ChatConversationCategory, ChatConversationMeta } from '../../models/chat.model';
import { ModeToggleComponent } from '../mode-toggle/mode-toggle';
import { BetaBadgeComponent } from '../../../../shared/components/beta-badge/beta-badge';
import { LanguageSelectorComponent } from '../../../../shared/components/language-selector/language-selector';

const COLLAPSED_STORAGE_KEY = 'chatSidebarCollapsed';

interface ConversationGroup {
  category: ChatConversationCategory;
  icon: string;
  conversations: ChatConversationMeta[];
}

/**
 * Sidebar du mode Chat, inspirée de Claude.ai : nouvelle conversation en haut,
 * conversations du projet courant rangées par catégorie (Business, Marketing,
 * Finances…), sidebar repliable, switch de mode toujours visible en bas.
 */
@Component({
  selector: 'app-chat-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ModeToggleComponent,
    BetaBadgeComponent,
    LanguageSelectorComponent,
  ],
  templateUrl: './chat-sidebar.html',
  styleUrl: './chat-sidebar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatSidebarComponent {
  protected readonly session = inject(ChatSessionService);
  protected readonly store = inject(ChatConversationStoreService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly mobileOpen = input<boolean>(false);
  readonly closeMobile = output<void>();
  readonly collapsedChange = output<boolean>();

  protected readonly collapsed = signal(this.readCollapsedState());
  protected readonly isProjectSelectorOpen = signal(false);
  protected readonly user = toSignal(this.auth.user$);

  /** Conversations du projet courant, rangées par catégorie */
  protected readonly groupedConversations = computed<ConversationGroup[]>(() => {
    const conversations = this.store.conversations();
    return CATEGORY_ORDER.map((category) => ({
      category,
      icon: CATEGORY_ICONS[category],
      conversations: conversations
        .filter((c) => c.category === category)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    })).filter((group) => group.conversations.length > 0);
  });

  private readCollapsedState(): boolean {
    try {
      return localStorage.getItem(COLLAPSED_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  }

  protected toggleCollapsed(): void {
    this.collapsed.update((value) => !value);
    try {
      localStorage.setItem(COLLAPSED_STORAGE_KEY, String(this.collapsed()));
    } catch {
      // ignore
    }
    this.collapsedChange.emit(this.collapsed());
  }

  protected toggleProjectSelector(): void {
    this.isProjectSelectorOpen.update((open) => !open);
  }

  protected newConversation(): void {
    if (this.store.busy()) return;
    this.store.createConversation();
    this.closeMobile.emit();
    this.router.navigate(['/chat']);
  }

  protected selectConversation(conversationId: string): void {
    if (this.store.busy()) return;
    this.store.selectConversation(conversationId);
    this.closeMobile.emit();
    this.router.navigate(['/chat']);
  }

  protected deleteConversation(event: Event, conversationId: string): void {
    event.stopPropagation();
    if (this.store.busy()) return;
    this.store.deleteConversation(conversationId);
  }

  protected selectProject(projectId: string | undefined): void {
    if (!projectId || this.store.busy()) return;
    this.session.selectProject(projectId);
    this.isProjectSelectorOpen.set(false);
    this.closeMobile.emit();
    this.router.navigate(['/chat']);
  }

  protected newProject(): void {
    this.isProjectSelectorOpen.set(false);
    this.closeMobile.emit();
    this.router.navigate(['/create-project']);
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

  @HostListener('document:click', ['$event.target'])
  protected onClickOutside(target: HTMLElement): void {
    if (this.isProjectSelectorOpen() && !target.closest('.chat-project-selector')) {
      this.isProjectSelectorOpen.set(false);
    }
  }
}
