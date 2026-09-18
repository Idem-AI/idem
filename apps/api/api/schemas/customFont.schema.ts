import { randomUUID } from 'crypto';
import mongoose, { Schema, Document } from 'mongoose';
import { CustomFontModel } from '../models/custom-font.model';

/**
 * Bibliothèque de polices importées, par utilisateur.
 *
 * Les fichiers vivent dans le bucket ; ce document n'en garde que le catalogue,
 * pour que la police reste proposée dans « Personnaliser » d'un projet à
 * l'autre sans être re-téléversée à chaque fois.
 */

export interface CustomFontDocument extends Omit<CustomFontModel, 'id'>, Document<string> {
  _id: string;
}

const CustomFontFileSchema = new Schema(
  {
    url: { type: String, required: true },
    filePath: { type: String },
    weight: { type: Number, required: true, default: 400 },
    style: { type: String, required: true, default: 'normal', enum: ['normal', 'italic'] },
    format: { type: String, required: true, enum: ['woff2', 'woff', 'ttf', 'otf'] },
  },
  { _id: false }
);

const CustomFontSchema = new Schema<CustomFontDocument>(
  {
    // Identifiant lisible : c'est lui qui nomme le dossier de la police dans le
    // bucket, et il doit être connu AVANT le premier téléversement.
    _id: { type: String, default: () => randomUUID() },
    userId: { type: String, required: true, index: true },
    family: { type: String, required: true, trim: true },
    category: { type: String, required: true, default: 'sans-serif' },
    weights: { type: [Number], default: [] },
    cssUrl: { type: String, required: true },
    cssPath: { type: String, required: true },
    folderPath: { type: String, required: true },
    files: { type: [CustomFontFileSchema], default: [] },
  },
  { timestamps: true, collection: 'custom_fonts' }
);

// La liste « mes polices », la plus récente en tête.
CustomFontSchema.index({ userId: 1, createdAt: -1 });

// Ré-importer la même famille MET À JOUR la police au lieu d'en créer une
// seconde : deux `@font-face` du même nom se marcheraient dessus au rendu.
CustomFontSchema.index({ userId: 1, family: 1 }, { unique: true });

export const CustomFont = mongoose.model<CustomFontDocument>('CustomFont', CustomFontSchema);
