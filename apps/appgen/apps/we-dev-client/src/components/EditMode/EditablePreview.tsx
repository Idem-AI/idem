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
  Link as LinkIcon,
  MousePointerClick,
  Trash2,
  RefreshCw,
  Upload,
  Palette,
  LayoutGrid,
  Move,
  Ruler,
  Undo2,
  Redo2,
} from 'lucide-react';
import {
  IDEM_SOURCE,
  decodeIdemId,
  isAgentMessage,
  type SelectedElementInfo,
  type ParentToAgentMessage,
} from './idemProtocol';
import {
  editText,
  editImageSrc,
  editStyle,
  editAttribute,
  reorderSiblings,
  deleteElement,
  type EditResult,
} from './astEdit';
import { buildInjectPlan, buildRemovePlan, type InstrumentationPlan } from './instrumentation';
import { SizeSelector, viewportStyle, WINDOW_SIZES, type WindowSize } from './ResponsiveViewport';

interface EditablePreviewProps {
  active: boolean;
}

/** Un changement de fichier réversible (pour l'historique undo/redo). */
interface FileChange {
  filePath: string;
  before: string;
  after: string;
}

/* ---------- helpers de lecture des valeurs calculées ---------- */
function rgbToHex(rgb: string | undefined): string {
  if (!rgb) return '#000000';
  const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!m) return '#000000';
  const hex = (n: string) => Number(n).toString(16).padStart(2, '0');
  return `#${hex(m[1])}${hex(m[2])}${hex(m[3])}`;
}
function toPx(v: string | undefined): number | undefined {
  if (!v) return undefined;
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? Math.round(n) : undefined;
}
/** Extrait l'URL d'un background-image CSS (`url("…")`). */
function extractBgUrl(v: string | undefined): string {
  if (!v || v === 'none') return '';
  const m = v.match(/url\((['"]?)(.*?)\1\)/);
  return m ? m[2] : '';
}
const cval = (info: SelectedElementInfo | null, key: string) => info?.computed?.[key];

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

  const selectedIdsRef = useRef<string[]>([]);
  selectedIdsRef.current = selected.map((e) => e.id);
  const injectedRef = useRef(false);

  // Historique undo/redo. Chaque entrée = un lot de changements de fichiers
  // (un edit simple touche 1 fichier ; un edit multi peut en toucher plusieurs).
  const undoStackRef = useRef<FileChange[][]>([]);
  const redoStackRef = useRef<FileChange[][]>([]);
  const [, setHistTick] = useState(0);
  const bumpHist = useCallback(() => setHistTick((n) => n + 1), []);
  const canUndo = undoStackRef.current.length > 0;
  const canRedo = redoStackRef.current.length > 0;

  const sendToAgent = useCallback((msg: ParentToAgentMessage) => {
    iframeRef.current?.contentWindow?.postMessage(msg, '*');
  }, []);

  const handleRefresh = useCallback(() => {
    if (iframeRef.current) iframeRef.current.src = iframeRef.current.src;
  }, []);

  /* -------- URL du serveur de dev -------- */
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

  /* -------- Injection / retrait de l'instrumentation -------- */
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
    // L'historique undo/redo ne vaut que pour la session d'édition en cours.
    undoStackRef.current = [];
    redoStackRef.current = [];
    bumpHist();

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
      applyPlan(buildRemovePlan(useFileStore.getState().files));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  /* -------- Historique (undo / redo) -------- */
  const commit = useCallback(
    async (changes: FileChange[]) => {
      if (!changes.length) return;
      for (const c of changes) await updateContent(c.filePath, c.after);
      undoStackRef.current.push(changes);
      if (undoStackRef.current.length > 60) undoStackRef.current.shift();
      redoStackRef.current = []; // toute nouvelle action invalide le redo
      bumpHist();
    },
    [updateContent, bumpHist]
  );

  const undo = useCallback(async () => {
    const entry = undoStackRef.current.pop();
    if (!entry) return;
    for (const c of entry) await updateContent(c.filePath, c.before);
    redoStackRef.current.push(entry);
    setSelected([]); // les offsets changent → on abandonne la sélection
    bumpHist();
  }, [updateContent, bumpHist]);

  const redo = useCallback(async () => {
    const entry = redoStackRef.current.pop();
    if (!entry) return;
    for (const c of entry) await updateContent(c.filePath, c.after);
    undoStackRef.current.push(entry);
    setSelected([]);
    bumpHist();
  }, [updateContent, bumpHist]);

  /* -------- Raccourcis clavier côté parent (focus hors iframe) -------- */
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((k === 'z' && e.shiftKey) || k === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, undo, redo]);

  /* -------- Application d'un résultat (mono-élément) -------- */
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
      const before = getContent(filePath);
      if (result.code !== before) await commit([{ filePath, before, after: result.code }]);
      if (!opts.keepSelection) setSelected([]);
    },
    [commit, getContent, t]
  );

  /* -------- Édition par lot (multi-sélection) -------- */
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
      const changes: FileChange[] = [];
      let anyFail = false;
      for (const [file, starts] of Object.entries(groups)) {
        const before = getContent(file);
        let code = before;
        starts.sort((a, b) => b - a);
        for (const start of starts) {
          const res = make(code, start);
          if (res.ok && res.code !== undefined) code = res.code;
          else anyFail = true;
        }
        if (code !== before) changes.push({ filePath: file, before, after: code });
      }
      if (changes.length) await commit(changes);
      if (anyFail && softFailMessage) toast.info(softFailMessage);
      setSelected([]);
    },
    [getContent, commit]
  );

  const deleteIds = useCallback(
    (ids: string[]) => applyBatch(ids, (c, s) => deleteElement(c, s), t('editMode.deleteUnsupported')),
    [applyBatch, t]
  );

  /* -------- Messages de l'agent -------- */
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!isAgentMessage(event.data)) return;
      const msg = event.data;
      switch (msg.type) {
        case 'AGENT_READY':
          setAgentReady(true);
          sendToAgent({ source: IDEM_SOURCE, type: 'ENABLE_EDIT', enabled: true });
          if (selectedIdsRef.current.length)
            sendToAgent({ source: IDEM_SOURCE, type: 'SET_SELECTION', ids: selectedIdsRef.current });
          break;
        case 'SELECTED':
          setSelected(msg.elements);
          break;
        case 'TEXT_EDIT': {
          const ref = decodeIdemId(msg.id);
          if (ref)
            applyResult(ref.filePath, editText(getContent(ref.filePath), ref.start, msg.text), {
              keepSelection: true,
            });
          break;
        }
        case 'REORDER': {
          const ref = decodeIdemId(msg.id);
          const beforeRef = decodeIdemId(msg.beforeId);
          if (ref)
            applyResult(
              ref.filePath,
              reorderSiblings(getContent(ref.filePath), ref.start, beforeRef ? beforeRef.start : null),
              { keepSelection: false, softFailMessage: t('editMode.reorderUnsupported') }
            );
          break;
        }
        case 'DELETE_ELEMENTS':
          deleteIds(msg.ids);
          break;
        case 'UNDO':
          undo();
          break;
        case 'REDO':
          redo();
          break;
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
  }, [sendToAgent, applyResult, deleteIds, undo, redo, getContent, t]);

  /* -------- Handlers du panneau -------- */
  const applyStyle = useCallback(
    (cssProp: string, value: string) => {
      if (!selected.length) return;
      if (selected.length === 1) {
        const ref = decodeIdemId(selected[0].id);
        if (ref)
          applyResult(ref.filePath, editStyle(getContent(ref.filePath), ref.start, cssProp, value), {
            keepSelection: true,
          });
      } else {
        applyBatch(selected.map((e) => e.id), (c, s) => editStyle(c, s, cssProp, value));
      }
    },
    [selected, applyResult, applyBatch, getContent]
  );

  const applyAttr = useCallback(
    (name: string, value: string | null) => {
      if (!primary) return;
      const ref = decodeIdemId(primary.id);
      if (ref)
        applyResult(ref.filePath, editAttribute(getContent(ref.filePath), ref.start, name, value), {
          keepSelection: true,
        });
    },
    [primary, applyResult, getContent]
  );

  const applyText = useCallback(
    (text: string) => {
      if (!primary) return;
      const ref = decodeIdemId(primary.id);
      if (ref)
        applyResult(ref.filePath, editText(getContent(ref.filePath), ref.start, text), {
          keepSelection: true,
        });
    },
    [primary, applyResult, getContent]
  );

  const applyImageUrl = useCallback(
    (src: string) => {
      if (!primary) return;
      const ref = decodeIdemId(primary.id);
      if (ref)
        applyResult(ref.filePath, editImageSrc(getContent(ref.filePath), ref.start, src), {
          keepSelection: true,
        });
    },
    [primary, applyResult, getContent]
  );

  const uploadImage = useCallback(
    (file: File, asBackground: boolean) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== 'string') return;
        if (asBackground) applyStyle('backgroundImage', `url("${reader.result}")`);
        else applyImageUrl(reader.result);
      };
      reader.readAsDataURL(file);
    },
    [applyStyle, applyImageUrl]
  );

  const deselect = useCallback(() => {
    setSelected([]);
    sendToAgent({ source: IDEM_SOURCE, type: 'SET_SELECTION', ids: [] });
  }, [sendToAgent]);

  const handlers: Handlers = {
    onStyle: applyStyle,
    onAttr: applyAttr,
    onText: applyText,
    onImageUrl: applyImageUrl,
    onUpload: uploadImage,
  };

  return (
    <div className="w-full h-full flex overflow-hidden bg-white dark:bg-[#1e1e1e]">
      <div className="flex-1 relative flex flex-col overflow-hidden">
        <div className="h-10 flex items-center gap-2 px-3 bg-[#f3f3f3] dark:bg-[#1a1a1a] border-b border-[#e4e4e4] dark:border-[#333]">
          <div className="flex items-center gap-1.5 text-xs text-[#6D28D9] dark:text-[#a78bfa] min-w-0">
            <MousePointerClick size={14} className="shrink-0" />
            <span className="truncate">{t('editMode.hint')}</span>
          </div>
          <div className="flex-1" />
          <button
            onClick={undo}
            disabled={!canUndo}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-[#2c2c2c] text-gray-600 dark:text-gray-400 disabled:opacity-30 disabled:hover:bg-transparent"
            title={`${t('editMode.undo')} (Ctrl+Z)`}
            aria-label={t('editMode.undo')}
          >
            <Undo2 size={15} />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-[#2c2c2c] text-gray-600 dark:text-gray-400 disabled:opacity-30 disabled:hover:bg-transparent"
            title={`${t('editMode.redo')} (Ctrl+Y)`}
            aria-label={t('editMode.redo')}
          >
            <Redo2 size={15} />
          </button>
          <div className="w-px h-5 bg-gray-300 dark:bg-[#3a3a3a] mx-1" />
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
                {multi ? t('editMode.multiSelected', { count: selected.length }) : primary?.kind}
              </span>
              <button className="text-xs text-gray-500 hover:text-[#6D28D9]" onClick={deselect}>
                {t('editMode.deselect')}
              </button>
            </div>

            {multi ? (
              <MultiControls onStyle={applyStyle} />
            ) : (
              primary && <SingleControls info={primary} handlers={handlers} />
            )}

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

/* ================================================================== */
/* Contrôles contextuels                                               */
/* ================================================================== */

interface Handlers {
  onStyle: (cssProp: string, value: string) => void;
  onAttr: (name: string, value: string | null) => void;
  onText: (text: string) => void;
  onImageUrl: (src: string) => void;
  onUpload: (file: File, asBackground: boolean) => void;
}

const CONTAINERS = ['container', 'list', 'generic'];

const SingleControls: React.FC<{ info: SelectedElementInfo; handlers: Handlers }> = ({
  info,
  handlers,
}) => {
  const { onStyle, onAttr, onText, onImageUrl, onUpload } = handlers;
  const kind = info.kind;
  const allowBgImage = CONTAINERS.includes(kind) || info.hasBackgroundImage;

  return (
    <>
      {/* Contenu texte */}
      {info.textEditable && kind !== 'image' && kind !== 'icon' && (
        <TextContent info={info} onText={onText} />
      )}

      {/* Image */}
      {kind === 'image' && (
        <ImageSection info={info} onImageUrl={onImageUrl} onUpload={onUpload} onStyle={onStyle} onAttr={onAttr} />
      )}

      {/* Lien */}
      {(kind === 'link' || (kind === 'button' && info.attrs.href !== undefined)) && (
        <LinkSection info={info} onAttr={onAttr} />
      )}

      {/* Champ de saisie */}
      {kind === 'input' && (
        <Section icon={<Type size={14} />} title="Placeholder">
          <AttrInput info={info} name="placeholder" onAttr={onAttr} placeholder="…" />
        </Section>
      )}

      {/* Icône */}
      {kind === 'icon' && (
        <>
          <Section icon={<Palette size={14} />} title="Icon">
            <ColorRow labelKey="editMode.textColor" cssProp="color" info={info} onStyle={onStyle} />
          </Section>
          <SizeSection info={info} onStyle={onStyle} />
        </>
      )}

      {/* Typographie (texte, titres, liens, boutons, inputs) */}
      {['heading', 'text', 'link', 'button', 'input'].includes(kind) && (
        <TypographySection info={info} onStyle={onStyle} />
      )}

      {/* Mise en page (conteneurs / listes) */}
      {CONTAINERS.includes(kind) && <LayoutSection info={info} onStyle={onStyle} />}

      {/* Fond */}
      {kind !== 'image' && kind !== 'icon' && (
        <BackgroundSection
          info={info}
          onStyle={onStyle}
          onUpload={onUpload}
          allowImage={allowBgImage}
        />
      )}

      {/* Taille (image / conteneurs) */}
      {(kind === 'image' || CONTAINERS.includes(kind)) && (
        <SizeSection info={info} onStyle={onStyle} />
      )}

      {/* Espacement */}
      <SpacingSection info={info} onStyle={onStyle} />
    </>
  );
};

const MultiControls: React.FC<{ onStyle: (p: string, v: string) => void }> = ({ onStyle }) => (
  <>
    <TypographySection info={null} onStyle={onStyle} />
    <BackgroundSection info={null} onStyle={onStyle} allowImage={false} />
    <SpacingSection info={null} onStyle={onStyle} />
  </>
);

/* ---------- sections ---------- */

const TextContent: React.FC<{ info: SelectedElementInfo; onText: (t: string) => void }> = ({
  info,
  onText,
}) => {
  const { t } = useTranslation();
  return (
    <Section icon={<Type size={14} />} title={t('editMode.text')}>
      <textarea
        key={info.id}
        defaultValue={info.text}
        rows={3}
        className="w-full text-sm rounded border border-gray-300 dark:border-[#444] bg-white dark:bg-[#2c2c2c] p-2 text-gray-800 dark:text-gray-100 resize-y"
        onBlur={(e) => {
          if (e.target.value !== info.text) onText(e.target.value);
        }}
      />
      <p className="text-[11px] text-gray-400 mt-1">{t('editMode.textHint')}</p>
    </Section>
  );
};

const ImageSection: React.FC<{
  info: SelectedElementInfo;
  onImageUrl: (s: string) => void;
  onUpload: (f: File, bg: boolean) => void;
  onStyle: (p: string, v: string) => void;
  onAttr: (n: string, v: string | null) => void;
}> = ({ info, onImageUrl, onUpload, onStyle, onAttr }) => {
  const { t } = useTranslation();
  const inputId = `idem-img-${info.id}`;
  return (
    <Section icon={<ImageIcon size={14} />} title={t('editMode.image')}>
      {info.src && (
        <div className="mb-2 rounded border border-gray-200 dark:border-[#444] overflow-hidden bg-[repeating-conic-gradient(#eee_0_25%,#fff_0_50%)] bg-[length:16px_16px]">
          <img src={info.src} alt="" className="max-h-28 w-full object-contain" />
        </div>
      )}
      <div className="flex gap-1.5">
        <input
          id={inputId}
          key={info.id}
          type="text"
          defaultValue={info.src}
          placeholder="https://…"
          className="flex-1 min-w-0 text-sm rounded border border-gray-300 dark:border-[#444] bg-white dark:bg-[#2c2c2c] p-2 text-gray-800 dark:text-gray-100"
          onKeyDown={(e) => {
            const el = e.target as HTMLInputElement;
            if (e.key === 'Enter' && el.value && el.value !== info.src) onImageUrl(el.value);
          }}
        />
        <button
          className="px-2 rounded bg-[#6D28D9] text-white text-xs hover:bg-[#5b21b6]"
          onClick={() => {
            const el = document.getElementById(inputId) as HTMLInputElement | null;
            if (el && el.value && el.value !== info.src) onImageUrl(el.value);
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
            if (f) onUpload(f, false);
            e.target.value = '';
          }}
        />
      </label>
      <div className="mt-3 space-y-3">
        <AttrRow labelKey="editMode.alt" info={info} name="alt" onAttr={onAttr} />
        <SelectRow
          labelKey="editMode.objectFit"
          cssProp="objectFit"
          info={info}
          onStyle={onStyle}
          options={['cover', 'contain', 'fill', 'none', 'scale-down']}
        />
        <SelectRow
          labelKey="editMode.objectPosition"
          cssProp="objectPosition"
          info={info}
          onStyle={onStyle}
          options={['center', 'top', 'bottom', 'left', 'right']}
        />
        <RangeRow labelKey="editMode.opacity" cssProp="opacity" info={info} onStyle={onStyle} />
      </div>
    </Section>
  );
};

const LinkSection: React.FC<{
  info: SelectedElementInfo;
  onAttr: (n: string, v: string | null) => void;
}> = ({ info, onAttr }) => {
  const { t } = useTranslation();
  const newTab = info.attrs.target === '_blank';
  return (
    <Section icon={<LinkIcon size={14} />} title={t('editMode.link')}>
      <AttrInput info={info} name="href" onAttr={onAttr} placeholder="https://… or /page" />
      <label className="flex items-center gap-2 mt-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer">
        <input
          type="checkbox"
          checked={newTab}
          onChange={(e) => {
            if (e.target.checked) {
              onAttr('target', '_blank');
              onAttr('rel', 'noopener noreferrer');
            } else {
              onAttr('target', null);
              onAttr('rel', null);
            }
          }}
        />
        {t('editMode.openNewTab')}
      </label>
    </Section>
  );
};

const TypographySection: React.FC<{
  info: SelectedElementInfo | null;
  onStyle: (p: string, v: string) => void;
}> = ({ info, onStyle }) => {
  const { t } = useTranslation();
  return (
    <Section icon={<Type size={14} />} title={t('editMode.typography')}>
      <div className="space-y-3">
        <ColorRow labelKey="editMode.textColor" cssProp="color" info={info} onStyle={onStyle} />
        <PxRow labelKey="editMode.fontSize" cssProp="fontSize" info={info} onStyle={onStyle} />
        <SelectRow
          labelKey="editMode.fontWeight"
          cssProp="fontWeight"
          info={info}
          onStyle={onStyle}
          options={[
            ['400', 'Normal'],
            ['500', 'Medium'],
            ['600', 'Semibold'],
            ['700', 'Bold'],
            ['800', 'Extra'],
          ]}
        />
        <SelectRow
          labelKey="editMode.fontStyle"
          cssProp="fontStyle"
          info={info}
          onStyle={onStyle}
          options={['normal', 'italic']}
        />
        <SelectRow
          labelKey="editMode.transform"
          cssProp="textTransform"
          info={info}
          onStyle={onStyle}
          options={['none', 'uppercase', 'capitalize', 'lowercase']}
        />
        <PxRow labelKey="editMode.lineHeight" cssProp="lineHeight" info={info} onStyle={onStyle} />
        <AlignRow onStyle={onStyle} />
      </div>
    </Section>
  );
};

const LayoutSection: React.FC<{
  info: SelectedElementInfo | null;
  onStyle: (p: string, v: string) => void;
}> = ({ info, onStyle }) => {
  const { t } = useTranslation();
  return (
    <Section icon={<LayoutGrid size={14} />} title={t('editMode.layout')}>
      <div className="space-y-3">
        <SelectRow
          labelKey="editMode.display"
          cssProp="display"
          info={info}
          onStyle={onStyle}
          options={['block', 'flex', 'inline-flex', 'grid', 'none']}
        />
        <SelectRow
          labelKey="editMode.direction"
          cssProp="flexDirection"
          info={info}
          onStyle={onStyle}
          options={['row', 'column', 'row-reverse', 'column-reverse']}
        />
        <SelectRow
          labelKey="editMode.justify"
          cssProp="justifyContent"
          info={info}
          onStyle={onStyle}
          options={['flex-start', 'center', 'flex-end', 'space-between', 'space-around']}
        />
        <SelectRow
          labelKey="editMode.alignItems"
          cssProp="alignItems"
          info={info}
          onStyle={onStyle}
          options={['stretch', 'flex-start', 'center', 'flex-end']}
        />
        <PxRow labelKey="editMode.gap" cssProp="gap" info={info} onStyle={onStyle} />
      </div>
    </Section>
  );
};

const BackgroundSection: React.FC<{
  info: SelectedElementInfo | null;
  onStyle: (p: string, v: string) => void;
  onUpload?: (f: File, bg: boolean) => void;
  allowImage: boolean;
}> = ({ info, onStyle, onUpload, allowImage }) => {
  const { t } = useTranslation();
  const bg = extractBgUrl(cval(info, 'backgroundImage'));
  const inputId = `idem-bg-${info?.id ?? 'multi'}`;
  const applyBg = (value: string) => {
    if (value) onStyle('backgroundImage', `url("${value}")`);
  };
  return (
    <Section icon={<Palette size={14} />} title={t('editMode.background')}>
      <div className="space-y-3">
        <ColorRow
          labelKey="editMode.bgColor"
          cssProp="backgroundColor"
          info={info}
          onStyle={onStyle}
          fallback="#ffffff"
        />
        {allowImage && (
          <div className="space-y-2 pt-1 border-t border-gray-200 dark:border-[#3a3a3a]">
            <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              {t('editMode.bgImage')}
            </span>
            {bg && (
              <div className="rounded border border-gray-200 dark:border-[#444] overflow-hidden bg-[repeating-conic-gradient(#eee_0_25%,#fff_0_50%)] bg-[length:16px_16px]">
                <img src={bg} alt="" className="max-h-24 w-full object-contain" />
              </div>
            )}
            <div className="flex gap-1.5">
              <input
                id={inputId}
                key={inputId}
                type="text"
                defaultValue={bg}
                placeholder="https://…"
                className="flex-1 min-w-0 text-sm rounded border border-gray-300 dark:border-[#444] bg-white dark:bg-[#2c2c2c] p-2 text-gray-800 dark:text-gray-100"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applyBg((e.target as HTMLInputElement).value);
                }}
              />
              <button
                className="px-2 rounded bg-[#6D28D9] text-white text-xs hover:bg-[#5b21b6]"
                onClick={() => {
                  const el = document.getElementById(inputId) as HTMLInputElement | null;
                  if (el) applyBg(el.value);
                }}
              >
                {t('editMode.apply')}
              </button>
            </div>
            <div className="flex gap-1.5">
              {onUpload && (
                <label className="flex-1 flex items-center justify-center gap-2 px-2 py-1.5 rounded border border-dashed border-gray-300 dark:border-[#555] text-xs text-gray-600 dark:text-gray-300 cursor-pointer hover:border-[#6D28D9] hover:text-[#6D28D9]">
                  <Upload size={13} />
                  {t('editMode.upload')}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onUpload(f, true);
                      e.target.value = '';
                    }}
                  />
                </label>
              )}
              {info?.hasBackgroundImage && (
                <button
                  className="px-2 py-1.5 rounded border border-gray-300 dark:border-[#555] text-xs text-gray-600 dark:text-gray-300 hover:border-red-400 hover:text-red-500"
                  onClick={() => onStyle('backgroundImage', 'none')}
                >
                  {t('editMode.removeBgImage')}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </Section>
  );
};

const SizeSection: React.FC<{
  info: SelectedElementInfo | null;
  onStyle: (p: string, v: string) => void;
}> = ({ info, onStyle }) => {
  const { t } = useTranslation();
  return (
    <Section icon={<Ruler size={14} />} title={t('editMode.size')}>
      <div className="space-y-3">
        <PxRow labelKey="editMode.width" cssProp="width" info={info} onStyle={onStyle} />
        <PxRow labelKey="editMode.height" cssProp="height" info={info} onStyle={onStyle} />
      </div>
    </Section>
  );
};

const SpacingSection: React.FC<{
  info: SelectedElementInfo | null;
  onStyle: (p: string, v: string) => void;
}> = ({ info, onStyle }) => {
  const { t } = useTranslation();
  return (
    <Section icon={<Move size={14} />} title={t('editMode.spacing')}>
      <div className="space-y-3">
        <PxRow labelKey="editMode.padding" cssProp="padding" cvKey="paddingTop" info={info} onStyle={onStyle} />
        <PxRow labelKey="editMode.radius" cssProp="borderRadius" info={info} onStyle={onStyle} />
      </div>
    </Section>
  );
};

/* ---------- lignes de contrôle réutilisables ---------- */

const ColorRow: React.FC<{
  labelKey: string;
  cssProp: string;
  info: SelectedElementInfo | null;
  onStyle: (p: string, v: string) => void;
  fallback?: string;
}> = ({ labelKey, cssProp, info, onStyle, fallback }) => {
  const { t } = useTranslation();
  return (
    <Row label={t(labelKey)}>
      <input
        key={`${cssProp}-${info?.id ?? 'multi'}`}
        type="color"
        defaultValue={info ? rgbToHex(cval(info, cssProp)) : fallback ?? '#000000'}
        className="w-8 h-8 rounded cursor-pointer bg-transparent"
        onChange={(e) => onStyle(cssProp, e.target.value)}
      />
    </Row>
  );
};

const PxRow: React.FC<{
  labelKey: string;
  cssProp: string;
  cvKey?: string;
  info: SelectedElementInfo | null;
  onStyle: (p: string, v: string) => void;
}> = ({ labelKey, cssProp, cvKey, info, onStyle }) => {
  const { t } = useTranslation();
  return (
    <Row label={t(labelKey)}>
      <input
        key={`${cssProp}-${info?.id ?? 'multi'}`}
        type="number"
        defaultValue={info ? toPx(cval(info, cvKey ?? cssProp)) : undefined}
        placeholder="—"
        className="w-20 text-sm rounded border border-gray-300 dark:border-[#444] bg-white dark:bg-[#2c2c2c] p-1 text-gray-800 dark:text-gray-100"
        onBlur={(e) => {
          if (e.target.value !== '') onStyle(cssProp, `${e.target.value}px`);
        }}
      />
    </Row>
  );
};

const RangeRow: React.FC<{
  labelKey: string;
  cssProp: string;
  info: SelectedElementInfo | null;
  onStyle: (p: string, v: string) => void;
}> = ({ labelKey, cssProp, info, onStyle }) => {
  const { t } = useTranslation();
  const initial = info ? Math.round((Number.parseFloat(cval(info, cssProp) ?? '1') || 1) * 100) : 100;
  return (
    <Row label={t(labelKey)}>
      <input
        key={`${cssProp}-${info?.id ?? 'multi'}`}
        type="range"
        min={0}
        max={100}
        defaultValue={initial}
        className="w-28"
        onChange={(e) => onStyle(cssProp, String(Number(e.target.value) / 100))}
      />
    </Row>
  );
};

const SelectRow: React.FC<{
  labelKey: string;
  cssProp: string;
  info: SelectedElementInfo | null;
  onStyle: (p: string, v: string) => void;
  options: (string | [string, string])[];
}> = ({ labelKey, cssProp, info, onStyle, options }) => {
  const { t } = useTranslation();
  return (
    <Row label={t(labelKey)}>
      <select
        key={`${cssProp}-${info?.id ?? 'multi'}`}
        defaultValue={info ? cval(info, cssProp) : undefined}
        className="text-sm rounded border border-gray-300 dark:border-[#444] bg-white dark:bg-[#2c2c2c] p-1 text-gray-800 dark:text-gray-100 max-w-[8rem]"
        onChange={(e) => onStyle(cssProp, e.target.value)}
      >
        {options.map((o) => {
          const [value, label] = Array.isArray(o) ? o : [o, o];
          return (
            <option key={value} value={value}>
              {label}
            </option>
          );
        })}
      </select>
    </Row>
  );
};

const AlignRow: React.FC<{ onStyle: (p: string, v: string) => void }> = ({ onStyle }) => {
  const { t } = useTranslation();
  return (
    <Row label={t('editMode.align')}>
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
            onClick={() => onStyle('textAlign', value)}
            aria-label={value}
          >
            <Icon size={14} />
          </button>
        ))}
      </div>
    </Row>
  );
};

const AttrRow: React.FC<{
  labelKey: string;
  info: SelectedElementInfo;
  name: string;
  onAttr: (n: string, v: string | null) => void;
}> = ({ labelKey, info, name, onAttr }) => {
  const { t } = useTranslation();
  return (
    <Row label={t(labelKey)}>
      <input
        key={`${name}-${info.id}`}
        type="text"
        defaultValue={info.attrs[name] ?? ''}
        className="w-36 text-sm rounded border border-gray-300 dark:border-[#444] bg-white dark:bg-[#2c2c2c] p-1 text-gray-800 dark:text-gray-100"
        onBlur={(e) => {
          if (e.target.value !== (info.attrs[name] ?? '')) onAttr(name, e.target.value);
        }}
      />
    </Row>
  );
};

const AttrInput: React.FC<{
  info: SelectedElementInfo;
  name: string;
  onAttr: (n: string, v: string | null) => void;
  placeholder?: string;
}> = ({ info, name, onAttr, placeholder }) => (
  <input
    key={`${name}-${info.id}`}
    type="text"
    defaultValue={info.attrs[name] ?? ''}
    placeholder={placeholder}
    className="w-full text-sm rounded border border-gray-300 dark:border-[#444] bg-white dark:bg-[#2c2c2c] p-2 text-gray-800 dark:text-gray-100"
    onBlur={(e) => {
      if (e.target.value !== (info.attrs[name] ?? '')) onAttr(name, e.target.value);
    }}
  />
);

/* ---------- primitives ---------- */

const Section: React.FC<{ title: string; icon?: React.ReactNode; children: React.ReactNode }> = ({
  title,
  icon,
  children,
}) => (
  <section>
    <h3 className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2 uppercase tracking-wide">
      {icon}
      {title}
    </h3>
    {children}
  </section>
);

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-center justify-between gap-2">
    <span className="text-sm text-gray-600 dark:text-gray-300">{label}</span>
    {children}
  </div>
);

export default EditablePreview;
