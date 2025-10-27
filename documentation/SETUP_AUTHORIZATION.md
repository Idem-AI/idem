# Guide d'Installation du Système d'Autorisation

## Étape 1: Installation des dépendances

```bash
# À la racine du monorepo
npm install

# Build le package shared-models
npm run build:shared
```

## Étape 2: Configuration de l'environnement

Ajouter dans `apps/api/.env`:

```bash
# Emails des administrateurs (pour la migration)
ADMIN_EMAILS=votre-email@example.com

# URL de l'application frontend
APP_URL=http://localhost:3000

# Configuration email (à configurer selon votre service)
EMAIL_SERVICE=sendgrid
EMAIL_API_KEY=your-api-key
EMAIL_FROM=noreply@idem.com
```

## Étape 3: Build et démarrage

```bash
# Build tous les packages
npm run build:all

# Ou juste l'API
npm run build:api

# Démarrer l'API
npm run dev:api
```

## Étape 4: Exécuter la migration

### Option 1: Via l'API (Recommandé)

```bash
# Obtenir votre token d'authentification
# Puis faire la requête:

curl -X POST http://localhost:3001/api/migration/run \
  -H "Authorization: Bearer YOUR_TOKEN"

# Vérifier le statut
curl -X GET http://localhost:3001/api/migration/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Option 2: Script de migration

Créer un script `apps/api/scripts/migrate.ts`:

```typescript
import { migrationService } from '../api/services/authorization/migration.service';

async function runMigration() {
  try {
    console.log('Starting migration...');
    const status = await migrationService.migrateAllUsers();
    console.log('Migration completed:', status);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
```

Puis exécuter:

```bash
cd apps/api
npx ts-node scripts/migrate.ts
```

## Étape 5: Tester le système

### 1. Créer une équipe

```bash
curl -X POST http://localhost:3001/api/teams \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mon Équipe de Test",
    "description": "Équipe pour tester le système"
  }'
```

### 2. Inviter un utilisateur

```bash
curl -X POST http://localhost:3001/api/invitations \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "displayName": "Test User",
    "invitationType": "team",
    "teamId": "TEAM_ID_FROM_STEP_1",
    "teamRole": "member"
  }'
```

### 3. Vérifier l'invitation

```bash
# L'invitation devrait être créée
# Un email devrait être envoyé (si configuré)
# Vous pouvez récupérer l'invitation pour tester:

curl -X GET http://localhost:3001/api/invitations/INVITATION_TOKEN
```

## Étape 6: Intégrer dans vos applications

### Dans votre application frontend

```typescript
// Installer le package
npm install @idem/shared-models

// Utiliser les types
import { UserModel, TeamModel } from '@idem/shared-models';

// Exemple: Récupérer les équipes de l'utilisateur
const response = await fetch('/api/teams/my-teams', {
  headers: {
    'Authorization': `Bearer ${userToken}`
  }
});

const teams: TeamModel[] = await response.json();
```

### Middleware de vérification des permissions

```typescript
import { projectTeamService } from './services/authorization/project-team.service';

// Middleware pour vérifier les permissions
export async function checkPermission(
  req: CustomRequest,
  res: Response,
  next: NextFunction,
  permission: keyof RolePermissions
) {
  const userId = req.user?.uid;
  const projectId = req.params.projectId;

  if (!userId || !projectId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const hasPermission = await projectTeamService.userHasPermission(projectId, userId, permission);

  if (!hasPermission) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  next();
}

// Utilisation
router.delete(
  '/projects/:projectId',
  authenticate,
  (req, res, next) => checkPermission(req, res, next, 'canDelete'),
  deleteProject
);
```

## Étape 7: Configuration du service d'email

### Exemple avec SendGrid

```bash
npm install @sendgrid/mail
```

Dans `invitation.service.ts`:

```typescript
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

private async sendInvitationEmail(invitation: InvitationModel): Promise<void> {
  const msg = {
    to: invitation.email,
    from: process.env.EMAIL_FROM!,
    subject: 'Invitation à rejoindre Idem',
    html: `
      <h1>Bienvenue sur Idem!</h1>
      <p>Vous avez été invité à rejoindre une équipe.</p>
      <p>Vos identifiants:</p>
      <ul>
        <li>Email: ${invitation.email}</li>
        <li>Mot de passe temporaire: ${invitation.temporaryPassword}</li>
      </ul>
      <p><a href="${invitationLink}">Accepter l'invitation</a></p>
    `,
  };

  await sgMail.send(msg);

  // Marquer comme envoyé
  if (invitation.id) {
    await this.repository.update(
      invitation.id,
      { emailSent: true, emailSentAt: new Date() },
      INVITATIONS_COLLECTION
    );
  }
}
```

## Étape 8: Créer les interfaces utilisateur

### Page de gestion des équipes

```typescript
// components/TeamManagement.tsx
import { useState, useEffect } from 'react';
import { TeamModel } from '@idem/shared-models';

export function TeamManagement() {
  const [teams, setTeams] = useState<TeamModel[]>([]);

  useEffect(() => {
    fetchTeams();
  }, []);

  async function fetchTeams() {
    const response = await fetch('/api/teams/my-teams', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();
    setTeams(data.data);
  }

  async function createTeam(name: string) {
    await fetch('/api/teams', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name })
    });
    fetchTeams();
  }

  return (
    <div>
      <h1>Mes Équipes</h1>
      {teams.map(team => (
        <div key={team.id}>
          <h2>{team.name}</h2>
          <p>{team.members.length} membres</p>
        </div>
      ))}
    </div>
  );
}
```

## Dépannage

### Erreur: Cannot find module '@idem/shared-models'

```bash
# Rebuild le package
cd packages/shared-models
npm run build

# Réinstaller les dépendances
cd ../../
npm install
```

### La migration ne démarre pas

Vérifiez que:

1. Votre email est dans `ADMIN_EMAILS`
2. Vous êtes authentifié avec le bon token
3. Firebase Admin SDK est correctement configuré

### Les emails ne sont pas envoyés

1. Vérifiez la configuration de votre service d'email
2. Consultez les logs de l'API
3. Testez manuellement l'envoi d'email

## Prochaines étapes

1. ✅ Système d'autorisation installé
2. ⬜ Configurer le service d'email
3. ⬜ Créer les interfaces utilisateur
4. ⬜ Tester avec des utilisateurs réels
5. ⬜ Déployer en production

## Support

Pour toute question, consultez:

- [Documentation complète](./documentation/AUTHORIZATION_SYSTEM.md)
- [Modèles partagés](./packages/shared-models/README.md)
