/**
 * Les marges de plateforme (px de composition) : COPIE de `packages/motion-compiler/src/design/safezones.ts` (le kit
 * est copié seul dans les images ; `check:intent` vérifie qu'elles sont identiques). En story, l'enveloppe prudente
 * des guides 2026 (≈ 900 × 1 400 au centre). Aucune dépendance : lisible côté serveur comme dans la page.
 */
export const PLATFORM_SAFE: Record<string, { x: number; y: number }> = {
  story: { x: 90, y: 260 },
  portrait: { x: 72, y: 96 },
  square: { x: 72, y: 72 },
  landscape: { x: 108, y: 72 },
};

export const BASE_SIZE: Record<string, { width: number; height: number }> = {
  story: { width: 1080, height: 1920 },
  portrait: { width: 1080, height: 1350 },
  square: { width: 1080, height: 1080 },
  landscape: { width: 1920, height: 1080 },
};
