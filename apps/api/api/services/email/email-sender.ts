/**
 * Quelle adresse signe un e-mail, d'après son modèle.
 *
 *  - `no-reply@` : rien à répondre (connexion, alertes automatiques) ;
 *  - `support@`  : argent et accès — une question est probable et doit
 *                  arriver à ceux qui aident ;
 *  - `beta@`     : programme bêta, qui vit de retours ;
 *  - `contact@`  : la conversation entamée par le formulaire de contact, et
 *                  tout modèle pas encore classé.
 *
 * La décision se prend ici et nulle part ailleurs : les appelants donnent leur
 * identifiant de modèle (`template`), le service d'envoi en déduit
 * l'expéditeur. Un nouveau modèle doit être classé ci-dessous ; tant qu'il ne
 * l'est pas, il part de `contact@` — une réponse inattendue reste lue, alors
 * qu'un no-reply par erreur la perdrait.
 *
 * Toutes ces adresses sont des alias du compte SMTP (`SMTP_USER`,
 * contact@idem.africa) chez Private Email : même serveur, même DKIM, même SPF,
 * seul l'en-tête « De » change. Vérifié le 25/11/2026 (envoi autorisé pour
 * chacune). Ne jamais ajouter une adresse qui n'existe pas chez Private Email :
 * le serveur la refuse (553 « not owned by user »).
 *
 * Même règle dans idem-admin (apps/api/api/services/email/email-sender.ts),
 * avec ses propres modèles.
 */

export type EmailSender = 'no-reply' | 'support' | 'beta' | 'contact';

const DOMAIN = 'idem.africa';

/** Par préfixe d'identifiant de modèle. Chaque ligne dit pourquoi. */
const ROUTES: { prefix: string; sender: EmailSender; why: string }[] = [
  { prefix: 'auth-', sender: 'no-reply', why: 'Connexion, confirmation, mot de passe : tout se fait par le lien ou le code.' },
  { prefix: 'suspicious_device', sender: 'no-reply', why: 'Alerte de sécurité : la réponse se donne par les boutons, jamais par e-mail.' },
  { prefix: 'billing.welcome_credit', sender: 'no-reply', why: 'Avis de crédit offert : rien à demander.' },
  { prefix: 'team.', sender: 'no-reply', why: 'Invitation dans l’équipe d’un projet : on répond par les boutons ; une réponse écrite va à la personne qui invite (replyTo).' },
  { prefix: 'meter.', sender: 'no-reply', why: 'Alertes automatiques de solde iDeploy : l’action est dans la console.' },

  { prefix: 'payment.', sender: 'support', why: 'Reçu à citer, paiement échoué : les questions d’argent vont au support.' },
  { prefix: 'subscription.', sender: 'support', why: 'Fin d’accès, renouvellement : une réponse est une demande d’aide.' },

  { prefix: 'beta.', sender: 'beta', why: 'La bêta demande des retours.' },

  { prefix: 'contact.', sender: 'contact', why: 'Formulaire de contact : la conversation continue.' },
];

export function senderForTemplate(template: string): EmailSender {
  return ROUTES.find((route) => template.startsWith(route.prefix))?.sender ?? 'contact';
}

export function senderAddress(sender: EmailSender): string {
  return `${sender}@${DOMAIN}`;
}

/** Adresse de contact, pour les messages construits hors des modèles. */
export function contactAddress(): string {
  return senderAddress('contact');
}
