import mongoose, { Schema, Document } from 'mongoose';
import { ProjectRevisionModel } from '../models/revision.model';

export interface ProjectRevisionDocument extends Omit<ProjectRevisionModel, 'id'>, Document {}

const RevisionAuthorSchema = new Schema(
  {
    type: { type: String, enum: ['user', 'ai', 'system'], required: true },
    userId: { type: String },
  },
  { _id: false }
);

const ProjectRevisionSchema = new Schema<ProjectRevisionDocument>(
  {
    projectId: { type: String, required: true },
    userId: { type: String, required: true },
    section: { type: String, required: true },
    version: { type: Number, required: true },
    author: { type: RevisionAuthorSchema, required: true },
    source: { type: String, required: true },
    summary: { type: String, required: true },
    changedPaths: [{ type: String }],
    patch: { type: Schema.Types.Mixed },
    snapshot: { type: Schema.Types.Mixed },
    sizeBytes: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    collection: 'project_revisions',
  }
);

// Une seule révision par (projet, section, version) — l'index unique sert aussi
// de verrou optimiste contre les écritures concurrentes (retry côté service).
ProjectRevisionSchema.index({ projectId: 1, section: 1, version: -1 }, { unique: true });

// Log global d'un projet trié par date (toutes sections confondues).
ProjectRevisionSchema.index({ projectId: 1, createdAt: -1 });

// Reconstruction: dernier snapshot ≤ version cible. Index PARTIEL (on n'indexe
// jamais la valeur du snapshot lui-même — les clés d'index MongoDB sont
// limitées en taille), seulement les révisions qui en portent un.
ProjectRevisionSchema.index(
  { projectId: 1, section: 1, version: -1 },
  { partialFilterExpression: { snapshot: { $exists: true } }, name: 'snapshot_lookup' }
);

// Requêtes par utilisateur (quota / nettoyage).
ProjectRevisionSchema.index({ userId: 1, createdAt: -1 });

export const ProjectRevision = mongoose.model<ProjectRevisionDocument>(
  'ProjectRevision',
  ProjectRevisionSchema
);
