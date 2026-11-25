/**
 * L'APERÇU RETENU PENDANT UNE MODIFICATION.
 *
 * Quand l'agent modifie un site qui tourne déjà, l'aperçu garde la version qui fonctionnait jusqu'à ce que l'agent
 * ait fini : l'utilisateur continue de tester à côté sans voir le site passer par des états à moitié écrits (une page
 * avant ses sections, un import vers un fichier pas encore là). Les fichiers arrivent dans l'éditeur au fil de l'eau ;
 * seuls la WebContainer et l'aperçu instantané attendent. À la fin, tout part d'un coup et l'aperçu redémarre.
 *
 * La PREMIÈRE génération n'est pas retenue : il n'y a rien à garder, et le site apparaît section par section.
 * Un atelier vidé (refonte, « régénérer ») lève aussi le verrou : c'est une nouvelle génération.
 */
import { create } from 'zustand';

interface PreviewHoldState {
  /** Une modification de l'agent est en cours : l'aperçu ne change pas. */
  held: boolean;
  /** Des changements attendent la fin (quelque chose a été écrit pendant le verrou). */
  pending: boolean;
}

export const usePreviewHold = create<PreviewHoldState>(() => ({ held: false, pending: false }));

const listeners = new Set<(changed: boolean) => void>();

export const isPreviewHeld = (): boolean => usePreviewHold.getState().held;

/** Retient l'aperçu (début d'une modification). */
export function holdPreview(): void {
  if (isPreviewHeld()) return;
  usePreviewHold.setState({ held: true, pending: false });
}

/** Un changement a été mis de côté ; il partira à la levée du verrou. */
export function markPreviewPending(): void {
  if (isPreviewHeld() && !usePreviewHold.getState().pending) usePreviewHold.setState({ pending: true });
}

/** Fin de la modification : les changements retenus partent, l'aperçu redémarre. Sans effet si rien n'est retenu. */
export function releasePreview(): void {
  if (!isPreviewHeld()) return;
  const changed = usePreviewHold.getState().pending;
  usePreviewHold.setState({ held: false, pending: false });
  listeners.forEach((listener) => {
    try {
      listener(changed);
    } catch (error) {
      console.warn('[aperçu retenu]', error);
    }
  });
}

/** Appelé à chaque levée du verrou, avec `true` si des changements attendaient. */
export function onPreviewRelease(listener: (changed: boolean) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
