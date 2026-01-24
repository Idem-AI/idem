# 🚀 Quick Start - Idem Workspace

## Installation en 3 étapes

### 1️⃣ Vérifier

```bash
./scripts/check-packages.sh
```

✅ Vérifie que tous les package.json sont valides

### 2️⃣ Nettoyer

```bash
./scripts/clean-all.sh
```

🧹 Supprime tous les node_modules et builds

### 3️⃣ Installer

```bash
./scripts/setup.sh
```

📦 Installe tout dans le bon ordre

---

## Démarrer les Applications

### Landing Page (Port 4201)

```bash
npm run dev:landing
```

🌐 Application publique avec SSR

### Dashboard (Port 4200)

```bash
npm run dev:dashboard
```

📊 Console d'administration

### API (Port 3001)

```bash
npm run dev:api
```

🔌 Backend Node.js/Express

### Chart Editor

```bash
npm run dev:chart
```

📈 Éditeur de diagrammes Mermaid

### AppGen Client

```bash
npm run dev:appgen-client
```

🛠️ Générateur d'applications (Vite)

### AppGen Next

```bash
npm run dev:appgen-next
```

⚡ Générateur d'applications (Next.js)

---

## Commandes Utiles

### Build

```bash
npm run build:all              # Build tout
npm run build:landing          # Build landing
npm run build:dashboard        # Build dashboard
npm run build:shared           # Build shared-models
npm run build:shared-auth      # Build shared-auth-client
```

### Tests & Qualité

```bash
npm run test:all               # Tous les tests
npm run lint:all               # Lint tout
npm run lint:fix               # Fix lint errors
```

### Nettoyage

```bash
./scripts/clean-all.sh         # Nettoyer tout
npm run clean                  # Nettoyer via workspaces
```

---

## En Cas de Problème

### Erreur "Invalid Version"

```bash
./scripts/check-packages.sh    # Identifier
./scripts/clean-all.sh         # Nettoyer
./scripts/setup.sh             # Réinstaller
```

### Dépendances Manquantes

```bash
npm run build:shared
npm run build:shared-auth
cd apps/landing && npm install
```

### Tout Réinstaller

```bash
./scripts/clean-all.sh
./scripts/setup.sh
```

---

## Documentation Complète

- 📚 **scripts/README.md** - Documentation des scripts
- 🔧 **scripts/TROUBLESHOOTING.md** - Guide de dépannage
- 📝 **SETUP_FIX_SUMMARY.md** - Résumé des corrections
- 📖 **README.md** - Documentation principale

---

## Prérequis

- ✅ Node.js >= 18.0.0
- ✅ npm >= 9.0.0
- ✅ pnpm (installé automatiquement si absent)
- ✅ jq (pour check-packages.sh)

### Vérifier les versions

```bash
node -v && npm -v && pnpm -v
```

---

## Architecture

```
idem/
├── apps/
│   ├── landing/           # Angular 20 + SSR (port 4201)
│   ├── main-dashboard/    # Angular 20 (port 4200)
│   ├── api/               # Node.js/Express (port 3001)
│   ├── chart/             # Svelte (Mermaid editor)
│   └── appgen/            # Next.js + Vite
├── packages/
│   ├── shared-models/     # Modèles TypeScript
│   ├── shared-auth-client/# Client auth Angular
│   └── shared-styles/     # Design system Tailwind
└── scripts/
    ├── setup.sh           # Installation
    ├── clean-all.sh       # Nettoyage
    └── check-packages.sh  # Vérification
```

---

## Workflow Développement

### Jour 1 - Installation

```bash
./scripts/check-packages.sh
./scripts/clean-all.sh
./scripts/setup.sh
```

### Jour 2+ - Développement

```bash
# Terminal 1
npm run dev:landing

# Terminal 2
npm run dev:dashboard

# Terminal 3
npm run dev:api
```

### Après modification d'un package partagé

```bash
cd packages/shared-models
npm run build
cd ../..

# Rebuild les apps
npm run build:landing
npm run build:dashboard
```

### Avant de commit

```bash
npm run lint:all
npm run test:all
npm run build:all
```

---

## Support

**Problème persistant ?**

1. Consulter `scripts/TROUBLESHOOTING.md`
2. Vérifier les logs : `~/.npm/_logs/`
3. Créer une issue avec :
   - Version Node/npm/pnpm
   - Système d'exploitation
   - Commande exécutée
   - Log d'erreur complet

---

**Prêt à démarrer ? Exécutez :**

```bash
./scripts/setup.sh
```
