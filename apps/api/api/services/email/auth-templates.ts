import { escapeHtml, paragraph, renderEmail, toPlainText } from './email-layout';
import type { RenderedEmail } from './templates';

/**
 * E-mails du serveur d'authentification (GoTrue), rendus par l'API.
 *
 * GoTrue n'envoie plus rien lui-même : son « Send Email Hook » confie chaque
 * message à l'API (voir controllers/authEmailHook.controller.ts). Les mails de
 * connexion partent donc du même SMTP, du même expéditeur et avec la même mise
 * en page — logo compris — que les reçus et les relances.
 *
 * Les liens pointent vers `/verify` du serveur d'authentification, exactement
 * comme ceux que GoTrue construisait : il valide le jeton puis renvoie vers la
 * page du dashboard demandée (`redirect_to`). Le dashboard n'a rien à changer.
 */

export type AuthEmailAction =
  | 'signup'
  | 'invite'
  | 'magiclink'
  | 'recovery'
  | 'email_change_current'
  | 'email_change_new'
  | 'reauthentication';

export interface AuthEmailParams {
  action: AuthEmailAction;
  firstName?: string;
  /** Lien de validation complet ; absent pour la réauthentification (code seul). */
  link?: string;
  /** Code à six chiffres, montré seulement quand aucun lien ne le remplace. */
  code?: string;
  /** Nouvelle adresse, pour le changement d'adresse. */
  newEmail?: string;
}

const NOT_YOU =
  "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : rien ne change sur votre compte.";

interface Copy {
  subject: string;
  title: string;
  preheader: string;
  lines: string[];
  cta?: string;
}

function copyFor(params: AuthEmailParams): Copy {
  const newEmail = params.newEmail ?? '';

  switch (params.action) {
    case 'signup':
      return {
        subject: 'Confirmez votre adresse IDEM',
        title: 'Confirmez votre adresse',
        preheader: 'Un clic pour activer votre compte IDEM.',
        lines: [
          'Votre compte IDEM est créé. Il reste à confirmer que cette adresse est bien la vôtre.',
        ],
        cta: 'Confirmer mon adresse',
      };
    case 'invite':
      return {
        subject: 'Votre invitation sur IDEM',
        title: 'Vous êtes invité sur IDEM',
        preheader: 'Acceptez l’invitation pour ouvrir votre espace.',
        lines: ['Un compte IDEM vous attend. Acceptez l’invitation pour choisir votre mot de passe.'],
        cta: "Accepter l'invitation",
      };
    case 'magiclink':
      return {
        subject: 'Votre lien de connexion IDEM',
        title: 'Votre lien de connexion',
        preheader: 'Un clic pour vous connecter à IDEM.',
        lines: ['Voici le lien demandé pour vous connecter à IDEM. Il ne sert qu’une fois.'],
        cta: 'Me connecter',
      };
    case 'recovery':
      return {
        subject: 'Choisissez votre mot de passe IDEM',
        title: 'Choisissez un nouveau mot de passe',
        preheader: 'Le lien pour choisir votre nouveau mot de passe IDEM.',
        lines: [
          'Vous avez demandé à changer le mot de passe de votre compte IDEM.',
          'Le lien ci-dessous ne sert qu’une fois.',
        ],
        cta: 'Choisir mon mot de passe',
      };
    case 'email_change_current':
      return {
        subject: 'Confirmez le changement d’adresse IDEM',
        title: 'Changement d’adresse',
        preheader: `Votre compte IDEM va passer à ${newEmail}.`,
        lines: [
          `Votre compte IDEM va utiliser une nouvelle adresse : <strong>${escapeHtml(newEmail)}</strong>.`,
          'Confirmez depuis cette adresse-ci : le changement ne se fait qu’une fois les deux adresses confirmées.',
        ],
        cta: 'Confirmer le changement',
      };
    case 'email_change_new':
      return {
        subject: 'Confirmez votre nouvelle adresse IDEM',
        title: 'Confirmez votre nouvelle adresse',
        preheader: 'Un clic pour rattacher cette adresse à votre compte IDEM.',
        lines: ['Cette adresse va devenir celle de votre compte IDEM. Confirmez qu’elle est bien la vôtre.'],
        cta: 'Confirmer cette adresse',
      };
    case 'reauthentication':
      return {
        subject: 'Votre code de confirmation IDEM',
        title: 'Votre code de confirmation',
        preheader: `Code : ${params.code ?? ''}`,
        lines: ['Saisissez ce code dans IDEM pour confirmer l’opération en cours.'],
      };
  }
}

/** Le code, en grand, pour la seule demande qui n'a pas de lien. */
function codeBlock(code: string): string {
  return `
    <p class="em-panel" style="margin:0 0 20px;padding:16px;text-align:center;font-size:28px;font-weight:700;letter-spacing:.3em;color:#0f172a;background:#f7fafc;border:1px solid #e5e7eb;border-radius:8px;">${escapeHtml(code)}</p>`;
}

export function authEmail(params: AuthEmailParams): RenderedEmail {
  const copy = copyFor(params);
  const hello = params.firstName ? `Bonjour ${escapeHtml(params.firstName)},` : 'Bonjour,';
  const helloText = params.firstName ? `Bonjour ${params.firstName},` : 'Bonjour,';
  const cta = copy.cta && params.link ? { label: copy.cta, url: params.link } : undefined;

  const body = [
    paragraph(hello),
    ...copy.lines.map(paragraph),
    !params.link && params.code ? codeBlock(params.code) : '',
  ].join('');

  return {
    subject: copy.subject,
    html: renderEmail({
      title: copy.title,
      preheader: copy.preheader,
      body,
      cta,
      footerNote: NOT_YOU,
    }),
    text: toPlainText(
      copy.title,
      [
        helloText,
        ...copy.lines.map((line) => line.replace(/<[^>]+>/g, '')),
        !params.link && params.code ? `Code : ${params.code}` : '',
        NOT_YOU,
      ],
      cta
    ),
  };
}
