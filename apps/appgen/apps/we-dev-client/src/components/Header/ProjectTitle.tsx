import React, { useState, useEffect } from 'react';
import { getProjectById } from '../../api/persistence/db';
import { useUrlData } from '../../hooks/useUrlData';
import { ProjectModel } from '@/api/persistence/models/project.model';
import ChatHistoryPanel from '@/components/ChatHistory/ChatHistoryPanel';
import { ProjectLogo } from '@/components/ProjectLogo';
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
      <div className="flex items-center gap-2.5 px-1 py-1">
        <ProjectLogo
          logo={projectData?.analysisResultModel?.branding?.logo}
          name={projectData?.name}
          size={32}
        />
        <div className="min-w-0">
          {/* Le nom du projet suffit : « Generation Workspace » et l'étiquette
              « Active Project » décrivaient l'écran où l'on se trouve déjà. */}
          <div className="text-sm font-medium text-text-primary truncate">
            {projectData?.name || 'Project'}
          </div>
        </div>
      </div>
    );
  }

  // No project: show chat history button
  return (
    <div className="relative flex items-center px-2 py-1">
      <button
        onClick={() => setHistoryOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg px-3 py-1.5 hover:bg-surface-2/10 transition-colors group"
      >
        <svg
          className="w-4 h-4 text-text-tertiary group-hover:text-text-primary transition-colors"
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
          <div className="text-sm font-medium text-text-secondary truncate max-w-[160px]">
            {activeSession?.title || 'Nouvelle conversation'}
          </div>
          <div className="text-xs text-text-tertiary">
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
