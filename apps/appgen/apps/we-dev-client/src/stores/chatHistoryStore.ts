import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

export interface ChatSession {
  uuid: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

interface ChatHistoryState {
  sessions: ChatSession[];
  activeChatUuid: string | null;
  // Create a new session and set it as active
  createSession: (title?: string) => string;
  // Update title of an existing session
  updateSessionTitle: (uuid: string, title: string) => void;
  // Touch updatedAt (called when a new message is saved)
  touchSession: (uuid: string) => void;
  // Delete a session
  deleteSession: (uuid: string) => void;
  // Set active chat
  setActiveChatUuid: (uuid: string | null) => void;
}

const useChatHistoryStore = create<ChatHistoryState>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeChatUuid: null,

      createSession: (title = 'Nouvelle conversation') => {
        const uuid = uuidv4();
        const now = Date.now();
        set((state) => ({
          sessions: [
            { uuid, title, createdAt: now, updatedAt: now },
            ...state.sessions,
          ],
          activeChatUuid: uuid,
        }));
        return uuid;
      },

      updateSessionTitle: (uuid, title) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.uuid === uuid ? { ...s, title } : s
          ),
        }));
      },

      touchSession: (uuid) => {
        const exists = get().sessions.find((s) => s.uuid === uuid);
        if (!exists) {
          set((state) => ({
            sessions: [
              { uuid, title: 'Nouvelle conversation', createdAt: Date.now(), updatedAt: Date.now() },
              ...state.sessions,
            ],
          }));
        } else {
          set((state) => ({
            sessions: state.sessions
              .map((s) => (s.uuid === uuid ? { ...s, updatedAt: Date.now() } : s))
              .sort((a, b) => b.updatedAt - a.updatedAt),
          }));
        }
      },

      deleteSession: (uuid) => {
        set((state) => ({
          sessions: state.sessions.filter((s) => s.uuid !== uuid),
          activeChatUuid: state.activeChatUuid === uuid ? null : state.activeChatUuid,
        }));
      },

      setActiveChatUuid: (uuid) => set({ activeChatUuid: uuid }),
    }),
    {
      name: 'appgen-chat-history',
    }
  )
);

export default useChatHistoryStore;
