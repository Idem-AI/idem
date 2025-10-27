# @idem/shared-models

Package de modèles et types partagés pour l'écosystème Idem.

## Installation

```bash
npm install @idem/shared-models
```

## Utilisation

```typescript
import { UserModel, TeamModel, ProjectModel } from '@idem/shared-models';
```

## Développement

```bash
# Build
npm run build

# Watch mode
npm run dev

# Clean
npm run clean
```

## Modèles disponibles

- **UserModel**: Modèle utilisateur avec authentification Google/GitHub
- **TeamModel**: Modèle d'équipe avec membres et rôles
- **TeamMemberModel**: Membre d'équipe avec rôle spécifique
- **ProjectModel**: Modèle de projet
- **ProjectTeamModel**: Association entre projet et équipe avec rôles
- **RoleModel**: Rôles et permissions
- **InvitationModel**: Invitations utilisateur
