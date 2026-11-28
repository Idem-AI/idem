import mongoose, { Document, Schema } from 'mongoose';
import type {
  MemberRoleKey,
  MemberStatus,
  ProjectPermissions,
} from '../../../../packages/shared-models/src/projects/project-access.model';

/**
 * L'équipe d'un projet : deux collections.
 *
 *  - `project_members` : une ligne par personne invitée. L'invitation et
 *    l'appartenance sont la même ligne à deux moments (`pending` → `active`) :
 *    les droits réglés à l'invitation sont ceux qui s'appliquent à l'arrivée,
 *    sans recopie. Un refus garde la ligne (`declined`) pour que le propriétaire
 *    le voie ; un retrait la supprime.
 *  - `project_groups`  : les groupes créés par le propriétaire (« Équipe
 *    marketing »). Un membre rattaché à un groupe en prend les droits ; changer
 *    le groupe change tous ses membres d'un coup.
 *
 * `userId` est connu dès l'invitation : on n'invite qu'un compte IDEM existant.
 * Le jeton de l'e-mail n'est stocké que haché.
 */

export interface ProjectMemberDocument extends Document {
  projectId: string;
  ownerId: string;
  userId: string;
  email: string;
  status: MemberStatus;
  roleKey: MemberRoleKey;
  groupId?: string | null;
  /** Réglage propre au membre, utilisé quand `roleKey` vaut `custom`. */
  permissions: ProjectPermissions;
  invitedBy: string;
  tokenHash: string;
  expiresAt: Date;
  invitedAt: Date;
  respondedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectMemberSchema = new Schema<ProjectMemberDocument>(
  {
    projectId: { type: String, required: true },
    ownerId: { type: String, required: true },
    userId: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    status: { type: String, enum: ['pending', 'active', 'declined'], required: true },
    roleKey: { type: String, required: true },
    groupId: { type: String, default: null },
    permissions: { type: Schema.Types.Mixed, default: {} },
    invitedBy: { type: String, required: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    invitedAt: { type: Date, required: true },
    respondedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'project_members' }
);

// Une personne n'apparaît qu'une fois par projet.
ProjectMemberSchema.index({ projectId: 1, userId: 1 }, { unique: true });
// « Mes projets partagés » et « mes invitations ».
ProjectMemberSchema.index({ userId: 1, status: 1 });
ProjectMemberSchema.index({ tokenHash: 1 }, { unique: true });

export interface ProjectGroupDocument extends Document {
  projectId: string;
  ownerId: string;
  name: string;
  permissions: ProjectPermissions;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectGroupSchema = new Schema<ProjectGroupDocument>(
  {
    projectId: { type: String, required: true, index: true },
    ownerId: { type: String, required: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    permissions: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, collection: 'project_groups' }
);

export const ProjectMember =
  (mongoose.models.ProjectMember as mongoose.Model<ProjectMemberDocument>) ||
  mongoose.model<ProjectMemberDocument>('ProjectMember', ProjectMemberSchema);

export const ProjectGroup =
  (mongoose.models.ProjectGroup as mongoose.Model<ProjectGroupDocument>) ||
  mongoose.model<ProjectGroupDocument>('ProjectGroup', ProjectGroupSchema);
