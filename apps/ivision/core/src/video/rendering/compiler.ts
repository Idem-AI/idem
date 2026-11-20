/**
 * Le dossier du runtime navigateur (`apps/ivision/core/motion`) — gardé pour `assets/lottie.ts`, qui y compile ses
 * clips Lottie à la demande ; `IDEM_MOTION_ROOT` peut l'imposer.
 */
import fs from 'fs';
import path from 'path';

function findMotionRoot(): string {
  const candidates = [
    process.env.IDEM_MOTION_ROOT,
    path.resolve(__dirname, '../../../motion'),
    // Lancé depuis `dist/` sans copie : les sources du dépôt.
    path.resolve(__dirname.replace(/[\\/]dist[\\/](?:apps[\\/]ivision[\\/]api[\\/]dist[\\/])?/, path.sep), '../../../motion'),
  ].filter((c): c is string => !!c);
  return candidates.find((c) => fs.existsSync(path.join(c, 'lottie-library', 'index.json'))) || candidates[candidates.length - 1];
}

export const MOTION_ROOT = findMotionRoot();
