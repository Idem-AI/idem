import { useCallback, useEffect, useRef, useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle, type ImperativePanelHandle } from 'react-resizable-panels';
import { MessageSquare, PanelLeftClose, PanelLeftOpen, Monitor } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useIsCompact } from '@/hooks/useMediaQuery';

interface WorkspaceShellProps {
  chat: React.ReactNode;
  workspace: React.ReactNode;
  /** Faux tant qu'aucun projet n'est lancé : le chat occupe alors tout l'écran. */
  hasWorkspace: boolean;
}

/**
 * Coquille du builder : conversation à gauche, espace de travail à droite.
 *
 * Trois comportements que l'ancienne disposition n'avait pas :
 *
 * 1. La largeur du chat est **réglable** et **mémorisée** (`autoSaveId`). Elle
 *    était figée à 400 px, ce qui rendait le panneau inutilisable sur un grand
 *    écran comme sur un petit.
 * 2. Le chat est **repliable** en rail : quand on relit son application, on
 *    veut toute la largeur pour l'aperçu.
 * 3. En dessous de 900 px, les deux panneaux ne cohabitent plus : on bascule
 *    sur une **vue unique** avec un sélecteur, plutôt que d'écraser les deux.
 */
export function WorkspaceShell({ chat, workspace, hasWorkspace }: WorkspaceShellProps) {
  const { t } = useTranslation();
  const isCompact = useIsCompact();
  const chatPanelRef = useRef<ImperativePanelHandle>(null);
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [compactView, setCompactView] = useState<'chat' | 'workspace'>('chat');

  const groupRef = useRef<HTMLDivElement>(null);
  const animationTimer = useRef<number>();

  /**
   * Repli et dépliage animés.
   *
   * `react-resizable-panels` écrit `flex-grow` en style inline et bascule d'un
   * coup : le panneau disparaît sans transition. Animer cette propriété en
   * permanence rendrait le glissement de la poignée mou et en retard sur le
   * curseur, donc la transition n'est armée que le temps du geste, via un
   * attribut posé sur le groupe.
   */
  const toggleChat = useCallback(() => {
    const panel = chatPanelRef.current;
    const group = groupRef.current?.querySelector<HTMLElement>('[data-panel-group]');
    if (!panel) return;

    group?.setAttribute('data-icode-animating', 'true');
    window.clearTimeout(animationTimer.current);

    if (panel.isCollapsed()) {
      panel.expand();
    } else {
      panel.collapse();
    }

    // Retrait après la durée déclarée en CSS : laisser l'attribut en place
    // ferait traîner la poignée au glissement suivant.
    animationTimer.current = window.setTimeout(() => {
      group?.removeAttribute('data-icode-animating');
    }, 340);
  }, []);

  useEffect(() => () => window.clearTimeout(animationTimer.current), []);

  // Aucun espace de travail : le chat prend toute la place, sans poignée ni
  // panneau vide à côté.
  if (!hasWorkspace) {
    return <div className="flex-1 min-h-0 min-w-0">{chat}</div>;
  }

  if (isCompact) {
    return (
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex-1 min-h-0">
          {compactView === 'chat' ? chat : workspace}
        </div>

        {/* Sélecteur de vue, en bas pour rester à portée de pouce. */}
        <div
          role="tablist"
          aria-label={t('workspace.viewSwitcher')}
          className="shrink-0 flex items-center gap-1 p-1.5 border-t border-[var(--glass-border)] bg-surface-1"
        >
          <CompactTab
            active={compactView === 'chat'}
            onClick={() => setCompactView('chat')}
            icon={<MessageSquare className="w-4 h-4" />}
            label={t('workspace.chat')}
          />
          <CompactTab
            active={compactView === 'workspace'}
            onClick={() => setCompactView('workspace')}
            icon={<Monitor className="w-4 h-4" />}
            label={t('workspace.app')}
          />
        </div>
      </div>
    );
  }

  return (
    <div ref={groupRef} className="flex-1 min-h-0 flex">
      {/* Rail de rappel : seule affordance visible quand le chat est replié.
          Il reste monté et s'ouvre en largeur, pour que l'apparition suive le
          même mouvement que le panneau plutôt que de surgir à la fin. */}
      <div
        aria-hidden={!chatCollapsed}
        className={`shrink-0 overflow-hidden border-r border-[var(--glass-border)] bg-surface-1 transition-[width,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          chatCollapsed ? 'w-11 opacity-100' : 'w-0 opacity-0 border-r-0'
        }`}
      >
        <div className="w-11 flex flex-col items-center gap-2 py-2">
          <button
            type="button"
            onClick={toggleChat}
            tabIndex={chatCollapsed ? 0 : -1}
            title={t('workspace.expandChat')}
            aria-label={t('workspace.expandChat')}
            className="w-8 h-8 grid place-items-center rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface-3 transition-colors"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
          <MessageSquare className="w-4 h-4 text-text-tertiary" aria-hidden />
        </div>
      </div>

      <PanelGroup direction="horizontal" autoSaveId="icode:workspace-layout" className="flex-1">
        <Panel
          id="chat"
          order={1}
          ref={chatPanelRef}
          defaultSize={32}
          minSize={20}
          maxSize={65}
          collapsible
          collapsedSize={0}
          onCollapse={() => setChatCollapsed(true)}
          onExpand={() => setChatCollapsed(false)}
          className="min-w-0"
        >
          <div
            className={`h-full relative group/chat transition-opacity duration-200 ${
              chatCollapsed ? 'opacity-0' : 'opacity-100'
            }`}
          >
            {chat}
            <button
              type="button"
              onClick={toggleChat}
              title={t('workspace.collapseChat')}
              aria-label={t('workspace.collapseChat')}
              className="absolute top-2 right-2 z-10 w-7 h-7 grid place-items-center rounded-md text-text-tertiary opacity-0 group-hover/chat:opacity-100 focus-visible:opacity-100 hover:text-text-primary hover:bg-surface-3 transition-all"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>
        </Panel>

        <PanelResizeHandle className="relative w-1.5 shrink-0 outline-none group/handle">
          {/* La poignée elle-même est fine ; la barre visible s'épaissit au
              survol pour rester discrète au repos et évidente à l'usage. */}
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-[var(--glass-border)] group-hover/handle:w-0.5 group-hover/handle:bg-primary group-data-[resize-handle-state=drag]/handle:w-0.5 group-data-[resize-handle-state=drag]/handle:bg-primary transition-all" />
        </PanelResizeHandle>

        <Panel id="workspace" order={2} minSize={30} className="min-w-0">
          {workspace}
        </Panel>
      </PanelGroup>
    </div>
  );
}

function CompactTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex-1 h-10 flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors ${
        active
          ? 'bg-primary text-white'
          : 'text-text-tertiary hover:text-text-primary hover:bg-surface-2'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

export default WorkspaceShell;
