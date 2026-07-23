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
  Trash2,
  RefreshCw,
  Upload,
} from 'lucide-react';
import {
  IDEM_SOURCE,
  decodeIdemId,
  isAgentMessage,
  type SelectedElementInfo,
  type StyleProperty,
  type ParentToAgentMessage,
} from './idemProtocol';
import {
  editText,
  editImageSrc,
  editStyle,
  reorderSiblings,
  deleteElement,
  type EditResult,
} from './astEdit';
import { buildInjectPlan, buildRemovePlan, type InstrumentationPlan } from './instrumentation';
import { SizeSelector, viewportStyle, WINDOW_SIZES, type WindowSize } from './ResponsiveViewport';

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
  const [selected, setSelected] = useState<SelectedElementInfo[]>([]);
  const [agentReady, setAgentReady] = useState(false);
  const [size, setSize] = useState<WindowSize>(WINDOW_SIZES[0]);

  const { updateContent, addFile, deleteFile, getContent } = useFileStore();

  const primary = selected[0] ?? null;
  const multi = selected.length > 1;

  // Refs pour les handlers asynchrones (postMessage).
  const selectedIdsRef = useRef<string[]>([]);
  selectedIdsRef.current = selected.map((e) => e.id);
  const injectedRef = useRef(false);

  /* -------- postMessage vers l'agent -------- */
  const sendToAgent = useCallback((msg: ParentToAgentMessage) => {
    iframeRef.current?.contentWindow?.postMessage(msg, '*');
  }, []);

  const handleRefresh = useCallback(() => {
    if (iframeRef.current) iframeRef.current.src = iframeRef.current.src;
  }, []);

  /* -------- URL du serveur de dev (WebContainer) -------- */
  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | undefined;
    (async () => {
      await getContainerInstance();
      if (!mounted) return;
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
      setSelected([]);
      const plan = buildRemovePlan(useFileStore.getState().files);
      applyPlan(plan);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  /* -------- Application d'un résultat d'édition (un seul élément) -------- */
  const applyResult = useCallback(
    async (
      filePath: string,
      result: EditResult,
      opts: { keepSelection?: boolean; softFailMessage?: string } = {}
    ) => {
      if (!result.ok || result.code === undefined) {
        if (opts.softFailMessage) toast.info(opts.softFailMessage);
        else toast.error(t('editMode.editFailed', { reason: result.reason ?? '' }));
        return;
      }
      await updateContent(filePath, result.code);
      if (!opts.keepSelection) setSelected([]);
    },
    [updateContent, t]
  );

  /**
   * Édition par lot (multi-sélection). Regroupe par fichier et applique les édits
   * du plus grand offset au plus petit : chaque édit ne décale que les offsets
   * situés APRÈS lui, donc les offsets encore à traiter (plus petits) restent valides.
   */
  const applyBatch = useCallback(
    async (
      ids: string[],
      make: (code: string, start: number) => EditResult,
      softFailMessage?: string
    ) => {
      const groups: Record<string, number[]> = {};
      for (const id of ids) {
        const ref = decodeIdemId(id);
        if (!ref) continue;
        (groups[ref.filePath] ||= []).push(ref.start);
      }
      let anyFail = false;
      for (const [file, starts] of Object.entries(groups)) {
        let code = getContent(file);
        starts.sort((a, b) => b - a);
        for (const start of starts) {
          const res = make(code, start);
          if (res.ok && res.code !== undefined) code = res.code;
          else anyFail = true;
        }
        await updateContent(file, code);
      }
      if (anyFail && softFailMessage) toast.info(softFailMessage);
      setSelected([]);
    },
    [getContent, updateContent]
  );

  const deleteIds = useCallback(
    (ids: string[]) => applyBatch(ids, (c, s) => deleteElement(c, s), t('editMode.deleteUnsupported')),
    [applyBatch, t]
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
          if (selectedIdsRef.current.length) {
            sendToAgent({ source: IDEM_SOURCE, type: 'SET_SELECTION', ids: selectedIdsRef.current });
          }
          break;
        }
        case 'SELECTED': {
          setSelected(msg.elements);
          break;
        }
        case 'TEXT_EDIT': {
          const ref = decodeIdemId(msg.id);
          if (!ref) return;
          applyResult(ref.filePath, editText(getContent(ref.filePath), ref.start, msg.text), {
            keepSelection: true,
          });
          break;
        }
        case 'REORDER': {
          const ref = decodeIdemId(msg.id);
          const beforeRef = decodeIdemId(msg.beforeId);
          if (!ref) return;
          applyResult(
            ref.filePath,
            reorderSiblings(getContent(ref.filePath), ref.start, beforeRef ? beforeRef.start : null),
            { keepSelection: false, softFailMessage: t('editMode.reorderUnsupported') }
          );
          break;
        }
        case 'DELETE_ELEMENTS': {
          deleteIds(msg.ids);
          break;
        }
        case 'REQUEST_IMAGE': {
          const ref = decodeIdemId(msg.id);
          if (!ref) return;
          const newSrc = window.prompt(t('editMode.imagePrompt'));
          if (!newSrc) return;
          applyResult(ref.filePath, editImageSrc(getContent(ref.filePath), ref.start, newSrc), {
            keepSelection: true,
          });
          break;
        }
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [sendToAgent, applyResult, deleteIds, getContent, t]);

  /* -------- Handlers du panneau de propriétés -------- */
  const applyStyle = useCallback(
    (property: StyleProperty, value: string) => {
      if (!selected.length) return;
      if (selected.length === 1) {
        const ref = decodeIdemId(selected[0].id);
        if (!ref) return;
        applyResult(ref.filePath, editStyle(getContent(ref.filePath), ref.start, property, value), {
          keepSelection: true,
        });
      } else {
        applyBatch(selected.map((e) => e.id), (c, s) => editStyle(c, s, property, value));
      }
    },
    [selected, applyResult, applyBatch, getContent]
  );

  const applyTextFromPanel = useCallback(
    (text: string) => {
      if (!primary) return;
      const ref = decodeIdemId(primary.id);
      if (!ref) return;
      applyResult(ref.filePath, editText(getContent(ref.filePath), ref.start, text), {
        keepSelection: true,
      });
    },
    [primary, applyResult, getContent]
  );

  const applyImageFromPanel = useCallback(
    (src: string) => {
      if (!primary) return;
      const ref = decodeIdemId(primary.id);
      if (!ref) return;
      applyResult(ref.filePath, editImageSrc(getContent(ref.filePath), ref.start, src), {
        keepSelection: true,
      });
    },
    [primary, applyResult, getContent]
  );

  const onUploadImage = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') applyImageFromPanel(reader.result);
      };
      reader.readAsDataURL(file);
    },
    [applyImageFromPanel]
  );

  const deselect = useCallback(() => {
    setSelected([]);
    sendToAgent({ source: IDEM_SOURCE, type: 'SET_SELECTION', ids: [] });
  }, [sendToAgent]);

  return (
    <div className="w-full h-full flex overflow-hidden bg-white dark:bg-[#1e1e1e]">
      {/* Zone preview éditable */}
      <div className="flex-1 relative flex flex-col overflow-hidden">
        <div className="h-10 flex items-center gap-2 px-3 bg-[#f3f3f3] dark:bg-[#1a1a1a] border-b border-[#e4e4e4] dark:border-[#333]">
          <div className="flex items-center gap-1.5 text-xs text-[#6D28D9] dark:text-[#a78bfa] min-w-0">
            <MousePointerClick size={14} className="shrink-0" />
            <span className="truncate">{t('editMode.hint')}</span>
          </div>
          <div className="flex-1" />
          <SizeSelector value={size} onChange={setSize} />
          <button
            onClick={handleRefresh}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-[#2c2c2c] text-gray-600 dark:text-gray-400"
            title={t('editMode.refresh')}
            aria-label={t('editMode.refresh')}
          >
            <RefreshCw size={15} />
          </button>
        </div>
        <div className="flex-1 overflow-auto flex items-start justify-center bg-[#ececec] dark:bg-[#141414] p-3">
          {url ? (
            <div
              className="bg-white shadow-xl rounded-md overflow-hidden shrink-0"
              style={viewportStyle(size)}
            >
              <iframe
                ref={iframeRef}
                src={url}
                className="w-full h-full border-none bg-white block"
                title="editable-preview"
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-downloads"
              />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-gray-500">{t('preview.noserver')}</div>
            </div>
          )}
          {active && url && !agentReady && (
            <div className="absolute top-12 right-4 text-[11px] px-2 py-1 rounded bg-black/60 text-white">
              {t('editMode.loadingAgent')}
            </div>
          )}
        </div>
      </div>

      {/* Panneau de propriétés */}
      <aside className="w-72 shrink-0 border-l border-[#e4e4e4] dark:border-[#333] bg-[#fafafa] dark:bg-[#232323] flex flex-col overflow-y-auto">
        {selected.length === 0 ? (
          <div className="p-4 text-sm text-gray-500 dark:text-gray-400">
            {t('editMode.noSelection')}
            <p className="mt-2 text-[11px] text-gray-400">{t('editMode.multiHint')}</p>
          </div>
        ) : (
          <div className="p-3 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium px-2 py-0.5 rounded bg-[#6D28D9] text-white uppercase">
                {multi ? t('editMode.multiSelected', { count: selected.length }) : primary?.tag}
              </span>
              <button className="text-xs text-gray-500 hover:text-[#6D28D9]" onClick={deselect}>
                {t('editMode.deselect')}
              </button>
            </div>

            {/* Texte (mono-sélection uniquement) */}
            {!multi && primary?.textEditable && (
              <PanelSection icon={<Type size={14} />} title={t('editMode.text')}>
                <textarea
                  key={primary.id}
                  defaultValue={primary.text}
                  rows={3}
                  className="w-full text-sm rounded border border-gray-300 dark:border-[#444] bg-white dark:bg-[#2c2c2c] p-2 text-gray-800 dark:text-gray-100 resize-y"
                  onBlur={(e) => {
                    if (e.target.value !== primary.text) applyTextFromPanel(e.target.value);
                  }}
                />
                <p className="text-[11px] text-gray-400 mt-1">{t('editMode.textHint')}</p>
              </PanelSection>
            )}

            {/* Image (mono-sélection uniquement) */}
            {!multi && primary?.tag === 'img' && (
              <PanelSection icon={<ImageIcon size={14} />} title={t('editMode.image')}>
                {primary.src && (
                  <div className="mb-2 rounded border border-gray-200 dark:border-[#444] overflow-hidden bg-[repeating-conic-gradient(#eee_0_25%,#fff_0_50%)] bg-[length:16px_16px]">
                    <img
                      src={primary.src}
                      alt=""
                      className="max-h-28 w-full object-contain"
                    />
                  </div>
                )}
                <div className="flex gap-1.5">
                  <input
                    key={primary.id}
                    type="text"
                    defaultValue={primary.src}
                    placeholder="https://…"
                    className="flex-1 min-w-0 text-sm rounded border border-gray-300 dark:border-[#444] bg-white dark:bg-[#2c2c2c] p-2 text-gray-800 dark:text-gray-100"
                    onKeyDown={(e) => {
                      const el = e.target as HTMLInputElement;
                      if (e.key === 'Enter' && el.value && el.value !== primary.src)
                        applyImageFromPanel(el.value);
                    }}
                    id="idem-img-url"
                  />
                  <button
                    className="px-2 rounded bg-[#6D28D9] text-white text-xs hover:bg-[#5b21b6]"
                    onClick={() => {
                      const el = document.getElementById('idem-img-url') as HTMLInputElement | null;
                      if (el && el.value && el.value !== primary.src) applyImageFromPanel(el.value);
                    }}
                  >
                    {t('editMode.apply')}
                  </button>
                </div>
                <label className="mt-2 flex items-center justify-center gap-2 px-3 py-2 rounded border border-dashed border-gray-300 dark:border-[#555] text-sm text-gray-600 dark:text-gray-300 cursor-pointer hover:border-[#6D28D9] hover:text-[#6D28D9]">
                  <Upload size={14} />
                  {t('editMode.upload')}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onUploadImage(f);
                      e.target.value = '';
                    }}
                  />
                </label>
              </PanelSection>
            )}

            {/* Style (mono + multi) */}
            <PanelSection title={t('editMode.style')}>
              <StyleControls info={multi ? null : primary} onApply={applyStyle} />
            </PanelSection>

            {/* Suppression */}
            <button
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded border border-red-300 dark:border-red-900/60 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 text-sm font-medium"
              onClick={() => deleteIds(selected.map((e) => e.id))}
            >
              <Trash2 size={14} />
              {multi ? t('editMode.deleteSelection', { count: selected.length }) : t('editMode.delete')}
            </button>
            <p className="text-[11px] text-gray-400 -mt-2">{t('editMode.deleteHint')}</p>
          </div>
        )}
      </aside>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Sous-composants                                                     */
/* ------------------------------------------------------------------ */

const StyleControls: React.FC<{
  info: SelectedElementInfo | null;
  onApply: (property: StyleProperty, value: string) => void;
}> = ({ info, onApply }) => {
  const { t } = useTranslation();
  const key = info?.id ?? 'multi';
  return (
    <div className="space-y-3">
      <LabeledRow label={t('editMode.textColor')}>
        <input
          key={`c-${key}`}
          type="color"
          defaultValue={info ? rgbToHex(info.computed.color) : '#000000'}
          className="w-8 h-8 rounded cursor-pointer bg-transparent"
          onChange={(e) => onApply('color', e.target.value)}
        />
      </LabeledRow>
      <LabeledRow label={t('editMode.background')}>
        <input
          key={`b-${key}`}
          type="color"
          defaultValue={info ? rgbToHex(info.computed.backgroundColor) : '#ffffff'}
          className="w-8 h-8 rounded cursor-pointer bg-transparent"
          onChange={(e) => onApply('backgroundColor', e.target.value)}
        />
      </LabeledRow>
      <LabeledRow label={t('editMode.fontSize')}>
        <input
          key={`f-${key}`}
          type="number"
          min={8}
          max={200}
          defaultValue={info ? pxToNumber(info.computed.fontSize) : undefined}
          placeholder="—"
          className="w-20 text-sm rounded border border-gray-300 dark:border-[#444] bg-white dark:bg-[#2c2c2c] p-1 text-gray-800 dark:text-gray-100"
          onBlur={(e) => {
            if (e.target.value) onApply('fontSize', `${e.target.value}px`);
          }}
        />
      </LabeledRow>
      <LabeledRow label={t('editMode.fontWeight')}>
        <select
          key={`w-${key}`}
          defaultValue={info?.computed.fontWeight}
          className="text-sm rounded border border-gray-300 dark:border-[#444] bg-white dark:bg-[#2c2c2c] p-1 text-gray-800 dark:text-gray-100"
          onChange={(e) => onApply('fontWeight', e.target.value)}
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
              onClick={() => onApply('textAlign', value)}
              aria-label={value}
            >
              <Icon size={14} />
            </button>
          ))}
        </div>
      </LabeledRow>
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

const LabeledRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-center justify-between">
    <span className="text-sm text-gray-600 dark:text-gray-300">{label}</span>
    {children}
  </div>
);

export default EditablePreview;
