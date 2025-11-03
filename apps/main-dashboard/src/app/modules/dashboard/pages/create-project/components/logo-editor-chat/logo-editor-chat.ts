import { Component, input, output, signal, computed, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SafeHtmlPipe } from '../../../projects-list/safehtml.pipe';
import { LogoModel } from '../../../../models/logo.model';
import { BrandingService } from '../../../../services/ai-agents/branding.service';
import { Subject, takeUntil } from 'rxjs';

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'logo';
  content: string;
  logo?: LogoModel;
  timestamp: Date;
}

@Component({
  selector: 'app-logo-editor-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, SafeHtmlPipe],
  templateUrl: './logo-editor-chat.html',
  styleUrl: './logo-editor-chat.css',
})
export class LogoEditorChat implements OnDestroy {
  private readonly brandingService = inject(BrandingService);
  private readonly destroy$ = new Subject<void>();

  // Inputs
  readonly projectId = input.required<string>();
  readonly initialLogo = input.required<LogoModel>();

  // Outputs
  readonly logoSelected = output<LogoModel>();
  readonly closed = output<void>();

  // State
  protected readonly messages = signal<ChatMessage[]>([]);
  protected readonly userPrompt = signal('');
  protected readonly isEditing = signal(false);
  protected readonly error = signal<string | null>(null);

  // Computed
  protected readonly canSend = computed(() => {
    return this.userPrompt().trim().length > 0 && !this.isEditing();
  });

  ngOnInit(): void {
    // Add initial logo to chat
    const initialLogo = this.initialLogo();
    this.messages.set([
      {
        id: 'initial',
        type: 'assistant',
        content: 'Here is your selected logo. You can ask me to modify it!',
        timestamp: new Date(),
      },
      {
        id: 'logo-initial',
        type: 'logo',
        content: '',
        logo: initialLogo,
        timestamp: new Date(),
      },
      {
        id: 'welcome',
        type: 'assistant',
        content:
          'Tell me what changes you\'d like to make. For example: "Make it more modern", "Change the colors to blue", "Add a gradient effect", etc.',
        timestamp: new Date(),
      },
    ]);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected sendMessage(): void {
    const prompt = this.userPrompt().trim();
    if (!prompt || this.isEditing()) {
      return;
    }

    // Add user message
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: prompt,
      timestamp: new Date(),
    };
    this.messages.update((msgs) => [...msgs, userMessage]);

    // Clear input
    this.userPrompt.set('');

    // Get the last logo from messages
    const lastLogoMessage = [...this.messages()]
      .reverse()
      .find((msg) => msg.type === 'logo' && msg.logo);

    if (!lastLogoMessage || !lastLogoMessage.logo) {
      this.error.set('No logo found to edit');
      return;
    }

    // Start editing
    this.isEditing.set(true);
    this.error.set(null);

    // Add loading message
    const loadingMessage: ChatMessage = {
      id: `loading-${Date.now()}`,
      type: 'assistant',
      content: 'Working on your modifications...',
      timestamp: new Date(),
    };
    this.messages.update((msgs) => [...msgs, loadingMessage]);

    // Call API
    this.brandingService
      .editLogo(this.projectId(), lastLogoMessage.logo.svg, prompt)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          // Remove loading message
          this.messages.update((msgs) => msgs.filter((msg) => msg.id !== loadingMessage.id));

          // Add success message
          const successMessage: ChatMessage = {
            id: `assistant-${Date.now()}`,
            type: 'assistant',
            content: 'Here is your modified logo!',
            timestamp: new Date(),
          };

          // Add new logo
          const logoMessage: ChatMessage = {
            id: `logo-${Date.now()}`,
            type: 'logo',
            content: '',
            logo: response.logo,
            timestamp: new Date(),
          };

          this.messages.update((msgs) => [...msgs, successMessage, logoMessage]);
          this.isEditing.set(false);
        },
        error: (error) => {
          console.error('Error editing logo:', error);

          // Remove loading message
          this.messages.update((msgs) => msgs.filter((msg) => msg.id !== loadingMessage.id));

          // Add error message
          const errorMessage: ChatMessage = {
            id: `error-${Date.now()}`,
            type: 'assistant',
            content:
              'Sorry, I encountered an error while modifying the logo. Please try again with a different prompt.',
            timestamp: new Date(),
          };
          this.messages.update((msgs) => [...msgs, errorMessage]);

          this.isEditing.set(false);
          this.error.set('Failed to edit logo');
        },
      });
  }

  protected selectLogo(logo: LogoModel): void {
    this.logoSelected.emit(logo);
    this.close();
  }

  protected close(): void {
    this.closed.emit();
  }

  protected handleKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }
}
