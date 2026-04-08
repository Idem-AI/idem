import React, { useState, useEffect } from 'react';
import { getProjectById } from '../../api/persistence/db';
import { useUrlData } from '../../hooks/useUrlData';
import { ProjectModel } from '@/api/persistence/models/project.model';
import ChatHistoryPanel from '@/components/ChatHistory/ChatHistoryPanel';
import useChatHistoryStore from '@/stores/chatHistoryStore';

export function ProjectTitle() {
  const [projectData, setProjectData] = useState<ProjectModel | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const { projectId } = useUrlData({ append: () => {} });
  const { sessions, activeChatUuid } = useChatHistoryStore();

  const activeSession = sessions.find((s) => s.uuid === activeChatUuid);

  useEffect(() => {
    if (!projectId) return;
    getProjectById(projectId)
      .then((p) => setProjectData(p))
      .catch((e) => console.error('Error loading project:', e));
  }, [projectId]);

  // Project mode: show project info
  if (projectId) {
    return (
      <div className="flex items-center space-x-3 px-3 py-2">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium">
          <img
            src={
              projectData?.analysisResultModel?.branding?.logo?.variations?.iconOnly
                ?.lightBackground || ''
            }
            alt=""
            width={32}
            height={32}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {projectData?.name || 'Project'}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Generation Workspace</div>
        </div>
        <div className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
          Active Project
        </div>
      </div>
    );
  }

  // No project: show chat history button
  return (
    <div className="relative flex items-center px-2 py-1">
      <button
        onClick={() => setHistoryOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg px-3 py-1.5 hover:bg-white/10 dark:hover:bg-white/10 hover:bg-gray-100 transition-colors group"
      >
        <svg
          className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
        <div className="text-left">
          <div className="text-sm font-medium text-gray-800 dark:text-white truncate max-w-[160px]">
            {activeSession?.title || 'Nouvelle conversation'}
          </div>
          <div className="text-xs text-gray-500">
            {sessions.length > 0
              ? `${sessions.length} chat${sessions.length > 1 ? 's' : ''}`
              : 'Historique vide'}
          </div>
        </div>
        <svg
          className="w-3 h-3 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <ChatHistoryPanel open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </div>
  );
}
