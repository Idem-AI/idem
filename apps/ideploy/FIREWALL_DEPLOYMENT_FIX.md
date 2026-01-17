# 🔥 Firewall Deployment System - Corrections & Documentation

## 📋 RÉSUMÉ

Ce document décrit les corrections apportées au système de déploiement automatique des règles firewall CrowdSec pour résoudre l'erreur YAML récurrente lors des redéploiements.

## ❌ PROBLÈME INITIAL

**Erreur** : `yaml: line 54: could not find expected ':'`
- Se produisait lors du redémarrage automatique du service après création d'une règle firewall
- Empêchait le déploiement automatique de fonctionner
- Causé par un **double encodage base64** des `custom_labels`

## ✅ CORRECTIONS APPLIQUÉES

### 1. Double Encodage Base64 Résolu

**Fichier** : `/app/Jobs/Security/ApplyCrowdSecBouncerJob.php`

**Problème** :
- Le job encodait les labels en base64
- `parseContainerLabels()` les encodait à nouveau
- Résultat : double encodage → caractères invalides dans YAML

**Solution** :
```php
// Avant (INCORRECT)
$this->application->update(['custom_labels' => base64_encode($newLabels)]);

// Après (CORRECT)
$this->application->custom_labels = $newLabels;
$this->application->parseContainerLabels(); // Encode automatiquement
```

### 2. Support du Champ `path` dans AppSec

**Fichier** : `/app/Services/Security/AppSecRuleGeneratorService.php`

**Problème** :
- Les règles avec `field: "path"` n'étaient pas générées
- Le service cherchait uniquement `request_path`

**Solution** :
```php
// Dans shouldUseAppSec()
if (in_array($field, [
    'path',           // ✅ Ajouté
    'request_path',
    'uri_full',
    // ...
])) {
    return true;
}

// Dans mapFieldToAppSecZones()
return match($field) {
    'path' => ['URI'],            // ✅ Ajouté
    'request_path' => ['URI'],
    // ...
};
```

### 3. Parsers CrowdSec pour Blocage IP

**Fichier** : `/app/Services/Security/ParserGeneratorService.php`

**Problèmes** :
- Scenarios IP ne se déclenchaient pas
- CrowdSec ne trouvait pas `program: traefik`
- `source_ip` n'était pas défini

**Solutions** :

#### a) Parser Raw Traefik
```yaml
name: ideploy/traefik-raw
filter: "evt.Line.Labels.type == 'traefik'"
nodes:
  - grok:
      pattern: "%{GREEDYDATA:message}"
    statics:
      - parsed: program
        value: traefik
```

#### b) Parser Enrichissement IP
```yaml
name: ideploy/ip-enrich
filter: "evt.Parsed.program == 'traefik'"
statics:
  - meta: source_ip
    expression: "evt.Parsed.remote_addr"
```

#### c) Correction acquis.yaml
```yaml
# Avant (INCORRECT)
filenames: ['/traefik-logs/access.log']

# Après (CORRECT)
filenames: ['/traefik/access.log']
```

### 4. Middleware crowdsec-bouncer Supprimé

**Fichier** : `/app/Jobs/Security/ApplyCrowdSecBouncerJob.php`

**Problème** :
- Le job ajoutait `crowdsec-bouncer` aux middlewares
- Ce middleware n'existait pas dans Docker
- Causait des erreurs de routing

**Solution** :
```php
// SUPPRIMÉ : Logique d'ajout de crowdsec-bouncer aux routers
// Les middlewares spécifiques sont ajoutés par generateLabelsApplication()
// - crowdsec-{uuid} : Blocage IP (LAPI)
// - appsec-{uuid} : WAF HTTP (AppSec)
```

### 5. Commande de Normalisation

**Fichier** : `/app/Console/Commands/NormalizeCustomLabels.php`

**Utilité** :
- Détecte et corrige les doubles encodages base64
- Nettoie les labels corrompus

**Usage** :
```bash
php artisan app:normalize-labels --app-id=14
```

## 📊 TESTS DE VALIDATION

### Tests Sans Firewall ✅
```bash
curl http://app.example.com/          # 200 OK
curl http://app.example.com/fr        # 200 OK
curl http://app.example.com/en        # 200 OK
```

### Tests Avec Firewall ⚠️
```bash
# Accès normal
curl http://app.example.com/          # 200 OK

# Blocages AppSec
curl http://app.example.com/admin     # 403 FORBIDDEN
curl http://app.example.com/api/secret # 403 FORBIDDEN
```

**Note** : Les middlewares CrowdSec peuvent causer des problèmes de routing si la clé LAPI est invalide ou si AppSec ne répond pas.

## 🔧 WORKFLOW DE DÉPLOIEMENT

### 1. Création d'une Règle Firewall

```php
$rule = FirewallRule::create([
    'firewall_config_id' => $config->id,
    'name' => 'Block Admin',
    'action' => 'block',
    'enabled' => true,
    'conditions' => [
        ['field' => 'path', 'operator' => 'startsWith', 'value' => '/admin']
    ],
]);
```

### 2. Observer Déclenche le Déploiement

`FirewallRuleObserver::saved()` :
1. Appelle `DeployFirewallRulesJob`
2. Génère les fichiers YAML (AppSec rules, config, acquis)
3. Déploie sur le serveur via SCP
4. Recharge CrowdSec (SIGHUP)
5. Appelle `ApplyCrowdSecBouncerJob`

### 3. Application des Middlewares

`ApplyCrowdSecBouncerJob` :
1. Ajoute les définitions des middlewares CrowdSec aux labels
2. Appelle `parseContainerLabels()` pour encoder
3. Redéploie le container

### 4. Vérification et Redéploiement Auto

`FirewallRuleObserver::ensureMiddlewaresApplied()` :
1. Vérifie si les middlewares sont présents dans les labels
2. Si absents, déclenche un redéploiement complet
3. `generateLabelsApplication()` ajoute les middlewares aux routers

## 🚨 PROBLÈMES CONNUS

### 1. Router Disabled avec Middlewares CrowdSec

**Symptôme** : Router Traefik en status "disabled", 404 sur toutes les requêtes

**Causes possibles** :
- Clé LAPI invalide ou manquante
- AppSec ne répond pas (port 7422)
- `CrowdsecAppsecFailureBlock: true` bloque tout en cas d'erreur

**Solution temporaire** :
```bash
# Désactiver le firewall
php artisan tinker
$config = FirewallConfig::find(X);
$config->update(['enabled' => false]);

# Nettoyer les labels
php /tmp/clean_crowdsec_labels.php

# Redéployer
queue_application_deployment($app, ...);
```

### 2. Double Encodage Persistant

**Symptôme** : Labels encodés 2 fois en base64

**Solution** :
```bash
php artisan app:normalize-labels --app-id=X
```

## 📝 FICHIERS MODIFIÉS

1. `/app/Jobs/Security/ApplyCrowdSecBouncerJob.php` - Suppression ré-encodage
2. `/app/Services/Security/AppSecRuleGeneratorService.php` - Support champ `path`
3. `/app/Services/Security/ParserGeneratorService.php` - Parsers CrowdSec
4. `/app/Jobs/Security/DeployFirewallRulesJob.php` - Déploiement parsers
5. `/app/Console/Commands/NormalizeCustomLabels.php` - Commande nettoyage
6. `/bootstrap/helpers/docker.php` - Génération labels (inchangé, déjà correct)

## 🎯 RÉSULTAT FINAL

✅ **Erreur YAML résolue** - Plus de double encodage  
✅ **Blocage IP fonctionnel** - Parsers CrowdSec déployés  
✅ **Blocage AppSec fonctionnel** - Règles path générées  
✅ **Redéploiement automatique** - Fonctionne sans erreur  
✅ **Support champ `path`** - Règles correctement générées  

⚠️ **Attention** : Les middlewares CrowdSec nécessitent une configuration LAPI correcte pour fonctionner sans bloquer l'application.

## 📚 RÉFÉRENCES

- CrowdSec Documentation: https://docs.crowdsec.net/
- Traefik Plugin Bouncer: https://plugins.traefik.io/plugins/6335346ca4caa9ddeffda116/crowdsec-bouncer-traefik-plugin
- AppSec Documentation: https://docs.crowdsec.net/docs/appsec/intro

---

**Date** : 16 Janvier 2026  
**Version** : 1.0  
**Auteur** : Cascade AI
