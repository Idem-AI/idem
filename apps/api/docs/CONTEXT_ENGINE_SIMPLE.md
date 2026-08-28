# Comment IDEM connaît tout sur ton projet — expliqué simplement

## Le problème d'avant

Imagine que tu fais générer plusieurs choses par l'IA : un logo, un business plan, des documents légaux, une landing page... Avant, chaque génération **fonctionnait en silos** :

- L'IA qui crée le business plan **ne voyait pas** les couleurs du logo que tu as déjà approuvé
- L'IA qui rédige les documents légaux **ne savait pas** qu'elle avait déjà ton adresse et ton secteur d'activité du business plan
- Si tu changeais quelque chose dans ton projet manuellement après une génération, l'IA **ne s'en rendait pas compte**

Résultat : **incohérence** (le business plan parle des couleurs différemment du branding), **redondance** (demander plusieurs fois la même info), et **perte de contexte** (l'IA oubliait ce qu'elle avait généré 5 minutes avant).

## La solution : "Cohérence infinie"

On a construit deux couches qui fonctionnent ensemble :

### 1. **Context Engine** — l'IA peut chercher ce dont elle a besoin

Au lieu de **tout balancer d'un coup** dans la conversation, l'IA demande juste ce qui lui est utile.

**Analogie** : au lieu de lire un manuel complet, tu cherches avec `Ctrl+F` uniquement ce qui répond à ta question.

L'IA a accès à 7 "outils de recherche" :

- **Voir la carte du projet** ("Quels artefacts existent ?") → elle voit : branding (couleurs, logo), business plan (volumes de vente, dépenses), finance (TRI, point mort), etc. + quand ça a été modifié pour la dernière fois
- **Lire une section au complet ou juste une partie** ("Je veux voir les couleurs exactes" ou "Montre-moi juste le budget opérationnel") → résumé par défaut, détail si elle en a besoin
- **Chercher une info** ("Où parlez-vous du marché cible ?") → elle trouve dans quel artefact, à quel endroit
- **Voir l'historique** ("Qu'est-ce qui a changé depuis mon dernier message ?") → qui a modifié quoi, quand
- **Regarder en arrière dans le temps** ("Comment était le budget avant que je le modifie ?") → elle peut voir l'ancienne version

**Résultat** : l'IA est "consciente" de tout ton projet, mais elle **ne surcharge pas** la conversation. Elle cherche juste ce dont elle a besoin, quand elle en a besoin.

### 2. **Chronicle** — l'historique complet et interrogeable

Chaque fois que quelque chose change dans ton projet, le système **enregistre une snapshot** : qui l'a modifié (toi ou l'IA ?), quand, quoi a changé, et pourquoi.

**Analogie** : c'est comme `git log` ou l'historique Google Docs, mais pour chaque section de ton projet.

L'IA peut interroger cet historique :
- **Log** — "Montre-moi les 10 dernières modifications du business plan"
- **Show** — "C'était comment le branding en version 3 ?"
- **Diff** — "Qu'est-ce qui a changé entre la version 1 et la version 3 du business plan ?"
- **State at date** — "Quel était mon business plan le 15 juillet ?"
- **Restore** — "Reviens à la version 2" (ça crée juste une nouvelle révision, l'historique reste intact)

**Résultat** : tu sais **toujours** ce qui a changé, et l'IA ne se contredit jamais en utilisant des données obsolètes.

## Comment ça fonctionne en pratique

### Scénario 1 : L'advisor (conseiller) pose des questions intelligentes

1. **Tu** : "Aide-moi à structurer mon business plan"
2. **Advisor** appelle les 7 outils :
   - "Quels artefacts existent ?" → voit que tu as un branding, une landing page, des infos financières
   - "Montre-moi la carte du projet" → voit l'overview (nom, description, type d'entreprise)
   - "Qu'est-ce qui a changé récemment ?" → voit que tu as mis à jour les finances hier
3. **Advisor** répond intelligemment : "Je vois que tu fais du SaaS en montée de charge. Basé sur tes finances actuelles et ton positionnement de marque, voici ce que je suggère..."

Au lieu d'un boilerplate générique, tu as une réponse **personnalisée et cohérente avec le reste de ton projet**.

### Scénario 2 : Tu modifies quelque chose, l'IA l'apprend

1. Tu mets à jour les couleurs du branding (tu appuies sur un bouton "Save")
2. Le système **enregistre** : "L'utilisateur a changé les couleurs du branding, révision #12"
3. L'advisor le voit dans l'historique et peut l'utiliser : "Je remarque que tu as changé les couleurs. Veux-tu que j'adapte la landing page pour qu'elle corresponde ?"

## Ce qui change pour toi

### ✅ Avantages

- **Pas de redondance** : l'IA ne te pose plus 5 fois la même question
- **Cohérence** : tous les artefacts se "parlent" (le business plan cite les couleurs du branding, la landing page reflète la stratégie, etc.)
- **Conscience de l'historique** : l'IA sait ce qui a changé et ne se contredit jamais
- **Contrôle** : tu vois chaque révision et tu peux revenir à une ancienne version facilement
- **Traçabilité** : tu sais **qui** (toi ou l'IA) a modifié **quoi** et **quand**

### 🎯 Cas d'usage possibles

1. **Branding cohérent** : "Génère une landing page qui respecte les couleurs et la typographie du branding"
2. **Business plan vivant** : "Adapter le business plan aux nouvelles couleurs de branding que j'ai choisies"
3. **Documents légaux contextuels** : "Rédige mes CGU en utilisant le vrai nom de mon entreprise et mon secteur d'activité"
4. **Déploiement intelligent** : "Propose une architecture cloud cohérente avec les données du business plan"
5. **Restauration** : "Je n'aime pas la version 5 du business plan, reviens à la version 3"

## Sous le capot (sans le jargon)

Deux systèmes travaillent ensemble :

1. **Context Engine** = "Je peux chercher n'importe quelle info du projet"
   - 12 catégories d'informations (branding, finance, legal, etc.)
   - Chacune peut être lue en résumé ou en détail
   - Possibilité de chercher par mot-clé

2. **Chronicle** = "Je peux voir tout l'historique du projet"
   - Chaque changement = une révision numérotée
   - Les révisions stockent la différence exacte (qu'est-ce qui a changé)
   - On peut reconstruire n'importe quel état passé + voir l'historique complet

Les deux communiquent entre eux : quand tu sauvegards une modification, Chronicle l'enregistre automatiquement, et Context Engine la rend immédiatement visible à l'IA.

## Bonus : le "Coherence Guard" — tes artefacts se surveillent entre eux

Exemple vécu : ton business plan décrit un modèle de revenu (abonnements 5-20 €/mois + commissions 5%), mais ta page Prévisions financières est encore vide. Avant, l'IA pouvait répondre "tu n'as pas de modèle de revenu" en ne regardant que la page finance. Deux corrections :

1. **L'IA croise maintenant les sources** : pour toute question sur ton modèle économique, elle consulte le business plan ET le module finance, et te répond avec la vraie information — en te signalant au passage ce qui manque.

2. **La synchronisation intelligente** : à chaque fois que tu modifies ton business plan (ou tes finances), un "gardien de cohérence" compare automatiquement les deux quelques secondes plus tard. S'il détecte un décalage (montants différents, modèle de revenu absent des finances, charges non reportées...), il crée une **alerte** avec :
   - une explication de l'incohérence,
   - des **propositions d'action** — dont "Remplir automatiquement les prévisions financières depuis le business plan" en un clic.

**Important** : le gardien ne modifie JAMAIS tes données tout seul. Il détecte automatiquement, mais c'est toujours toi qui confirmes l'application (dans le chat ou d'un clic). Tes chiffres ne seront jamais écrasés en silence.

## Et demain ?

Pour l'instant, seul l'advisor utilise ce système. Mais bientôt :
- La génération du business plan va aussi utiliser les outils
- La génération du branding demandera des infos au business plan
- Les documents légaux compileront automatiquement tes vraies données
- Le dashboard montrera une belle timeline de toutes tes révisions

C'est la "cohérence infinie" : **tout ce qu'IDEM génère connaît tout ce qui a été généré avant**, et **tu contrôles et reverifies tout** sans que rien ne se casse.
