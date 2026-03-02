# Backend MongoDB - Configuration Complète

## Vue d'ensemble

Le backend API utilise **exclusivement MongoDB avec Mongoose**. Firestore a été complètement supprimé.

## Architecture

### Structure des fichiers

```
apps/api/api/
├── config/
│   └── mongodb.config.ts          # Gestionnaire de connexion MongoDB
├── repository/
│   ├── IRepository.ts              # Interface commune
│   ├── MongoDBRepository.ts        # Implémentation MongoDB
│   ├── RepositoryFactory.ts        # Factory (retourne MongoDB uniquement)
│   └── database.config.ts          # Configuration (MongoDB uniquement)
├── schemas/
│   ├── user.schema.ts              # Schéma Mongoose pour User
│   ├── project.schema.ts           # Schéma Mongoose pour Project
│   ├── archetype.schema.ts         # Schéma Mongoose pour Archetype
│   ├── deployment.schema.ts        # Schéma Mongoose pour Deployment
│   ├── contact.schema.ts           # Schéma Mongoose pour Contact
│   └── index.ts                    # Export centralisé
├── models/                         # Interfaces TypeScript (inchangées)
└── index.ts                        # Point d'entrée avec init MongoDB
```

## Configuration

### Variables d'environnement

Fichier `.env` :

```bash
# Database Configuration - MongoDB Only
MONGODB_URI=mongodb://localhost:27017/idem

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
REDIS_DB=0

# Autres configurations...
```

**Note :** Toutes les variables Firebase ont été supprimées.

## Schémas Mongoose

### Schémas disponibles

Tous les modèles principaux ont des schémas Mongoose définis :

#### 1. UserSchema (`schemas/user.schema.ts`)
- **Collection :** `users`
- **Index :** `email`, `uid`
- **Champs :** uid, email, displayName, photoURL, subscription, quota, roles, githubIntegration, refreshTokens, policyAcceptance

#### 2. ProjectSchema (`schemas/project.schema.ts`)
- **Collection :** `projects`
- **Index :** `userId + createdAt`, full-text search sur `name` et `description`
- **Champs :** name, description, type, constraints, teamSize, scope, userId, selectedPhases, analysisResultModel, deployments, activeChatMessages, policyAcceptance, additionalInfos

#### 3. ArchetypeSchema (`schemas/archetype.schema.ts`)
- **Collection :** `archetypes`
- **Index :** `provider + category`, `isActive`, full-text search
- **Champs :** name, description, provider, category, tags, terraformVariables, defaultValues, isActive

#### 4. DeploymentSchema (`schemas/deployment.schema.ts`)
- **Collection :** `deployments`
- **Index :** `projectId + createdAt`, `status`, `environment`
- **Champs :** projectId, name, mode, environment, status, gitRepository, environmentVariables, pipelines, architectureComponents, chatMessages, etc.

#### 5. ContactSchema (`schemas/contact.schema.ts`)
- **Collection :** `contacts`
- **Index :** `status + createdAt`, `email`
- **Champs :** name, email, subject, message, status, ipAddress, userAgent

### Schémas génériques

Pour les collections non définies (ex: collections utilisateur spécifiques), le `MongoDBRepository` crée automatiquement un schéma générique avec `strict: false`.

## MongoDBRepository

### Fonctionnalités

Le repository utilise automatiquement les schémas prédéfinis quand disponibles :

```typescript
// Mapping automatique
const SCHEMA_MAP: Record<string, Schema> = {
  'users': UserSchema,
  'projects': ProjectSchema,
  'archetypes': ArchetypeSchema,
  'deployments': DeploymentSchema,
  'contacts': ContactSchema,
};
```

### Transformation automatique

Tous les documents sont transformés pour utiliser `id` au lieu de `_id` :

```typescript
// MongoDB document
{ _id: ObjectId("..."), name: "Test" }

// Transformé en
{ id: "...", name: "Test" }
```

### Timestamps automatiques

Tous les schémas ont `timestamps: true`, donc `createdAt` et `updatedAt` sont gérés automatiquement par Mongoose.

## Utilisation dans le code

### Aucun changement requis !

Le code existant continue de fonctionner sans modification :

```typescript
// Services (inchangés)
class ProjectService {
  private projectRepository: IRepository<ProjectModel>;

  constructor() {
    this.projectRepository = RepositoryFactory.getRepository<ProjectModel>();
  }

  async createProject(data: ProjectData) {
    return await this.projectRepository.create(data, 'projects');
  }
}
```

Le `RepositoryFactory` retourne automatiquement `MongoDBRepository`.

## Installation MongoDB

### Local (Development)

**macOS :**
```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

**Linux (Ubuntu/Debian) :**
```bash
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
sudo systemctl start mongod
```

**Windows :**
Téléchargez depuis https://www.mongodb.com/try/download/community

### Cloud (Production)

**MongoDB Atlas (Recommandé) :**

1. Créez un compte sur https://www.mongodb.com/cloud/atlas
2. Créez un cluster gratuit
3. Configurez les accès réseau (IP Whitelist)
4. Créez un utilisateur de base de données
5. Récupérez la connection string :
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/idem?retryWrites=true&w=majority
   ```

## Démarrage

### 1. Installer les dépendances

```bash
npm install
```

Les dépendances MongoDB sont déjà installées :
- `mongoose`
- `@types/mongoose`

### 2. Configurer `.env`

```bash
MONGODB_URI=mongodb://localhost:27017/idem
```

### 3. Démarrer l'API

```bash
npm run dev
```

Logs attendus :
```
Server running on port 3001
Database: MongoDB
MongoDB connection established successfully
```

## Index MongoDB

### Index recommandés

Les index sont définis dans les schémas Mongoose et créés automatiquement :

**Users :**
```javascript
db.users.createIndex({ email: 1 }, { unique: true })
db.users.createIndex({ uid: 1 }, { unique: true })
```

**Projects :**
```javascript
db.projects.createIndex({ userId: 1, createdAt: -1 })
db.projects.createIndex({ name: "text", description: "text" })
```

**Deployments :**
```javascript
db.deployments.createIndex({ projectId: 1, createdAt: -1 })
db.deployments.createIndex({ status: 1 })
db.deployments.createIndex({ environment: 1 })
```

**Archetypes :**
```javascript
db.archetypes.createIndex({ provider: 1, category: 1 })
db.archetypes.createIndex({ isActive: 1 })
db.archetypes.createIndex({ name: "text", description: "text" })
```

## Cache Redis

Le cache Redis fonctionne de la même manière qu'avant :

```typescript
// Cache automatique dans findById
const cacheKey = cacheService.generateDBKey(collectionPath, 'system', id);
const cached = await cacheService.get<T>(cacheKey, { prefix: 'db', ttl: 1800 });
```

## Monitoring

### Logs MongoDB

```
info: MongoDBRepository initialized
info: Using predefined schema for collection: projects
info: Mongoose model ready for collection: projects
info: MongoDBRepository.create called for collection path: projects
info: Document created successfully in projects, documentId: 507f1f77bcf86cd799439011
```

### Connexion MongoDB

```
info: MongoDB connected successfully {"host":"localhost","database":"idem"}
```

## Tests

### Vérifier la connexion

```bash
# MongoDB Shell
mongosh

# Dans mongosh :
> show dbs
> use idem
> show collections
> db.users.find().limit(5)
```

### Tester l'API

```bash
# Health check
curl http://localhost:3001/

# Créer un projet
curl -X POST http://localhost:3001/projects \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Project", "description": "Test"}'

# Récupérer un projet
curl http://localhost:3001/projects/{projectId}
```

## Migrations de données

Si vous avez des données existantes dans Firestore, vous devrez les migrer vers MongoDB.

### Option 1 : Démarrage à zéro

Recommandé pour le développement - commencez avec une base MongoDB vide.

### Option 2 : Script de migration

Créez un script pour migrer les données de Firestore vers MongoDB (si nécessaire).

## Avantages MongoDB

✅ **Requêtes complexes** - Agrégations, joins, full-text search  
✅ **Transactions ACID** - Support complet des transactions  
✅ **Schémas flexibles** - Validation optionnelle avec Mongoose  
✅ **Performance** - Indexation avancée  
✅ **Coût** - Moins cher pour gros volumes  
✅ **Outils** - MongoDB Compass, Atlas, etc.  

## Troubleshooting

### Erreur : "MONGODB_URI environment variable is not defined"

**Solution :** Ajoutez `MONGODB_URI` dans votre `.env`

### Erreur : "MongoServerError: connect ECONNREFUSED"

**Solution :** MongoDB n'est pas démarré. Lancez :
```bash
# macOS
brew services start mongodb-community

# Linux
sudo systemctl start mongod
```

### Erreur : "Model already defined"

**Solution :** Redémarrez le serveur. Mongoose garde les modèles en cache.

### Connexion lente

**Solution :** Utilisez MongoDB local pour le développement ou MongoDB Atlas avec une région proche.

## Fichiers supprimés

Les fichiers suivants ont été supprimés :

- ❌ `api/repository/FirestoreRepository.ts` - Supprimé
- ❌ Firebase Admin SDK initialization dans `index.ts` - Supprimé
- ❌ Variables d'environnement Firebase - Supprimées
- ❌ Dépendance `firebase-admin` - Désinstallée

## Fichiers créés

Les fichiers suivants ont été créés :

- ✅ `api/config/mongodb.config.ts` - Gestionnaire de connexion
- ✅ `api/schemas/user.schema.ts` - Schéma User
- ✅ `api/schemas/project.schema.ts` - Schéma Project
- ✅ `api/schemas/archetype.schema.ts` - Schéma Archetype
- ✅ `api/schemas/deployment.schema.ts` - Schéma Deployment
- ✅ `api/schemas/contact.schema.ts` - Schéma Contact
- ✅ `api/schemas/index.ts` - Export centralisé

## Fichiers modifiés

- ✅ `api/repository/MongoDBRepository.ts` - Utilise les schémas prédéfinis
- ✅ `api/repository/RepositoryFactory.ts` - Retourne MongoDB uniquement
- ✅ `api/repository/database.config.ts` - MongoDB uniquement
- ✅ `api/index.ts` - Initialisation MongoDB, Firebase supprimé
- ✅ `.env.example` - Variables Firebase supprimées
- ✅ `package.json` - `firebase-admin` désinstallé

## Prochaines étapes

### Développement

1. ✅ MongoDB installé et démarré
2. ✅ Variables d'environnement configurées
3. ✅ API démarrée avec succès
4. ⏳ Tester toutes les fonctionnalités
5. ⏳ Créer des données de test

### Production

1. ⏳ Configurer MongoDB Atlas
2. ⏳ Migrer les données (si nécessaire)
3. ⏳ Configurer les backups
4. ⏳ Monitorer les performances
5. ⏳ Optimiser les index

## Support

Pour toute question :

1. Vérifiez les logs de l'API
2. Vérifiez la connexion MongoDB : `mongosh` ou MongoDB Compass
3. Vérifiez les variables d'environnement
4. Consultez la documentation Mongoose : https://mongoosejs.com/

## Conclusion

Le backend utilise maintenant **exclusivement MongoDB**. Firestore a été complètement supprimé. Tous les schémas Mongoose sont définis et prêts à l'emploi. Le code existant continue de fonctionner sans modification grâce au pattern Repository.
