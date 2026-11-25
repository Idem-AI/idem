import { BLOG_KINDS_INFO, isBlogKind, type SeoLocale } from '@idem/shared-seo';
import type { BlogEvent, BlogKind, BlogPostSummary } from '../models/blog.model';

/**
 * Ce que la page du blog et la page d'un billet disent d'un type et d'un événement. Les noms des
 * types viennent de `@idem/shared-seo` : les mêmes que dans les pages servies aux robots, le
 * `llms.txt` et le panel.
 */

export function kindLabel(kind: BlogKind, locale: SeoLocale): string {
  return (BLOG_KINDS_INFO[kind] ?? BLOG_KINDS_INFO.article).label[locale];
}

export function kindPlural(kind: BlogKind, locale: SeoLocale): string {
  return (BLOG_KINDS_INFO[kind] ?? BLOG_KINDS_INFO.article).plural[locale];
}

export function kindDescription(kind: BlogKind, locale: SeoLocale): string {
  return (BLOG_KINDS_INFO[kind] ?? BLOG_KINDS_INFO.article).description[locale];
}

export function parseKind(value: string | null): BlogKind | null {
  return isBlogKind(value) ? value : null;
}

/** Un événement sans fin reste « en cours » six heures après son début (même règle que l'API). */
const EVENT_GRACE_MS = 6 * 60 * 60 * 1000;

export function isPastEvent(event: BlogEvent | undefined, now = Date.now()): boolean {
  if (!event) return false;
  const end = event.endsAt ? Date.parse(event.endsAt) : Date.parse(event.startsAt) + EVENT_GRACE_MS;
  return end < now;
}

const LANG: Record<SeoLocale, string> = { fr: 'fr-FR', en: 'en-GB' };

/** Le jour et le mois d'un événement, pour la pastille de date (« 05 » / « déc. »). */
export function eventDay(event: BlogEvent, locale: SeoLocale): { day: string; month: string } {
  const zone = event.timezone || 'Africa/Douala';
  const date = new Date(event.startsAt);
  return {
    day: new Intl.DateTimeFormat(LANG[locale], { day: '2-digit', timeZone: zone }).format(date),
    month: new Intl.DateTimeFormat(LANG[locale], { month: 'short', timeZone: zone }).format(date),
  };
}

/**
 * La date d'un événement, à l'heure du lieu, avec la ville du fuseau quand elle diffère de celle
 * du visiteur (« jeudi 4 décembre 2026, 10:00 – 12:00 · heure de Douala »).
 */
export function eventWhen(event: BlogEvent, locale: SeoLocale): string {
  const zone = event.timezone || 'Africa/Douala';
  const full = new Intl.DateTimeFormat(LANG[locale], { dateStyle: 'full', timeStyle: 'short', timeZone: zone });
  const time = new Intl.DateTimeFormat(LANG[locale], { timeStyle: 'short', timeZone: zone });
  const dayKey = new Intl.DateTimeFormat('en-CA', { dateStyle: 'short', timeZone: zone });
  const start = new Date(event.startsAt);
  let text = full.format(start);
  if (event.endsAt) {
    const end = new Date(event.endsAt);
    text += ` – ${dayKey.format(start) === dayKey.format(end) ? time.format(end) : full.format(end)}`;
  }
  const visitor = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (visitor !== zone) {
    const city = zone.split('/').pop()!.replace(/_/g, ' ');
    text += locale === 'fr' ? ` · heure de ${city}` : ` · ${city} time`;
  }
  return text;
}

/** Où se tient l'événement, en une ligne. */
export function eventPlace(event: BlogEvent, locale: SeoLocale): string {
  const online = locale === 'fr' ? 'En ligne' : 'Online';
  return [event.location, event.online ? online : ''].filter(Boolean).join(' · ');
}

/** Un fichier .ics (agenda) pour l'événement, en adresse `data:` téléchargeable. */
export function icsHref(post: BlogPostSummary, url: string): string | null {
  const event = post.event;
  if (!event) return null;
  const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const end = event.endsAt ?? new Date(Date.parse(event.startsAt) + 60 * 60 * 1000).toISOString();
  const text = (s: string) => s.replace(/\\/g, '\\\\').replace(/([,;])/g, '\\$1').replace(/\n/g, '\\n');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//IDEM//Blog//FR',
    'BEGIN:VEVENT',
    `UID:${post.slug}@idem.africa`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(event.startsAt)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${text(post.title)}`,
    `DESCRIPTION:${text(`${post.excerpt}\n${url}`)}`,
    ...(event.location ? [`LOCATION:${text(event.location)}`] : []),
    `URL:${url}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join('\r\n'))}`;
}
