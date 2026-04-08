import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AppGenDraft {
  id: string;
  createdAt: string;
  updatedAt: string;
  appName?: string;
  description?: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;
  files: Record<string, string>;
  metadata: {
    framework?: string;
    features?: string[];
    type?: 'landing' | 'app' | 'dashboard' | 'ecommerce' | 'other';
    deployUrl?: string;
  };
}

export interface AppGenHandoffPayload {
  draftId: string;
  appName: string;
  description: string;
  files: Record<string, string>;
  metadata: AppGenDraft['metadata'];
  messages: AppGenDraft['messages'];
  generatedAt: string;
  source: 'appgen';
}

interface AppGenContextState {
  draft: AppGenDraft | null;
  pendingIntent: string | null;
  isConnectedToProject: boolean;
  projectId: string | null;

  initDraft: () => void;
  updateDraftMessages: (messages: AppGenDraft['messages']) => void;
  updateDraftFiles: (files: Record<string, string>) => void;
  updateDraftMetadata: (metadata: Partial<AppGenDraft['metadata']>) => void;
  setDraftAppName: (name: string) => void;
  setDraftDescription: (description: string) => void;
  setPendingIntent: (intent: string | null) => void;
  setConnectedProject: (projectId: string | null) => void;
  getHandoffPayload: () => AppGenHandoffPayload | null;
  clearDraft: () => void;
}

const generateDraftId = () => `draft_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

const useAppGenContextStore = create<AppGenContextState>()(
  persist(
    (set, get) => ({
      draft: null,
      pendingIntent: null,
      isConnectedToProject: false,
      projectId: null,

      initDraft: () => {
        const existing = get().draft;
        if (existing) return;
        set({
          draft: {
            id: generateDraftId(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            messages: [],
            files: {},
            metadata: {},
          },
        });
      },

      updateDraftMessages: (messages) =>
        set((state) => ({
          draft: state.draft
            ? { ...state.draft, messages, updatedAt: new Date().toISOString() }
            : state.draft,
        })),

      updateDraftFiles: (files) =>
        set((state) => ({
          draft: state.draft
            ? { ...state.draft, files, updatedAt: new Date().toISOString() }
            : state.draft,
        })),

      updateDraftMetadata: (metadata) =>
        set((state) => ({
          draft: state.draft
            ? {
                ...state.draft,
                metadata: { ...state.draft.metadata, ...metadata },
                updatedAt: new Date().toISOString(),
              }
            : state.draft,
        })),

      setDraftAppName: (name) =>
        set((state) => ({
          draft: state.draft
            ? { ...state.draft, appName: name, updatedAt: new Date().toISOString() }
            : state.draft,
        })),

      setDraftDescription: (description) =>
        set((state) => ({
          draft: state.draft
            ? { ...state.draft, description, updatedAt: new Date().toISOString() }
            : state.draft,
        })),

      setPendingIntent: (intent) => set({ pendingIntent: intent }),

      setConnectedProject: (projectId) =>
        set({
          projectId,
          isConnectedToProject: projectId !== null,
        }),

      getHandoffPayload: (): AppGenHandoffPayload | null => {
        const { draft } = get();
        if (!draft) return null;
        return {
          draftId: draft.id,
          appName: draft.appName || 'Mon Application',
          description: draft.description || '',
          files: draft.files,
          metadata: draft.metadata,
          messages: draft.messages,
          generatedAt: draft.updatedAt,
          source: 'appgen',
        };
      },

      clearDraft: () =>
        set({
          draft: null,
          pendingIntent: null,
          isConnectedToProject: false,
          projectId: null,
        }),
    }),
    {
      name: 'appgen-context',
      version: 1,
    }
  )
);

export default useAppGenContextStore;
