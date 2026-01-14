# Configuration des clés SSH de test

## Pourquoi des variables d'environnement ?

Les clés SSH de test sont maintenant configurées via des variables d'environnement pour :

- ✅ Éviter de committer des clés réelles dans Git
- ✅ Passer les contrôles de sécurité GitHub (push protection)
- ✅ Permettre à chaque développeur d'utiliser ses propres clés de test

## Configuration pour le développement local

### 1. Générer des clés SSH de test

```bash
# Générer une clé ED25519 pour les tests
ssh-keygen -t ed25519 -f ~/.ssh/test_ideploy_key -N ""

# Générer une clé RSA pour les tests GitHub
ssh-keygen -t rsa -b 2048 -f ~/.ssh/test_github_key -N ""
```

### 2. Ajouter les clés à votre fichier `.env`

Copiez le contenu des clés générées dans votre fichier `.env` local :

```bash
# Dans apps/ideploy/.env

# Clé pour les tests généraux
TEST_SSH_KEY="-----BEGIN OPENSSH PRIVATE KEY-----
[contenu de ~/.ssh/test_ideploy_key]
-----END OPENSSH PRIVATE KEY-----"

# Clé pour le seeder de l'hôte de test
TEST_SSH_HOST_KEY="-----BEGIN OPENSSH PRIVATE KEY-----
[contenu de ~/.ssh/test_ideploy_key]
-----END OPENSSH PRIVATE KEY-----"

# Clé pour le seeder GitHub
TEST_SSH_GITHUB_KEY="-----BEGIN RSA PRIVATE KEY-----
[contenu de ~/.ssh/test_github_key]
-----END RSA PRIVATE KEY-----"

# Clé pour Windows Docker Desktop
TEST_SSH_WINDOWS_KEY="-----BEGIN OPENSSH PRIVATE KEY-----
[contenu de ~/.ssh/test_ideploy_key]
-----END OPENSSH PRIVATE KEY-----"
```

### 3. Pour les tests automatisés (CI/CD)

Les tests peuvent fonctionner avec les valeurs par défaut (placeholders `XXXX...`) car ils testent principalement le formatage, pas la validité cryptographique des clés.

Si vous avez besoin de vraies clés pour les tests d'intégration, ajoutez-les comme secrets dans votre CI :

- GitHub Actions : Settings → Secrets → Actions
- GitLab CI : Settings → CI/CD → Variables

## Fichiers concernés

- `database/seeders/PrivateKeySeeder.php` - Utilise `TEST_SSH_HOST_KEY` et `TEST_SSH_GITHUB_KEY`
- `database/seeders/ProductionSeeder.php` - Utilise `TEST_SSH_WINDOWS_KEY`
- `tests/Feature/MultilineEnvironmentVariableTest.php` - Utilise `TEST_SSH_KEY`
- `tests/Unit/PrivateKeyStorageTest.php` - Utilise `TEST_SSH_KEY`

## Sécurité

⚠️ **IMPORTANT** :

- Ne JAMAIS committer le fichier `.env` avec des clés réelles
- Ces clés doivent être uniquement pour les tests locaux
- Ne pas utiliser de clés de production ou ayant accès à des ressources réelles
