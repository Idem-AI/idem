import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Monitor, Code2, Palette, Plug, ShieldCheck, Maximize2, Minimize2 } from 'lucide-react';
import EditablePreview, { type SelectionContext } from '../EditMode/EditablePreview';
import WeIde, { type IdeDetail } from '../WeIde';
import WeAPI from '../WeAPI';
import ThemePanel from '../ThemePanel';
import ChecksPanel from '../ChecksPanel';
import type { DesignSystem } from '@/api/design';
import { getProjectById } from '@/api/persistence/db';
import type { ProjectModel } from '@/api/persistence/models/project.model';

export type WorkspaceView = 'preview' | 'code' | 'theme' | 'checks' | 'api';

const VIEW_KEY = 'icode:workspace-view';
const IDE_DETAIL_KEY = 'icode:ide-detail';

interface WorkspaceProps {
  /** Injecte une demande dans la conversation (sélection, annotation, thème). */
  onSendToChat?: (message: string) => void;
}

/**
 * Espace de travail : ce que l'on regarde à droite de la conversation.
 *
 * L'ordre des onglets est une décision produit, pas un détail. L'ancienne
 * version ouvrait sur l'IDE : un utilisateur non technique atterrissait sur un
 * explorateur de fichiers. Ici l'aperçu est premier et le code se demande.
 */
export function Workspace({ onSendToChat }: WorkspaceProps) {
  const { t } = useTranslation();
  const [projectData, setProjectData] = useState<ProjectModel | null>(null);

  useEffect(() => {
    const projectId = new URLSearchParams(window.location.search).get('projectId');
    if (!projectId) return;
    getProjectById(projectId)
      .then(setProjectData)
      .catch((error) => console.warn('[workspace] projet non chargé', error));
  }, []);

  const [view, setView] = useState<WorkspaceView>(
    () => (localStorage.getItem(VIEW_KEY) as WorkspaceView) || 'preview'
  );
  const [ideDetail, setIdeDetail] = useState<IdeDetail>(
    () => (localStorage.getItem(IDE_DETAIL_KEY) as IdeDetail) || 'minimal'
  );
  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem(VIEW_KEY, view);
  }, [view]);

  useEffect(() => {
    localStorage.setItem(IDE_DETAIL_KEY, ideDetail);
  }, [ideDetail]);

  const tabs: Array<{ id: WorkspaceView; label: string; icon: React.ReactNode }> = [
    { id: 'preview', label: t('workspace.preview'), icon: <Monitor className="w-4 h-4" /> },
    { id: 'code', label: t('workspace.code'), icon: <Code2 className="w-4 h-4" /> },
    { id: 'theme', label: t('workspace.theme'), icon: <Palette className="w-4 h-4" /> },
    { id: 'checks', label: t('workspace.checks'), icon: <ShieldCheck className="w-4 h-4" /> },
    { id: 'api', label: t('workspace.api'), icon: <Plug className="w-4 h-4" /> },
  ];

  /** Navigation clavier standard d'un `tablist` : flèches, Début, Fin. */
  const onTabKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const order = tabs.map((tab) => tab.id);
      const index = order.indexOf(view);
      let next: WorkspaceView | null = null;

      if (event.key === 'ArrowRight') next = order[(index + 1) % order.length];
      else if (event.key === 'ArrowLeft') next = order[(index - 1 + order.length) % order.length];
      else if (event.key === 'Home') next = order[0];
      else if (event.key === 'End') next = order[order.length - 1];

      if (!next) return;
      event.preventDefault();
      setView(next);
      // Le focus suit la sélection, sinon la navigation clavier « saute » sans
      // que le lecteur d'écran annonce l'onglet atteint.
      requestAnimationFrame(() => {
        tabsRef.current
          ?.querySelector<HTMLButtonElement>(`[data-tab="${next}"]`)
          ?.focus();
      });
    },
    [tabs, view]
  );

  const handleSelection = useCallback(
    (context: SelectionContext) => {
      if (!onSendToChat) return;
      onSendToChat(describeSelection(context, t));
    },
    [onSendToChat, t]
  );

  const handleApplyTheme = useCallback(
    (system: DesignSystem, brief: string) => {
      if (!onSendToChat) return;
      onSendToChat(
        `${t('theme.applyPrompt', { direction: system.direction.name })}\n\n${brief}`
      );
      setView('preview');
    },
    [onSendToChat, t]
  );

  return (
    <div
      data-tour="appgen-preview"
      className="h-full flex flex-col min-w-0 bg-surface-1 motif-surface"
    >
      <div className="h-10 shrink-0 flex items-center gap-1 px-2 border-b border-[var(--glass-border)]">
        <div
          ref={tabsRef}
          role="tablist"
          aria-label={t('workspace.viewSwitcher')}
          onKeyDown={onTabKeyDown}
          className="flex items-center gap-0.5"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              data-tab={tab.id}
              aria-selected={view === tab.id}
              tabIndex={view === tab.id ? 0 : -1}
              onClick={() => setView(tab.id)}
              className={`h-8 px-3 flex items-center gap-1.5 rounded-md text-[13px] font-medium transition-colors ${
                view === tab.id
                  ? 'bg-surface-3 text-text-primary'
                  : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-2'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Le niveau de détail de l'éditeur ne concerne que la vue Code : il
            n'apparaît que là, plutôt que d'encombrer la barre en permanence. */}
        {view === 'code' && (
          <button
            type="button"
            onClick={() => setIdeDetail((current) => (current === 'full' ? 'minimal' : 'full'))}
            aria-pressed={ideDetail === 'full'}
            className="h-8 px-2.5 flex items-center gap-1.5 rounded-md text-xs text-text-tertiary hover:text-text-primary hover:bg-surface-2 transition-colors"
            title={ideDetail === 'full' ? t('workspace.ideMinimalHint') : t('workspace.ideFullHint')}
          >
            {ideDetail === 'full' ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
            {ideDetail === 'full' ? t('workspace.ideMinimal') : t('workspace.ideFull')}
          </button>
        )}
      </div>

      {/* Chaque vue reste montée : démonter l'aperçu perdrait l'état du serveur
          de dev et l'instrumentation d'édition à chaque aller-retour. */}
      <div className="flex-1 min-h-0 relative">
        <ViewSlot active={view === 'preview'}>
          <EditablePreview onAskAboutSelection={onSendToChat ? handleSelection : undefined} />
        </ViewSlot>
        <ViewSlot active={view === 'code'}>
          <WeIde detail={ideDetail} />
        </ViewSlot>
        <ViewSlot active={view === 'theme'} lazy>
          <ThemePanel projectData={projectData} onApply={onSendToChat ? handleApplyTheme : undefined} />
        </ViewSlot>
        <ViewSlot active={view === 'checks'} lazy>
          <ChecksPanel onRepair={onSendToChat} />
        </ViewSlot>
        <ViewSlot active={view === 'api'} lazy>
          <WeAPI />
        </ViewSlot>
      </div>
    </div>
  );
}

/**
 * Conteneur de vue. `lazy` retarde le premier montage jusqu'à la première
 * ouverture — le panneau Thème appelle le serveur, WeAPI charge antd : ni l'un
 * ni l'autre ne doit coûter quoi que ce soit à qui ne les ouvre jamais.
 */
function ViewSlot({
  active,
  lazy,
  children,
}: {
  active: boolean;
  lazy?: boolean;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(!lazy);

  useEffect(() => {
    if (active) setMounted(true);
  }, [active]);

  if (!mounted) return null;

  return (
    <div className="absolute inset-0" hidden={!active} aria-hidden={!active}>
      {children}
    </div>
  );
}

/**
 * Traduit une sélection (ou une annotation) en demande lisible par le modèle.
 *
 * Le chemin de fichier et l'offset sont ce qui évite au modèle de chercher
 * l'élément à la main : il sait exactement quel nœud JSX modifier.
 */
function describeSelection(
  context: SelectionContext,
  t: (key: string, options?: Record<string, unknown>) => string
): string {
  if (context.annotation) {
    const { note, bounds } = context.annotation;
    const zone = `${Math.round(bounds.x * 100)}%,${Math.round(bounds.y * 100)}%`;
    return note
      ? t('editMode.annotationPrompt', { note, zone })
      : t('editMode.annotationPromptEmpty', { zone });
  }

  const lines = context.elements.map(
    (element) =>
      `- <${element.tag}> (${element.kind}) — ${element.filePath}@${element.start}` +
      (element.text ? ` — « ${element.text} »` : '') +
      (element.className ? ` — class="${element.className}"` : '')
  );

  return `${t('editMode.selectionPrompt', { count: context.count })}\n${lines.join('\n')}\n\n`;
}

export default Workspace;
