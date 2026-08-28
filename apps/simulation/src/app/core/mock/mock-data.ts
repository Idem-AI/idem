import { environment } from '@env';

/** Clé de stockage du choix explicite de l'utilisateur. */
export const MOCK_STORAGE_KEY = 'idem_simulation_mock_data';

/** `?mock=on` / `?mock=off` dans l'URL : bascule sans reconstruire l'app. */
export const MOCK_QUERY_PARAM = 'mock';

const ON = new Set(['on', '1', 'true', 'yes']);
const OFF = new Set(['off', '0', 'false', 'no']);

/**
 * Résout la source de données à utiliser.
 *
 * Trois niveaux, du plus fort au plus faible :
 *  1. `?mock=on|off` dans l'URL — mémorisé, pour partager un lien de démo ;
 *  2. le choix mémorisé dans le navigateur ;
 *  3. `USE_MOCK_DATA` du `.env`, valeur de repli à la construction.
 *
 * Fonction pure et sans Angular : elle est appelée au démarrage, avant que
 * l'injecteur ne soit disponible.
 */
export function isMockDataEnabled(): boolean {
  const fromUrl = readQueryOverride();
  if (fromUrl !== null) {
    writeStoredPreference(fromUrl);
    return fromUrl;
  }

  const stored = readStoredPreference();
  return stored ?? environment.useMockData;
}

/** Vrai si la valeur active vient d'un choix explicite, pas du `.env`. */
export function hasMockOverride(): boolean {
  return readStoredPreference() !== null;
}

export function readStoredPreference(): boolean | null {
  try {
    const raw = localStorage.getItem(MOCK_STORAGE_KEY);
    if (raw === null) {
      return null;
    }
    return ON.has(raw) ? true : OFF.has(raw) ? false : null;
  } catch {
    // Navigation privée : on retombe sur la valeur du build.
    return null;
  }
}

export function writeStoredPreference(value: boolean | null): void {
  try {
    if (value === null) {
      localStorage.removeItem(MOCK_STORAGE_KEY);
    } else {
      localStorage.setItem(MOCK_STORAGE_KEY, value ? 'on' : 'off');
    }
  } catch {
    // Le choix ne survivra pas à la session : acceptable pour un mode démo.
  }
}

function readQueryOverride(): boolean | null {
  try {
    const raw = new URLSearchParams(location.search).get(MOCK_QUERY_PARAM);
    if (raw === null) {
      return null;
    }
    const value = raw.toLowerCase();
    return ON.has(value) ? true : OFF.has(value) ? false : null;
  } catch {
    return null;
  }
}
