import { useEffect, useRef, useState, useCallback } from 'react';
import { getContainerInstance, onServerReady } from '../WeIde/services';
import { useFileStore } from '../WeIde/stores/fileStore';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Type,
  Image as ImageIcon,
  MousePointerClick,
} from 'lucide-react';
import {
  IDEM_SOURCE,
  decodeIdemId,
  isAgentMessage,
  type SelectedElementInfo,
  type StyleProperty,
  type ParentToAgentMessage,
} from './idemProtocol';
import { editText, editImageSrc, editStyle, reorderSiblings, type EditResult } from './astEdit';
import { buildInjectPlan, buildRemovePlan, type InstrumentationPlan } from './instrumentation';

interface EditablePreviewProps {
  /** true quand l'onglet Edit est actif (déclenche l'instrumentation). */
  active: boolean;
}

/** rgb(a) -> #rrggbb pour alimenter <input type="color">. */
function rgbToHex(rgb: string): string {
  const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!m) return '#000000';
  const hex = (n: string) => Number(n).toString(16).padStart(2, '0');
  return `#${hex(m[1])}${hex(m[2])}${hex(m[3])}`;
}

function pxToNumber(v: string): number {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? Math.round(n) : 16;
}

const EditablePreview: React.FC<EditablePreviewProps> = ({ active }) => {
  const { t } = useTranslation();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [url, setUrl] = useState('');
  const [selected, setSelected] = useState<SelectedElementInfo | null>(null);
  const [agentReady, setAgentReady] = useState(false);

  const { updateContent, addFile, deleteFile, getContent } = useFileStore();

  // Refs pour les handlers asynchrones (postMessage).
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selected?.id ?? null;
  // Vrai uniquement une fois l'instrumentation réellement injectée (évite de
  // réécrire vite.config au montage quand le mode Edit n'a jamais été ouvert).
  const injectedRef = useRef(false);

  /* -------- postMessage vers l'agent -------- */
  const sendToAgent = useCallback((msg: ParentToAgentMessage) => {
    iframeRef.current?.contentWindow?.postMessage(msg, '*');
  }, []);

  /* -------- URL du serveur de dev (WebContainer) -------- */
  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | undefined;
    (async () => {
      await getContainerInstance();
      if (!mounted) return;
      // Rappel immédiat avec la dernière URL connue si le serveur tourne déjà.
      unsubscribe = onServerReady((_port, serverUrl) => {
        if (mounted) setUrl(serverUrl);
      });
    })();
    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  /* -------- Injection / retrait de l'instrumentation selon `active` -------- */
  useEffect(() => {
    const applyPlan = async (plan: InstrumentationPlan) => {
      const currentFiles = useFileStore.getState().files;
      for (const [path, content] of Object.entries(plan.writes)) {
        if (path in currentFiles) await updateContent(path, content);
        else await addFile(path, content);
      }
      for (const path of plan.deletes) {
        if (path in useFileStore.getState().files) await deleteFile(path);
      }
    };

    if (active) {
      const plan = buildInjectPlan(useFileStore.getState().files);
      if (!plan.ok) {
        toast.error(t('editMode.injectFailed', { reason: plan.reason ?? '' }));
        return;
      }
      injectedRef.current = true;
      applyPlan(plan);
    } else if (injectedRef.current) {
      injectedRef.current = false;
      setAgentReady(false);
      setSelected(null);
      const plan = buildRemovePlan(useFileStore.getState().files);
      applyPlan(plan);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  /* -------- Application d'un résultat d'édition au fichier -------- */
  const applyResult = useCallback(
    async (filePath: string, result: EditResult, keepSelection: boolean) => {
      if (!result.ok || result.code === undefined) {
        toast.error(t('editMode.editFailed', { reason: result.reason ?? '' }));
        return;
      }
      await updateContent(filePath, result.code);
      if (!keepSelection) {
        setSelected(null);
        selectedIdRef.current = null;
      }
    },
    [updateContent, t]
  );

  /* -------- Réception des messages de l'agent -------- */
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!isAgentMessage(event.data)) return;
      const msg = event.data;

      switch (msg.type) {
        case 'AGENT_READY': {
          setAgentReady(true);
          sendToAgent({ source: IDEM_SOURCE, type: 'ENABLE_EDIT', enabled: true });
          // Restaure la sélection après un rechargement HMR (offset inchangé).
          if (selectedIdRef.current) {
            sendToAgent({ source: IDEM_SOURCE, type: 'SET_SELECTION', id: selectedIdRef.current });
          }
          break;
        }
        case 'SELECTED': {
          setSelected(msg.element);
          break;
        }
        case 'TEXT_EDIT': {
          const ref = decodeIdemId(msg.id);
          if (!ref) return;
          applyResult(ref.filePath, editText(getContent(ref.filePath), ref.start, msg.text), true);
          break;
        }
        case 'REORDER': {
          const ref = decodeIdemId(msg.id);
          const beforeRef = decodeIdemId(msg.beforeId);
          if (!ref) return;
          // Le réordonnancement décale les offsets -> on abandonne la sélection.
          applyResult(
            ref.filePath,
            reorderSiblings(getContent(ref.filePath), ref.start, beforeRef ? beforeRef.start : null),
            false
          );
          break;
        }
        case 'REQUEST_IMAGE': {
          const ref = decodeIdemId(msg.id);
          if (!ref) return;
          const newSrc = window.prompt(t('editMode.imagePrompt'));
          if (!newSrc) return;
          applyResult(ref.filePath, editImageSrc(getContent(ref.filePath), ref.start, newSrc), true);
          break;
        }
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [sendToAgent, applyResult, getContent, t]);

  /* -------- Handlers du panneau de propriétés -------- */
  const applyStyle = useCallback(
    (property: StyleProperty, value: string) => {
      if (!selected) return;
      const ref = decodeIdemId(selected.id);
      if (!ref) return;
      applyResult(ref.filePath, editStyle(getContent(ref.filePath), ref.start, property, value), true);
    },
    [selected, applyResult, getContent]
  );

  const applyTextFromPanel = useCallback(
    (text: string) => {
      if (!selected) return;
      const ref = decodeIdemId(selected.id);
      if (!ref) return;
      applyResult(ref.filePath, editText(getContent(ref.filePath), ref.start, text), true);
    },
    [selected, applyResult, getContent]
  );

  const applyImageFromPanel = useCallback(
    (src: string) => {
      if (!selected) return;
      const ref = decodeIdemId(selected.id);
      if (!ref) return;
      applyResult(ref.filePath, editImageSrc(getContent(ref.filePath), ref.start, src), true);
    },
    [selected, applyResult, getContent]
  );

  const deselect = useCallback(() => {
    setSelected(null);
    selectedIdRef.current = null;
    sendToAgent({ source: IDEM_SOURCE, type: 'SET_SELECTION', id: null });
  }, [sendToAgent]);

  return (
    <div className="w-full h-full flex overflow-hidden bg-white dark:bg-[#1e1e1e]">
      {/* Zone preview éditable */}
      <div className="flex-1 relative flex flex-col overflow-hidden">
        <div className="h-9 flex items-center gap-2 px-3 text-xs text-[#6D28D9] dark:text-[#a78bfa] bg-[#F5EEFF] dark:bg-[#241b38] border-b border-[#e4e4e4] dark:border-[#333]">
          <MousePointerClick size={14} />
          <span>{t('editMode.hint')}</span>
        </div>
        <div className="flex-1 relative bg-white overflow-hidden">
          {url ? (
            <iframe
              ref={iframeRef}
              src={url}
              className="w-full h-full border-none bg-white"
              title="editable-preview"
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-downloads"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-[#1e1e1e]">
              <div className="text-gray-500">{t('preview.noserver')}</div>
            </div>
          )}
          {active && url && !agentReady && (
            <div className="absolute top-2 right-2 text-[11px] px-2 py-1 rounded bg-black/60 text-white">
              {t('editMode.loadingAgent')}
            </div>
          )}
        </div>
      </div>

      {/* Panneau de propriétés */}
      <aside className="w-72 shrink-0 border-l border-[#e4e4e4] dark:border-[#333] bg-[#fafafa] dark:bg-[#232323] flex flex-col overflow-y-auto">
        {!selected ? (
          <div className="p-4 text-sm text-gray-500 dark:text-gray-400">
            {t('editMode.noSelection')}
          </div>
        ) : (
          <div className="p-3 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium px-2 py-0.5 rounded bg-[#6D28D9] text-white uppercase">
                {selected.tag}
              </span>
              <button
                className="text-xs text-gray-500 hover:text-[#6D28D9]"
                onClick={deselect}
              >
                {t('editMode.deselect')}
              </button>
            </div>

            {/* Texte */}
            {selected.textEditable && (
              <PanelSection icon={<Type size={14} />} title={t('editMode.text')}>
                <textarea
                  key={selected.id}
                  defaultValue={selected.text}
                  rows={3}
                  className="w-full text-sm rounded border border-gray-300 dark:border-[#444] bg-white dark:bg-[#2c2c2c] p-2 text-gray-800 dark:text-gray-100 resize-y"
                  onBlur={(e) => {
                    if (e.target.value !== selected.text) applyTextFromPanel(e.target.value);
                  }}
                />
                <p className="text-[11px] text-gray-400 mt-1">{t('editMode.textHint')}</p>
              </PanelSection>
            )}

            {/* Image */}
            {selected.tag === 'img' && (
              <PanelSection icon={<ImageIcon size={14} />} title={t('editMode.image')}>
                <input
                  key={selected.id}
                  type="text"
                  defaultValue={selected.src}
                  placeholder="https://…"
                  className="w-full text-sm rounded border border-gray-300 dark:border-[#444] bg-white dark:bg-[#2c2c2c] p-2 text-gray-800 dark:text-gray-100"
                  onBlur={(e) => {
                    if (e.target.value && e.target.value !== selected.src)
                      applyImageFromPanel(e.target.value);
                  }}
                />
              </PanelSection>
            )}

            {/* Style */}
            <PanelSection title={t('editMode.style')}>
              <div className="space-y-3">
                <LabeledRow label={t('editMode.textColor')}>
                  <input
                    type="color"
                    defaultValue={rgbToHex(selected.computed.color)}
                    className="w-8 h-8 rounded cursor-pointer bg-transparent"
                    onChange={(e) => applyStyle('color', e.target.value)}
                  />
                </LabeledRow>
                <LabeledRow label={t('editMode.background')}>
                  <input
                    type="color"
                    defaultValue={rgbToHex(selected.computed.backgroundColor)}
                    className="w-8 h-8 rounded cursor-pointer bg-transparent"
                    onChange={(e) => applyStyle('backgroundColor', e.target.value)}
                  />
                </LabeledRow>
                <LabeledRow label={t('editMode.fontSize')}>
                  <input
                    type="number"
                    min={8}
                    max={200}
                    defaultValue={pxToNumber(selected.computed.fontSize)}
                    className="w-20 text-sm rounded border border-gray-300 dark:border-[#444] bg-white dark:bg-[#2c2c2c] p-1 text-gray-800 dark:text-gray-100"
                    onBlur={(e) => applyStyle('fontSize', `${e.target.value}px`)}
                  />
                </LabeledRow>
                <LabeledRow label={t('editMode.fontWeight')}>
                  <select
                    defaultValue={selected.computed.fontWeight}
                    className="text-sm rounded border border-gray-300 dark:border-[#444] bg-white dark:bg-[#2c2c2c] p-1 text-gray-800 dark:text-gray-100"
                    onChange={(e) => applyStyle('fontWeight', e.target.value)}
                  >
                    <option value="400">Normal</option>
                    <option value="500">Medium</option>
                    <option value="600">Semibold</option>
                    <option value="700">Bold</option>
                  </select>
                </LabeledRow>
                <LabeledRow label={t('editMode.align')}>
                  <div className="flex gap-1">
                    {(
                      [
                        ['left', AlignLeft],
                        ['center', AlignCenter],
                        ['right', AlignRight],
                      ] as const
                    ).map(([value, Icon]) => (
                      <button
                        key={value}
                        className="p-1.5 rounded border border-gray-300 dark:border-[#444] hover:bg-[#F5EEFF] dark:hover:bg-[#2c2c2c] text-gray-700 dark:text-gray-200"
                        onClick={() => applyStyle('textAlign', value)}
                        aria-label={value}
                      >
                        <Icon size={14} />
                      </button>
                    ))}
                  </div>
                </LabeledRow>
              </div>
            </PanelSection>
          </div>
        )}
      </aside>
    </div>
  );
};

const PanelSection: React.FC<{
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, icon, children }) => (
  <section>
    <h3 className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2 uppercase tracking-wide">
      {icon}
      {title}
    </h3>
    {children}
  </section>
);

const LabeledRow: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div className="flex items-center justify-between">
    <span className="text-sm text-gray-600 dark:text-gray-300">{label}</span>
    {children}
  </div>
);

export default EditablePreview;
