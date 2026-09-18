/**
 * Mise en page commune des e-mails transactionnels IDEM.
 *
 * Trois contraintes, dans cet ordre :
 *
 *  1. **Les messageries cassent le CSS moderne.** Gmail retire les `<style>`
 *     dans certains contextes, Outlook ignore flexbox et grid. D'où des
 *     tableaux et des styles en ligne — non par goût, par nécessité.
 *  2. **Le message doit être lisible avant d'être beau.** Fond clair, texte
 *     sombre, une seule colonne, un seul bouton. L'en-tête sombre porte
 *     l'identité ; le corps reste blanc, parce qu'un e-mail sombre s'imprime
 *     mal et vieillit mal dans les fils de discussion.
 *  3. **Le design system IDEM sans y toucher** : primaire `#1447e6`, accent
 *     `#22d3ee`, fond sombre `#06080d`, pile de polices Vilevile puis système.
 *     La police n'est pas embarquée — les messageries la retirent presque
 *     toutes, et 30 Ko de base64 par message coûteraient plus qu'ils ne
 *     rapportent (même choix que l'EmailService historique).
 */

export const BRAND = {
  primary: '#1447e6',
  accent: '#22d3ee',
  dark: '#06080d',
  text: '#1f2937',
  muted: '#6b7280',
  border: '#e5e7eb',
  surface: '#f7fafc',
  // Les fichiers sont nommés d'après le thème qu'ils servent : `logo_dark` est
  // la variante du thème sombre, et l'en-tête de tous les modèles l'est.
  // Servie par la landing, qui héberge idem.africa.
  logo: 'https://idem.africa/assets/icons/logo_dark.png',
  console: 'https://console.idem.africa',
  site: 'https://idem.africa',
  fontStack: "'Vilevile', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
} as const;

/**
 * Échappe une valeur avant insertion dans le HTML.
 *
 * Les modèles interpolent des données saisies par des humains : un nom
 * d'entreprise contenant `<` cassait la mise en page, et un message
 * personnalisé rédigé dans le panel admin pouvait injecter du balisage dans un
 * message signé IDEM. Aucune interpolation ne doit se passer de cette fonction.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Prénom utilisable, déduit du nom affiché ou de l'adresse. */
export function firstNameOf(displayName?: string, email?: string): string {
  const fromName = (displayName ?? '').trim().split(/\s+/)[0];
  if (fromName) return fromName;

  const local = (email ?? '').split('@')[0] ?? '';
  const cleaned = local.replace(/[._-]+/g, ' ').trim().split(/\s+/)[0] ?? '';

  // Une adresse comme `jean.dupont@…` donne « Jean » ; `contact@…` ne donne
  // rien d'exploitable, on reste alors impersonnel plutôt que ridicule.
  if (!cleaned || cleaned.length < 2 || /^\d+$/.test(cleaned)) return '';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
}

/** Montant en francs CFA, avec l'espace insécable qui évite les coupures. */
export function formatXaf(amount: number): string {
  return `${Math.round(amount).toLocaleString('fr-FR').replace(/ |\s/g, ' ')} F`;
}

/** Date lisible en français, fuseau de Douala. */
export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('fr-FR', {
    timeZone: 'Africa/Douala',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export interface LayoutOptions {
  /** Titre affiché dans l'en-tête sombre. */
  title: string;
  /** Sous-titre de l'en-tête, une phrase. */
  subtitle?: string;
  /**
   * Texte d'aperçu, affiché par la messagerie à côté de l'objet. Sans lui,
   * l'aperçu reprend le premier texte visible — souvent « Bonjour ».
   */
  preheader: string;
  /** Corps déjà mis en forme (utiliser les aides ci-dessous). */
  body: string;
  cta?: { label: string; url: string };
  /** Mention discrète en pied de message. */
  footerNote?: string;
}

/** Paragraphe. */
export function paragraph(html: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:${BRAND.text};">${html}</p>`;
}

/** Encadré de mise en valeur (récapitulatif, montant, date de fin). */
export function panel(title: string, rows: { label: string; value: string }[]): string {
  const cells = rows
    .map(
      (row) => `
        <tr>
          <td style="padding:6px 0;font-size:14px;color:${BRAND.muted};">${row.label}</td>
          <td style="padding:6px 0;font-size:14px;color:${BRAND.text};font-weight:600;text-align:right;">${row.value}</td>
        </tr>`
    )
    .join('');

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.surface};border:1px solid ${BRAND.border};border-left:4px solid ${BRAND.primary};border-radius:8px;margin:0 0 20px;">
      <tr>
        <td style="padding:18px 20px;">
          <p style="margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${BRAND.primary};">${escapeHtml(title)}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${cells}</table>
        </td>
      </tr>
    </table>`;
}

/** Liste à puces fléchées, dans le style des e-mails IDEM existants. */
export function bullets(items: string[]): string {
  const rows = items
    .map(
      (item) => `
        <tr>
          <td valign="top" style="width:18px;padding:4px 0;color:${BRAND.primary};font-weight:700;">›</td>
          <td style="padding:4px 0;font-size:15px;line-height:1.6;color:${BRAND.text};">${item}</td>
        </tr>`
    )
    .join('');

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">${rows}</table>`;
}

/** Message personnel écrit par un administrateur, cité tel quel. */
export function quote(text: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
      <tr>
        <td style="padding:14px 18px;background:#eef2ff;border-radius:8px;font-size:15px;line-height:1.7;color:${BRAND.text};font-style:italic;">
          ${escapeHtml(text).replace(/\n/g, '<br>')}
        </td>
      </tr>
    </table>`;
}

/**
 * Assemble le message complet.
 *
 * Le bouton est construit en tableau plutôt qu'en `<a>` stylé : c'est la seule
 * forme qu'Outlook rend correctement.
 */
export function renderEmail(options: LayoutOptions): string {
  const cta = options.cta
    ? `
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;">
        <tr>
          <td style="background:${BRAND.primary};border-radius:8px;">
            <a href="${escapeHtml(options.cta.url)}" style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:.02em;">${escapeHtml(options.cta.label)}</a>
          </td>
        </tr>
      </table>`
    : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(options.title)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.surface};">
  <!-- Aperçu : lu par la messagerie, jamais affiché dans le message. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(options.preheader)}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.surface};padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,.08);font-family:${BRAND.fontStack};">

          <tr>
            <td style="background:${BRAND.dark};padding:32px 28px;text-align:center;">
              <img src="${BRAND.logo}" alt="IDEM" width="92" style="display:block;margin:0 auto 14px;width:92px;height:auto;">
              <h1 style="margin:0 0 6px;font-size:21px;font-weight:600;color:#ffffff;line-height:1.35;">${escapeHtml(options.title)}</h1>
              ${
                options.subtitle
                  ? `<p style="margin:0;font-size:14px;color:${BRAND.accent};">${escapeHtml(options.subtitle)}</p>`
                  : ''
              }
            </td>
          </tr>

          <tr>
            <td style="padding:30px 28px 8px;">
              ${options.body}
              ${cta}
            </td>
          </tr>

          <tr>
            <td style="padding:0 28px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${BRAND.border};">
                <tr>
                  <td style="padding-top:18px;font-size:14px;color:${BRAND.text};">
                    L'équipe IDEM
                    <div style="margin-top:4px;font-size:13px;color:${BRAND.muted};font-style:italic;">L'intelligence artificielle souveraine d'Afrique</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="background:${BRAND.surface};padding:20px 28px;text-align:center;border-top:1px solid ${BRAND.border};">
              ${
                options.footerNote
                  ? `<p style="margin:0 0 8px;font-size:12px;color:${BRAND.muted};line-height:1.6;">${escapeHtml(options.footerNote)}</p>`
                  : ''
              }
              <p style="margin:0;font-size:12px;color:${BRAND.muted};">
                <a href="${BRAND.console}" style="color:${BRAND.primary};text-decoration:none;">console.idem.africa</a>
                &nbsp;·&nbsp; contact@idem.africa &nbsp;·&nbsp; Douala, Cameroun
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Version texte, obligatoire.
 *
 * Certains clients n'affichent que celle-ci, et un message sans partie texte
 * part plus facilement en indésirable.
 */
export function toPlainText(title: string, lines: string[], cta?: { label: string; url: string }): string {
  const body = lines.filter(Boolean).join('\n\n');
  const action = cta ? `\n\n${cta.label} : ${cta.url}` : '';

  return `${title}\n${'='.repeat(title.length)}\n\n${body}${action}\n\n—\nL'équipe IDEM — L'intelligence artificielle souveraine d'Afrique\nconsole.idem.africa · contact@idem.africa · Douala, Cameroun\n`;
}
