/**
 * Les images envoyées depuis le mode Édition partent dans le stockage d'IDEM
 * (`POST /appgen/media/upload`) ; le code ne garde que leur adresse.
 *
 * Avant, le fichier était écrit dans le code en `data:…;base64` : une photo
 * de quelques Mo devenait autant de texte dans un composant, relu par le modèle
 * à chaque tour et renvoyé à chaque sauvegarde et mise en ligne.
 *
 * L'image remplacée n'est jamais supprimée : elle reste à son adresse, et
 * l'annulation (ou une version antérieure du projet) la retrouve.
 */
import useAppGenContextStore from '@/stores/appgenContextSlice';

const IDEM_API = process.env.REACT_APP_IDEM_API_BASE_URL || 'http://localhost:3001';

export class SiteImageUploadError extends Error {
  constructor(
    readonly code: 'too_large' | 'unsupported' | 'login' | 'failed',
    readonly maxBytes?: number
  ) {
    super(code);
  }
}

export async function uploadSiteImage(file: File): Promise<string> {
  const form = new FormData();
  // Le champ texte avant le fichier : multer le lit dans l'ordre du formulaire.
  form.append('projectId', useAppGenContextStore.getState().projectId || 'icode-drafts');
  form.append('file', file, file.name);

  const token = localStorage.getItem('token');
  let response: Response;
  try {
    response = await fetch(`${IDEM_API}/appgen/media/upload`, {
      method: 'POST',
      body: form,
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
  } catch {
    throw new SiteImageUploadError('failed');
  }
  const data = (await response.json().catch(() => null)) as { url?: string; maxBytes?: number } | null;
  if (response.ok && typeof data?.url === 'string') return data.url;
  if (response.status === 413) throw new SiteImageUploadError('too_large', data?.maxBytes);
  if (response.status === 415) throw new SiteImageUploadError('unsupported');
  if (response.status === 401) throw new SiteImageUploadError('login');
  throw new SiteImageUploadError('failed');
}
