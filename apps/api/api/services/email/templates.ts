import {
  BRAND,
  bullets,
  escapeHtml,
  formatDate,
  formatXaf,
  panel,
  paragraph,
  quote,
  renderEmail,
  toPlainText,
} from './email-layout';

/**
 * Modèles d'e-mails transactionnels.
 *
 * Chaque modèle renvoie un objet complet — objet, HTML, texte — et rien
 * d'autre : il ne lit pas la base, n'envoie rien, ne décide de rien. Cette
 * séparation permet de les rendre dans un test ou un aperçu sans SMTP ni
 * données réelles.
 *
 * Le ton suit une règle simple : dire ce qui s'est passé, puis ce que la
 * personne peut faire. Pas de superlatif, pas de fausse urgence — ces messages
 * accompagnent de l'argent, et la confiance se perd vite.
 */

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const CONSOLE_URL = process.env.IDEM_FRONTEND_URL || BRAND.console;

/** Salutation : personnalisée quand on connaît le prénom, neutre sinon. */
function greeting(firstName?: string): string {
  return firstName ? `Bonjour ${escapeHtml(firstName)},` : 'Bonjour,';
}

const ENGINE_LABELS: Record<string, string> = {
  business: 'iBusiness',
  appgen: 'iCode',
  ideploy: 'iDeploy',
};

export function engineLabel(engine?: string | null): string {
  return ENGINE_LABELS[engine ?? ''] ?? 'IDEM';
}

// ============================================
// PAIEMENTS
// ============================================

export interface PaymentReceiptParams {
  firstName?: string;
  reference: string;
  label: string;
  amountXaf: number;
  provider: string;
  providerTransactionId?: string;
  paidAt: Date;
  /** Crédits accordés par l'achat, s'il en accorde. */
  credits?: number;
  engine?: string | null;
}

export function paymentReceipt(params: PaymentReceiptParams): RenderedEmail {
  const rows = [
    { label: 'Offre', value: escapeHtml(params.label) },
    { label: 'Montant', value: formatXaf(params.amountXaf) },
    { label: 'Référence', value: escapeHtml(params.reference) },
    { label: 'Date', value: formatDate(params.paidAt) },
  ];

  if (params.providerTransactionId) {
    rows.push({ label: 'Transaction opérateur', value: escapeHtml(params.providerTransactionId) });
  }

  const body = [
    paragraph(greeting(params.firstName)),
    paragraph('Votre paiement est bien arrivé. Voici votre reçu.'),
    panel('Reçu de paiement', rows),
    params.credits
      ? paragraph(
          `<strong>${params.credits} crédits ${escapeHtml(engineLabel(params.engine))}</strong> ont été ajoutés à votre compte.`
        )
      : '',
    paragraph(
      `Conservez la référence <strong>${escapeHtml(params.reference)}</strong> : elle nous permet de retrouver ce paiement en quelques secondes si vous nous écrivez.`
    ),
  ].join('');

  return {
    subject: `Reçu IDEM — ${params.label} (${params.reference})`,
    html: renderEmail({
      title: 'Paiement confirmé',
      subtitle: formatXaf(params.amountXaf),
      preheader: `Votre paiement de ${formatXaf(params.amountXaf)} pour ${params.label} est confirmé.`,
      body,
      cta: { label: 'Ouvrir mon espace', url: CONSOLE_URL },
    }),
    text: toPlainText(
      'Paiement confirmé',
      [
        greetingText(params.firstName),
        'Votre paiement est bien arrivé.',
        `Offre : ${params.label}`,
        `Montant : ${formatXaf(params.amountXaf)}`,
        `Référence : ${params.reference}`,
        `Date : ${formatDate(params.paidAt)}`,
        params.credits ? `${params.credits} crédits ${engineLabel(params.engine)} ajoutés.` : '',
      ],
      { label: 'Ouvrir mon espace', url: CONSOLE_URL }
    ),
  };
}

export interface PaymentFailedParams {
  firstName?: string;
  reference: string;
  label: string;
  amountXaf: number;
  reason: string;
  hint?: string | null;
  retryUrl?: string;
}

export function paymentFailed(params: PaymentFailedParams): RenderedEmail {
  const body = [
    paragraph(greeting(params.firstName)),
    paragraph(`Votre paiement pour <strong>${escapeHtml(params.label)}</strong> n'a pas abouti.`),
    panel('Détail', [
      { label: 'Offre', value: escapeHtml(params.label) },
      { label: 'Montant', value: formatXaf(params.amountXaf) },
      { label: 'Motif', value: escapeHtml(params.reason) },
      { label: 'Référence', value: escapeHtml(params.reference) },
    ]),
    params.hint ? paragraph(escapeHtml(params.hint)) : '',
    // Dire explicitement que rien n'a été débité évite l'inquiétude la plus
    // fréquente après un échec de paiement Mobile Money.
    paragraph('Aucun montant n\'a été prélevé sur votre compte Mobile Money.'),
  ].join('');

  return {
    subject: `Paiement non abouti — ${params.label}`,
    html: renderEmail({
      title: 'Paiement non abouti',
      preheader: `${params.reason} — aucun montant n'a été prélevé.`,
      body,
      cta: params.retryUrl ? { label: 'Réessayer', url: params.retryUrl } : undefined,
    }),
    text: toPlainText(
      'Paiement non abouti',
      [
        greetingText(params.firstName),
        `Votre paiement pour ${params.label} n'a pas abouti.`,
        `Motif : ${params.reason}`,
        params.hint ?? '',
        `Référence : ${params.reference}`,
        "Aucun montant n'a été prélevé sur votre compte Mobile Money.",
      ],
      params.retryUrl ? { label: 'Réessayer', url: params.retryUrl } : undefined
    ),
  };
}

// ============================================
// ABONNEMENTS
// ============================================

export interface RenewalReminderParams {
  firstName?: string;
  planName: string;
  engine: string;
  amountXaf: number;
  dueDate: Date;
  /** Jours restants ; 0 = échéance aujourd'hui. */
  daysLeft: number;
  payUrl: string;
  graceDays: number;
}

export function renewalReminder(params: RenewalReminderParams): RenderedEmail {
  const today = params.daysLeft <= 0;

  const body = [
    paragraph(greeting(params.firstName)),
    paragraph(
      today
        ? `Votre abonnement <strong>${escapeHtml(params.planName)}</strong> (${escapeHtml(engineLabel(params.engine))}) arrive à échéance aujourd'hui.`
        : `Votre abonnement <strong>${escapeHtml(params.planName)}</strong> (${escapeHtml(engineLabel(params.engine))}) arrive à échéance dans ${params.daysLeft} jour${params.daysLeft > 1 ? 's' : ''}.`
    ),
    panel('Renouvellement', [
      { label: 'Offre', value: escapeHtml(params.planName) },
      { label: 'Montant', value: formatXaf(params.amountXaf) },
      { label: 'Échéance', value: formatDate(params.dueDate) },
    ]),
    // Le Mobile Money n'ayant pas de prélèvement automatique, il faut dire à
    // la fois que l'action est nécessaire ET qu'un oubli n'est pas irréversible.
    paragraph(
      `Le règlement se fait en Mobile Money, en une fois. Passé l'échéance, votre accès reste ouvert ${params.graceDays} jours — au-delà, votre compte repasse à l'offre gratuite et vos crédits déjà acquis restent utilisables jusqu'à leur expiration.`
    ),
  ].join('');

  return {
    subject: today
      ? `Votre abonnement ${params.planName} arrive à échéance aujourd'hui`
      : `Votre abonnement ${params.planName} arrive à échéance dans ${params.daysLeft} jours`,
    html: renderEmail({
      title: 'Renouvellement à prévoir',
      subtitle: `${params.planName} — ${formatXaf(params.amountXaf)}`,
      preheader: `Échéance le ${formatDate(params.dueDate)} · règlement en Mobile Money.`,
      body,
      cta: { label: 'Renouveler maintenant', url: params.payUrl },
    }),
    text: toPlainText(
      'Renouvellement à prévoir',
      [
        greetingText(params.firstName),
        `Votre abonnement ${params.planName} (${engineLabel(params.engine)}) arrive à échéance le ${formatDate(params.dueDate)}.`,
        `Montant : ${formatXaf(params.amountXaf)}`,
        `Passé l'échéance, votre accès reste ouvert ${params.graceDays} jours.`,
      ],
      { label: 'Renouveler', url: params.payUrl }
    ),
  };
}

export interface GraceStartedParams {
  firstName?: string;
  planName: string;
  engine: string;
  amountXaf: number;
  graceEndsAt: Date;
  payUrl: string;
}

export function graceStarted(params: GraceStartedParams): RenderedEmail {
  const body = [
    paragraph(greeting(params.firstName)),
    paragraph(
      `L'échéance de votre abonnement <strong>${escapeHtml(params.planName)}</strong> est passée. Votre accès reste ouvert jusqu'au <strong>${formatDate(params.graceEndsAt)}</strong>.`
    ),
    panel('À régler', [
      { label: 'Offre', value: escapeHtml(params.planName) },
      { label: 'Montant', value: formatXaf(params.amountXaf) },
      { label: 'Accès maintenu jusqu\'au', value: formatDate(params.graceEndsAt) },
    ]),
    paragraph(
      'Sans règlement à cette date, votre compte repasse à l\'offre gratuite. Rien n\'est supprimé : vos projets, documents et applications restent en place.'
    ),
  ].join('');

  return {
    subject: `Accès maintenu jusqu'au ${formatDate(params.graceEndsAt)} — ${params.planName}`,
    html: renderEmail({
      title: 'Échéance dépassée',
      subtitle: `Accès maintenu jusqu'au ${formatDate(params.graceEndsAt)}`,
      preheader: 'Votre accès reste ouvert quelques jours, le temps de régler.',
      body,
      cta: { label: 'Régler mon abonnement', url: params.payUrl },
    }),
    text: toPlainText(
      'Échéance dépassée',
      [
        greetingText(params.firstName),
        `Votre accès à ${params.planName} reste ouvert jusqu'au ${formatDate(params.graceEndsAt)}.`,
        `Montant : ${formatXaf(params.amountXaf)}`,
        "Sans règlement, le compte repasse à l'offre gratuite. Rien n'est supprimé.",
      ],
      { label: 'Régler mon abonnement', url: params.payUrl }
    ),
  };
}

export interface SubscriptionExpiredParams {
  firstName?: string;
  planName: string;
  engine: string;
  payUrl: string;
}

export function subscriptionExpired(params: SubscriptionExpiredParams): RenderedEmail {
  const body = [
    paragraph(greeting(params.firstName)),
    paragraph(
      `Votre abonnement <strong>${escapeHtml(params.planName)}</strong> a pris fin. Votre compte est repassé à l'offre gratuite ${escapeHtml(engineLabel(params.engine))}.`
    ),
    bullets([
      'Vos projets, documents et applications restent en place.',
      'Vos crédits déjà acquis restent utilisables jusqu\'à leur expiration.',
      'Vous pouvez reprendre votre offre à tout moment, sans frais de remise en service.',
    ]),
  ].join('');

  return {
    subject: `Votre abonnement ${params.planName} a pris fin`,
    html: renderEmail({
      title: 'Abonnement terminé',
      preheader: 'Votre compte est repassé à l\'offre gratuite. Rien n\'est supprimé.',
      body,
      cta: { label: 'Reprendre mon offre', url: params.payUrl },
    }),
    text: toPlainText(
      'Abonnement terminé',
      [
        greetingText(params.firstName),
        `Votre abonnement ${params.planName} a pris fin ; votre compte est repassé à l'offre gratuite.`,
        'Vos projets et vos crédits acquis restent en place.',
      ],
      { label: 'Reprendre mon offre', url: params.payUrl }
    ),
  };
}

// ============================================
// BÊTA PREMIUM
// ============================================

export interface BetaInvitationParams {
  firstName?: string;
  /** Noms des offres ouvertes, dans l'ordre d'affichage. */
  plans: string[];
  monthlyCredits: { business: number; appgen: number };
  endsAt?: Date | null;
  /** Mot écrit par l'équipe dans le panel admin. */
  personalMessage?: string;
  /** Valeur mensuelle des offres, calculée depuis le catalogue. */
  monthlyValueXaf?: number;
}

export function betaInvitation(params: BetaInvitationParams): RenderedEmail {
  const untilLine = params.endsAt
    ? `jusqu'au <strong>${formatDate(params.endsAt)}</strong>`
    : 'pendant toute la durée de la bêta';

  const body = [
    paragraph(greeting(params.firstName)),
    paragraph(
      `Vous faites partie des <strong>bêta-testeurs premium d'IDEM</strong>. Concrètement : nos offres les plus complètes vous sont ouvertes, gratuitement, ${untilLine}.`
    ),
    params.personalMessage ? quote(params.personalMessage) : '',
    bullets(params.plans.map((plan) => escapeHtml(plan))),
    panel('Vos crédits mensuels', [
      { label: 'iBusiness', value: `${params.monthlyCredits.business} crédits/mois` },
      { label: 'iCode', value: `${params.monthlyCredits.appgen} crédits/mois` },
      ...(params.monthlyValueXaf
        ? [{ label: 'Valeur mensuelle', value: formatXaf(params.monthlyValueXaf) }]
        : []),
    ]),
    paragraph(
      'Ils se rechargent chaque mois. Rien à saisir, rien à payer : votre compte est déjà à jour.'
    ),
    paragraph(
      'En échange, une seule chose : dites-nous ce qui coince. Un écran confus, une génération ratée, une lenteur — c\'est exactement ce que nous cherchons avant l\'ouverture publique.'
    ),
  ].join('');

  return {
    subject: 'Vous êtes bêta-testeur premium IDEM',
    html: renderEmail({
      title: 'Bienvenue parmi les bêta-testeurs premium',
      subtitle: 'Nos offres les plus complètes, gratuitement',
      preheader: 'Vos offres premium sont déjà actives sur votre compte IDEM.',
      body,
      cta: { label: 'Ouvrir mon espace IDEM', url: CONSOLE_URL },
      footerNote:
        'Vous recevez ce message parce que votre adresse figure parmi les bêta-testeurs sélectionnés.',
    }),
    text: toPlainText(
      'Bienvenue parmi les bêta-testeurs premium IDEM',
      [
        greetingText(params.firstName),
        `Nos offres les plus complètes vous sont ouvertes gratuitement${params.endsAt ? ` jusqu'au ${formatDate(params.endsAt)}` : ''}.`,
        params.personalMessage ?? '',
        params.plans.map((plan) => `- ${plan}`).join('\n'),
        `Crédits mensuels : ${params.monthlyCredits.business} iBusiness + ${params.monthlyCredits.appgen} iCode.`,
        'Dites-nous ce qui coince : c\'est ce que nous cherchons avant l\'ouverture publique.',
      ],
      { label: 'Ouvrir mon espace IDEM', url: CONSOLE_URL }
    ),
  };
}

export interface BetaEndingParams {
  firstName?: string;
  endsAt: Date;
  daysLeft: number;
  plansUrl: string;
}

export function betaEnding(params: BetaEndingParams): RenderedEmail {
  const ended = params.daysLeft <= 0;

  const body = [
    paragraph(greeting(params.firstName)),
    paragraph(
      ended
        ? `Votre accès bêta premium a pris fin le <strong>${formatDate(params.endsAt)}</strong>. Votre compte est repassé aux offres gratuites.`
        : `Votre accès bêta premium prend fin le <strong>${formatDate(params.endsAt)}</strong>, dans ${params.daysLeft} jour${params.daysLeft > 1 ? 's' : ''}.`
    ),
    bullets([
      'Tout ce que vous avez produit reste à vous : projets, documents, applications.',
      'Vos crédits déjà accordés restent utilisables jusqu\'à leur expiration.',
      'Les offres payantes commencent à 2 999 F/mois, réglables en Mobile Money.',
    ]),
    paragraph('Merci : vos retours ont directement changé le produit.'),
  ].join('');

  return {
    subject: ended
      ? 'Votre accès bêta premium a pris fin'
      : `Votre accès bêta premium prend fin le ${formatDate(params.endsAt)}`,
    html: renderEmail({
      title: ended ? 'Fin de la bêta premium' : 'Votre bêta premium se termine bientôt',
      preheader: 'Vos projets et vos crédits acquis restent en place.',
      body,
      cta: { label: 'Voir les offres', url: params.plansUrl },
    }),
    text: toPlainText(
      ended ? 'Fin de la bêta premium' : 'Votre bêta premium se termine bientôt',
      [
        greetingText(params.firstName),
        ended
          ? `Votre accès bêta premium a pris fin le ${formatDate(params.endsAt)}.`
          : `Votre accès bêta premium prend fin le ${formatDate(params.endsAt)}.`,
        'Vos projets et vos crédits acquis restent en place.',
        'Merci : vos retours ont directement changé le produit.',
      ],
      { label: 'Voir les offres', url: params.plansUrl }
    ),
  };
}

// ============================================
// CRÉDIT DE BIENVENUE
// ============================================

export interface WelcomeCreditParams {
  firstName?: string;
  business: number;
  appgen: number;
  expiresAt: Date;
}

export function welcomeCredit(params: WelcomeCreditParams): RenderedEmail {
  const body = [
    paragraph(greeting(params.firstName)),
    paragraph(
      'IDEM passe à un fonctionnement par crédits : chaque livrable a un prix clair, affiché avant de lancer la génération.'
    ),
    panel('Offerts sur votre compte', [
      { label: 'iBusiness', value: `${params.business} crédits` },
      { label: 'iCode', value: `${params.appgen} crédits` },
      { label: 'Valables jusqu\'au', value: formatDate(params.expiresAt) },
    ]),
    paragraph(
      'De quoi terminer ce que vous aviez commencé et découvrir le barème sans rien avancer. Aucune carte, aucun engagement.'
    ),
  ].join('');

  return {
    subject: 'Vos crédits de bienvenue IDEM',
    html: renderEmail({
      title: 'Vos crédits de bienvenue',
      subtitle: `${params.business} iBusiness + ${params.appgen} iCode`,
      preheader: 'Offerts sur votre compte, valables deux mois.',
      body,
      cta: { label: 'Utiliser mes crédits', url: CONSOLE_URL },
    }),
    text: toPlainText(
      'Vos crédits de bienvenue IDEM',
      [
        greetingText(params.firstName),
        'IDEM passe à un fonctionnement par crédits.',
        `Offerts : ${params.business} crédits iBusiness et ${params.appgen} crédits iCode, valables jusqu'au ${formatDate(params.expiresAt)}.`,
      ],
      { label: 'Utiliser mes crédits', url: CONSOLE_URL }
    ),
  };
}

/** Salutation, version texte. */
function greetingText(firstName?: string): string {
  return firstName ? `Bonjour ${firstName},` : 'Bonjour,';
}
