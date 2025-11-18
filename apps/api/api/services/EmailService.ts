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
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #7877C6, #5B59B8); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
          .field { margin-bottom: 15px; }
          .label { font-weight: bold; color: #7877C6; }
          .value { margin-top: 5px; padding: 10px; background: white; border-radius: 4px; border-left: 3px solid #7877C6; }
          .message { background: white; padding: 15px; border-radius: 4px; border: 1px solid #ddd; white-space: pre-wrap; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚀 Nouveau Message de Contact - IDEM</h1>
            <p>Un nouveau message a été reçu via le formulaire de contact</p>
          </div>
          
          <div class="content">
            <div class="field">
              <div class="label">👤 Nom complet :</div>
              <div class="value">${contact.name}</div>
            </div>
            
            <div class="field">
              <div class="label">📧 Email :</div>
              <div class="value">
                <a href="mailto:${contact.email}">${contact.email}</a>
              </div>
            </div>
            
            ${
              contact.company
                ? `
            <div class="field">
              <div class="label">🏢 Entreprise :</div>
              <div class="value">${contact.company}</div>
            </div>
            `
                : ''
            }
            
            <div class="field">
              <div class="label">📋 Sujet :</div>
              <div class="value">${subjectText}</div>
            </div>
            
            <div class="field">
              <div class="label">💬 Message :</div>
              <div class="message">${contact.message}</div>
            </div>
            
            <div class="field">
              <div class="label">📅 Date :</div>
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
              <div class="label">🆔 ID Contact :</div>
              <div class="value">${contact.id}</div>
            </div>
          </div>
          
          <div class="footer">
            <p>Ce message a été envoyé automatiquement depuis le site web IDEM</p>
            <p>🌍 <strong>IDEM</strong> - L'IA Souveraine d'Afrique</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
Nouveau Message de Contact - IDEM

Nom: ${contact.name}
Email: ${contact.email}
${contact.company ? `Entreprise: ${contact.company}\n` : ''}Sujet: ${subjectText}
Date: ${contact.createdAt.toLocaleString('fr-FR', { timeZone: 'Africa/Douala' })}
ID: ${contact.id}

Message:
${contact.message}

---
Ce message a été envoyé automatiquement depuis le site web IDEM.
    `;

    await this.transporter.sendMail({
      from: `"IDEM Contact Form" <${process.env.SMTP_USER}>`,
      to: 'contact@idem.africa',
      subject: `🚀 [IDEM Contact] ${subjectText} - ${contact.name}`,
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
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #7877C6, #5B59B8); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .highlight { background: white; padding: 15px; border-radius: 4px; border-left: 3px solid #7877C6; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          .cta { background: #7877C6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚀 Merci pour votre message !</h1>
            <p>Nous avons bien reçu ${subjectText}</p>
          </div>
          
          <div class="content">
            <p>Bonjour <strong>${contact.name}</strong>,</p>
            
            <p>Merci de nous avoir contactés ! Nous avons bien reçu votre message et nous vous répondrons dans les plus brefs délais.</p>
            
            <div class="highlight">
              <h3>📋 Récapitulatif de votre demande :</h3>
              <p><strong>Sujet :</strong> ${subjectText}</p>
              <p><strong>Date :</strong> ${contact.createdAt.toLocaleString('fr-FR', {
                timeZone: 'Africa/Douala',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}</p>
              <p><strong>Référence :</strong> #${contact.id.substring(0, 8)}</p>
            </div>
            
            <p><strong>⏱️ Temps de réponse :</strong> Nous nous engageons à vous répondre dans les 24 heures ouvrables.</p>
            
            <p>En attendant, n'hésitez pas à :</p>
            <ul>
              <li>🌐 Découvrir notre plateforme : <a href="https://dashboard.idem.africa">dashboard.idem.africa</a></li>
              <li>📚 Consulter notre documentation</li>
              <li>💬 Rejoindre notre communauté</li>
            </ul>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://dashboard.idem.africa/create-project" class="cta">🚀 Essayer IDEM Gratuitement</a>
            </div>
            
            <p>Cordialement,<br>
            <strong>L'équipe IDEM</strong><br>
            🌍 L'IA Souveraine d'Afrique</p>
          </div>
          
          <div class="footer">
            <p>📧 contact@idem.africa | 🌐 idem.africa</p>
            <p>Douala, Cameroun 🇨🇲</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.transporter.sendMail({
      from: `"IDEM Team" <${process.env.SMTP_USER}>`,
      to: contact.email,
      subject: `✅ Confirmation de réception - IDEM`,
      html: htmlContent,
    });
  }
}
