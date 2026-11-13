import mongoose from 'mongoose';
import { Project } from '../../schemas/project.schema';
import type {
  BuilderBrand,
  BuilderTeamMember,
} from '../../../../../packages/shared-models/src/builders/program';

/**
 * Ce que la vitrine Idem Builders lit sur le projet lui-même, au moment où on
 * la regarde : son identité de marque (couleurs, logo, polices) et son équipe.
 *
 * Lu en direct plutôt que copié à l'admission : un logo retravaillé ou une
 * nouvelle recrue apparaissent sur la fiche sans que personne n'ait à la
 * mettre à jour. Rien n'est publié qui ne soit validé ici : couleurs au format
 * hexadécimal, adresses en http(s), textes bornés.
 */

/** Ce dont la vitrine a besoin du projet, et rien de plus. */
export interface ProjectExcerpt {
  id: string;
  description?: string;
  longDescription?: string;
  city?: string;
  branding?: Record<string, any>;
  teamMembers?: Record<string, any>[];
}

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

function hex(value: unknown): string | undefined {
  return typeof value === 'string' && HEX.test(value.trim()) ? value.trim() : undefined;
}

function httpUrl(value: unknown, max = 600): string | undefined {
  if (typeof value !== 'string') return undefined;
  const raw = value.trim();
  if (!/^https?:\/\//i.test(raw) || raw.length > max) return undefined;
  try {
    return new URL(raw).toString();
  } catch {
    return undefined;
  }
}

function text(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const clean = value.replace(/\s+\n/g, '\n').trim();
  return clean ? clean.slice(0, max) : undefined;
}

/** Luminance relative (WCAG) d'une couleur hexadécimale. */
function luminance(color: string): number {
  const value = color.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const channel = parseInt(full.slice(i, i + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Lit les projets d'une liste de candidatures, en une requête. */
export async function loadProjectExcerpts(projectIds: string[]): Promise<Map<string, ProjectExcerpt>> {
  const unique = [...new Set(projectIds.filter(Boolean))];
  if (unique.length === 0) return new Map();

  // `_id` est `Mixed` : selon l'époque du projet, chaîne ou ObjectId.
  const ids: unknown[] = [...unique];
  for (const id of unique) {
    if (mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === id) {
      ids.push(new mongoose.Types.ObjectId(id));
    }
  }

  const docs = await Project.find({ _id: { $in: ids } })
    .select(
      'description longDescription additionalInfos.city additionalInfos.teamMembers analysisResultModel.branding.logo analysisResultModel.branding.colors analysisResultModel.branding.typography'
    )
    .lean();

  return new Map(
    docs.map((doc: any) => [
      String(doc._id),
      {
        id: String(doc._id),
        description: doc.description,
        longDescription: doc.longDescription,
        city: doc.additionalInfos?.city,
        branding: doc.analysisResultModel?.branding,
        teamMembers: doc.additionalInfos?.teamMembers,
      },
    ])
  );
}

/**
 * L'identité d'un projet pour sa couverture et sa charte.
 *
 * Le logo posé sur la couleur principale est la variante prévue pour ce fond
 * (claire sur un fond foncé, et l'inverse). Un logo ancien, enregistré en SVG
 * dans la base plutôt qu'en fichier, est servi par l'API (`logoPath`).
 */
export function brandOf(project: ProjectExcerpt | undefined, logoPath: string): BuilderBrand | undefined {
  const branding = project?.branding;
  const colors = branding?.colors?.colors ?? {};
  const primary = hex(colors.primary);
  if (!primary) return undefined;

  const dark = luminance(primary) < 0.4;
  const logo = branding?.logo ?? {};
  const withText = logo.variations?.withText ?? {};
  const main = httpUrl(logo.svg);
  const inline = typeof logo.svg === 'string' && logo.svg.trim().startsWith('<svg');

  // La version monochrome n'est pas un repli : elle est souvent à la couleur
  // principale, et donnait un logo bleu sur une couverture bleue. Sans
  // déclinaison pour fond sombre, la couverture passe le logo en blanc.
  const onLight = httpUrl(withText.lightBackground) ?? main ?? (inline ? logoPath : undefined);
  const onDark = httpUrl(withText.darkBackground);
  const logoColors = (Array.isArray(logo.colors) ? logo.colors : [])
    .map(hex)
    .filter((color: string | undefined): color is string => Boolean(color))
    .slice(0, 8);

  const palette = (['primary', 'secondary', 'accent', 'background', 'text'] as const)
    .map((role) => ({ role, hex: hex(colors[role]) }))
    .filter((entry): entry is { role: typeof entry.role; hex: string } => Boolean(entry.hex));

  const typography = branding?.typography ?? {};
  const fonts = {
    primary: text(typography.primaryFont, 80),
    secondary: text(typography.secondaryFont, 80),
    stylesheet: httpUrl(typography.url),
  };

  return {
    primary,
    secondary: hex(colors.secondary),
    accent: hex(colors.accent),
    dark,
    logoOnDark: onDark,
    logoOnLight: onLight,
    logoColors: logoColors.length ? logoColors : undefined,
    fonts: fonts.primary || fonts.secondary ? fonts : undefined,
    palette,
  };
}

/** Le SVG d'un logo ancien, enregistré dans la base. */
export function inlineLogo(project: ProjectExcerpt | undefined): string | undefined {
  const svg = project?.branding?.logo?.svg;
  return typeof svg === 'string' && svg.trim().startsWith('<svg') ? svg : undefined;
}

/** L'équipe, telle que la fiche publique la montre : jamais l'adresse e-mail. */
export function teamOf(project: ProjectExcerpt | undefined): BuilderTeamMember[] {
  const members = Array.isArray(project?.teamMembers) ? project!.teamMembers! : [];
  return members
    .map((member) => {
      const name = text(member?.name, 80);
      if (!name) return null;
      const links = {
        linkedin: httpUrl(member?.socialLinks?.linkedin, 300),
        github: httpUrl(member?.socialLinks?.github, 300),
        twitter: httpUrl(member?.socialLinks?.twitter, 300),
      };
      const entry: BuilderTeamMember = {
        name,
        role: text(member?.role, 80),
        bio: text(member?.bio, 600),
        pictureUrl: httpUrl(member?.pictureUrl),
      };
      if (links.linkedin || links.github || links.twitter) entry.links = links;
      return entry;
    })
    .filter((member): member is BuilderTeamMember => member !== null)
    .slice(0, 12);
}

/** Le récit du projet : sa description longue, à défaut la courte. */
export function storyOf(project: ProjectExcerpt | undefined): string | undefined {
  return text(project?.longDescription, 4_000) ?? text(project?.description, 600);
}

export function cityOf(project: ProjectExcerpt | undefined): string | undefined {
  return text(project?.city, 80);
}
