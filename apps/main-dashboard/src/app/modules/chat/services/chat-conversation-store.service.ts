import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AdvisorService } from '../../dashboard/services/ai-agents/advisor.service';
import { ChatMessageModel } from '../models/chat.model';

const STORAGE_PREFIX = 'idem_chat_conv_';
const MAX_PERSISTED_MESSAGES = 60;

/**
 * Fil de conversation du mode Chat, par projet.
 *
 * Les messages riches (cartes, chips) sont un état d'interface : ils sont
 * persistés localement. Les échanges libres avec l'IA passent par la
 * conversation Advisor existante (persistée côté serveur) — au premier
 * chargement d'un projet, l'historique Advisor est importé pour assurer la
 * continuité entre les deux modes.
 */
@Injectable({ providedIn: 'root' })
export class ChatConversationStoreService {
  private readonly advisorService = inject(AdvisorService);

  readonly messages = signal<ChatMessageModel[]>([]);
  readonly isLoading = signal(false);

  private currentProjectId: string | null = null;

  private storageKey(projectId: string): string {
    return `${STORAGE_PREFIX}${projectId}`;
  }

  async load(projectId: string): Promise<void> {
    this.currentProjectId = projectId;
    this.isLoading.set(true);
    try {
      const local = this.readLocal(projectId);
      if (local.length > 0) {
        this.messages.set(local);
        return;
      }
      // Première visite en mode Chat : on importe l'historique Advisor
      const imported = await this.importAdvisorHistory(projectId);
      this.messages.set(imported);
      if (imported.length > 0) {
        this.persist(projectId);
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  private readLocal(projectId: string): ChatMessageModel[] {
    try {
      const raw = localStorage.getItem(this.storageKey(projectId));
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as ChatMessageModel[]) : [];
    } catch {
      return [];
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

  append(message: ChatMessageModel): void {
    this.messages.update((msgs) => [...msgs, message]);
    if (this.currentProjectId) {
      this.persist(this.currentProjectId);
    }
  }

  /** Met à jour un message existant (ex. figer une carte de sélection). */
  patch(messageId: string, patch: Partial<ChatMessageModel>): void {
    this.messages.update((msgs) =>
      msgs.map((m) => (m.id === messageId ? { ...m, ...patch } : m)),
    );
    if (this.currentProjectId) {
      this.persist(this.currentProjectId);
    }
  }

  remove(messageId: string): void {
    this.messages.update((msgs) => msgs.filter((m) => m.id !== messageId));
    if (this.currentProjectId) {
      this.persist(this.currentProjectId);
    }
  }

  clear(): void {
    this.messages.set([]);
    if (this.currentProjectId) {
      try {
        localStorage.removeItem(this.storageKey(this.currentProjectId));
      } catch {
        // ignore
      }
    }
  }

  /** Remplace le fil affiché sans persistance (utilisé par l'onboarding). */
  setTransient(messages: ChatMessageModel[]): void {
    this.currentProjectId = null;
    this.messages.set(messages);
  }

  appendTransient(message: ChatMessageModel): void {
    this.messages.update((msgs) => [...msgs, message]);
  }

  private persist(projectId: string): void {
    try {
      const toStore = this.messages()
        .slice(-MAX_PERSISTED_MESSAGES)
        // Les SVG des concepts de logos sont trop lourds pour localStorage :
        // la carte n'est pas restaurée au rechargement (le flux branding est
        // reprenable à tout moment depuis l'état du projet).
        .map((m) => (m.logoOptions ? { ...m, logoOptions: undefined } : m));
      localStorage.setItem(this.storageKey(projectId), JSON.stringify(toStore));
    } catch {
      // Quota localStorage dépassé : la conversation reste en mémoire
    }
  }
}
