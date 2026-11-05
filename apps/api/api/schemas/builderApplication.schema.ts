import mongoose, { Schema, Document } from 'mongoose';
import type { BuilderSignals, BuilderStatus } from '../../../../packages/shared-models/src/builders/program';

/**
 * Les candidatures au programme Idem Builders.
 *
 * Écrites ici (candidature depuis la console, décision relayée par le panel
 * admin), lues directement en base par le panel pour sa liste. Une candidature
 * porte un projet : un même compte peut faire entrer plusieurs projets, mais
 * le bonus de bienvenue n'est versé qu'une fois par compte.
 *
 * `signals` est l'état du projet **au dépôt** : l'administrateur juge ce que
 * le candidat a montré, et la liste reste lisible même si le projet change
 * ensuite ou disparaît.
 */

export interface BuilderApplicationDocument extends Document {
  userId: string;
  email: string;
  displayName?: string;
  projectId: string;
  projectName: string;
  projectDescription?: string;
  country?: string;
  /** Ce que le projet apporte à l'Afrique, dans les mots du candidat. */
  pitch: string;
  /** Adresse publique du site ou de l'application. */
  publicUrl?: string;
  signals: BuilderSignals;
  /** Preuve d'acceptation des conditions et de la politique de confidentialité du programme. */
  consent: { version: string; acceptedAt: Date; ipAddress?: string; userAgent?: string };
  status: BuilderStatus;
  decidedAt?: Date;
  decidedBy?: string;
  /** Motif d'un refus, transmis au candidat. */
  decisionNote?: string;
  /** Renseignée quand un projet accepté est retiré du programme (et non refusé à l'entrée). */
  leftProgramAt?: Date;
  /** Versement du bonus de bienvenue (une fois par compte). */
  welcomeBonusXaf?: number;
  welcomeBonusAt?: Date;
  /** Présence sur la vitrine publique d'idem.africa/builders. */
  showcase: { visible: boolean; featured: boolean; tagline?: string };
  /** Envoi de l'e-mail de décision, inscrit par le panel. */
  email_state?: { sentAt?: Date; messageId?: string; error?: string; attempts?: number };
  createdAt: Date;
  updatedAt: Date;
}

const SignalsSchema = new Schema(
  {
    sitePublished: { type: Boolean, default: false },
    appPublished: { type: Boolean, default: false },
    communication: { type: Boolean, default: false },
    domain: { type: Boolean, default: false },
    brand: { type: Boolean, default: false },
    charter: { type: Boolean, default: false },
    businessPlan: { type: Boolean, default: false },
    pitchDeck: { type: Boolean, default: false },
    legal: { type: Boolean, default: false },
    video: { type: Boolean, default: false },
  },
  { _id: false }
);

const BuilderApplicationSchema = new Schema<BuilderApplicationDocument>(
  {
    userId: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    displayName: { type: String },
    projectId: { type: String, required: true },
    projectName: { type: String, required: true },
    projectDescription: { type: String },
    country: { type: String },
    pitch: { type: String, required: true },
    publicUrl: { type: String },
    signals: { type: SignalsSchema, required: true },
    consent: {
      version: { type: String, required: true },
      acceptedAt: { type: Date, required: true },
      ipAddress: { type: String },
      userAgent: { type: String },
    },
    status: { type: String, required: true, default: 'pending' },
    decidedAt: { type: Date },
    decidedBy: { type: String },
    decisionNote: { type: String },
    leftProgramAt: { type: Date },
    welcomeBonusXaf: { type: Number },
    welcomeBonusAt: { type: Date },
    showcase: {
      visible: { type: Boolean, default: true },
      featured: { type: Boolean, default: false },
      tagline: { type: String },
    },
    email_state: {
      sentAt: { type: Date },
      messageId: { type: String },
      error: { type: String },
      attempts: { type: Number },
    },
  },
  { timestamps: true, collection: 'builder_applications' }
);

// La file d'examen du panel : « en attente », les plus anciennes d'abord.
BuilderApplicationSchema.index({ status: 1, createdAt: -1 });

// « Mes candidatures », et « ce compte est-il Builder ? » à chaque recharge.
BuilderApplicationSchema.index({ userId: 1, status: 1 });

// Un projet n'a qu'une candidature ouverte ou acceptée à la fois : vérifié par
// le service. Pas d'index unique partiel — `$in` n'y est accepté qu'à partir de
// MongoDB 6, et un double clic se rattrape mieux qu'une base qui refuse l'index.
BuilderApplicationSchema.index({ projectId: 1, status: 1 });

// La vitrine publique.
BuilderApplicationSchema.index({ status: 1, 'showcase.visible': 1, 'showcase.featured': -1, decidedAt: -1 });

export const BuilderApplication = mongoose.model<BuilderApplicationDocument>(
  'BuilderApplication',
  BuilderApplicationSchema
);
