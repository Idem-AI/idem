import React, { useEffect, useRef } from 'react';
import useChatHistoryStore, { ChatSession } from '@/stores/chatHistoryStore';
import { db } from '@/utils/indexDB';
import { eventEmitter } from '@/components/AiChat/utils/EventEmitter';

interface ChatHistoryPanelProps {
  open: boolean;
  onClose: () => void;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - ts;
  if (diff < 60_000) return "A l'instant";
  if (diff < 3600_000) return `Il y a ${Math.floor(diff / 60_000)} min`;
  if (d.toDateString() === now.toDateString())
    return `Aujourd'hui ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Hier';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

const ChatHistoryPanel: React.FC<ChatHistoryPanelProps> = ({ open, onClose }) => {
  const { sessions, activeChatUuid, deleteSession, createSession, setActiveChatUuid } =
    useChatHistoryStore();
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  const handleSelectChat = (session: ChatSession) => {
    setActiveChatUuid(session.uuid);
    eventEmitter.emit('chat:select', session.uuid);
    onClose();
  };

  const handleNewChat = () => {
    const uuid = createSession();
    eventEmitter.emit('chat:select', '');
    setActiveChatUuid(uuid);
    onClose();
  };

  const handleDeleteSession = async (e: React.MouseEvent, uuid: string) => {
    e.stopPropagation();
    await db.deleteByUuid(uuid);
    deleteSession(uuid);
    // If deleted active chat, start fresh
    if (uuid === activeChatUuid) {
      eventEmitter.emit('chat:select', '');
    }
  };

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      className="absolute left-0 top-full mt-1 w-72 bg-gray-900 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col"
      style={{ maxHeight: '70vh' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <span className="text-sm font-semibold text-white">Historique des chats</span>
        <button
          onClick={handleNewChat}
          className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nouveau
        </button>
      </div>

      {/* List */}
      <div className="overflow-y-auto flex-1">
        {sessions.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-500">
            Aucun chat pour l'instant
          </div>
        ) : (
          sessions.map((session) => (
            <button
              key={session.uuid}
              onClick={() => handleSelectChat(session)}
              className={`w-full flex items-start justify-between gap-2 px-4 py-3 text-left hover:bg-white/5 transition-colors group ${
                session.uuid === activeChatUuid ? 'bg-white/10' : ''
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white truncate">{session.title}</div>
                <div className="text-xs text-gray-500 mt-0.5">{formatDate(session.updatedAt)}</div>
              </div>
              <button
                onClick={(e) => handleDeleteSession(e, session.uuid)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/10 text-gray-400 hover:text-red-400 flex-shrink-0"
                title="Supprimer"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export default ChatHistoryPanel;
