/**
 * Le contact du site, posé par IDEM. Le site n'a pas de serveur : un
 * formulaire n'« envoie » rien, il ouvre WhatsApp ou la messagerie avec le
 * message déjà écrit, vers les coordonnées réelles du projet.
 *
 *   const href = messageLink(`Bonjour, je m'appelle ${nom}. ${message}`);
 *   if (href) window.open(href, '_blank', 'noopener');
 */
import { site } from '@/site/data';

type Channel = { label: string; value: string; href: string };

const channels = (): Channel[] => ((site as { contact?: { channels?: Channel[] } }).contact?.channels ?? []);

/** Le canal qui reçoit les messages : WhatsApp d'abord, puis l'e-mail. */
export function contactChannel(): Channel | null {
  const list = channels();
  return list.find((channel) => channel.href.startsWith('https://wa.me/')) ?? list.find((channel) => channel.href.startsWith('mailto:')) ?? null;
}

/** Le lien qui ouvre ce message dans WhatsApp ou la messagerie ; `null` si le projet n'a ni l'un ni l'autre. */
export function messageLink(message: string, subject = 'Demande depuis le site'): string | null {
  const channel = contactChannel();
  if (!channel) return null;
  const text = encodeURIComponent(message.trim());
  if (channel.href.startsWith('https://wa.me/')) return `${channel.href.split('?')[0]}?text=${text}`;
  return `${channel.href.split('?')[0]}?subject=${encodeURIComponent(subject)}&body=${text}`;
}
