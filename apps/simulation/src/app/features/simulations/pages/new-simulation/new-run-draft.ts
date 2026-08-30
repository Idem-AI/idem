import { SimulationOrigin } from '../../models';

/**
 * Brouillon de l'étape « source », mis de côté le temps d'un aller-retour vers
 * le login central.
 *
 * Se connecter impose de quitter la page : sans cela, l'utilisateur qui vient
 * de téléverser son business plan le perdrait, et l'invitation à « d'abord
 * téléverser, se connecter ensuite » n'aurait plus de sens. `sessionStorage`
 * est lié à l'onglet et à l'origine : le brouillon revient avec l'utilisateur,
 * et disparaît avec l'onglet.
 */
const DRAFT_KEY = 'idem_simulation_new_run_draft';

/**
 * Au-delà, on ne met pas le document de côté : `sessionStorage` plafonne aux
 * alentours de 5 Mo, et le base64 ajoute un tiers. L'utilisateur est prévenu
 * dans le dialogue plutôt que de voir son fichier disparaître sans explication.
 */
export const MAX_STASHED_FILE_BYTES = 1_000_000;

interface StoredDraft {
  origin: SimulationOrigin;
  projectId: string | null;
  file: { name: string; type: string; dataUrl: string } | null;
}

export interface NewRunDraft {
  origin: SimulationOrigin;
  projectId: string | null;
  file: File | null;
}

/** Vrai si ce document peut traverser l'aller-retour vers le login. */
export function canStashFile(file: File | null): boolean {
  return !file || file.size <= MAX_STASHED_FILE_BYTES;
}

export async function saveDraft(draft: NewRunDraft): Promise<void> {
  const stored: StoredDraft = {
    origin: draft.origin,
    projectId: draft.projectId,
    file: null,
  };

  if (draft.file && canStashFile(draft.file)) {
    const dataUrl = await readAsDataUrl(draft.file);
    if (dataUrl) {
      stored.file = { name: draft.file.name, type: draft.file.type, dataUrl };
    }
  }

  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(stored));
  } catch {
    // Quota atteint ou stockage refusé : on repart simplement d'une page vide.
  }
}

/** Relit le brouillon et l'oublie : il ne vaut que pour ce retour de login. */
export async function takeDraft(): Promise<NewRunDraft | null> {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(DRAFT_KEY);
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    return null;
  }
  if (!raw) {
    return null;
  }

  try {
    const stored = JSON.parse(raw) as StoredDraft;
    return {
      origin: stored.origin,
      projectId: stored.projectId,
      file: stored.file ? await toFile(stored.file) : null,
    };
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // Rien à nettoyer.
  }
}

function readAsDataUrl(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

async function toFile(stored: NonNullable<StoredDraft['file']>): Promise<File | null> {
  try {
    const blob = await (await fetch(stored.dataUrl)).blob();
    return new File([blob], stored.name, { type: stored.type || blob.type });
  } catch {
    return null;
  }
}
