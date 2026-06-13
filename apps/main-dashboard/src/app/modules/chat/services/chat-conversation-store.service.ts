import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AdvisorService } from '../../dashboard/services/ai-agents/advisor.service';
import { ChatConversationMeta, ChatMessageModel } from '../models/chat.model';
import { ChatCategorizerService } from './chat-categorizer.service';

const INDEX_PREFIX = 'idem_chat_convs_';
const MESSAGES_PREFIX = 'idem_chat_conv_';
const MAX_PERSISTED_MESSAGES = 60;
const MAX_TITLE_LENGTH = 48;

let conversationCounter = 0;

/**
 * Conversations du mode Chat : plusieurs conversations par projet, rangées
 * par catégorie (titre et catégorie dérivés du premier message utilisateur).
 *
 * Stockage localStorage :
 * - `idem_chat_convs_<projectId>`            → index (ChatConversationMeta[])
 * - `idem_chat_conv_<projectId>_<convId>`    → messages d'une conversation
 *
 * L'ancien format mono-conversation (`idem_chat_conv_<projectId>`) est migré
 * automatiquement. Les échanges libres avec l'IA passent toujours par la
 * conversation Advisor (côté serveur, une par projet) — au premier chargement
 * d'un projet, son historique est importé dans la première conversation.
 */
@Injectable({ providedIn: 'root' })
export class ChatConversationStoreService {
  private readonly advisorService = inject(AdvisorService);
  private readonly categorizer = inject(ChatCategorizerService);

  readonly conversations = signal<ChatConversationMeta[]>([]);
  readonly activeConversationId = signal<string | null>(null);
  readonly messages = signal<ChatMessageModel[]>([]);
  readonly isLoading = signal(false);
  /** Réponse IA / persistance en cours : la sidebar gèle les changements de conversation */
  readonly busy = signal(false);

  private currentProjectId: string | null = null;

  // ─────────────────────────────────────────────── Clés de stockage

  private indexKey(projectId: string): string {
    return `${INDEX_PREFIX}${projectId}`;
  }

  private messagesKey(projectId: string, conversationId: string): string {
    return `${MESSAGES_PREFIX}${projectId}_${conversationId}`;
  }

  private legacyKey(projectId: string): string {
    return `${MESSAGES_PREFIX}${projectId}`;
  }

  // ─────────────────────────────────────────────── Chargement

  async load(projectId: string): Promise<void> {
    this.currentProjectId = projectId;
    this.isLoading.set(true);
    try {
      this.migrateLegacyConversation(projectId);
      let index = this.readIndex(projectId);

      if (index.length === 0) {
        // Première visite en mode Chat : importe l'historique Advisor
        const imported = await this.importAdvisorHistory(projectId);
        const meta = this.newMeta();
        const firstUser = imported.find((m) => m.role === 'user');
        if (firstUser) {
          meta.title = this.makeTitle(firstUser.content);
          meta.category = this.categorizer.categorize(firstUser.content);
        }
        index = [meta];
        this.writeIndex(projectId, index);
        this.writeMessages(projectId, meta.id, imported);
      }

      this.conversations.set(index);
      const mostRecent = [...index].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      )[0];
      this.activeConversationId.set(mostRecent.id);
      this.messages.set(this.readMessages(projectId, mostRecent.id));
    } finally {
      this.isLoading.set(false);
    }
  }

  /** Migre l'ancien format mono-conversation vers l'index multi-conversations. */
  private migrateLegacyConversation(projectId: string): void {
    try {
      const raw = localStorage.getItem(this.legacyKey(projectId));
      if (!raw) return;
      const messages = JSON.parse(raw);
      if (Array.isArray(messages) && messages.length > 0) {
        const meta = this.newMeta();
        const firstUser = (messages as ChatMessageModel[]).find((m) => m.role === 'user');
        if (firstUser) {
          meta.title = this.makeTitle(firstUser.content);
          meta.category = this.categorizer.categorize(firstUser.content);
        }
        const index = [meta, ...this.readIndex(projectId)];
        this.writeIndex(projectId, index);
        this.writeMessages(projectId, meta.id, messages as ChatMessageModel[]);
      }
      localStorage.removeItem(this.legacyKey(projectId));
    } catch {
      // Migration best effort : en cas d'échec on repart d'un index vide
    }
  }

  private async importAdvisorHistory(projectId: string): Promise<ChatMessageModel[]> {
    try {
      const conversation = await firstValueFrom(this.advisorService.getConversation(projectId));
      return (conversation?.messages ?? [])
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          createdAt: new Date(m.createdAt).toISOString(),
        }));
    } catch {
      return [];
    }
  }

  // ─────────────────────────────────────────────── Gestion des conversations

  private newMeta(): ChatConversationMeta {
    conversationCounter += 1;
    const now = new Date().toISOString();
    return {
      id: `conv-${Date.now()}-${conversationCounter}`,
      title: '',
      category: 'general',
      createdAt: now,
      updatedAt: now,
    };
  }

  /** Crée une nouvelle conversation vide pour le projet courant et l'active. */
  createConversation(): string | null {
    const projectId = this.currentProjectId;
    if (!projectId) return null;

    // Réutilise une conversation encore vierge plutôt que d'en empiler
    const existing = this.readIndex(projectId);
    const blank = existing.find(
      (c) => !c.title && this.readMessages(projectId, c.id).length === 0,
    );
    if (blank) {
      this.activeConversationId.set(blank.id);
      this.messages.set([]);
      return blank.id;
    }

    const meta = this.newMeta();
    const index = [meta, ...existing];
    this.writeIndex(projectId, index);
    this.writeMessages(projectId, meta.id, []);
    this.conversations.set(index);
    this.activeConversationId.set(meta.id);
    this.messages.set([]);
    return meta.id;
  }

  selectConversation(conversationId: string): void {
    const projectId = this.currentProjectId;
    if (!projectId || this.activeConversationId() === conversationId) return;
    this.activeConversationId.set(conversationId);
    this.messages.set(this.readMessages(projectId, conversationId));
  }

  deleteConversation(conversationId: string): void {
    const projectId = this.currentProjectId;
    if (!projectId) return;
    const index = this.readIndex(projectId).filter((c) => c.id !== conversationId);
    this.writeIndex(projectId, index);
    try {
      localStorage.removeItem(this.messagesKey(projectId, conversationId));
    } catch {
      // ignore
    }
    this.conversations.set(index);

    if (this.activeConversationId() === conversationId) {
      const next = [...index].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      )[0];
      if (next) {
        this.activeConversationId.set(next.id);
        this.messages.set(this.readMessages(projectId, next.id));
      } else {
        this.createConversation();
      }
    }
  }

  // ─────────────────────────────────────────────── Messages

  append(message: ChatMessageModel): void {
    this.messages.update((msgs) => [...msgs, message]);
    const projectId = this.currentProjectId;
    const conversationId = this.activeConversationId();
    if (!projectId || !conversationId) return;
    this.persistMessages(projectId, conversationId);
    this.touchMeta(projectId, conversationId, message);
  }

  /** Met à jour un message existant (ex. figer une carte de sélection). */
  patch(messageId: string, patch: Partial<ChatMessageModel>): void {
    this.messages.update((msgs) =>
      msgs.map((m) => (m.id === messageId ? { ...m, ...patch } : m)),
    );
    const projectId = this.currentProjectId;
    const conversationId = this.activeConversationId();
    if (!projectId || !conversationId) return;
    this.persistMessages(projectId, conversationId);
  }

  remove(messageId: string): void {
    this.messages.update((msgs) => msgs.filter((m) => m.id !== messageId));
    const projectId = this.currentProjectId;
    const conversationId = this.activeConversationId();
    if (!projectId || !conversationId) return;
    this.persistMessages(projectId, conversationId);
  }

  /** Vide la conversation active (les autres conversations sont intactes). */
  clear(): void {
    this.messages.set([]);
    const projectId = this.currentProjectId;
    const conversationId = this.activeConversationId();
    if (!projectId || !conversationId) return;
    this.persistMessages(projectId, conversationId);
  }

  /** Remplace le fil affiché sans persistance (utilisé par l'onboarding). */
  setTransient(messages: ChatMessageModel[]): void {
    this.currentProjectId = null;
    this.activeConversationId.set(null);
    this.conversations.set([]);
    this.messages.set(messages);
  }

  appendTransient(message: ChatMessageModel): void {
    this.messages.update((msgs) => [...msgs, message]);
  }

  // ─────────────────────────────────────────────── Persistance

  /** Titre + catégorie au premier message utilisateur, recatégorisation si 'general'. */
  private touchMeta(
    projectId: string,
    conversationId: string,
    message: ChatMessageModel,
  ): void {
    const index = this.readIndex(projectId);
    const meta = index.find((c) => c.id === conversationId);
    if (!meta) return;

    meta.updatedAt = new Date().toISOString();
    if (message.role === 'user' && message.content) {
      if (!meta.title) {
        meta.title = this.makeTitle(message.content);
        meta.category = this.categorizer.categorize(message.content);
      } else if (meta.category === 'general') {
        const category = this.categorizer.categorize(message.content);
        if (category !== 'general') meta.category = category;
      }
    }
    this.writeIndex(projectId, index);
    this.conversations.set(index);
  }

  private makeTitle(text: string): string {
    const compact = text.replace(/\s+/g, ' ').trim();
    return compact.length > MAX_TITLE_LENGTH
      ? `${compact.slice(0, MAX_TITLE_LENGTH).trimEnd()}…`
      : compact;
  }

  private readIndex(projectId: string): ChatConversationMeta[] {
    try {
      const raw = localStorage.getItem(this.indexKey(projectId));
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as ChatConversationMeta[]) : [];
    } catch {
      return [];
    }
  }

  private writeIndex(projectId: string, index: ChatConversationMeta[]): void {
    try {
      localStorage.setItem(this.indexKey(projectId), JSON.stringify(index));
    } catch {
      // ignore
    }
  }

  private readMessages(projectId: string, conversationId: string): ChatMessageModel[] {
    try {
      const raw = localStorage.getItem(this.messagesKey(projectId, conversationId));
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as ChatMessageModel[]) : [];
    } catch {
      return [];
    }
  }

  private writeMessages(
    projectId: string,
    conversationId: string,
    messages: ChatMessageModel[],
  ): void {
    try {
      const toStore = messages
        .slice(-MAX_PERSISTED_MESSAGES)
        // Les SVG des concepts de logos sont trop lourds pour localStorage :
        // la carte n'est pas restaurée au rechargement (le flux branding est
        // reprenable à tout moment depuis l'état du projet).
        .map((m) => (m.logoOptions ? { ...m, logoOptions: undefined } : m));
      localStorage.setItem(this.messagesKey(projectId, conversationId), JSON.stringify(toStore));
    } catch {
      // Quota localStorage dépassé : la conversation reste en mémoire
    }
  }

  private persistMessages(projectId: string, conversationId: string): void {
    this.writeMessages(projectId, conversationId, this.messages());
  }
}
