/**
 * Accès au système de design forgé côté serveur.
 *
 * Forger ne coûte rien (calcul pur, aucun appel modèle), donc l'interface peut
 * rejouer la forge à chaque ajustement sans se soucier du budget.
 */

export interface ArtDirectionSummary {
  id: string;
  name: string;
  registers: string[];
  surface: 'light' | 'dark';
  colorStrategy: string;
  radius: number;
  signature: string;
}

export interface FontPairing {
  display: string;
  body: string;
  displayWeights: string;
  bodyWeights: string;
}

export interface DesignSystem {
  seed: number;
  register: 'marketing' | 'product';
  direction: ArtDirectionSummary & {
    spacingBase: number;
    typeRatio: number;
    borders: string;
    shadows: string;
    cadence: string;
    avoid: string;
  };
  brandDriven: boolean;
  fonts: FontPairing & { mono: string; fromBrand?: boolean };
  colors: {
    brand: Record<string, string>;
    neutral: Record<string, string>;
    accent: string;
    secondary: string;
    surface: string;
    surfaceRaised: string;
    ink: string;
    inkMuted: string;
  };
  contrast: {
    bodyOnSurface: number;
    mutedOnSurface: number;
    inkOnAccent: number;
  };
  typeScale: Record<string, string>;
  fontsHrefs: string[];
}

export interface ForgeOverrides {
  brandColor?: string;
  directionId?: string;
  fontPairingDisplay?: string;
}

export interface ForgeResponse {
  system: DesignSystem;
  brief: string;
  catalog: {
    directions: ArtDirectionSummary[];
    fontPairings: FontPairing[];
  };
}

const apiBase = () => process.env.REACT_APP_BASE_URL || '';

export async function forgeDesignSystem(
  projectData: unknown,
  overrides?: ForgeOverrides,
  signal?: AbortSignal
): Promise<ForgeResponse> {
  const response = await fetch(`${apiBase()}/api/design/forge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectData, overrides }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Design forge failed: ${response.status}`);
  }

  return (await response.json()) as ForgeResponse;
}
