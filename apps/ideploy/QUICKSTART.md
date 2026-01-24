# 🚀 Démarrage Rapide - Coolify Local (Sans Docker)

## Installation en 3 étapes

### 1️⃣ Installer les dépendances (une seule fois)

```bash
brew install php@8.4 postgresql@15 redis composer
```

### 2️⃣ Configurer et installer Coolify

```bash
./scripts/run-local.sh
```

### 3️⃣ Démarrer l'application

```bash
# Option A : Tout démarrer automatiquement
make start

# Option B : Démarrage manuel (4 terminaux)
make serve     # Terminal 1
make queue     # Terminal 2
make horizon   # Terminal 3
make dev       # Terminal 4 (optionnel)
```

## 🌐 Accès

- **Application** : http://localhost:8000
- **Horizon** : http://localhost:8000/horizon

## 📝 Commandes utiles

```bash
make help          # Voir toutes les commandes
make status        # Voir l'état des services
make logs          # Voir les logs
make stop          # Arrêter tous les services
make restart       # Redémarrer
make db-fresh      # Réinitialiser la BDD
make cache-clear   # Vider les caches
```

## 🛑 Arrêter

```bash
make stop
```

---

Pour plus de détails, consultez [LOCAL_SETUP.md](LOCAL_SETUP.md)
