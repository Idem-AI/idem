import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RotateCcw, Trash2, FilePlus2, FileMinus2, FileEdit } from 'lucide-react';
import { toast } from 'react-toastify';
import useVersionHistory, { diffSnapshots, type Snapshot } from '@/stores/versionHistory';
import { useFileStore } from '@/components/WeIde/stores/fileStore';

/**
 * Liste des points de restauration.
 *
 * Rendue à l'intérieur du menu d'actions plutôt que depuis son propre bouton
 * dans la barre : restaurer une version est un geste rare, au même titre
 * qu'exporter le code ou pousser sur GitHub, pas une information à garder
 * affichée en permanence.
 */
export function VersionList({ onDone }: { onDone?: () => void }) {
  const { t } = useTranslation();
  const { snapshots, load, remove } = useVersionHistory();
  const { files, setFiles } = useFileStore();
  const [restoring, setRestoring] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, [load]);

  const restore = async (snapshot: Snapshot) => {
    setRestoring(snapshot.id);
    try {
      // L'état courant devient lui-même un point de retour : restaurer ne doit
      // pas être la seule action irréversible de l'application.
      await useVersionHistory
        .getState()
        .capture(t('versions.beforeRestore'), useFileStore.getState().files);
      await setFiles(snapshot.files);
      toast.success(t('versions.restored'));
      onDone?.();
    } catch (error) {
      console.error('[versions] restauration impossible', error);
      toast.error(t('versions.restoreFailed'));
    } finally {
      setRestoring(null);
    }
  };

  if (snapshots.length === 0) {
    return (
      <div className="px-4 py-6 text-center">
        <p className="text-sm text-text-secondary">{t('versions.emptyTitle')}</p>
        <p className="text-xs text-text-tertiary mt-1">{t('versions.emptyBody')}</p>
      </div>
    );
  }

  return (
    <ul className="max-h-[52vh] overflow-y-auto py-1">
      {snapshots.map((snapshot, index) => (
        <SnapshotRow
          key={snapshot.id}
          snapshot={snapshot}
          previous={snapshots[index + 1]}
          current={index === 0 ? files : undefined}
          busy={restoring === snapshot.id}
          onRestore={() => restore(snapshot)}
          onRemove={() => remove(snapshot.id)}
        />
      ))}
    </ul>
  );
}

function SnapshotRow({
  snapshot,
  previous,
  current,
  busy,
  onRestore,
  onRemove,
}: {
  snapshot: Snapshot;
  previous?: Snapshot;
  current?: Record<string, string>;
  busy: boolean;
  onRestore: () => void;
  onRemove: () => void;
}) {
  const { t, i18n } = useTranslation();

  const delta = useMemo(
    () => diffSnapshots(previous?.files, snapshot.files),
    [previous, snapshot]
  );

  const isCurrent = useMemo(() => {
    if (!current) return false;
    const d = diffSnapshots(snapshot.files, current);
    return !d.added.length && !d.changed.length && !d.removed.length;
  }, [current, snapshot]);

  const time = new Intl.DateTimeFormat(i18n.language, {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: 'short',
  }).format(snapshot.createdAt);

  return (
    <li className="group px-3 py-2 hover:bg-surface-2 transition-colors">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] text-text-primary truncate">{snapshot.label}</p>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-text-tertiary">
            <time dateTime={new Date(snapshot.createdAt).toISOString()}>{time}</time>
            {isCurrent && (
              <span className="px-1.5 rounded bg-primary/12 text-primary">
                {t('versions.current')}
              </span>
            )}
          </div>

          {(delta.added.length > 0 || delta.changed.length > 0 || delta.removed.length > 0) && (
            <div className="mt-1 flex items-center gap-2.5 text-[11px] text-text-tertiary tabular-nums">
              {delta.added.length > 0 && (
                <span className="flex items-center gap-1 text-success">
                  <FilePlus2 className="w-3 h-3" />
                  {delta.added.length}
                </span>
              )}
              {delta.changed.length > 0 && (
                <span className="flex items-center gap-1">
                  <FileEdit className="w-3 h-3" />
                  {delta.changed.length}
                </span>
              )}
              {delta.removed.length > 0 && (
                <span className="flex items-center gap-1 text-danger">
                  <FileMinus2 className="w-3 h-3" />
                  {delta.removed.length}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={onRestore}
            disabled={busy || isCurrent}
            title={t('versions.restore')}
            aria-label={t('versions.restore')}
            className="w-7 h-7 grid place-items-center rounded-md text-text-tertiary hover:text-primary hover:bg-surface-3 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={onRemove}
            title={t('versions.remove')}
            aria-label={t('versions.remove')}
            className="w-7 h-7 grid place-items-center rounded-md text-text-tertiary hover:text-danger hover:bg-surface-3 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </li>
  );
}

export default VersionList;
