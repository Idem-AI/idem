import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { ImageUp, X } from 'lucide-react';
import { IdemLoader } from '@idem/shared-loader/react';
import Button from '@/components/ui/Button';
import useAppGenContextStore from '@/stores/appgenContextSlice';
import { assessSiteImages, enhanceSiteImages, type FlaggedImage, type ImageSlot } from '@/api/siteImageQuality';
import { storedAssetUrl } from '../WeIde/services/webcontainer/insecureAssets';
import { useFileStore } from '../WeIde/stores/fileStore';

/**
 * LES IMAGES FLOUES D'UNE REFONTE, proposées à l'amélioration — jamais imposée.
 *
 * Le site refait s'affiche d'abord tel quel. Une fois l'aperçu chargé, le pont du site (`renderEntry`, en
 * développement seulement) rapporte la place de chaque image ; l'API dit lesquelles paraîtront floues À LEUR PLACE
 * (mesure par le code). S'il y en a, ce bandeau le dit au-dessus de l'aperçu, sans le couvrir. Sur accord, chaque
 * image améliorée remplace l'ancienne dans le code dès qu'elle est prête (l'aperçu se met à jour par Vite) ; les
 * originales restent stockées et « Revenir aux originales » les rétablit.
 *
 * Seules les images recopiées d'un ancien site (`/site-assets/`) sont concernées : un site sans refonte n'affiche
 * jamais rien. La mesure se fait en vue large (≥ 1 024 px), la plus exigeante.
 */

const SOURCE = 'idem-preview';
/** Première demande après que la page s'est posée, puis relances tant que le site compile encore. */
const SETTLE_MS = 2500;
const RETRY_MS = 3000;
const ATTEMPTS = 6;
const DESKTOP_MIN = 1024;

type Phase = 'idle' | 'offer' | 'running' | 'done' | 'error' | 'closed';

interface Flagged extends FlaggedImage {
  /** L'adresse vue par l'aperçu (copie locale en développement). */
  previewSrc: string;
  displayWidth: number;
  displayHeight: number;
}

const memoryKey = (projectId: string) => `idem.imageQuality.${projectId}`;
const remembered = (projectId: string): boolean => {
  try {
    return sessionStorage.getItem(memoryKey(projectId)) === 'closed';
  } catch {
    return false;
  }
};
const remember = (projectId: string) => {
  try {
    sessionStorage.setItem(memoryKey(projectId), 'closed');
  } catch {
    // stockage indisponible : le bandeau reviendra au prochain chargement, sans gravité
  }
};

/** Remplace une adresse par une autre dans tous les fichiers du projet qui la citent (`src/site/media.ts` surtout). */
async function swapUrl(from: string, to: string): Promise<void> {
  const { files, updateContent } = useFileStore.getState();
  for (const [path, content] of Object.entries(files)) {
    if (typeof content === 'string' && content.includes(from)) await updateContent(path, content.split(from).join(to));
  }
}

export function SiteImageQualityBanner({ iframeRef, active, reloadKey }: { iframeRef: RefObject<HTMLIFrameElement>; active: boolean; reloadKey: string }) {
  const { t } = useTranslation();
  const projectId = useAppGenContextStore((state) => state.projectId);
  const [phase, setPhase] = useState<Phase>('idle');
  const [flagged, setFlagged] = useState<Flagged[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0, improved: 0 });
  /** Adresse d'origine → adresse améliorée, pour revenir en arrière. */
  const swapped = useRef(new Map<string, string>());
  const abort = useRef<AbortController | null>(null);

  // Relevé de l'aperçu, une fois la page posée ; seulement tant que rien n'a été proposé.
  useEffect(() => {
    if (!active || !projectId || phase !== 'idle' || remembered(projectId)) return;
    const frame = iframeRef.current;
    if (!frame) return;
    const requestId = Math.random().toString(36).slice(2);
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const onMessage = async (event: MessageEvent) => {
      const data = event.data as { source?: string; type?: string; id?: string; viewportWidth?: number; images?: ImageSlot[] } | null;
      if (!data || data.source !== SOURCE || data.type !== 'IMAGES' || data.id !== requestId || event.source !== frame.contentWindow) return;
      window.removeEventListener('message', onMessage);
      clearTimeout(timer);
      if ((data.viewportWidth ?? 0) < DESKTOP_MIN || !Array.isArray(data.images)) return;
      const slots = data.images
        .map((image) => ({ ...image, previewSrc: image.url, url: storedAssetUrl(image.url) }))
        .filter((image) => image.url.includes('/site-assets/') && !/-hd-[a-z0-9]+\.webp/i.test(image.url));
      if (!slots.length) return;
      const results = await assessSiteImages(projectId, slots.map(({ url, displayWidth, displayHeight }) => ({ url, displayWidth, displayHeight }))).catch(() => []);
      if (cancelled || !results.length) return;
      setFlagged(results.map((result) => ({ ...result, ...slots.find((slot) => slot.url === result.url)! })));
      setPhase('offer');
    };
    // Un site généré avant le 21/11/2026 n'a pas de pont : les relances s'épuisent sans rien afficher.
    let attempt = 0;
    const ask = () => {
      if (cancelled || attempt++ >= ATTEMPTS) return;
      frame.contentWindow?.postMessage({ source: SOURCE, type: 'MEASURE_IMAGES', id: requestId }, '*');
      timer = setTimeout(ask, RETRY_MS);
    };
    window.addEventListener('message', onMessage);
    timer = setTimeout(ask, SETTLE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      window.removeEventListener('message', onMessage);
    };
  }, [active, projectId, phase, iframeRef, reloadKey]);

  // Un autre projet : tout recommence.
  useEffect(() => {
    setPhase('idle');
    setFlagged([]);
    swapped.current.clear();
  }, [projectId]);

  useEffect(() => () => abort.current?.abort(), []);

  const highlight = useCallback(
    (urls: string[]) => iframeRef.current?.contentWindow?.postMessage({ source: SOURCE, type: 'HIGHLIGHT_IMAGES', urls }, '*'),
    [iframeRef]
  );

  const close = () => {
    if (projectId) remember(projectId);
    highlight([]);
    setPhase('closed');
  };

  const enhance = async () => {
    if (!projectId) return;
    // Celles qui restent : une reprise après une coupure ne refait pas les images déjà améliorées.
    const pending = flagged.filter((image) => !swapped.current.has(image.url));
    if (!pending.length) return;
    abort.current?.abort();
    abort.current = new AbortController();
    highlight([]);
    setPhase('running');
    setProgress({ done: 0, total: pending.length, improved: swapped.current.size });
    try {
      await enhanceSiteImages(
        projectId,
        pending.map(({ url, displayWidth, displayHeight }) => ({ url, displayWidth, displayHeight })),
        (event) => {
          if (event.type !== 'image') return;
          setProgress((value) => ({ ...value, done: value.done + 1, improved: value.improved + (event.status === 'done' ? 1 : 0) }));
          if (event.status === 'done') {
            swapped.current.set(event.url, event.enhancedUrl);
            void swapUrl(event.url, event.enhancedUrl);
          }
        },
        abort.current.signal
      );
      if (projectId) remember(projectId);
      setPhase('done');
    } catch {
      setPhase('error');
    }
  };

  const revert = async () => {
    for (const [original, enhanced] of Array.from(swapped.current.entries())) await swapUrl(enhanced, original);
    swapped.current.clear();
    setProgress((value) => ({ ...value, improved: 0 }));
    setPhase('closed');
  };

  if (phase === 'idle' || phase === 'closed') return null;

  return (
    <div role="status" aria-live="polite" className="shrink-0 border-b border-[var(--glass-border)] bg-surface-2 px-3 py-2.5">
      <div className="flex items-start gap-2.5">
        {phase === 'running' ? <IdemLoader size="xs" /> : <ImageUp size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />}
        <div className="min-w-0 flex-1">
          {phase === 'offer' && (
            <>
              <p className="text-sm font-semibold text-text-primary">{t('preview.imageQuality.offerTitle', { count: flagged.length })}</p>
              <p className="mt-0.5 text-xs text-text-secondary text-pretty">{t('preview.imageQuality.offerBody')}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button variant="primary" size="sm" onClick={enhance}>
                  {t('preview.imageQuality.enhance')}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => highlight(flagged.map((image) => image.previewSrc))}>
                  {t('preview.imageQuality.show')}
                </Button>
                <Button variant="ghost" size="sm" onClick={close}>
                  {t('preview.imageQuality.later')}
                </Button>
              </div>
            </>
          )}
          {phase === 'running' && (
            <>
              <p className="text-sm font-semibold text-text-primary">{t('preview.imageQuality.runningTitle')}</p>
              <p className="mt-0.5 text-xs text-text-secondary">{t('preview.imageQuality.runningBody', { done: progress.done, total: progress.total })}</p>
              <progress className="mt-2 block h-1 w-full" max={progress.total || 1} value={progress.done} aria-label={t('preview.imageQuality.runningTitle')} />
            </>
          )}
          {phase === 'done' && (
            <>
              <p className="text-sm font-semibold text-text-primary">
                {progress.improved ? t('preview.imageQuality.doneTitle', { count: progress.improved }) : t('preview.imageQuality.doneNone')}
              </p>
              {progress.improved > 0 && (
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <p className="text-xs text-text-secondary">{t('preview.imageQuality.doneBody')}</p>
                  <Button variant="ghost" size="sm" onClick={revert}>
                    {t('preview.imageQuality.revert')}
                  </Button>
                </div>
              )}
            </>
          )}
          {phase === 'error' && (
            <>
              <p className="text-sm text-text-primary">{t('preview.imageQuality.error')}</p>
              <Button variant="primary" size="sm" onClick={enhance} className="mt-2">
                {t('preview.imageQuality.retry')}
              </Button>
            </>
          )}
        </div>
        {phase !== 'running' && (
          <button
            type="button"
            onClick={close}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-text-tertiary hover:bg-surface-3 hover:text-text-primary"
            aria-label={t('preview.imageQuality.close')}
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
