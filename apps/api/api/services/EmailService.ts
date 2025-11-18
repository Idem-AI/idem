import nodemailer from 'nodemailer';
import { Contact } from '../models/Contact';

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendContactNotification(contact: Contact): Promise<void> {
    const subjectMap = {
      general: 'Demande Générale',
      demo: 'Demande de Démo',
      enterprise: 'Solutions Entreprise',
      partnership: 'Partenariat',
      support: 'Support Technique',
      billing: 'Facturation et Prix',
    };

    const subjectText = subjectMap[contact.subject as keyof typeof subjectMap] || contact.subject;

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Nouveau Message de Contact - Idem AI</title>
        <link href="https://fonts.googleapis.com/css2?family=Jura:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: 'Jura', sans-serif;
            line-height: 1.6;
            color: #2d3748;
            background-color: #f7fafc;
            padding: 20px;
          }

          .container {
            max-width: 600px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
          }

          .header {
            background: #1447e6;
            color: white;
            padding: 40px 30px;
            text-align: center;
            position: relative;
          }

          .logo {
            width: 80px;
            height: auto;
            margin: 0 auto 20px;
            display: block;
            padding: 16px;
          }

          .header h1 {
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 8px;
            letter-spacing: 0.5px;
          }

          .header p {
            font-size: 16px;
            opacity: 0.9;
            font-weight: 300;
          }

          .content {
            padding: 40px 30px;
          }

          .field {
            margin-bottom: 24px;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 16px;
          }

          .field:last-child {
            border-bottom: none;
            margin-bottom: 0;
          }

          .label {
            font-weight: 600;
            color: #1447e6;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 8px;
          }

          .value {
            font-size: 16px;
            color: #2d3748;
            font-weight: 400;
          }

          .value a {
            color: #1447e6;
            text-decoration: none;
          }

          .value a:hover {
            text-decoration: underline;
          }

          .message {
            background: #f7fafc;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #1447e6;
            white-space: pre-wrap;
            font-size: 15px;
            line-height: 1.7;
          }

          .footer {
            background: #f7fafc;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #e2e8f0;
          }

          .footer p {
            font-size: 14px;
            color: #718096;
            margin-bottom: 8px;
          }

          .footer .brand {
            font-weight: 600;
            color: #1447e6;
            font-size: 16px;
          }

          .footer-logo {
            width: 60px;
            height: auto;
            margin: 0 auto 15px;
            display: block;
          }

          .contact-id {
            font-family: 'Courier New', monospace;
            background: #e2e8f0;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 14px;
          }

          @media (max-width: 600px) {
            .container {
              margin: 10px;
              border-radius: 8px;
            }

            .header, .content, .footer {
              padding: 20px;
            }

            .header h1 {
              font-size: 20px;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="https://idem.africa/assets/icons/logo_white.webp" alt="Idem AI" class="logo">
            <h1>Nouveau Message de Contact</h1>
            <p>Un nouveau message a été reçu via le formulaire de contact</p>
          </div>

          <div class="content">
            <div class="field">
              <div class="label">Nom complet</div>
              <div class="value">${contact.name}</div>
            </div>

            <div class="field">
              <div class="label">Adresse email</div>
              <div class="value">
                <a href="mailto:${contact.email}">${contact.email}</a>
              </div>
            </div>

            ${
              contact.company
                ? `
            <div class="field">
              <div class="label">Entreprise</div>
              <div class="value">${contact.company}</div>
            </div>
            `
                : ''
            }

            <div class="field">
              <div class="label">Sujet</div>
              <div class="value">${subjectText}</div>
            </div>

            <div class="field">
              <div class="label">Message</div>
              <div class="message">${contact.message}</div>
            </div>

            <div class="field">
              <div class="label">Date de réception</div>
              <div class="value">${contact.createdAt.toLocaleString('fr-FR', {
                timeZone: 'Africa/Douala',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}</div>
            </div>

            <div class="field">
              <div class="label">Référence</div>
              <div class="value">
                <span class="contact-id">${contact.id}</span>
              </div>
            </div>
          </div>

          <div class="footer">
            <img src="https://idem.africa/assets/icons/logo_white.webp" alt="Idem AI" class="footer-logo">
            <p>Ce message a été envoyé automatiquement depuis le site web Idem AI</p>
            <p class="brand">Idem AI - L'Intelligence Artificielle Souveraine d'Afrique</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
Nouveau Message de Contact - Idem AI

Nom: ${contact.name}
Email: ${contact.email}
${contact.company ? `Entreprise: ${contact.company}\n` : ''}Sujet: ${subjectText}
Date: ${contact.createdAt.toLocaleString('fr-FR', { timeZone: 'Africa/Douala' })}
ID: ${contact.id}

Message:
${contact.message}

---
Ce message a été envoyé automatiquement depuis le site web Idem AI.
    `;

    await this.transporter.sendMail({
      from: `"Idem AI Contact Form" <${process.env.SMTP_USER}>`,
      to: 'arolleaguekeng@gmail.com',
      subject: `[Idem AI Contact] ${subjectText} - ${contact.name}`,
      text: textContent,
      html: htmlContent,
      replyTo: contact.email,
    });
  }

  async sendAutoReply(contact: Contact): Promise<void> {
    const subjectMap = {
      general: 'votre demande générale',
      demo: 'votre demande de démo',
      enterprise: 'votre demande de solutions entreprise',
      partnership: 'votre demande de partenariat',
      support: 'votre demande de support technique',
      billing: 'votre question sur la facturation',
    };

    const subjectText = subjectMap[contact.subject as keyof typeof subjectMap] || 'votre message';

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Confirmation de réception - Idem AI</title>
        <link href="https://fonts.googleapis.com/css2?family=Jura:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: 'Jura', sans-serif;
            line-height: 1.6;
            color: #2d3748;
            background-color: #f7fafc;
            padding: 20px;
          }

          .container {
            max-width: 600px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
          }

          .header {
            background: #1447e6;
            color: white;
            padding: 40px 30px;
            text-align: center;
            position: relative;
          }

          .logo {
            width: 80px;
            height: auto;
            margin: 0 auto 20px;
            display: block;
          }

          .header h1 {
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 8px;
            letter-spacing: 0.5px;
          }

          .header p {
            font-size: 16px;
            opacity: 0.9;
            font-weight: 300;
          }

          .content {
            padding: 40px 30px;
          }

          .greeting {
            font-size: 18px;
            margin-bottom: 24px;
            color: #2d3748;
          }

          .greeting strong {
            color: #1447e6;
          }

          .paragraph {
            margin-bottom: 20px;
            font-size: 16px;
            line-height: 1.7;
          }

          .highlight {
            background: #f7fafc;
            border: 1px solid #e2e8f0;
            border-left: 4px solid #1447e6;
            padding: 24px;
            border-radius: 8px;
            margin: 24px 0;
          }

          .highlight h3 {
            color: #1447e6;
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 16px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .highlight p {
            margin-bottom: 8px;
            font-size: 15px;
          }

          .highlight strong {
            color: #2d3748;
            font-weight: 600;
          }

          .response-time {
            background: #e6fffa;
            border: 1px solid #81e6d9;
            border-radius: 8px;
            padding: 16px;
            margin: 24px 0;
            font-size: 15px;
          }

          .response-time strong {
            color: #065f46;
          }

          .links-section {
            margin: 24px 0;
          }

          .links-section ul {
            list-style: none;
            padding: 0;
          }

          .links-section li {
            margin-bottom: 12px;
            padding-left: 20px;
            position: relative;
          }

          .links-section li:before {
            content: "→";
            position: absolute;
            left: 0;
            color: #1447e6;
            font-weight: 600;
          }

          .links-section a {
            color: #1447e6;
            text-decoration: none;
            font-weight: 500;
          }

          .links-section a:hover {
            text-decoration: underline;
          }

          .cta-section {
            text-align: center;
            margin: 32px 0;
            padding: 24px;
            background: #f7fafc;
            border-radius: 8px;
          }
            .cta-section a {
              text-decoration: none;
              color: white;
          }

          .cta {
            background: #1447e6;
            color: white;
            padding: 14px 28px;
            text-decoration: none;
            border-radius: 8px;
            display: inline-block;
            font-weight: 600;
            font-size: 16px;
            letter-spacing: 0.5px;
            transition: transform 0.2s ease;
          }

          .cta:hover {
            transform: translateY(-2px);
          }

          .footer-logo {
            width: 60px;
            height: auto;
            margin: 0 auto 15px;
            display: block;
          }

          .signature {
            margin-top: 32px;
            padding-top: 24px;
            border-top: 1px solid #e2e8f0;
            font-size: 16px;
          }

          .signature .team {
            font-weight: 600;
            color: #1447e6;
          }

          .signature .tagline {
            font-size: 14px;
            color: #718096;
            font-style: italic;
            margin-top: 4px;
          }

          .footer {
            background: #f7fafc;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #e2e8f0;
          }

          .footer p {
            font-size: 14px;
            color: #718096;
            margin-bottom: 8px;
          }

          .footer .contact-info {
            font-weight: 500;
            color: #1447e6;
          }

          .reference-id {
            font-family: 'Courier New', monospace;
            background: #e2e8f0;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 14px;
            color: #2d3748;
          }

          @media (max-width: 600px) {
            .container {
              margin: 10px;
              border-radius: 8px;
            }

            .header, .content, .footer {
              padding: 20px;
            }

            .header h1 {
              font-size: 20px;
            }

            .cta-section {
              padding: 16px;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="https://idem.africa/assets/icons/logo_white.webp" alt="Idem AI" class="logo">
            <h1>Merci pour votre message</h1>
            <p>Nous avons bien reçu ${subjectText}</p>
          </div>

          <div class="content">
            <div class="greeting">
              Bonjour <strong>${contact.name}</strong>,
            </div>

            <div class="paragraph">
              Merci de nous avoir contactés ! Nous avons bien reçu votre message et nous vous répondrons dans les plus brefs délais.
            </div>

            <div class="highlight">
              <h3>Récapitulatif de votre demande</h3>
              <p><strong>Sujet :</strong> ${subjectText}</p>
              <p><strong>Date :</strong> ${contact.createdAt.toLocaleString('fr-FR', {
                timeZone: 'Africa/Douala',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}</p>
              <p><strong>Référence :</strong> <span class="reference-id">#${contact.id.substring(0, 8)}</span></p>
            </div>

            <div class="response-time">
              <strong>Temps de réponse :</strong> Nous nous engageons à vous répondre dans les 24 heures ouvrables.
            </div>

            <div class="paragraph">
              En attendant, n'hésitez pas à :
            </div>

            <div class="links-section">
              <ul>
                <li><a href="https://console.idem.africa">Découvrir notre plateforme</a></li>
                <li><a href="https://idem.africa">Consulter notre documentation</a></li>
                <li>Rejoindre notre communauté</li>
              </ul>
            </div>

            <div class="cta-section">
              <a href="https://console.idem.africa/create-project" class="cta">Essayer Idem AI Gratuitement</a>
            </div>

            <div class="signature">
              <div>Cordialement,</div>
              <div class="team">L'équipe Idem AI</div>
              <div class="tagline">L'Intelligence Artificielle Souveraine d'Afrique</div>
            </div>
          </div>

          <div class="footer">
            <img src="https://idem.africa/assets/icons/logo_white.webp" alt="Idem AI" class="footer-logo">
            <p class="contact-info">contact@idem.africa | idem.africa</p>
            <p>Douala, Cameroun</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.transporter.sendMail({
      from: `"Idem AI Team" <${process.env.SMTP_USER}>`,
      to: contact.email,
      subject: `Confirmation de réception - Idem AI`,
      html: htmlContent,
    });
  }
}
