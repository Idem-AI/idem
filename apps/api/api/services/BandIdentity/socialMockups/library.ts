/**
 * La bibliothèque de mockups de réseaux sociaux.
 *
 * Chaque mockup est un GABARIT HTML/CSS — pas une image. C'est ce qui permet d'y
 * poser le logo, la bannière, le nom, la promesse et les visuels d'une marque
 * par simple remplissage, sans modèle d'image et sans retouche au pixel : la
 * page du réseau est redessinée à l'identique en code, et ses emplacements sont
 * des `{{marqueurs}}` nommés.
 *
 * Aucun mockup exploitable n'existait en ligne sous cette forme (les clones
 * HTML trouvés couvrent Instagram seul, avec des interfaces datées et des
 * dépendances de bibliothèques) : les gabarits ont donc été dessinés pour IDEM
 * d'après les interfaces publiques de chaque réseau. Ils vivent dans
 * `public/assets/social-mockups/` — cf. le README du dossier pour la liste des
 * marqueurs et la façon d'en ajouter un.
 */

import fs from 'fs';
import path from 'path';
import logger from '../../../config/logger';

export type SocialMockupNetwork = 'facebook' | 'linkedin' | 'x' | 'youtube' | 'instagram';

/** Format de la bannière attendue par l'emplacement — il porte sa zone sûre. */
export type CoverFormat = 'facebook-cover' | 'linkedin-cover' | 'x-header' | 'youtube-banner';

/**
 * Format du visuel posé dans l'emplacement média.
 *
 * `post`, `square` et `banner` sont les formats du générateur de visuels
 * (`FlyerFormat`) : l'emplacement a EXACTEMENT leur rapport, le visuel n'y est
 * donc jamais recadré. `thumbnail` est une vignette vidéo 16:9, composée par
 * le code.
 */
export type MediaFormat = 'post' | 'square' | 'banner' | 'thumbnail';

export interface SocialMockupTemplate {
  id: string;
  network: SocialMockupNetwork;
  /** `profile` : page ou profil, porte une bannière. `post` : une publication. */
  kind: 'profile' | 'post';
  /** Libellé affiché sous le mockup dans la charte. */
  label: string;
  /** Chemin du gabarit, relatif au dossier de la bibliothèque. */
  file: string;
  width: number;
  height: number;
  cover?: { width: number; height: number; format: CoverFormat };
  media?: { width: number; height: number; format: MediaFormat };
  tiles?: { count: number };
}

/**
 * Les valeurs d'un mockup.
 *
 * `{{clé}}` reçoit la valeur ÉCHAPPÉE — c'est le cas de tout texte, qui vient
 * du projet ou d'un modèle. `{{{clé}}}` reçoit du HTML brut, produit par le
 * code : bannière, vignette, tuiles, liens de polices.
 */
export interface MockupValues {
  brandName: string;
  handle: string;
  category: string;
  bio: string;
  avatarSrc: string;
  avatarGround: string;
  postText?: string;
  caption?: string;
  hashtags?: string;
  title?: string;
  mediaSrc?: string;
  coverHtml?: string;
  mediaHtml?: string;
  tiles?: string;
  fontLinks?: string;
}

const LIBRARY_SUBDIR = path.join('public', 'assets', 'social-mockups');

/**
 * Le dossier de la bibliothèque.
 *
 * `process.cwd()` d'abord : c'est la convention du service PDF, qui lit ses
 * scripts dans `public/`. Les scripts de contrôle ne tournent pas toujours
 * depuis `apps/api`, d'où la remontée depuis ce fichier en repli.
 */
function libraryDir(): string | null {
  const candidates = [path.join(process.cwd(), LIBRARY_SUBDIR)];
  let dir = __dirname;
  for (let depth = 0; depth < 8; depth++) {
    candidates.push(path.join(dir, LIBRARY_SUBDIR));
    dir = path.dirname(dir);
  }
  return candidates.find((candidate) => fs.existsSync(path.join(candidate, 'manifest.json'))) ?? null;
}

let cachedTemplates: SocialMockupTemplate[] | null = null;
const cachedHtml = new Map<string, string>();

/** Les gabarits de la bibliothèque. Vide si le dossier est absent. */
export function loadSocialMockupLibrary(): SocialMockupTemplate[] {
  if (cachedTemplates) return cachedTemplates;
  const dir = libraryDir();
  if (!dir) {
    logger.error(`[SOCIAL MOCKUPS] Bibliothèque introuvable (${LIBRARY_SUBDIR}/manifest.json)`);
    return [];
  }
  const raw = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')) as {
    templates: SocialMockupTemplate[];
  };
  cachedTemplates = raw.templates.filter((template) => {
    const exists = fs.existsSync(path.join(dir, template.file));
    if (!exists) logger.warn(`[SOCIAL MOCKUPS] Gabarit absent : ${template.file}`);
    return exists;
  });
  return cachedTemplates;
}

/** Le HTML d'un gabarit, tel qu'il est versionné. */
export function readMockupTemplate(template: SocialMockupTemplate): string {
  const cached = cachedHtml.get(template.id);
  if (cached) return cached;
  const dir = libraryDir();
  if (!dir) throw new Error('Bibliothèque de mockups introuvable');
  const html = fs.readFileSync(path.join(dir, template.file), 'utf8');
  cachedHtml.set(template.id, html);
  return html;
}

const escapeHtml = (value: string): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * Remplit un gabarit. Un marqueur sans valeur est vidé et signalé : un
 * `{{brandName}}` imprimé tel quel dans une charte serait pire qu'un blanc.
 */
export function fillMockupTemplate(html: string, values: MockupValues, templateId = 'mockup'): string {
  const table = values as unknown as Record<string, string | undefined>;
  const missing = new Set<string>();
  const lookup = (key: string): string => {
    const value = table[key];
    if (value === undefined || value === null) missing.add(key);
    return value ?? '';
  };
  const filled = html
    .replace(/\{\{\{\s*([A-Za-z]+)\s*\}\}\}/g, (_match, key: string) => lookup(key))
    .replace(/\{\{\s*([A-Za-z]+)\s*\}\}/g, (_match, key: string) => escapeHtml(lookup(key)));
  if (missing.size > 0) {
    logger.warn(`[SOCIAL MOCKUPS] ${templateId} : marqueur(s) sans valeur — ${[...missing].join(', ')}`);
  }
  return filled;
}
