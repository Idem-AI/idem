# Système d'Autorisation Idem - Implémentation Complète

## 🎯 Objectif

Créer un système d'autorisation complet permettant:

- ✅ Connexion via Google/GitHub
- ✅ Création d'utilisateurs par invitation
- ✅ Gestion des équipes (teams)
- ✅ Gestion des rôles dans les équipes
- ✅ Association équipes-projets avec rôles spécifiques
- ✅ Système de permissions granulaire
- ✅ Rétrocompatibilité avec les utilisateurs existants
- ✅ Modèles partagés entre applications

## 📦 Structure Créée

```
idem/
├── packages/
│   └── shared-models/              # 🆕 Package de modèles partagés
│       ├── src/
│       │   ├── auth/
│       │   │   ├── user.model.ts
│       │   │   ├── team.model.ts
│       │   │   ├── project-team.model.ts
│       │   │   └── invitation.model.ts
│       │   ├── projects/
│       │   │   └── project.model.ts
│       │   └── index.ts
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
│
├── apps/api/api/
│   ├── services/authorization/     # 🆕 Services d'autorisation
│   │   ├── team.service.ts
│   │   ├── project-team.service.ts
│   │   ├── invitation.service.ts
│   │   └── migration.service.ts
│   │
│   ├── controllers/                # 🆕 Contrôleurs
│   │   ├── team.controller.ts
│   │   ├── invitation.controller.ts
│   │   ├── project-team.controller.ts
│   │   └── migration.controller.ts
│   │
│   └── routes/                     # 🆕 Routes API
│       ├── team.routes.ts
│       ├── invitation.routes.ts
│       ├── project-team.routes.ts
│       └── migration.routes.ts
│
├── documentation/
│   └── AUTHORIZATION_SYSTEM.md     # 🆕 Documentation complète
│
└── SETUP_AUTHORIZATION.md          # 🆕 Guide d'installation
```

## 🚀 Démarrage Rapide

### 1. Installation

```bash
# À la racine du monorepo
npm install

# Build le package shared-models
npm run build:shared
```

### 2. Configuration

Copier `.env.example` vers `.env` dans `apps/api/` et configurer:

```bash
# Authorization System
ADMIN_EMAILS=votre-email@example.com
APP_URL=http://localhost:3000

# Email Service
EMAIL_SERVICE=sendgrid
EMAIL_API_KEY=your-api-key
EMAIL_FROM=noreply@idem.com
```

### 3. Build et Démarrage

```bash
# Build l'API
npm run build:api

# Démarrer l'API
npm run dev:api
```

### 4. Migration des Utilisateurs Existants

```bash
# Via l'API (nécessite authentification admin)
curl -X POST http://localhost:3001/api/migration/run \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Vérifier le statut
curl -X GET http://localhost:3001/api/migration/status \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## 🔑 Fonctionnalités Principales

### 1. Gestion des Équipes

```typescript
// Créer une équipe
POST /api/teams
{
  "name": "Mon Équipe",
  "description": "Description",
  "members": [
    {
      "email": "user@example.com",
      "displayName": "John Doe",
      "role": "member"
    }
  ]
}

// Récupérer mes équipes
GET /api/teams/my-teams

// Ajouter un membre
POST /api/teams/:teamId/members
{
  "email": "newuser@example.com",
  "displayName": "Jane Doe",
  "role": "member"
}
```

### 2. Système d'Invitation

```typescript
// Créer une invitation
POST /api/invitations
{
  "email": "newuser@example.com",
  "displayName": "New User",
  "invitationType": "team",
  "teamId": "team-id",
  "teamRole": "member"
}

// L'utilisateur reçoit un email avec:
// - Email de connexion
// - Mot de passe temporaire
// - Lien d'invitation

// Accepter l'invitation
POST /api/invitations/accept
{
  "invitationToken": "token-from-email",
  "temporaryPassword": "temp-password",
  "newPassword": "new-secure-password"
}
```

### 3. Association Équipes-Projets

```typescript
// Ajouter une équipe à un projet
POST /api/projects/:projectId/teams
{
  "teamId": "team-id",
  "roles": ["developer", "designer"]
}

// Récupérer mes permissions
GET /api/projects/:projectId/permissions
// Retourne:
{
  "canEdit": true,
  "canDelete": false,
  "canDeploy": true,
  "canViewAnalytics": true,
  ...
}
```

## 👥 Rôles et Permissions

### Rôles dans une Équipe

- **owner**: Créateur de l'équipe (tous les droits)
- **admin**: Peut gérer les membres
- **member**: Membre standard
- **viewer**: Lecture seule

### Rôles dans un Projet

- **project-owner**: Propriétaire du projet
- **project-admin**: Administrateur
- **developer**: Développeur (édition + déploiement)
- **designer**: Designer (édition uniquement)
- **contributor**: Contributeur (édition limitée)
- **viewer**: Lecture seule

### Matrice des Permissions

| Permission  | Owner | Admin | Developer | Designer | Contributor | Viewer |
| ----------- | ----- | ----- | --------- | -------- | ----------- | ------ |
| Éditer      | ✅    | ✅    | ✅        | ✅       | ✅          | ❌     |
| Supprimer   | ✅    | ❌    | ❌        | ❌       | ❌          | ❌     |
| Inviter     | ✅    | ✅    | ❌        | ❌       | ❌          | ❌     |
| Déployer    | ✅    | ✅    | ✅        | ❌       | ❌          | ❌     |
| Analytics   | ✅    | ✅    | ✅        | ✅       | ❌          | ✅     |
| Gérer Teams | ✅    | ✅    | ❌        | ❌       | ❌          | ❌     |
| Paramètres  | ✅    | ✅    | ❌        | ❌       | ❌          | ❌     |

## 🔄 Rétrocompatibilité

Le système assure une rétrocompatibilité totale:

### Migration Automatique

- Les utilisateurs existants deviennent des `owners`
- Leurs données sont préservées
- Nouveaux champs ajoutés automatiquement
- Pas de perte de données

### Migration On-Demand

- Si un utilisateur n'a pas été migré, il sera migré à sa première connexion
- Processus transparent pour l'utilisateur

## 📚 Utilisation dans les Applications

### Installation du Package

```bash
npm install @idem/shared-models
```

### Import des Types

```typescript
import {
  UserModel,
  TeamModel,
  ProjectModel,
  CreateTeamDTO,
  ProjectTeamRole,
  ROLE_PERMISSIONS,
} from '@idem/shared-models';
```

### Exemple d'Utilisation

```typescript
// Vérifier les permissions avant une action
async function deleteProject(projectId: string, userId: string) {
  const permissions = await fetch(`/api/projects/${projectId}/permissions`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const perms = await permissions.json();

  if (!perms.data.canDelete) {
    throw new Error('Permission denied');
  }

  // Procéder à la suppression
  await fetch(`/api/projects/${projectId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}
```

## 🔐 Sécurité

### Authentification

- Firebase Auth pour l'authentification
- Support Google et GitHub OAuth
- Tokens JWT sécurisés

### Autorisation

- Vérification des permissions à chaque requête
- Rôles granulaires par équipe et par projet
- Isolation des données par utilisateur/équipe

### Invitations

- Mots de passe temporaires sécurisés
- Tokens d'invitation uniques
- Expiration automatique (7 jours)
- Changement de mot de passe obligatoire

## 📊 Collections Firestore

Le système utilise les collections suivantes:

```
firestore/
├── users/                  # Utilisateurs (migré)
├── teams/                  # 🆕 Équipes
├── project_teams/          # 🆕 Associations projet-équipe
├── invitations/            # 🆕 Invitations
└── migration_status/       # 🆕 Statut des migrations
```

## 🛠️ Prochaines Étapes

### Obligatoire

1. ⬜ **Configurer le service d'email** (SendGrid, Mailgun, AWS SES)
2. ⬜ **Tester la migration** avec vos données
3. ⬜ **Créer les interfaces utilisateur** pour la gestion des équipes

### Recommandé

4. ⬜ Implémenter la gestion des permissions dans le frontend
5. ⬜ Ajouter des notifications pour les invitations
6. ⬜ Créer un dashboard d'administration
7. ⬜ Ajouter des logs d'audit pour les actions sensibles

### Optionnel

8. ⬜ Implémenter des webhooks pour les événements d'équipe
9. ⬜ Ajouter des quotas par équipe
10. ⬜ Créer des rapports d'utilisation par équipe

## 📖 Documentation

- [Documentation complète](./documentation/AUTHORIZATION_SYSTEM.md)
- [Guide d'installation](./SETUP_AUTHORIZATION.md)
- [Package shared-models](./packages/shared-models/README.md)

## 🐛 Dépannage

### Module '@idem/shared-models' non trouvé

```bash
cd packages/shared-models
npm run build
cd ../..
npm install
```

### Migration ne démarre pas

Vérifiez:

- Votre email est dans `ADMIN_EMAILS`
- Vous êtes authentifié
- Firebase Admin SDK est configuré

### Emails non envoyés

1. Configurez votre service d'email dans `invitation.service.ts`
2. Vérifiez les variables d'environnement
3. Consultez les logs de l'API

## 🤝 Contribution

Pour contribuer au système d'autorisation:

1. Créer une branche depuis `main`
2. Implémenter vos changements
3. Tester localement
4. Créer une pull request

## 📝 Notes Importantes

- ⚠️ **Migration**: Exécutez la migration en dehors des heures de pointe
- ⚠️ **Email**: Configurez le service d'email avant la production
- ⚠️ **Permissions**: Testez toutes les permissions avant le déploiement
- ⚠️ **Backup**: Faites un backup de Firestore avant la migration

## ✅ Checklist de Déploiement

- [ ] Package `@idem/shared-models` buildé
- [ ] Variables d'environnement configurées
- [ ] Service d'email configuré et testé
- [ ] Migration testée en développement
- [ ] Backup Firestore effectué
- [ ] Migration exécutée en production
- [ ] Tests de permissions effectués
- [ ] Documentation mise à jour
- [ ] Équipe formée sur le nouveau système

## 🎉 Résultat

Vous disposez maintenant d'un système d'autorisation complet et évolutif qui permet:

✅ Gestion flexible des équipes
✅ Invitations utilisateur automatisées
✅ Permissions granulaires par projet
✅ Rétrocompatibilité totale
✅ Modèles partagés entre applications
✅ Architecture scalable et maintenable

Bon développement! 🚀
