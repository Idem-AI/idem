import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Trash2, X } from 'lucide-react';
import { IdemLoader } from '@idem/shared-loader/react';
import useChatHistoryStore, { ChatSession } from '@/stores/chatHistoryStore';
import { db } from '@/utils/indexDB';
import { eventEmitter } from '@/components/AiChat/utils/EventEmitter';
import { getUserProjects } from '@/api/persistence/db';
import type { ProjectModel } from '@/api/persistence/models/project.model';
import { ProjectLogo } from '@/components/ProjectLogo';
import { EmptyPreviewIllustration } from '@/components/ui/Illustrations';

interface ChatHistoryPanelProps {
  open: boolean;
  onClose: () => void;
  /** Le projet ouvert dans l'atelier, mis en évidence dans la liste. */
  currentProjectId?: string | null;
}

type Group = 'today' | 'yesterday' | 'week' | 'older';
const GROUPS: Group[] = ['today', 'yesterday', 'week', 'older'];

function groupOf(ts: number): Group {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const day = 86_400_000;
  if (ts >= start.getTime()) return 'today';
  if (ts >= start.getTime() - day) return 'yesterday';
  if (ts >= start.getTime() - 6 * day) return 'week';
  return 'older';
}

function timeOf(ts: number, locale: string): string {
  const group = groupOf(ts);
  return group === 'today' || group === 'yesterday'
    ? new Date(ts).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    : new Date(ts).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

const stamp = (value: unknown): number => {
  const ts = value ? new Date(value as string).getTime() : 0;
  return Number.isFinite(ts) ? ts : 0;
};

type Entry =
  | { kind: 'project'; id: string; title: string; ts: number; project: ProjectModel }
  | { kind: 'draft'; id: string; title: string; ts: number; session: ChatSession };

/**
 * L'historique de l'atelier : les projets IDEM (leur site et leur conversation sont enregistrés dans IDEM, on les
 * rouvre de n'importe quel appareil) et les brouillons sans projet, gardés dans ce navigateur. Classés par date.
 */
const ChatHistoryPanel: React.FC<ChatHistoryPanelProps> = ({ open, onClose, currentProjectId }) => {
  const { t, i18n } = useTranslation();
  const { sessions, activeChatUuid, deleteSession, createSession, setActiveChatUuid } = useChatHistoryStore();
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [projects, setProjects] = useState<ProjectModel[] | null>(null);
  const [query, setQuery] = useState('');
  const [confirming, setConfirming] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setConfirming(null);
    searchRef.current?.focus();
    let alive = true;
    getUserProjects()
      .then((list) => alive && setProjects(list ?? []))
      .catch(() => alive && setProjects([]));
    return () => {
      alive = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  const entries = useMemo<Entry[]>(() => {
    const list: Entry[] = [
      ...(projects ?? [])
        .filter((p) => p.id)
        .map((p) => ({ kind: 'project' as const, id: p.id!, title: p.name || t('history.untitled'), ts: stamp(p.updatedAt ?? p.createdAt), project: p })),
      ...sessions.map((s) => ({ kind: 'draft' as const, id: s.uuid, title: s.title || t('history.untitled'), ts: s.updatedAt, session: s })),
    ];
    const needle = query.trim().toLowerCase();
    return list.filter((e) => !needle || e.title.toLowerCase().includes(needle)).sort((a, b) => b.ts - a.ts);
  }, [projects, sessions, query, t]);

  const grouped = useMemo(() => GROUPS.map((g) => [g, entries.filter((e) => groupOf(e.ts) === g)] as const).filter(([, list]) => list.length), [entries]);

  const openProject = (id: string) => {
    if (id === currentProjectId) return onClose();
    // Un projet se rouvre par son adresse : l'atelier le recharge en entier (site, conversation, charte).
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('projectId', id);
    window.location.assign(url.toString());
  };

  const openDraft = (session: ChatSession) => {
    if (currentProjectId) {
      const url = new URL(window.location.href);
      url.search = '';
      url.searchParams.set('chat', session.uuid);
      window.location.assign(url.toString());
      return;
    }
    setActiveChatUuid(session.uuid);
    eventEmitter.emit('chat:select', session.uuid);
    onClose();
  };

  const startNew = () => {
    if (currentProjectId) {
      // Une nouvelle conversation, hors du projet ouvert : l'accueil de l'atelier.
      const url = new URL(window.location.href);
      url.search = '';
      url.searchParams.set('from', 'appgen');
      window.location.assign(url.toString());
      return;
    }
    const uuid = createSession();
    eventEmitter.emit('chat:select', '');
    setActiveChatUuid(uuid);
    onClose();
  };

  const removeDraft = async (uuid: string) => {
    await db.deleteByUuid(uuid);
    deleteSession(uuid);
    setConfirming(null);
    if (uuid === activeChatUuid) eventEmitter.emit('chat:select', '');
  };

  if (!open) return null;

  const loading = projects === null;
  const locale = i18n.language?.startsWith('en') ? 'en-GB' : 'fr-FR';

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={t('history.title')}
      className="glass-card absolute left-0 top-full mt-2 w-[min(24rem,calc(100vw-1.5rem))] z-50 !p-0 overflow-hidden flex flex-col shadow-glass"
      style={{ maxHeight: '72vh' }}
    >
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-3">
        <h2 className="text-sm font-semibold text-text-primary">{t('history.title')}</h2>
        <div className="flex items-center gap-1">
          <button type="button" onClick={startNew} className="inner-button button-sm inline-flex items-center gap-1.5">
            <Plus size={14} aria-hidden />
            {t('history.new')}
          </button>
          <button type="button" onClick={onClose} className="button-icon" aria-label={t('history.close')}>
            <X size={16} aria-hidden />
          </button>
        </div>
      </div>

      <div className="px-4 pb-3">
        <label className="relative block !mb-0">
          <span className="sr-only">{t('history.search')}</span>
          <Search size={14} aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" />
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('history.search')}
            className="!w-full !pl-8"
          />
        </label>
      </div>

      <div className="overflow-y-auto custom-scrollbar flex-1 pb-2">
        {loading && sessions.length === 0 ? (
          <div className="py-10 flex justify-center">
            <IdemLoader size="sm" label={t('history.loading')} />
          </div>
        ) : entries.length === 0 ? (
          <div className="px-6 py-8 flex flex-col items-center text-center gap-3">
            <EmptyPreviewIllustration size={72} />
            <p className="text-sm text-text-secondary">{query ? t('history.noMatch') : t('history.empty')}</p>
          </div>
        ) : (
          <>
            {grouped.map(([group, list]) => (
              <section key={group} aria-label={t(`history.group.${group}`)} className="mb-1">
                <h3 className="px-4 pt-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-text-tertiary">{t(`history.group.${group}`)}</h3>
                <ul>
                  {list.map((entry) => {
                    const active = entry.kind === 'project' ? entry.id === currentProjectId : !currentProjectId && entry.id === activeChatUuid;
                    return (
                      <li key={`${entry.kind}-${entry.id}`} className="group relative">
                        <button
                          type="button"
                          onClick={() => (entry.kind === 'project' ? openProject(entry.id) : openDraft(entry.session))}
                          aria-current={active ? 'true' : undefined}
                          className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-smooth hover:bg-[var(--glass-bg-light)] focus-visible:bg-[var(--glass-bg-light)] ${active ? 'bg-[var(--glass-bg-light)]' : ''}`}
                        >
                          {entry.kind === 'project' ? (
                            <ProjectLogo logo={entry.project.analysisResultModel?.branding?.logo} name={entry.project.name} size={28} />
                          ) : (
                            <span aria-hidden className="w-7 h-7 shrink-0 rounded-md border border-dashed border-[var(--glass-border)]" />
                          )}
                          <span className="flex-1 min-w-0">
                            <span className={`block text-sm truncate ${active ? 'font-medium text-text-primary' : 'text-text-primary'}`}>{entry.title}</span>
                            <span className="block text-xs text-text-tertiary">
                              {entry.kind === 'project' ? t('history.project') : t('history.draft')} · {timeOf(entry.ts, locale)}
                            </span>
                          </span>
                        </button>
                        {entry.kind === 'draft' &&
                          (confirming === entry.id ? (
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                              <button type="button" onClick={() => removeDraft(entry.id)} className="outer-button button-sm !text-danger">
                                {t('history.confirmDelete')}
                              </button>
                              <button type="button" onClick={() => setConfirming(null)} className="button-ghost button-sm">
                                {t('history.cancel')}
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirming(entry.id)}
                              aria-label={t('history.delete', { title: entry.title })}
                              className="button-icon absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-text-tertiary"
                            >
                              <Trash2 size={14} aria-hidden />
                            </button>
                          ))}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
            {loading && (
              <div className="py-3 flex justify-center">
                <IdemLoader size="xs" label={t('history.loading')} />
              </div>
            )}
          </>
        )}
      </div>
      <p className="px-4 py-2.5 border-t border-[var(--glass-border-subtle)] text-xs text-text-tertiary">{t('history.footnote')}</p>
    </div>
  );
};

export default ChatHistoryPanel;
