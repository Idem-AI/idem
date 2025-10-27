# Système d'Autorisation Idem

## Vue d'ensemble

Le système d'autorisation Idem permet de gérer les utilisateurs, les équipes et les permissions sur les projets de manière flexible et sécurisée.

## Architecture

### Modèles Partagés

Tous les modèles sont centralisés dans le package `@idem/shared-models` pour assurer la cohérence entre toutes les applications.

```
packages/shared-models/
├── src/
│   ├── auth/
│   │   ├── user.model.ts          # Modèle utilisateur
│   │   ├── team.model.ts          # Modèle équipe
│   │   ├── project-team.model.ts  # Association projet-équipe
│   │   └── invitation.model.ts    # Invitations utilisateur
│   └── projects/
│       └── project.model.ts       # Modèle projet
```

### Concepts Clés

#### 1. Utilisateurs (Users)

- **Owner**: Utilisateur qui s'est inscrit via Google/GitHub (propriétaire de son compte)
- **Invited User**: Utilisateur créé par invitation (créé par un owner)

Chaque utilisateur peut:

- Créer des équipes
- Être membre de plusieurs équipes
- Avoir différents rôles dans différentes équipes

#### 2. Équipes (Teams)

Une équipe est un groupe d'utilisateurs avec des rôles spécifiques:

**Rôles dans une équipe:**

- `owner`: Créateur de l'équipe (tous les droits)
- `admin`: Peut gérer les membres et les rôles
- `member`: Membre standard
- `viewer`: Lecture seule

#### 3. Projets et Équipes

Une équipe peut être associée à plusieurs projets avec des rôles spécifiques par projet:

**Rôles dans un projet:**

- `project-owner`: Propriétaire du projet
- `project-admin`: Administrateur du projet
- `developer`: Développeur (peut éditer et déployer)
- `designer`: Designer (peut éditer)
- `contributor`: Contributeur (peut éditer)
- `viewer`: Lecture seule

**Permissions par rôle:**

| Permission        | project-owner | project-admin | developer | designer | contributor | viewer |
| ----------------- | ------------- | ------------- | --------- | -------- | ----------- | ------ |
| canEdit           | ✅            | ✅            | ✅        | ✅       | ✅          | ❌     |
| canDelete         | ✅            | ❌            | ❌        | ❌       | ❌          | ❌     |
| canInvite         | ✅            | ✅            | ❌        | ❌       | ❌          | ❌     |
| canDeploy         | ✅            | ✅            | ✅        | ❌       | ❌          | ❌     |
| canViewAnalytics  | ✅            | ✅            | ✅        | ✅       | ❌          | ✅     |
| canManageTeams    | ✅            | ✅            | ❌        | ❌       | ❌          | ❌     |
| canManageSettings | ✅            | ✅            | ❌        | ❌       | ❌          | ❌     |

## API Endpoints

### Teams

```bash
# Créer une équipe
POST /api/teams
Authorization: Bearer <token>
{
  "name": "Mon Équipe",
  "description": "Description de l'équipe",
  "members": [
    {
      "email": "user@example.com",
      "displayName": "John Doe",
      "role": "member"
    }
  ]
}

# Récupérer mes équipes
GET /api/teams/my-teams
Authorization: Bearer <token>

# Récupérer une équipe
GET /api/teams/:teamId
Authorization: Bearer <token>

# Ajouter un membre
POST /api/teams/:teamId/members
Authorization: Bearer <token>
{
  "email": "newuser@example.com",
  "displayName": "Jane Doe",
  "role": "member"
}

# Mettre à jour le rôle d'un membre
PUT /api/teams/:teamId/members/role
Authorization: Bearer <token>
{
  "userId": "user-id",
  "role": "admin"
}

# Retirer un membre
DELETE /api/teams/:teamId/members/:memberId
Authorization: Bearer <token>
```

### Invitations

```bash
# Créer une invitation
POST /api/invitations
Authorization: Bearer <token>
{
  "email": "newuser@example.com",
  "displayName": "New User",
  "invitationType": "team",
  "teamId": "team-id",
  "teamRole": "member"
}

# Accepter une invitation
POST /api/invitations/accept
{
  "invitationToken": "token-from-email",
  "temporaryPassword": "temp-password-from-email",
  "newPassword": "new-secure-password"
}

# Récupérer une invitation
GET /api/invitations/:token

# Rejeter une invitation
POST /api/invitations/:token/reject

# Renvoyer une invitation
POST /api/invitations/:invitationId/resend
Authorization: Bearer <token>
```

### Project Teams

```bash
# Ajouter une équipe à un projet
POST /api/projects/:projectId/teams
Authorization: Bearer <token>
{
  "teamId": "team-id",
  "roles": ["developer", "designer"]
}

# Récupérer les équipes d'un projet
GET /api/projects/:projectId/teams
Authorization: Bearer <token>

# Mettre à jour les rôles d'une équipe
PUT /api/projects/:projectId/teams/roles
Authorization: Bearer <token>
{
  "teamId": "team-id",
  "roles": ["project-admin"]
}

# Retirer une équipe d'un projet
DELETE /api/projects/:projectId/teams/:teamId
Authorization: Bearer <token>

# Récupérer mes permissions
GET /api/projects/:projectId/permissions
Authorization: Bearer <token>

# Vérifier mon accès
GET /api/projects/:projectId/access
Authorization: Bearer <token>
```

### Migration

```bash
# Lancer la migration (Admin uniquement)
POST /api/migration/run
Authorization: Bearer <token>

# Vérifier le statut de la migration
GET /api/migration/status
Authorization: Bearer <token>
```

## Flux d'Invitation

### 1. Créer une invitation

```typescript
// L'owner crée une invitation
POST /api/invitations
{
  "email": "newuser@example.com",
  "displayName": "New User",
  "invitationType": "team",
  "teamId": "team-123",
  "teamRole": "member"
}
```

### 2. Email envoyé

L'utilisateur reçoit un email avec:

- Email de connexion
- Mot de passe temporaire
- Lien d'invitation

### 3. Accepter l'invitation

```typescript
// L'utilisateur accepte l'invitation
POST /api/invitations/accept
{
  "invitationToken": "token-from-email",
  "temporaryPassword": "temp-password",
  "newPassword": "new-secure-password"
}
```

### 4. Compte créé

- Compte Firebase Auth créé
- Utilisateur activé dans l'équipe
- Peut se connecter avec son email et nouveau mot de passe

## Rétrocompatibilité

### Migration Automatique

Le système migre automatiquement les utilisateurs existants:

1. Les utilisateurs actuels deviennent des `owners`
2. Leurs données sont préservées
3. Nouveaux champs ajoutés:
   - `isOwner: true`
   - `teamMemberships: []`
   - `isActive: true`
   - `authProvider: 'google' | 'github'`

### Migration On-Demand

Lors de la première connexion après déploiement, si un utilisateur n'a pas été migré, il sera automatiquement migré.

## Utilisation dans les Applications

### Installation

```bash
# Dans votre application
npm install @idem/shared-models
```

### Import des modèles

```typescript
import {
  UserModel,
  TeamModel,
  ProjectModel,
  CreateTeamDTO,
  AddTeamMemberDTO,
} from '@idem/shared-models';
```

### Vérifier les permissions

```typescript
// Vérifier si un utilisateur peut éditer un projet
const permissions = await fetch(`/api/projects/${projectId}/permissions`, {
  headers: { Authorization: `Bearer ${token}` },
});

if (permissions.canEdit) {
  // Autoriser l'édition
}
```

## Variables d'Environnement

Ajouter dans `.env`:

```bash
# Emails des administrateurs (séparés par des virgules)
ADMIN_EMAILS=admin1@example.com,admin2@example.com

# URL de l'application (pour les liens d'invitation)
APP_URL=https://your-app.com

# Configuration email (à implémenter selon votre service)
EMAIL_SERVICE=sendgrid
EMAIL_API_KEY=your-api-key
EMAIL_FROM=noreply@idem.com
```

## Prochaines Étapes

1. **Configurer le service d'email** dans `invitation.service.ts`
2. **Créer les interfaces utilisateur** pour:
   - Gestion des équipes
   - Invitation d'utilisateurs
   - Gestion des permissions
3. **Tester la migration** avec vos données de production
4. **Déployer progressivement** le système

## Support

Pour toute question ou problème, consultez la documentation ou contactez l'équipe de développement.
