import { Request, Response } from 'express';
import logger from '../config/logger';
import { BRAND, escapeHtml } from '../services/email/email-layout';
import {
  DeviceDecision,
  DeviceDecisionOutcome,
  peekDeviceCheck,
  resolveDeviceCheck,
} from '../services/identity/deviceCheck.service';
import { describeDevice } from '../utils/device-fingerprint.util';

/**
 * Page ouverte depuis l'e-mail « Connexion suspecte ».
 *
 * `GET` affiche la question et ne change rien : les messageries et antivirus
 * ouvrent les liens des e-mails avant le destinataire. Seul le bouton du
 * formulaire (`POST`) applique la réponse.
 */

const CONSOLE_URL = (process.env.IDEM_FRONTEND_URL || BRAND.console).replace(/\/+$/, '');

function page(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)} · IDEM</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; background: ${BRAND.surface}; color: ${BRAND.text}; font-family: ${BRAND.fontStack}; }
  main { max-width: 520px; margin: 48px auto; padding: 0 16px; }
  .card { background: #fff; border: 1px solid ${BRAND.border}; border-radius: 14px; padding: 28px; }
  .brand { font-weight: 700; letter-spacing: .08em; color: ${BRAND.primary}; font-size: 14px; margin: 0 0 18px; }
  h1 { font-size: 22px; line-height: 1.35; margin: 0 0 12px; }
  p { font-size: 15px; line-height: 1.7; margin: 0 0 16px; }
  dl { display: grid; grid-template-columns: auto 1fr; gap: 6px 16px; margin: 0 0 20px; padding: 16px; background: ${BRAND.surface}; border-radius: 8px; font-size: 14px; }
  dt { color: ${BRAND.muted}; }
  dd { margin: 0; font-weight: 600; }
  .actions { display: flex; flex-wrap: wrap; gap: 12px; }
  button, .link { font: inherit; font-size: 15px; font-weight: 600; padding: 12px 22px; border-radius: 8px; cursor: pointer; text-decoration: none; }
  .primary { background: ${BRAND.primary}; color: #fff; border: 1px solid ${BRAND.primary}; }
  .secondary { background: #fff; color: ${BRAND.text}; border: 1px solid ${BRAND.border}; }
  button:focus-visible, .link:focus-visible { outline: 3px solid ${BRAND.accent}; outline-offset: 2px; }
</style>
</head>
<body>
<main>
  <div class="card">
    <p class="brand">IDEM</p>
    ${body}
  </div>
</main>
</body>
</html>`;
}

function send(res: Response, status: number, title: string, body: string): void {
  res.status(status).set('Cache-Control', 'no-store').type('html').send(page(title, body));
}

const loginLink = `<a class="link primary" href="${escapeHtml(`${CONSOLE_URL}/login`)}">Me reconnecter</a>`;

const OUTCOMES: Record<DeviceDecisionOutcome, { title: string; body: string }> = {
  approved: {
    title: 'Appareil confirmé',
    body: `<h1>Appareil confirmé</h1>
      <p>Merci. Cet appareil peut maintenant utiliser votre session : rechargez la page ouverte sur IDEM.</p>
      <p>Si elle vous demande de vous reconnecter, faites-le simplement.</p>`,
  },
  denied: {
    title: 'Compte sécurisé',
    body: `<h1>Votre compte est sécurisé</h1>
      <p>Toutes vos sessions ont été fermées, sur tous vos appareils. La personne qui utilisait votre session n'a plus accès à votre compte.</p>
      <p>Reconnectez-vous, puis changez votre mot de passe (« Choisir mon mot de passe » sur la page de connexion). Si vous vous connectez avec Google, vérifiez aussi la sécurité de ce compte.</p>
      <div class="actions">${loginLink}</div>`,
  },
  session_gone: {
    title: 'Session terminée',
    body: `<h1>Cette session est déjà terminée</h1>
      <p>Elle a expiré ou a été fermée entre-temps. Reconnectez-vous sur l'appareil que vous utilisez.</p>
      <div class="actions">${loginLink}</div>`,
  },
  expired: {
    title: 'Lien expiré',
    body: `<h1>Ce lien n'est plus valable</h1>
      <p>Il a déjà servi ou date de plus de 48 heures. Si vous pensez que quelqu'un utilise votre compte, reconnectez-vous puis utilisez « Déconnecter tous les appareils » dans votre compte.</p>
      <div class="actions">${loginLink}</div>`,
  },
};

/** GET /auth/device-check/:token */
export const deviceCheckPageController = async (req: Request, res: Response): Promise<void> => {
  try {
    const check = await peekDeviceCheck(req.params.token as string);
    if (!check) return send(res, 410, OUTCOMES.expired.title, OUTCOMES.expired.body);

    const when = new Date(check.at).toLocaleString('fr-FR', {
      timeZone: 'Africa/Douala',
      dateStyle: 'long',
      timeStyle: 'short',
    });
    // La réponse choisie dans l'e-mail passe en premier, en bouton plein.
    const approve = (primary: boolean) =>
      `<button class="${primary ? 'primary' : 'secondary'}" type="submit" name="decision" value="approve">Oui, c'est moi</button>`;
    const deny = (primary: boolean) =>
      `<button class="${primary ? 'primary' : 'secondary'}" type="submit" name="decision" value="deny">Non, ce n'est pas moi</button>`;
    const buttons = req.query.d === 'approve' ? approve(true) + deny(false) : deny(true) + approve(false);

    send(
      res,
      200,
      'Connexion suspecte',
      `<h1>Était-ce vous ?</h1>
      <p>Votre session IDEM a été utilisée depuis un autre appareil que celui où vous vous êtes connecté. Nous avons refusé l'accès.</p>
      <dl>
        <dt>Appareil</dt><dd>${escapeHtml(describeDevice(check.fingerprint))}</dd>
        <dt>Adresse IP</dt><dd>${escapeHtml(check.ipAddress)}</dd>
        <dt>Date</dt><dd>${escapeHtml(when)}</dd>
      </dl>
      <p>« Ce n'est pas moi » ferme toutes vos sessions, sur tous vos appareils.</p>
      <form method="post" class="actions">${buttons}</form>`
    );
  } catch (error: any) {
    logger.error(`auth.device_check_page_failed: ${error.message}`);
    send(res, 500, 'Erreur', '<h1>Une erreur est survenue</h1><p>Réessayez dans un instant.</p>');
  }
};

/** POST /auth/device-check/:token, corps `decision=approve|deny`. */
export const deviceCheckDecisionController = async (req: Request, res: Response): Promise<void> => {
  const decision = req.body?.decision;
  if (decision !== 'approve' && decision !== 'deny') {
    return send(res, 400, 'Réponse manquante', '<h1>Réponse manquante</h1><p>Rouvrez le lien de l’e-mail et choisissez une réponse.</p>');
  }
  try {
    const outcome = await resolveDeviceCheck(req.params.token as string, decision as DeviceDecision);
    const { title, body } = OUTCOMES[outcome];
    send(res, outcome === 'expired' ? 410 : 200, title, body);
  } catch (error: any) {
    logger.error(`auth.device_check_decision_failed: ${error.message}`);
    send(res, 500, 'Erreur', `<h1>Une erreur est survenue</h1><p>Votre réponse n’a peut-être pas été appliquée. Si quelqu’un d’autre utilise votre compte, reconnectez-vous puis utilisez « Déconnecter tous les appareils » dans votre compte.</p><div class="actions">${loginLink}</div>`);
  }
};
