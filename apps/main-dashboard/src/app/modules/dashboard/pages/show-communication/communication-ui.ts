/**
 * Vocabulaire d'affichage du module Communication.
 *
 * Tout ce qui est purement présentationnel vit ici : les quatre écrans en ont
 * besoin, et le dupliquer aurait produit quatre tables d'icônes divergentes.
 * Aucune dépendance Angular — ce sont des constantes et des fonctions pures.
 */
import {
  ContentChannel,
  ContentIdea,
  ContentStatus,
  FlyerFormat,
  PlanStatus,
  VisualIntent,
} from '../../models/communication.model';

export const FLYER_FORMATS: FlyerFormat[] = ['square', 'story', 'banner', 'post', 'a4'];

export const VISUAL_INTENTS: VisualIntent[] = [
  'awareness',
  'celebration',
  'promotion',
  'recruitment',
  'announcement',
];

/**
 * Canaux proposés à la création d'une période.
 *
 * Volontairement plus courte que l'énumération du modèle : `blog`, `email` et
 * `other` existent côté données (un contenu importé peut les porter) mais
 * n'ajoutent rien à un choix de démarrage, où trop d'options fait hésiter.
 */
export const PLANNABLE_CHANNELS: ContentChannel[] = [
  'instagram',
  'facebook',
  'linkedin',
  'tiktok',
  'x',
  'youtube',
];

export const CHANNEL_ICONS: Record<ContentChannel, string> = {
  instagram: 'pi pi-instagram',
  facebook: 'pi pi-facebook',
  linkedin: 'pi pi-linkedin',
  tiktok: 'pi pi-tiktok',
  x: 'pi pi-twitter',
  youtube: 'pi pi-youtube',
  blog: 'pi pi-file-edit',
  email: 'pi pi-envelope',
  other: 'pi pi-globe',
};

export function channelIcon(channel: ContentChannel | undefined): string {
  return (channel && CHANNEL_ICONS[channel]) || 'pi pi-globe';
}

/** Proportions d'aperçu, pour que la vignette ait la forme du format réel. */
export const FORMAT_ASPECT: Record<FlyerFormat, string> = {
  square: '1 / 1',
  story: '9 / 16',
  banner: '40 / 21',
  post: '4 / 5',
  a4: '1 / 1.414',
};

export function formatAspect(format: FlyerFormat | undefined): string {
  return (format && FORMAT_ASPECT[format]) || '1 / 1';
}

/**
 * Classes de la pastille de statut d'un contenu.
 *
 * Chaque statut a sa couleur ET son intensité : lue en niveaux de gris ou par un
 * œil daltonien, la progression idée → publié reste lisible.
 */
export function statusPillClass(status: ContentStatus | undefined): string {
  switch (status) {
    case 'published':
      return 'text-[var(--color-success)] border-[var(--color-success)]/40 bg-[var(--color-success)]/10';
    case 'scheduled':
      return 'text-[var(--color-accent-500)] border-[var(--color-accent-500)]/40 bg-[var(--color-accent-500)]/10';
    case 'approved':
      return 'text-[var(--color-primary-500)] border-[var(--color-primary-500)]/40 bg-[var(--color-primary-500)]/10';
    default:
      return 'text-[var(--color-text-tertiary)] border-[var(--glass-border)] bg-transparent';
  }
}

export function planStatusPillClass(status: PlanStatus | undefined): string {
  switch (status) {
    case 'active':
      return 'text-[var(--color-success)] border-[var(--color-success)]/40 bg-[var(--color-success)]/10';
    case 'done':
      return 'text-[var(--color-text-tertiary)] border-[var(--glass-border)] bg-transparent';
    case 'archived':
      return 'text-[var(--color-text-tertiary)] border-[var(--glass-border)] bg-transparent opacity-70';
    default:
      return 'text-[var(--color-accent-500)] border-[var(--color-accent-500)]/40 bg-[var(--color-accent-500)]/10';
  }
}

/** Date ISO du jour (YYYY-MM-DD) — les templates ne peuvent pas appeler `new Date()`. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysIso(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Premier jour du mois prochain — la proposition par défaut d'une période. */
export function firstDayOfNextMonth(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
    .toISOString()
    .slice(0, 10);
}

/** Dernier jour du mois d'une date ISO. */
export function lastDayOfMonth(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))
    .toISOString()
    .slice(0, 10);
}

/** Premier jour du mois en cours. */
export function firstDayOfThisMonth(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

/**
 * Raccourcis de période proposés avant toute saisie de date.
 *
 * Trois choix couvrent la quasi-totalité des cas réels ; taper deux dates est
 * réservé à qui en a vraiment besoin. Demander d'emblée un calendrier à qui veut
 * juste « organiser le mois prochain » est le premier point où l'on perd
 * quelqu'un qui ne connaît rien au marketing.
 */
export type PeriodPreset = 'thisMonth' | 'nextMonth' | 'twoWeeks' | 'custom';

export function presetRange(preset: PeriodPreset): { start: string; end: string } {
  switch (preset) {
    case 'thisMonth': {
      const start = firstDayOfThisMonth();
      return { start, end: lastDayOfMonth(start) };
    }
    case 'nextMonth': {
      const start = firstDayOfNextMonth();
      return { start, end: lastDayOfMonth(start) };
    }
    case 'twoWeeks': {
      const start = todayIso();
      return { start, end: addDaysIso(start, 13) };
    }
    default: {
      const start = todayIso();
      return { start, end: addDaysIso(start, 27) };
    }
  }
}

/** Libellé lisible d'une période : « du 1 novembre au 30 novembre ». */
export function formatRange(start: string, end: string, locale?: string): string {
  if (!start || !end) return '';
  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  };
  const from = new Date(`${start}T00:00:00Z`).toLocaleDateString(locale, options);
  const to = new Date(`${end}T00:00:00Z`).toLocaleDateString(locale, options);
  return `${from} → ${to}`;
}

export function daysBetweenIso(start: string, end: string): number {
  const a = Date.parse(`${start}T00:00:00Z`);
  const b = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 1;
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

/**
 * Nombre de contenus qu'une période produira.
 *
 * Affiché AVANT la génération : c'est ce qui rend le prix compréhensible, et ce
 * qui évite de demander à l'utilisateur un nombre qu'un calcul connaît déjà.
 */
export function expectedItemCount(start: string, end: string, postsPerWeek: number): number {
  const days = daysBetweenIso(start, end);
  return Math.min(40, Math.max(1, Math.round((days / 7) * postsPerWeek)));
}

/** Contenus d'une période regroupés par semaine, semaines ordonnées. */
export function groupByWeek(items: ContentIdea[]): { week: number; items: ContentIdea[] }[] {
  const byWeek = new Map<number, ContentIdea[]>();
  for (const item of items) {
    const week = item.week || 1;
    const list = byWeek.get(week) ?? [];
    list.push(item);
    byWeek.set(week, list);
  }
  return Array.from(byWeek.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([week, list]) => ({
      week,
      items: [...list].sort((a, b) => (a.scheduledFor || '').localeCompare(b.scheduledFor || '')),
    }));
}
