import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CookieService } from '../../../../shared/services/cookie.service';
import { Loader } from '../../../../shared/components/loader/loader';
import { AdvisorService } from '../../services/ai-agents/advisor.service';
import { AdvisorMessage } from '../../models/advisor.model';

const SUGGESTED_PROMPTS_FR = [
  'Analyse mon projet et dis-moi ce qu’il manque pour démarrer sérieusement.',
  'Quelle forme juridique me conseilles-tu pour mon projet ?',
  'Quelles sont les étapes administratives pour créer mon entreprise ?',
  'Quels sont les financements possibles pour une startup en Afrique subsaharienne ?',
];

@Component({
  selector: 'app-advisor',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, Loader],
  templateUrl: './advisor.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdvisorPage implements OnInit, AfterViewChecked {
  private readonly advisorService = inject(AdvisorService);
  private readonly cookieService = inject(CookieService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);

  @ViewChild('scrollAnchor') private scrollAnchor?: ElementRef<HTMLDivElement>;

  protected readonly projectId = signal<string | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly messages = signal<AdvisorMessage[]>([]);
  protected readonly pendingAssistant = signal(false);
  protected readonly draft = signal('');
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly suggestions = SUGGESTED_PROMPTS_FR;

  protected readonly isEmpty = computed(() => this.messages().length === 0);

  ngOnInit(): void {
    const pid = this.cookieService.get('projectId');
    this.projectId.set(pid);
    if (!pid) {
      this.isLoading.set(false);
      return;
    }
    this.loadConversation(pid);
  }

  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }

  private loadConversation(projectId: string): void {
    this.isLoading.set(true);
    this.advisorService
      .getConversation(projectId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (conv) => {
          this.messages.set(conv?.messages || []);
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false),
      });
  }

  protected useSuggestion(suggestion: string): void {
    this.draft.set(suggestion);
  }

  protected updateDraft(value: string): void {
    this.draft.set(value);
  }

  protected send(): void {
    const pid = this.projectId();
    const content = this.draft().trim();
    if (!pid || !content || this.pendingAssistant()) return;

    // Optimistic user message
    const optimistic: AdvisorMessage = {
      id: `local-${Date.now()}`,
      role: 'user',
      content,
      createdAt: new Date(),
    };
    this.messages.update((msgs) => [...msgs, optimistic]);
    this.draft.set('');
    this.pendingAssistant.set(true);
    this.errorMessage.set(null);

    this.advisorService
      .sendMessage(pid, content)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.messages.update((msgs) => {
            const filtered = msgs.filter((m) => m.id !== optimistic.id);
            return [...filtered, result.userMessage, result.assistantMessage];
          });
          this.pendingAssistant.set(false);
        },
        error: (err) => {
          console.error('Advisor send error:', err);
          this.errorMessage.set(
            this.translate.instant('dashboard.advisor.errors.send'),
          );
          this.pendingAssistant.set(false);
          // Remove optimistic message on error
          this.messages.update((msgs) => msgs.filter((m) => m.id !== optimistic.id));
          // Restore draft so user can retry
          this.draft.set(content);
        },
      });
  }

  protected clearConversation(): void {
    const pid = this.projectId();
    if (!pid) return;
    this.advisorService
      .clearConversation(pid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.messages.set([]),
      });
  }

  protected handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  private scrollToBottom(): void {
    if (!this.scrollAnchor) return;
    this.scrollAnchor.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }
}
