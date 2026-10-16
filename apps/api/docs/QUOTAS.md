# Quotas IA par fonctionnalité

> Généré par `npm run quotas:matrix` le 2026-10-16 — ne pas modifier à la main : corriger `config/generation-budgets.ts` ou `models/usage-quota.model.ts`, puis relancer.

## Comment lire ce document

Chaque génération IA a une **enveloppe** : ses étapes, le modèle de chacune, le nombre d’appels et les jetons d’entrée et de sortie, en valeur **typique** et en **plafond** (les `maxOutputTokens` configurés, le nombre maximal de sections ou de scènes, les reprises bornées). Multipliée par le tarif OpenRouter du modèle choisi pour la fonctionnalité, elle donne le coût d’une génération à chaque cran de la jauge de créativité.

- Taux de conversion : **1 $ = 577 F CFA** (`XAF_USD_RATE`).
- Valeur nette d’un franc de prix (modèle au portefeuille) : **plancher 0,85 F** (pire grille pays, bonus de recharge maximal, frais) et **référence 0,97 F** (frais seuls). Un livrable rapporte sa part du Kit plafonné (2 500 F pour 7 500 F) ; une esquisse, une aide ou la génération initiale iCode ne rapportent rien et sont bornées par les quotas.
- **R1 · jamais à perte** : coût plafond ≤ prix × valeur plancher (« marge au plafond » ≥ 0).
- **R2 · très rentable** : coût typique ≤ 25 % du prix × valeur de référence (« marge typique » ≥ 75 %).
- Unités hors jetons : résultat web $0.0040, image FLUX.2 $0.0034, image Gemini $0.077, seconde de clip $0.120, voix 0,62 $ par million de caractères.

Les **quotas** comptent les générations par groupe de fonctionnalités, par jour (UTC), semaine (ISO, lundi) et mois. Un **plafond de dépense IA** par compte complète le comptage : il arrête le pire cas (une suite de générations au coût plafond) avant qu’il ne coûte plus que ce que l’offre rapporte. Enfin chaque génération a un **budget d’exécution** : au-delà, elle est signalée (mode `log`) ou arrêtée et remboursée (mode `enforce`).

## 1. Quotas par offre — jour / semaine / mois

| Groupe | Gratuit (Découverte / Hobby) | Essentiel / Starter | Croissance / Pro | Cabinet / Studio / Scale | Bêta premium (offerte) |
|---|---|---|---|---|---|
| Aides IA | 30 / 120 / 300 | 80 / 400 / 1 200 | 150 / 800 / 2 500 | 300 / 1 500 / 5 000 | 60 / 300 / 800 |
| Retouches IA | 30 / 120 / 300 | 120 / 600 / 1 800 | 250 / 1 200 / 3 500 | 500 / 2 500 / 8 000 | 80 / 400 / 1 000 |
| Créations | 15 / 40 / 80 | 40 / 200 / 500 | 80 / 400 / 1 200 | 200 / 1 000 / 3 000 | 30 / 120 / 300 |
| Livrables complets | 5 / 10 / 20 | 8 / 25 / 60 | 15 / 50 / 120 | 40 / 150 / 400 | 4 / 12 / 25 |
| Vidéos | 2 / 4 / 8 | 4 / 12 / 25 | 8 / 25 / 60 | 20 / 60 / 150 | 2 / 6 / 12 |
| Applications générées | 3 / 10 / 25 | 20 / 100 / 300 | 40 / 200 / 600 | 100 / 500 / 1 500 | 10 / 40 / 100 |
| Modifications iCode | 40 / 150 / 400 | 200 / 900 / 2 500 | 400 / 1 800 / 5 000 | 1 000 / 4 500 / 12 000 | 120 / 500 / 1 200 |
| Simulations | 3 / 6 / 10 | 5 / 15 / 30 | 8 / 25 / 60 | 15 / 50 / 120 | 2 / 4 / 6 |

**Ce que chaque groupe recouvre**

| Groupe | Fonctionnalités comptées |
|---|---|
| Aides IA | Onboarding (questions, lecture des réponses) · Amélioration de la demande, « J’ai de la chance » · Occasions de communication · Assistant du studio de communication · Vidéo : interprétation et amélioration de la demande · Contrôle de cohérence du projet · Finance : suggestions · Analyse d’un logo importé · Simulation : pré-analyse (avant paiement) · Déploiement : assistant et configuration · iVision : projet créé depuis un site · Simulation : rapport complet ou laboratoire |
| Retouches IA | Retouche IA (révision) · Nouvelles palettes / polices · Vidéo : retouche écrite (textes, voix, musique, scène) |
| Créations | Stratégie de communication · Calendrier éditorial · Période de communication · Visuel / flyer · Visuel 100 % généré par IA · Carrousel (jusqu’à 10 vues) · Carte de visite · Relance de logos · Nouveaux logos depuis le panneau |
| Livrables complets | Business plan complet · Business plan — nouvelle mise en page · Pitch deck · Pitch deck — nouvelle mise en page · Logo et charte graphique · Kit juridique OHADA · Prévisions financières 3 ans · Manuel de procédures (feuille de route) |
| Vidéos | Vidéo motion design (15 s, 1 format, HD) · Vidéo — nouvel export · Clip vidéo IA (8 s) |
| Applications générées | Génération initiale d’une application (gratuite) |
| Modifications iCode | iCode — message / planification · iCode — build standard · iCode — action premium · iCode — image de site générée · iCode — clip vidéo de site (5-6 s) |
| Simulations | Simulation (exécution standard) |

Le palier se lit sur l’offre du moteur du groupe (iBusiness pour retouches, créations, livrables et vidéos ; iCode pour les applications) ; les aides IA et les simulations prennent la meilleure offre du compte. Un accès bêta offert a son propre palier, volontairement borné. Les limites se surchargent sans redéploiement (`billing_settings.usageQuotas`).

## 2. Plafond de dépense IA par compte

| Offre | Jour | Semaine | Mois |
|---|---|---|---|
| Gratuit (Découverte / Hobby) | $0.500 (289 F) | $1.000 (577 F) | $1.500 (866 F) |
| Essentiel / Starter | $3.000 (1 731 F) | $8.000 (4 616 F) | $18.000 (10 386 F) |
| Croissance / Pro | $6.000 (3 462 F) | $18.000 (10 386 F) | $45.000 (25 965 F) |
| Cabinet / Studio / Scale | $15.000 (8 655 F) | $45.000 (25 965 F) | $110.000 (63 470 F) |
| Bêta premium (offerte) | $2.000 (1 154 F) | $6.000 (3 462 F) | $15.000 (8 655 F) |

Le plafond n’est jamais affiché en montant à l’utilisateur : le tableau de bord montre une « capacité de génération » en pourcentage.

## 3. Coût, prix et marge de chaque fonctionnalité

### Groupe « Aides IA »

#### Onboarding (questions, lecture des réponses)

Clé `free.onboarding` · groupe **Aides IA** · hors jauge
  
Points d’entrée : `POST /onboarding/questions`, `POST /onboarding/parse`

| Cran | Modèles dominants | Entrée typ. / max | Sortie typ. / max | Coût typ. | Coût max | Prix | Marge au plafond (plancher) | Marge typique (référence) | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| — | `qwen3.5-9b` | 2,0 k / 4,0 k | 500 / 2,0 k | 0,2 F | 0,4 F | 0 | — | — | gratuit — borné par le quota |

<details><summary>Détail des étapes</summary>

| Étape | Modèle | Appels typ. / max | Entrée typ. / max | Sortie typ. / max | Coût typ. / max |
|---|---|---|---|---|---|
| Questions / lecture | `qwen/qwen3.5-9b` | 1 / 1 | 2,0 k / 4,0 k | 500 / 2,0 k | 0,2 F / 0,4 F |

Budget d’exécution : alerte au-delà de 0,4 F, arrêt (mode `enforce`) au-delà de 1,2 F.

</details>

#### Amélioration de la demande, « J’ai de la chance »

Clé `free.prompt` · groupe **Aides IA** · hors jauge
  
Points d’entrée : `POST /prompt/prompt`, `POST /prompt/improve`, `POST /prompt/feeling-lucky`

| Cran | Modèles dominants | Entrée typ. / max | Sortie typ. / max | Coût typ. | Coût max | Prix | Marge au plafond (plancher) | Marge typique (référence) | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| — | `qwen3.5-122b-a10b` | 2,0 k / 6,0 k | 500 / 3,0 k | 0,9 F | 4,5 F | 0 | — | — | gratuit — borné par le quota |

<details><summary>Détail des étapes</summary>

| Étape | Modèle | Appels typ. / max | Entrée typ. / max | Sortie typ. / max | Coût typ. / max |
|---|---|---|---|---|---|
| Reformulation | `qwen/qwen3.5-122b-a10b` | 1 / 1 | 2,0 k / 6,0 k | 500 / 3,0 k | 0,9 F / 4,5 F |

Budget d’exécution : alerte au-delà de 4,5 F, arrêt (mode `enforce`) au-delà de 14 F.

</details>

#### Occasions de communication

Clé `free.occasions` · groupe **Aides IA** · hors jauge
  
Points d’entrée : `GET /project/communication/:projectId/occasions`

| Cran | Modèles dominants | Entrée typ. / max | Sortie typ. / max | Coût typ. | Coût max | Prix | Marge au plafond (plancher) | Marge typique (référence) | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| — | `qwen3.5-9b` | 2,0 k / 3,0 k | 1,5 k / 4,0 k | 0,2 F | 0,5 F | 0 | — | — | gratuit — borné par le quota |

<details><summary>Détail des étapes</summary>

| Étape | Modèle | Appels typ. / max | Entrée typ. / max | Sortie typ. / max | Coût typ. / max |
|---|---|---|---|---|---|
| Occasions | `qwen/qwen3.5-9b` | 1 / 1 | 2,0 k / 3,0 k | 1,5 k / 4,0 k | 0,2 F / 0,5 F |

Budget d’exécution : alerte au-delà de 0,5 F, arrêt (mode `enforce`) au-delà de 1,6 F.

</details>

#### Assistant du studio de communication

Clé `free.studio` · groupe **Aides IA** · hors jauge
  
Points d’entrée : `POST /project/communication/:projectId/studio/message`

| Cran | Modèles dominants | Entrée typ. / max | Sortie typ. / max | Coût typ. | Coût max | Prix | Marge au plafond (plancher) | Marge typique (référence) | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| — | `qwen3.5-122b-a10b` | 6,0 k / 24,0 k | 1,5 k / 12,0 k | 2,7 F | 18 F | 0 | — | — | gratuit — borné par le quota |

<details><summary>Détail des étapes</summary>

| Étape | Modèle | Appels typ. / max | Entrée typ. / max | Sortie typ. / max | Coût typ. / max |
|---|---|---|---|---|---|
| Réponse | `qwen/qwen3.5-122b-a10b` | 1 / 2 | 6,0 k / 24,0 k | 1,5 k / 12,0 k | 2,7 F / 18 F |

Budget d’exécution : alerte au-delà de 18 F, arrêt (mode `enforce`) au-delà de 54 F.

</details>

#### Vidéo : interprétation et amélioration de la demande

Clé `free.video_assist` · groupe **Aides IA** · hors jauge
  
Points d’entrée : `POST …/videos/interpret`, `POST …/videos/enhance`

| Cran | Modèles dominants | Entrée typ. / max | Sortie typ. / max | Coût typ. | Coût max | Prix | Marge au plafond (plancher) | Marge typique (référence) | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| — | `gemini-3.8-flash` | 3,0 k / 16,0 k | 400 / 1,8 k | 2,2 F | 11 F | 0 | — | — | gratuit — borné par le quota |

<details><summary>Détail des étapes</summary>

| Étape | Modèle | Appels typ. / max | Entrée typ. / max | Sortie typ. / max | Coût typ. / max |
|---|---|---|---|---|---|
| Lecture | `google/gemini-3.8-flash` | 1 / 2 | 3,0 k / 16,0 k | 400 / 1,8 k | 2,2 F / 11 F |

Budget d’exécution : alerte au-delà de 11 F, arrêt (mode `enforce`) au-delà de 32 F.

</details>

#### Contrôle de cohérence du projet

Clé `free.coherence` · groupe **Aides IA** · hors jauge
  
Points d’entrée : `POST /project/coherence/:projectId/check`

| Cran | Modèles dominants | Entrée typ. / max | Sortie typ. / max | Coût typ. | Coût max | Prix | Marge au plafond (plancher) | Marge typique (référence) | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| — | `qwen3.5-122b-a10b` | 8,0 k / 20,0 k | 1,5 k / 4,0 k | 3,0 F | 7,8 F | 0 | — | — | gratuit — borné par le quota |

<details><summary>Détail des étapes</summary>

| Étape | Modèle | Appels typ. / max | Entrée typ. / max | Sortie typ. / max | Coût typ. / max |
|---|---|---|---|---|---|
| Audit | `qwen/qwen3.5-122b-a10b` | 1 / 1 | 8,0 k / 20,0 k | 1,5 k / 4,0 k | 3,0 F / 7,8 F |

Budget d’exécution : alerte au-delà de 7,8 F, arrêt (mode `enforce`) au-delà de 23 F.

</details>

#### Finance : suggestions

Clé `free.finance_assist` · groupe **Aides IA** · hors jauge
  
Points d’entrée : `POST /project/finance/:projectId/ai-suggestions`

| Cran | Modèles dominants | Entrée typ. / max | Sortie typ. / max | Coût typ. | Coût max | Prix | Marge au plafond (plancher) | Marge typique (référence) | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| — | `qwen3.5-9b` | 3,0 k / 6,0 k | 500 / 1,0 k | 0,2 F | 0,4 F | 0 | — | — | gratuit — borné par le quota |

<details><summary>Détail des étapes</summary>

| Étape | Modèle | Appels typ. / max | Entrée typ. / max | Sortie typ. / max | Coût typ. / max |
|---|---|---|---|---|---|
| Suggestions | `qwen/qwen3.5-9b` | 1 / 1 | 3,0 k / 6,0 k | 500 / 1,0 k | 0,2 F / 0,4 F |

Budget d’exécution : alerte au-delà de 0,4 F, arrêt (mode `enforce`) au-delà de 1,3 F.

</details>

#### Analyse d’un logo importé

Clé `free.logo_analysis` · groupe **Aides IA** · hors jauge
  
Points d’entrée : `POST /logo/analyze`

| Cran | Modèles dominants | Entrée typ. / max | Sortie typ. / max | Coût typ. | Coût max | Prix | Marge au plafond (plancher) | Marge typique (référence) | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| — | `qwen3.5-122b-a10b` | 3,0 k / 6,0 k | 800 / 2,0 k | 1,4 F | 3,3 F | 0 | — | — | gratuit — borné par le quota |

<details><summary>Détail des étapes</summary>

| Étape | Modèle | Appels typ. / max | Entrée typ. / max | Sortie typ. / max | Coût typ. / max |
|---|---|---|---|---|---|
| Lecture du logo | `qwen/qwen3.5-122b-a10b` | 1 / 1 | 3,0 k / 6,0 k | 800 / 2,0 k | 1,4 F / 3,3 F |

Budget d’exécution : alerte au-delà de 3,3 F, arrêt (mode `enforce`) au-delà de 9,9 F.

</details>

#### Simulation : pré-analyse (avant paiement)

Clé `free.simulation_analysis` · groupe **Aides IA** · hors jauge
  
Points d’entrée : `POST /project/simulation/:projectId/analysis`, `POST /project/simulation/import/analysis`

| Cran | Modèles dominants | Entrée typ. / max | Sortie typ. / max | Coût typ. | Coût max | Prix | Marge au plafond (plancher) | Marge typique (référence) | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| — | `qwen3.5-122b-a10b` | 8,0 k / 30,0 k | 2,0 k / 8,2 k | 3,6 F | 14 F | 0 | — | — | gratuit — borné par le quota |

<details><summary>Détail des étapes</summary>

| Étape | Modèle | Appels typ. / max | Entrée typ. / max | Sortie typ. / max | Coût typ. / max |
|---|---|---|---|---|---|
| Compréhension du projet | `qwen/qwen3.5-122b-a10b` | 1 / 1 | 8,0 k / 30,0 k | 2,0 k / 8,2 k | 3,6 F / 14 F |

Budget d’exécution : alerte au-delà de 14 F, arrêt (mode `enforce`) au-delà de 43 F.

</details>

#### Déploiement : assistant et configuration

Clé `free.deployment` · groupe **Aides IA** · hors jauge
  
Points d’entrée : `POST /project/deployments/generate`, `POST /project/deployments/chat`

| Cran | Modèles dominants | Entrée typ. / max | Sortie typ. / max | Coût typ. | Coût max | Prix | Marge au plafond (plancher) | Marge typique (référence) | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| — | `qwen3.5-122b-a10b` | 4,0 k / 8,0 k | 800 / 4,0 k | 1,6 F | 6,0 F | 0 | — | — | gratuit — borné par le quota |

<details><summary>Détail des étapes</summary>

| Étape | Modèle | Appels typ. / max | Entrée typ. / max | Sortie typ. / max | Coût typ. / max |
|---|---|---|---|---|---|
| Assistant | `qwen/qwen3.5-122b-a10b` | 1 / 1 | 4,0 k / 8,0 k | 800 / 4,0 k | 1,6 F / 6,0 F |

Budget d’exécution : alerte au-delà de 6,0 F, arrêt (mode `enforce`) au-delà de 18 F.

</details>

#### iVision : projet créé depuis un site

Clé `free.site_import` · groupe **Aides IA** · hors jauge
  
Points d’entrée : `POST /internal/ivision/projects/from-site`

| Cran | Modèles dominants | Entrée typ. / max | Sortie typ. / max | Coût typ. | Coût max | Prix | Marge au plafond (plancher) | Marge typique (référence) | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| — | `gemini-3.8-flash`, `qwen3.5-35b-a3b` | 12,0 k / 44,0 k | 2,0 k / 8,8 k | 5,5 F | 21 F | 0 | — | — | gratuit — borné par le quota |

<details><summary>Détail des étapes</summary>

| Étape | Modèle | Appels typ. / max | Entrée typ. / max | Sortie typ. / max | Coût typ. / max |
|---|---|---|---|---|---|
| Lecture des pages | `qwen/qwen3.5-35b-a3b` | 2 / 4 | 6,0 k / 24,0 k | 1,2 k / 5,6 k | 1,2 F / 5,3 F |
| Rédaction du projet | `google/gemini-3.8-flash` | 1 / 2 | 6,0 k / 20,0 k | 800 / 3,2 k | 4,3 F / 16 F |

Budget d’exécution : alerte au-delà de 21 F, arrêt (mode `enforce`) au-delà de 63 F.

</details>

#### Simulation : rapport complet ou laboratoire

Clé `free.simulation_extra` · groupe **Aides IA** · hors jauge
  
Points d’entrée : `POST /project/simulation/:projectId/:simulationId/report`, `POST …/labs/:lab`

| Cran | Modèles dominants | Entrée typ. / max | Sortie typ. / max | Coût typ. | Coût max | Prix | Marge au plafond (plancher) | Marge typique (référence) | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| — | `qwen3.5-122b-a10b` | 24,0 k / 120 k | 8,0 k / 72,0 k | 13 F | 104 F | 0 | — | — | gratuit — borné par le quota |

<details><summary>Détail des étapes</summary>

| Étape | Modèle | Appels typ. / max | Entrée typ. / max | Sortie typ. / max | Coût typ. / max |
|---|---|---|---|---|---|
| Rapport / laboratoire | `qwen/qwen3.5-122b-a10b` | 2 / 6 | 24,0 k / 120 k | 8,0 k / 72,0 k | 13 F / 104 F |

Budget d’exécution : alerte au-delà de 104 F, arrêt (mode `enforce`) au-delà de 313 F.

</details>

### Groupe « Retouches IA »

#### Retouche IA (révision)

Clé `business.revision` · groupe **Retouches IA** · hors jauge
  
Points d’entrée : `POST …/sections/:sectionId/ai-edit (plan, deck, carte, charte)`, `POST /project/advisor/:projectId/messages`, `POST /project/finance/:projectId/ai-fill/:section, chat/parse, import/analyze`, `GET /project/diagrams/generate/:projectId`, `POST …/colors-typography, art-direction, moments, extract-context, declinate`

| Cran | Modèles dominants | Entrée typ. / max | Sortie typ. / max | Coût typ. | Coût max | Prix | Marge au plafond (plancher) | Marge typique (référence) | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| — | `gemini-3.8-flash`, `qwen3-coder-next` | 12,2 k / 32,0 k | 2,7 k / 11,0 k | 7,0 F | 18 F | 0 F | — | — | inclus |

<details><summary>Détail des étapes</summary>

| Étape | Modèle | Appels typ. / max | Entrée typ. / max | Sortie typ. / max | Coût typ. / max |
|---|---|---|---|---|---|
| Retouche du texte | `google/gemini-3.8-flash` | 1 / 1 | 8,0 k / 16,0 k | 1,2 k / 3,0 k | 6,1 F / 13 F |
| Page réécrite par l’auteur (si forme demandée) | `qwen/qwen3-coder-next` | 0,3 / 1 | 4,2 k / 16,0 k | 1,5 k / 8,0 k | 1,0 F / 4,8 F |

Budget d’exécution : alerte au-delà de 18 F, arrêt (mode `enforce`) au-delà de 55 F.

</details>

> « Révision » recouvre des usages de coût très différents (une phrase, une page réécrite, un relevé bancaire analysé). Une retouche est incluse 30 jours après la version finale (et avec Croissance), sinon 100 F : la page réécrite et l’import de document sont couverts à ce prix ; à surveiller dans le journal d’usage.

#### Nouvelles palettes / polices

Clé `business.brand_regenerate` · groupe **Retouches IA** · hors jauge
  
Points d’entrée : `POST /project/brandings/:projectId/identity/jobs/palettes|fonts`

| Cran | Modèles dominants | Entrée typ. / max | Sortie typ. / max | Coût typ. | Coût max | Prix | Marge au plafond (plancher) | Marge typique (référence) | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| — | `gemini-3.8-flash` | 6,0 k / 10,0 k | 2,0 k / 6,0 k | 6,9 F | 17 F | 100 F | 80 % | 93 % | ✅ |

<details><summary>Détail des étapes</summary>

| Étape | Modèle | Appels typ. / max | Entrée typ. / max | Sortie typ. / max | Coût typ. / max |
|---|---|---|---|---|---|
| Propositions | `google/gemini-3.8-flash` | 1 / 1 | 6,0 k / 10,0 k | 2,0 k / 6,0 k | 6,9 F / 17 F |

Budget d’exécution : alerte au-delà de 85 F, arrêt (mode `enforce`) au-delà de 97 F.

</details>

#### Vidéo : retouche écrite (textes, voix, musique, scène)

Clé `free.video_revise` · groupe **Retouches IA** · hors jauge
  
Points d’entrée : `POST …/videos/:videoId/revise`

| Cran | Modèles dominants | Entrée typ. / max | Sortie typ. / max | Coût typ. | Coût max | Prix | Marge au plafond (plancher) | Marge typique (référence) | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| — | `qwen3-coder-next`, `qwen3.5-27b` | 4,0 k / 36,0 k | 500 / 16,9 k | 1,4 F | 12 F | 0 | — | — | gratuit — borné par le quota |

<details><summary>Détail des étapes</summary>

| Étape | Modèle | Appels typ. / max | Entrée typ. / max | Sortie typ. / max | Coût typ. / max |
|---|---|---|---|---|---|
| Lecture de la retouche | `qwen/qwen3.5-27b` | 1 / 1 | 4,0 k / 8,0 k | 500 / 900 | 1,4 F / 2,6 F |
| Scène réécrite par l’auteur | `qwen/qwen3-coder-next` | 0 / 2 | 0 / 28,0 k | 0 / 16,0 k | 0,0 F / 9,3 F |
| Voix off redite | `speech_char` | 0 / 600 | — | — | 0,0 F / 0,2 F |

Budget d’exécution : alerte au-delà de 12 F, arrêt (mode `enforce`) au-delà de 36 F.

</details>

> Gratuite (l’export suivant est facturé « nouvel export ») : bornée par le quota « Retouches IA ».

### Groupe « Créations »

#### Stratégie de communication

Clé `business.communication_strategy` · groupe **Créations** · hors jauge
  
Points d’entrée : `GET /project/communication/:projectId/generate-strategy`

| Cran | Modèles dominants | Entrée typ. / max | Sortie typ. / max | Coût typ. | Coût max | Prix | Marge au plafond (plancher) | Marge typique (référence) | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| — | `qwen3.5-397b-a17b`, `qwen3.5-9b` | 16,0 k / 22,0 k | 9,0 k / 21,0 k | 16 F | 38 F | 1000 F | 96 % | 98 % | ✅ |

<details><summary>Détail des étapes</summary>

| Étape | Modèle | Appels typ. / max | Entrée typ. / max | Sortie typ. / max | Coût typ. / max |
|---|---|---|---|---|---|
| Stratégie | `qwen/qwen3.5-397b-a17b` | 1 / 1 | 10,0 k / 14,0 k | 6,0 k / 16,0 k | 15 F / 37 F |
| Contexte et tendances | `qwen/qwen3.5-9b` | 2 / 2 | 6,0 k / 8,0 k | 3,0 k / 5,0 k | 0,6 F / 0,9 F |

Budget d’exécution : alerte au-delà de 850 F, arrêt (mode `enforce`) au-delà de 970 F.

</details>

#### Calendrier éditorial

Clé `business.editorial_calendar` · groupe **Créations** · hors jauge
  
Points d’entrée : `GET /project/communication/:projectId/generate-calendar`

| Cran | Modèles dominants | Entrée typ. / max | Sortie typ. / max | Coût typ. | Coût max | Prix | Marge au plafond (plancher) | Marge typique (référence) | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| — | `qwen3.5-397b-a17b` | 10,0 k / 14,0 k | 8,0 k / 20,0 k | 20 F | 46 F | 500 F | 89 % | 96 % | ✅ |

<details><summary>Détail des étapes</summary>

| Étape | Modèle | Appels typ. / max | Entrée typ. / max | Sortie typ. / max | Coût typ. / max |
|---|---|---|---|---|---|
| Calendrier | `qwen/qwen3.5-397b-a17b` | 1 / 1 | 10,0 k / 14,0 k | 8,0 k / 20,0 k | 20 F / 46 F |

Budget d’exécution : alerte au-delà de 425 F, arrêt (mode `enforce`) au-delà de 485 F.

</details>

#### Période de communication

Clé `business.communication_plan` · groupe **Créations** · hors jauge
  
Points d’entrée : `GET /project/communication/:projectId/plans/:planId/generate`

| Cran | Modèles dominants | Entrée typ. / max | Sortie typ. / max | Coût typ. | Coût max | Prix | Marge au plafond (plancher) | Marge typique (référence) | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| — | `qwen3.5-397b-a17b`, `qwen3.5-9b` | 18,0 k / 25,0 k | 11,0 k / 32,0 k | 28 F | 65 F | 500 F | 85 % | 94 % | ✅ |

<details><summary>Détail des étapes</summary>

| Étape | Modèle | Appels typ. / max | Entrée typ. / max | Sortie typ. / max | Coût typ. / max |
|---|---|---|---|---|---|
| Brief de la période | `qwen/qwen3.5-397b-a17b` | 1 / 1 | 8,0 k / 10,0 k | 3,0 k / 8,0 k | 8,5 F / 20 F |
| Contenus datés | `qwen/qwen3.5-397b-a17b` | 1 / 1 | 10,0 k / 12,0 k | 8,0 k / 20,0 k | 20 F / 45 F |
| Occasions | `qwen/qwen3.5-9b` | 0 / 1 | 0 / 3,0 k | 0 / 4,0 k | 0,0 F / 0,5 F |

Budget d’exécution : alerte au-delà de 425 F, arrêt (mode `enforce`) au-delà de 485 F.

</details>

#### Visuel / flyer

Clé `business.flyer` · groupe **Créations** · suit la jauge de créativité
  
Points d’entrée : `POST /project/communication/:projectId/visuals`, `POST /project/communication/:projectId/flyer/:contentId`, `iVision · visuel`

| Cran | Modèles dominants | Entrée typ. / max | Sortie typ. / max | Coût typ. | Coût max | Prix | Marge au plafond (plancher) | Marge typique (référence) | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| Low | `gemini-3.8-flash`, `qwen3-coder-next` | 13,0 k / 27,0 k | 3,8 k / 13,2 k | 5,7 F | 12 F | 100 F | 85 % | 94 % | ✅ |
| Medium | `gemini-3.8-flash`, `qwen3-coder` | 13,0 k / 27,0 k | 3,8 k / 13,2 k | 6,8 F | 16 F | 100 F | 81 % | 93 % | ✅ |
| High | `gemini-3.8-flash`, `deepseek-v4-pro` | 13,0 k / 27,0 k | 3,8 k / 13,2 k | 8,0 F | 18 F | 100 F | 79 % | 92 % | ✅ |
| Ultra | `deepseek-v4-pro`, `gemini-3.8-flash` | 13,0 k / 27,0 k | 3,8 k / 13,2 k | 8,4 F | 19 F | 100 F | 78 % | 91 % | ✅ |

<details><summary>Détail des étapes (cran Medium)</summary>

| Étape | Modèle | Appels typ. / max | Entrée typ. / max | Sortie typ. / max | Coût typ. / max |
|---|---|---|---|---|---|
| Rédaction du visuel | `google/gemini-3.8-flash` | 1 / 1 | 5,0 k / 7,0 k | 800 / 1,2 k | 3,9 F / 5,6 F |
| Écriture de la page (HTML) | `qwen/qwen3-coder-next` | 1 / 1 | 8,0 k / 10,0 k | 3,0 k / 6,0 k | 1,9 F / 3,5 F |
| Réparation technique (cran +1) | `qwen/qwen3-coder` | 0 / 1 | 0 / 10,0 k | 0 / 6,0 k | 0,0 F / 5,2 F |
| Photo générée (FLUX.2) | `image` | 0,5 / 1 | — | — | 1,0 F / 2,0 F |

Budget d’exécution : alerte au-delà de 85 F, arrêt (mode `enforce`) au-delà de 97 F.

</details>

#### Visuel 100 % généré par IA

Clé `business.ai_visual` · groupe **Créations** · suit la jauge de créativité

| Cran | Modèles dominants | Entrée typ. / max | Sortie typ. / max | Coût typ. | Coût max | Prix | Marge au plafond (plancher) | Marge typique (référence) | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| Low | `gemini-3.8-flash`, `qwen3-coder-30b-a3b-instruct` | 13,0 k / 17,0 k | 3,8 k / 7,2 k | 49 F | 51 F | 100 F | 39 % | 49 % | ⚠️ marge < 75 % → 203 F |
| Medium | `gemini-3.8-flash`, `qwen3-coder-next` | 13,0 k / 17,0 k | 3,8 k / 7,2 k | 50 F | 54 F | 100 F | 37 % | 48 % | ⚠️ marge < 75 % → 208 F |
| High | `gemini-3.8-flash`, `qwen3-coder` | 13,0 k / 17,0 k | 3,8 k / 7,2 k | 51 F | 55 F | 100 F | 35 % | 47 % | ⚠️ marge < 75 % → 213 F |
| Ultra | `gemini-3.8-flash`, `deepseek-v4-pro` | 13,0 k / 17,0 k | 3,8 k / 7,2 k | 52 F | 56 F | 100 F | 35 % | 47 % | ⚠️ marge < 75 % → 214 F |

<details><summary>Détail des étapes (cran Medium)</summary>

| Étape | Modèle | Appels typ. / max | Entrée typ. / max | Sortie typ. / max | Coût typ. / max |
|---|---|---|---|---|---|
| Rédaction du visuel | `google/gemini-3.8-flash` | 1 / 1 | 5,0 k / 7,0 k | 800 / 1,2 k | 3,9 F / 5,6 F |
| Écriture de la page (HTML) | `qwen/qwen3-coder-next` | 1 / 1 | 8,0 k / 10,0 k | 3,0 k / 6,0 k | 1,9 F / 3,5 F |
| Image générée (Gemini Image) | `image_gemini` | 1 / 1 | — | — | 44 F / 44 F |

Budget d’exécution : alerte au-delà de 85 F, arrêt (mode `enforce`) au-delà de 107 F.

</details>

> À 100 F, une image générée par un modèle coûteux mange le prix au plancher : rester sur FLUX.2 (20× moins cher).

#### Carrousel (jusqu’à 10 vues)

Clé `business.carousel` · groupe **Créations** · suit la jauge de créativité

| Cran | Modèles dominants | Entrée typ. / max | Sortie typ. / max | Coût typ. | Coût max | Prix | Marge au plafond (plancher) | Marge typique (référence) | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| Low | `qwen3-coder-30b-a3b-instruct`, `gemini-3.8-flash` | 54,0 k / 108 k | 20,0 k / 53,0 k | 12 F | 22 F | 200 F | 87 % | 94 % | ✅ |
| Medium | `qwen3-coder-next`, `gemini-3.8-flash` | 54,0 k / 108 k | 20,0 k / 53,0 k | 19 F | 40 F | 200 F | 76 % | 90 % | ✅ |
| High | `qwen3-coder`, `gemini-3.8-flash` | 54,0 k / 108 k | 20,0 k / 53,0 k | 26 F | 56 F | 200 F | 67 % | 87 % | ✅ |
| Ultra | `deepseek-v4-pro`, `gemini-3.8-flash` | 54,0 k / 108 k | 20,0 k / 53,0 k | 28 F | 60 F | 200 F | 65 % | 86 % | ✅ |

<details><summary>Détail des étapes (cran Medium)</summary>

| Étape | Modèle | Appels typ. / max | Entrée typ. / max | Sortie typ. / max | Coût typ. / max |
|---|---|---|---|---|---|
| Rédaction des vues | `google/gemini-3.8-flash` | 1 / 1 | 6,0 k / 8,0 k | 2,0 k / 3,0 k | 6,9 F / 10,0 F |
| Écriture des vues (HTML) | `qwen/qwen3-coder-next` | 6 / 10 | 48,0 k / 100 k | 18,0 k / 50,0 k | 12 F / 30 F |

Budget d’exécution : alerte au-delà de 170 F, arrêt (mode `enforce`) au-delà de 194 F.

</details>

#### Carte de visite

Clé `business.business_card` · groupe **Créations** · suit la jauge de créativité
  
Points d’entrée : `POST /project/business-card/:projectId/generate`

| Cran | Modèles dominants | Entrée typ. / max | Sortie typ. / max | Coût typ. | Coût max | Prix | Marge au plafond (plancher) | Marge typique (référence) | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| Low | `gemini-3.8-flash`, `qwen3-coder-next` | 24,0 k / 52,0 k | 7,5 k / 28,0 k | 7,5 F | 22 F | 167 F | 84 % | 95 % | ✅ |
| Medium | `gemini-3.8-flash`, `qwen3-coder` | 24,0 k / 52,0 k | 7,5 k / 28,0 k | 9,9 F | 30 F | 167 F | 79 % | 94 % | ✅ |
| High | `gemini-3.8-flash`, `deepseek-v4-pro` | 24,0 k / 52,0 k | 7,5 k / 28,0 k | 12 F | 34 F | 167 F | 76 % | 92 % | ✅ |
| Ultra | `deepseek-v4-pro`, `gemini-3.8-flash` | 24,0 k / 52,0 k | 7,5 k / 28,0 k | 13 F | 35 F | 1167 F | 96 % | 99 % | ✅ |

<details><summary>Détail des étapes (cran Medium)</summary>

| Étape | Modèle | Appels typ. / max | Entrée typ. / max | Sortie typ. / max | Coût typ. / max |
|---|---|---|---|---|---|
| Contenu de la carte | `google/gemini-3.8-flash` | 1 / 1 | 6,0 k / 8,0 k | 1,5 k / 4,0 k | 5,8 F / 12 F |
| Écriture du gabarit (recto, verso) | `qwen/qwen3-coder-next` | 2 / 2 | 18,0 k / 22,0 k | 6,0 k / 12,0 k | 4,0 F / 7,1 F |
| Réparation technique (cran +1) | `qwen/qwen3-coder` | 0 / 2 | 0 / 22,0 k | 0 / 12,0 k | 0,0 F / 11 F |

Budget d’exécution : alerte au-delà de 142 F, arrêt (mode `enforce`) au-delà de 162 F.

</details>

#### Relance de logos

Clé `business.logo_relaunch` · groupe **Créations** · hors jauge
  
Points d’entrée : `POST /project/brandings/edit-logo/:projectId`, `relance de session de logo`

| Cran | Modèles dominants | Entrée typ. / max | Sortie typ. / max | Coût typ. | Coût max | Prix | Marge au plafond (plancher) | Marge typique (référence) | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| — | `deepseek-v4-pro` | 32,0 k / 80,0 k | 12,0 k / 48,0 k | 14 F | 48 F | 100 F | 44 % | 86 % | ✅ |

<details><summary>Détail des étapes</summary>

| Étape | Modèle | Appels typ. / max | Entrée typ. / max | Sortie typ. / max | Coût typ. / max |
|---|---|---|---|---|---|
| Moteur de logos (Ultra) | `deepseek/deepseek-v4-pro` | 4 / 8 | 32,0 k / 80,0 k | 12,0 k / 48,0 k | 14 F / 44 F |
| Images de référence | `image` | 0 / 2 | — | — | 0,0 F / 3,9 F |

Budget d’exécution : alerte au-delà de 85 F, arrêt (mode `enforce`) au-delà de 97 F.

</details>

#### Nouveaux logos depuis le panneau

Clé `business.logo_regenerate` · groupe **Créations** · hors jauge
  
Points d’entrée : `POST /project/brandings/:projectId/identity/jobs/logos`

| Cran | Modèles dominants | Entrée typ. / max | Sortie typ. / max | Coût typ. | Coût max | Prix | Marge au plafond (plancher) | Marge typique (référence) | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| — | `deepseek-v4-pro` | 32,0 k / 80,0 k | 12,0 k / 48,0 k | 14 F | 44 F | 100 F | 49 % | 86 % | ✅ |

<details><summary>Détail des étapes</summary>

| Étape | Modèle | Appels typ. / max | Entrée typ. / max | Sortie typ. / max | Coût typ. / max |
|---|---|---|---|---|---|
| Moteur de logos (Ultra) | `deepseek/deepseek-v4-pro` | 4 / 8 | 32,0 k / 80,0 k | 12,0 k / 48,0 k | 14 F / 44 F |

Budget d’exécution : alerte au-delà de 85 F, arrêt (mode `enforce`) au-delà de 97 F.

</details>

### Groupe « Livrables complets »

#### Business plan complet

Clé `business.business_plan` · groupe **Livrables complets** · suit la jauge de créativité
  
Points d’entrée : `GET /project/businessPlans/generate/:projectId`

| Cran | Modèles dominants | Entrée typ. / max | Sortie typ. / max | Coût typ. | Coût max | Prix | Marge au plafond (plancher) | Marge typique (référence) | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| Low | `gemini-3.8-flash`, `qwen3.5-9b` | 579 k / 1 799 k | 135 k / 768 k | 455 F | 2 683 F | 667 F | -373 % | 30 % | ⚠️ perte possible au plancher, marge < 75 % → 3157 F |
| Medium | `gemini-3.8-flash`, `qwen3-coder-next` | 579 k / 1 799 k | 135 k / 768 k | 486 F | 2 790 F | 667 F | -392 % | 25 % | ⚠️ perte possible au plancher, marge < 75 % → 3283 F |
| High | `gemini-3.8-flash`, `qwen3-coder` | 579 k / 1 799 k | 135 k / 768 k | 516 F | 2 862 F | 667 F | -405 % | 20 % | ⚠️ perte possible au plancher, marge < 75 % → 3368 F |
| Ultra | `gemini-3.8-flash`, `deepseek-v4-pro` | 579 k / 1 799 k | 135 k / 768 k | 521 F | 2 860 F | 1667 F | -102 % | 68 % | ⚠️ perte possible au plancher, marge < 75 % → 3366 F |

<details><summary>Détail des étapes (cran Medium)</summary>

| Étape | Modèle | Appels typ. / max | Entrée typ. / max | Sortie typ. / max | Coût typ. / max |
|---|---|---|---|---|---|
| Recherche sourcée (synthèse) | `qwen/qwen3.5-9b` | 14 / 54 | 84,0 k / 486 k | 16,8 k / 82,9 k | 6,3 F / 35 F |
| Rédaction des sections | `google/gemini-3.8-flash` | 12 / 18 | 144 k / 288 k | 30,0 k / 180 k | 127 F / 514 F |
| Vérification des chiffres | `qwen/qwen3.5-9b` | 12 / 18 | 96,0 k / 216 k | 7,2 k / 18,4 k | 6,2 F / 14 F |
| Correction après vérification | `google/gemini-3.8-flash` | 3 / 18 | 42,0 k / 324 k | 7,5 k / 180 k | 34 F / 530 F |
| Direction du document | `qwen/qwen3.5-27b` | 1 / 2 | 12,0 k / 32,0 k | 2,0 k / 5,0 k | 4,8 F / 12 F |
| Écriture des pages (HTML) | `qwen/qwen3-coder-next` | 13 / 19 | 182 k / 342 k | 65,0 k / 228 k | 43 F / 129 F |
| Réparation technique (cran +1) | `qwen/qwen3-coder` | 1 / 6 | 16,0 k / 108 k | 5,0 k / 72,0 k | 5,7 F / 60 F |
| Couverture (sur-titre et promesse) | `qwen/qwen3.5-9b` | 1 / 1 | 3,0 k / 3,0 k | 1,2 k / 1,5 k | 0,3 F / 0,3 F |
| Résultats de recherche web | `web_result` | 112 / 648 | — | — | 258 F / 1 496 F |

Budget d’exécution : alerte au-delà de 567 F, arrêt (mode `enforce`) au-delà de 5 581 F.

</details>

> La recherche web pèse la moitié du coût typique (jusqu’à 3 recherches de 12 résultats par section). Leviers : 6 résultats par recherche, 2 recherches par section, réutilisation des recherches déjà payées (secteur × pays), rédacteur sur un modèle ouvert (DeepSeek V4 Flash : sortie ~20× moins chère que Gemini 3.8 Flash).

#### Business plan — nouvelle mise en page

Clé `business.business_plan_relayout` · groupe **Livrables complets** · suit la jauge de créativité
  
Points d’entrée : `POST /project/businessPlans/:projectId/relayout`

| Cran | Modèles dominants | Entrée typ. / max | Sortie typ. / max | Coût typ. | Coût max | Prix | Marge au plafond (plancher) | Marge typique (référence) | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| Low | `qwen3-coder-30b-a3b-instruct`, `qwen3-coder-next` | 210 k / 430 k | 72,0 k / 279 k | 22 F | 79 F | 500 F | 81 % | 95 % | ✅ |
| Medium | `qwen3-coder-next`, `qwen3-coder` | 210 k / 430 k | 72,0 k / 279 k | 53 F | 175 F | 500 F | 59 % | 89 % | ✅ |
| High | `qwen3-coder`, `deepseek-v4-pro` | 210 k / 430 k | 72,0 k / 279 k | 83 F | 242 F | 500 F | 43 % | 83 % | ✅ |
| Ultra | `deepseek-v4-pro` | 210 k / 430 k | 72,0 k / 279 k | 88 F | 245 F | 500 F | 42 % | 82 % | ✅ |

<details><summary>Détail des étapes (cran Medium)</summary>

| Étape | Modèle | Appels typ. / max | Entrée typ. / max | Sortie typ. / max | Coût typ. / max |
|---|---|---|---|---|---|
| Direction du document | `qwen/qwen3.5-27b` | 1 / 1 | 12,0 k / 16,0 k | 2,0 k / 2,5 k | 4,8 F / 6,2 F |
| Écriture des pages (HTML) | `qwen/qwen3-coder-next` | 13 / 19 | 182 k / 342 k | 65,0 k / 228 k | 43 F / 129 F |
| Réparation technique (cran +1) | `qwen/qwen3-coder` | 1 / 4 | 16,0 k / 72,0 k | 5,0 k / 48,0 k | 5,7 F / 40 F |

Budget d’exécution : alerte au-delà de 425 F, arrêt (mode `enforce`) au-delà de 485 F.

</details>

#### Pitch deck

Clé `business.pitch_deck` · groupe **Livrables complets** · suit la jauge de créativité
  
Points d’entrée : `GET /project/pitch-deck/generate/:projectId`

| Cran | Modèles dominants | Entrée typ. / max | Sortie typ. / max | Coût typ. | Coût max | Prix | Marge au plafond (plancher) | Marge typique (référence) | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| Low | `gemini-3.8-flash`, `qwen3-coder-30b-a3b-instruct` | 202 k / 387 k | 60,0 k / 185 k | 84 F | 238 F | 333 F | 16 % | 74 % | ⚠️ marge < 75 % → 346 F |
| Medium | `gemini-3.8-flash`, `qwen3-coder-next` | 202 k / 387 k | 60,0 k / 185 k | 103 F | 287 F | 333 F | -1 % | 68 % | ⚠️ perte possible au plancher, marge < 75 % → 426 F |
| High | `gemini-3.8-flash`, `qwen3-coder` | 202 k / 387 k | 60,0 k / 185 k | 122 F | 324 F | 333 F | -14 % | 62 % | ⚠️ perte possible au plancher, marge < 75 % → 502 F |
| Ultra | `gemini-3.8-flash`, `deepseek-v4-pro` | 202 k / 387 k | 60,0 k / 185 k | 123 F | 321 F | 1333 F | 72 % | 90 % | ✅ |

<details><summary>Détail des étapes (cran Medium)</summary>

| Étape | Modèle | Appels typ. / max | Entrée typ. / max | Sortie typ. / max | Coût typ. / max |
|---|---|---|---|---|---|
| Rédaction des slides | `google/gemini-3.8-flash` | 9 / 11 | 72,0 k / 132 k | 18,0 k / 66,0 k | 70 F / 200 F |
| Direction du document | `qwen/qwen3.5-27b` | 1 / 2 | 10,0 k / 28,0 k | 2,0 k / 5,0 k | 4,5 F / 12 F |
| Écriture des slides (HTML) | `qwen/qwen3-coder-next` | 9 / 11 | 108 k / 176 k | 36,0 k / 88,0 k | 24 F / 53 F |
| Réparation technique (cran +1) | `qwen/qwen3-coder` | 1 / 3 | 12,0 k / 48,0 k | 4,0 k / 24,0 k | 4,4 F / 22 F |
| Couverture (sur-titre et promesse) | `qwen/qwen3.5-9b` | 0 / 1 | 0 / 3,0 k | 0 / 1,5 k | 0,0 F / 0,3 F |

Budget d’exécution : alerte au-delà de 283 F, arrêt (mode `enforce`) au-delà de 574 F.

</details>

#### Pitch deck — nouvelle mise en page

Clé `business.pitch_deck_relayout` · groupe **Livrables complets** · suit la jauge de créativité
  
Points d’entrée : `POST /project/pitch-deck/:projectId/relayout`

| Cran | Modèles dominants | Entrée typ. / max | Sortie typ. / max | Coût typ. | Coût max | Prix | Marge au plafond (plancher) | Marge typique (référence) | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| Low | `qwen3-coder-30b-a3b-instruct`, `qwen3-coder-next` | 130 k / 222 k | 42,0 k / 107 k | 14 F | 32 F | 300 F | 87 % | 95 % | ✅ |
| Medium | `qwen3-coder-next`, `qwen3-coder` | 130 k / 222 k | 42,0 k / 107 k | 33 F | 73 F | 300 F | 71 % | 89 % | ✅ |
| High | `qwen3-coder`, `deepseek-v4-pro` | 130 k / 222 k | 42,0 k / 107 k | 51 F | 106 F | 300 F | 58 % | 82 % | ✅ |
| Ultra | `deepseek-v4-pro` | 130 k / 222 k | 42,0 k / 107 k | 53 F | 108 F | 300 F | 58 % | 82 % | ✅ |

<details><summary>Détail des étapes (cran Medium)</summary>

| Étape | Modèle | Appels typ. / max | Entrée typ. / max | Sortie typ. / max | Coût typ. / max |
|---|---|---|---|---|---|
| Direction du document | `qwen/qwen3.5-27b` | 1 / 1 | 10,0 k / 14,0 k | 2,0 k / 2,5 k | 4,5 F / 5,9 F |
| Écriture des slides (HTML) | `qwen/qwen3-coder-next` | 9 / 11 | 108 k / 176 k | 36,0 k / 88,0 k | 24 F / 53 F |
| Réparation technique (cran +1) | `qwen/qwen3-coder` | 1 / 2 | 12,0 k / 32,0 k | 4,0 k / 16,0 k | 4,4 F / 15 F |

Budget d’exécution : alerte au-delà de 255 F, arrêt (mode `enforce`) au-delà de 291 F.

</details>

#### Logo et charte graphique

Clé `business.logo_brand` · groupe **Livrables complets** · suit la jauge de créativité
  
Points d’entrée : `GET /project/brandings/generate/:projectId`, `POST /project/brandings/generate/logo-concepts/:projectId`

| Cran | Modèles dominants | Entrée typ. / max | Sortie typ. / max | Coût typ. | Coût max | Prix | Marge au plafond (plancher) | Marge typique (référence) | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| Low | `gemini-3.8-flash`, `deepseek-v4-pro` | 364 k / 662 k | 133 k / 397 k | 289 F | 608 F | 500 F | -43 % | 40 % | ⚠️ perte possible au plancher, marge < 75 % → 1192 F |
| Medium | `gemini-3.8-flash`, `deepseek-v4-pro` | 364 k / 662 k | 133 k / 397 k | 317 F | 670 F | 500 F | -58 % | 35 % | ⚠️ perte possible au plancher, marge < 75 % → 1306 F |
| High | `gemini-3.8-flash`, `qwen3-coder` | 364 k / 662 k | 133 k / 397 k | 342 F | 714 F | 500 F | -68 % | 30 % | ⚠️ perte possible au plancher, marge < 75 % → 1409 F |
| Ultra | `gemini-3.8-flash`, `deepseek-v4-pro` | 364 k / 662 k | 133 k / 397 k | 344 F | 715 F | 1500 F | 44 % | 76 % | ✅ |

<details><summary>Détail des étapes (cran Medium)</summary>

| Étape | Modèle | Appels typ. / max | Entrée typ. / max | Sortie typ. / max | Coût typ. / max |
|---|---|---|---|---|---|
| Moteur de logos (toujours Ultra) | `deepseek/deepseek-v4-pro` | 8 / 16 | 64,0 k / 160 k | 24,0 k / 96,0 k | 28 F / 87 F |
| Direction artistique, couleurs, typographie | `google/gemini-3.8-flash` | 3 / 4 | 24,0 k / 48,0 k | 9,0 k / 32,0 k | 30 F / 90 F |
| Sections de la charte | `google/gemini-3.8-flash` | 11 / 12 | 110 k / 168 k | 33,0 k / 96,0 k | 119 F / 280 F |
| Direction du document | `qwen/qwen3.5-27b` | 1 / 1 | 10,0 k / 14,0 k | 2,0 k / 2,5 k | 4,5 F / 5,9 F |
| Écriture des pages (HTML) | `qwen/qwen3-coder-next` | 12 / 14 | 144 k / 224 k | 60,0 k / 140 k | 38 F / 80 F |
| Réparation technique (cran +1) | `qwen/qwen3-coder` | 1 / 3 | 12,0 k / 48,0 k | 5,0 k / 30,0 k | 5,0 F / 26 F |
| Mises en situation (Gemini Image) | `image_gemini` | 2 / 2 | — | — | 89 F / 89 F |
| Motifs et visuels (FLUX.2) | `image` | 2 / 6 | — | — | 3,9 F / 12 F |

Budget d’exécution : alerte au-delà de 425 F, arrêt (mode `enforce`) au-delà de 1 340 F.

</details>

> Le logo tourne au cran Ultra quel que soit le cran choisi ; le cran ne joue que sur les pages de la charte.

#### Kit juridique OHADA

Clé `business.legal_kit` · groupe **Livrables complets** · hors jauge
  
Points d’entrée : `POST /project/legal-docs/generate/:projectId`, `GET /project/legal-docs/generate/:projectId`

| Cran | Modèles dominants | Entrée typ. / max | Sortie typ. / max | Coût typ. | Coût max | Prix | Marge au plafond (plancher) | Marge typique (référence) | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| — | `qwen3.5-122b-a10b`, `qwen3.5-9b` | 36,0 k / 84,0 k | 20,8 k / 75,0 k | 29 F | 98 F | 500 F | 77 % | 94 % | ✅ |

<details><summary>Détail des étapes</summary>

| Étape | Modèle | Appels typ. / max | Entrée typ. / max | Sortie typ. / max | Coût typ. / max |
|---|---|---|---|---|---|
| Rédaction des actes (statuts, pacte, CGV/CGU…) | `qwen/qwen3.5-122b-a10b` | 4 / 6 | 32,0 k / 72,0 k | 20,0 k / 72,0 k | 29 F / 97 F |
| Contexte et recommandations | `qwen/qwen3.5-9b` | 1 / 2 | 4,0 k / 12,0 k | 800 / 3,0 k | 0,3 F / 1,0 F |

Budget d’exécution : alerte au-delà de 425 F, arrêt (mode `enforce`) au-delà de 485 F.

</details>

#### Prévisions financières 3 ans

Clé `business.financial_forecast` · groupe **Livrables complets** · hors jauge
  
Points d’entrée : `POST /project/finance/:projectId/ai-fill-all`, `GET /project/finance/:projectId/ai-fill-stream`

| Cran | Modèles dominants | Entrée typ. / max | Sortie typ. / max | Coût typ. | Coût max | Prix | Marge au plafond (plancher) | Marge typique (référence) | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| — | `qwen3.5-397b-a17b`, `qwen3.5-9b` | 14,0 k / 126 k | 6,3 k / 74,0 k | 16 F | 185 F | 333 F | 35 % | 95 % | ✅ |

<details><summary>Détail des étapes</summary>

| Étape | Modèle | Appels typ. / max | Entrée typ. / max | Sortie typ. / max | Coût typ. / max |
|---|---|---|---|---|---|
| Remplissage du prévisionnel | `qwen/qwen3.5-397b-a17b` | 1 / 6 | 12,0 k / 120 k | 6,0 k / 72,0 k | 16 F / 184 F |
| Lecture de l’intention | `qwen/qwen3.5-9b` | 1 / 2 | 2,0 k / 6,0 k | 300 / 2,0 k | 0,1 F / 0,5 F |

Budget d’exécution : alerte au-delà de 283 F, arrêt (mode `enforce`) au-delà de 369 F.

</details>

> Les chiffres sont recalculés par le code (`finance.computed`) : le modèle propose des hypothèses, il ne recopie aucun total.

#### Manuel de procédures (feuille de route)

Clé `business.procedures_manual` · groupe **Livrables complets** · hors jauge

| Cran | Modèles dominants | Entrée typ. / max | Sortie typ. / max | Coût typ. | Coût max | Prix | Marge au plafond (plancher) | Marge typique (référence) | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| — | `qwen3.5-122b-a10b` | 64,0 k / 144 k | 24,0 k / 96,0 k | 38 F | 137 F | 0 F | — | — | inclus |

<details><summary>Détail des étapes</summary>

| Étape | Modèle | Appels typ. / max | Entrée typ. / max | Sortie typ. / max | Coût typ. / max |
|---|---|---|---|---|---|
| Rédaction des procédures | `qwen/qwen3.5-122b-a10b` | 8 / 12 | 64,0 k / 144 k | 24,0 k / 96,0 k | 38 F / 137 F |

Budget d’exécution : alerte au-delà de 137 F, arrêt (mode `enforce`) au-delà de 410 F.

</details>

> Pas encore commercialisé : enveloppe prévisionnelle.

### Groupe « Vidéos »

#### Vidéo motion design (15 s, 1 format, HD)

Clé `business.motion_video` · groupe **Vidéos** · suit la jauge de créativité
  
Points d’entrée : `POST /project/communication/:projectId/videos`, `POST /project/communication/:projectId/videos/stream`, `iVision · vidéo`

| Cran | Modèles dominants | Entrée typ. / max | Sortie typ. / max | Coût typ. | Coût max | Prix | Marge au plafond (plancher) | Marge typique (référence) | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| Low | `qwen3-coder-30b-a3b-instruct`, `qwen3-coder-next` | 93,0 k / 184 k | 29,8 k / 101 k | 16 F | 742 F | 300 F | -191 % | 95 % | ⚠️ perte possible au plancher → 873 F |
| Medium | `qwen3-coder-next`, `qwen3-coder` | 93,0 k / 184 k | 29,8 k / 101 k | 35 F | 790 F | 300 F | -210 % | 88 % | ⚠️ perte possible au plancher → 929 F |
| High | `qwen3-coder`, `qwen3.5-397b-a17b` | 93,0 k / 184 k | 29,8 k / 101 k | 49 F | 820 F | 300 F | -221 % | 83 % | ⚠️ perte possible au plancher → 965 F |
| Ultra | `deepseek-v4-pro`, `gemini-3.8-flash` | 93,0 k / 184 k | 29,8 k / 101 k | 43 F | 804 F | 300 F | -215 % | 85 % | ⚠️ perte possible au plancher → 946 F |

<details><summary>Détail des étapes (cran Medium)</summary>

| Étape | Modèle | Appels typ. / max | Entrée typ. / max | Sortie typ. / max | Coût typ. / max |
|---|---|---|---|---|---|
| Compréhension de la demande | `google/gemini-3.8-flash` | 1 / 2 | 3,0 k / 8,0 k | 300 / 1,2 k | 1,9 F / 6,1 F |
| Concept du film | `qwen/qwen3.5-27b` | 1 / 1 | 8,0 k / 10,0 k | 1,5 k / 2,5 k | 3,5 F / 5,3 F |
| Storyboard | `qwen/qwen3.5-27b` | 1 / 1 | 10,0 k / 12,0 k | 4,0 k / 9,0 k | 7,5 F / 15 F |
| Code de chaque scène | `qwen/qwen3-coder-next` | 5 / 8 | 60,0 k / 112 k | 20,0 k / 64,0 k | 13 F / 37 F |
| Réparation technique (cran +1) | `qwen/qwen3-coder` | 1 / 3 | 12,0 k / 42,0 k | 4,0 k / 24,0 k | 4,4 F / 21 F |
| Photos générées (FLUX.2) | `image` | 2 / 6 | — | — | 3,9 F / 12 F |
| Clips générés (Seedance / Veo) | `video_second` | 0 / 10 | — | — | 0,0 F / 692 F |
| Voix off (Kokoro) | `speech_char` | 300 / 1 200 | — | — | 0,1 F / 0,4 F |

Budget d’exécution : alerte au-delà de 255 F, arrêt (mode `enforce`) au-delà de 1 579 F.

</details>

> Prix et enveloppe suivent le périmètre (durée × formats × qualité, `video/pricing.ts`). Les clips générés dominent le plafond : 3 essais au plus, puis banque d’images.

#### Vidéo — nouvel export

Clé `business.motion_video_rerender` · groupe **Vidéos** · hors jauge
  
Points d’entrée : `POST /project/communication/:projectId/videos/:videoId/export`

| Cran | Modèles dominants | Entrée typ. / max | Sortie typ. / max | Coût typ. | Coût max | Prix | Marge au plafond (plancher) | Marge typique (référence) | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| — | `qwen3-coder-next`, `qwen3.5-27b` | 0 / 36,0 k | 0 / 16,8 k | 0,0 F | 12 F | 100 F | 86 % | 100 % | ✅ |

<details><summary>Détail des étapes</summary>

| Étape | Modèle | Appels typ. / max | Entrée typ. / max | Sortie typ. / max | Coût typ. / max |
|---|---|---|---|---|---|
| Lecture de la retouche | `qwen/qwen3.5-27b` | 0 / 1 | 0 / 8,0 k | 0 / 800 | 0,0 F / 2,4 F |
| Scènes réécrites | `qwen/qwen3-coder-next` | 0 / 2 | 0 / 28,0 k | 0 / 16,0 k | 0,0 F / 9,3 F |

Budget d’exécution : alerte au-delà de 85 F, arrêt (mode `enforce`) au-delà de 97 F.

</details>

#### Clip vidéo IA (8 s)

Clé `business.short_video` · groupe **Vidéos** · hors jauge

| Cran | Modèles dominants | Entrée typ. / max | Sortie typ. / max | Coût typ. | Coût max | Prix | Marge au plafond (plancher) | Marge typique (référence) | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| — | `gemini-3.8-flash` | 3,0 k / 4,0 k | 500 / 1,6 k | 556 F | 559 F | 1500 F | 56 % | 62 % | ⚠️ marge < 75 % → 2295 F |

<details><summary>Détail des étapes</summary>

| Étape | Modèle | Appels typ. / max | Entrée typ. / max | Sortie typ. / max | Coût typ. / max |
|---|---|---|---|---|---|
| Prompt du clip | `google/gemini-3.8-flash` | 1 / 1 | 3,0 k / 4,0 k | 500 / 1,6 k | 2,4 F / 5,2 F |
| Clip généré | `video_second` | 8 / 8 | — | — | 554 F / 554 F |

Budget d’exécution : alerte au-delà de 1 275 F, arrêt (mode `enforce`) au-delà de 1 455 F.

</details>

> Clip de site à 1 000 F : préférer Seedance 2.0 Mini, un clip Veo 3.1 Fast de 8 s ne couvre pas son coût au plancher.

### Groupe « Applications générées »

#### Génération initiale d’une application (gratuite)

Clé `appgen.initial_generation` · groupe **Applications générées** · hors jauge
  
Points d’entrée : `AppGen · première demande (POST /billing/consume)`

| Cran | Modèles dominants | Entrée typ. / max | Sortie typ. / max | Coût typ. | Coût max | Prix | Marge au plafond (plancher) | Marge typique (référence) | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| — | `qwen3-coder-next` | 50,0 k / 300 k | 12,0 k / 80,0 k | 9,0 F | 58 F | 0 F | — | — | inclus |

<details><summary>Détail des étapes</summary>

| Étape | Modèle | Appels typ. / max | Entrée typ. / max | Sortie typ. / max | Coût typ. / max |
|---|---|---|---|---|---|
| Agent de code | `qwen/qwen3-coder-next` | 2 / 5 | 50,0 k / 300 k | 12,0 k / 80,0 k | 9,0 F / 58 F |

Budget d’exécution : alerte au-delà de 58 F, arrêt (mode `enforce`) au-delà de 173 F.

</details>

> Gratuite par choix (« générer est gratuit, posséder se paie ») : c’est un coût d’acquisition, borné par le quota du jour.

### Groupe « Modifications iCode »

#### iCode — message / planification

Clé `appgen.message` · groupe **Modifications iCode** · hors jauge
  
Points d’entrée : `AppGen · chat (POST /billing/consume)`

| Cran | Modèles dominants | Entrée typ. / max | Sortie typ. / max | Coût typ. | Coût max | Prix | Marge au plafond (plancher) | Marge typique (référence) | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| — | `qwen3-coder-next` | 20,0 k / 60,0 k | 1,0 k / 4,0 k | 1,8 F | 6,0 F | 25 F | 72 % | 92 % | ✅ |

<details><summary>Détail des étapes</summary>

| Étape | Modèle | Appels typ. / max | Entrée typ. / max | Sortie typ. / max | Coût typ. / max |
|---|---|---|---|---|---|
| Agent de code | `qwen/qwen3-coder-next` | 1 / 1 | 20,0 k / 60,0 k | 1,0 k / 4,0 k | 1,8 F / 6,0 F |

Budget d’exécution : alerte au-delà de 21 F, arrêt (mode `enforce`) au-delà de 24 F.

</details>

#### iCode — build standard

Clé `appgen.build` · groupe **Modifications iCode** · hors jauge
  
Points d’entrée : `AppGen · modification (POST /billing/consume)`

| Cran | Modèles dominants | Entrée typ. / max | Sortie typ. / max | Coût typ. | Coût max | Prix | Marge au plafond (plancher) | Marge typique (référence) | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| — | `qwen3-coder-next` | 40,0 k / 360 k | 6,0 k / 48,0 k | 5,5 F | 47 F | 25 F | -122 % | 77 % | ⚠️ perte possible au plancher → 56 F |

<details><summary>Détail des étapes</summary>

| Étape | Modèle | Appels typ. / max | Entrée typ. / max | Sortie typ. / max | Coût typ. / max |
|---|---|---|---|---|---|
| Agent de code | `qwen/qwen3-coder-next` | 1 / 3 | 40,0 k / 360 k | 6,0 k / 48,0 k | 5,5 F / 47 F |

Budget d’exécution : alerte au-delà de 21 F, arrêt (mode `enforce`) au-delà de 94 F.

</details>

> Le contexte du projet entier repart à chaque tour : le cache d’entrée d’OpenRouter (−40 % sur Qwen3 Coder Next) est le premier levier.

#### iCode — action premium

Clé `appgen.premium` · groupe **Modifications iCode** · hors jauge
  
Points d’entrée : `AppGen · modèle premium (POST /billing/consume)`

| Cran | Modèles dominants | Entrée typ. / max | Sortie typ. / max | Coût typ. | Coût max | Prix | Marge au plafond (plancher) | Marge typique (référence) | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| — | `qwen3-coder` | 40,0 k / 360 k | 6,0 k / 48,0 k | 10 F | 90 F | 75 F | -41 % | 86 % | ⚠️ perte possible au plancher → 106 F |

<details><summary>Détail des étapes</summary>

| Étape | Modèle | Appels typ. / max | Entrée typ. / max | Sortie typ. / max | Coût typ. / max |
|---|---|---|---|---|---|
| Agent de code (480B) | `qwen/qwen3-coder` | 1 / 3 | 40,0 k / 360 k | 6,0 k / 48,0 k | 10 F / 90 F |

Budget d’exécution : alerte au-delà de 64 F, arrêt (mode `enforce`) au-delà de 180 F.

</details>

#### iCode — image de site générée

Clé `appgen.site_image` · groupe **Modifications iCode** · hors jauge
  
Points d’entrée : `POST /appgen/media/image`

| Cran | Modèles dominants | Entrée typ. / max | Sortie typ. / max | Coût typ. | Coût max | Prix | Marge au plafond (plancher) | Marge typique (référence) | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| — |  | 0 / 0 | 0 / 0 | 2,0 F | 3,9 F | 25 F | 82 % | 92 % | ✅ |

<details><summary>Détail des étapes</summary>

| Étape | Modèle | Appels typ. / max | Entrée typ. / max | Sortie typ. / max | Coût typ. / max |
|---|---|---|---|---|---|
| Image générée | `image` | 1 / 2 | — | — | 2,0 F / 3,9 F |

Budget d’exécution : alerte au-delà de 21 F, arrêt (mode `enforce`) au-delà de 24 F.

</details>

#### iCode — clip vidéo de site (5-6 s)

Clé `appgen.site_video` · groupe **Modifications iCode** · hors jauge
  
Points d’entrée : `POST /appgen/media/video`

| Cran | Modèles dominants | Entrée typ. / max | Sortie typ. / max | Coût typ. | Coût max | Prix | Marge au plafond (plancher) | Marge typique (référence) | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| — |  | 0 / 0 | 0 / 0 | 346 F | 415 F | 1000 F | 51 % | 64 % | ⚠️ marge < 75 % → 1428 F |

<details><summary>Détail des étapes</summary>

| Étape | Modèle | Appels typ. / max | Entrée typ. / max | Sortie typ. / max | Coût typ. / max |
|---|---|---|---|---|---|
| Clip généré | `video_second` | 5 / 6 | — | — | 346 F / 415 F |

Budget d’exécution : alerte au-delà de 850 F, arrêt (mode `enforce`) au-delà de 970 F.

</details>

### Groupe « Simulations »

#### Simulation (exécution standard)

Clé `free.simulation_run` · groupe **Simulations** · hors jauge
  
Points d’entrée : `POST /project/simulation/:projectId`, `POST /project/simulation/import/run`

| Cran | Modèles dominants | Entrée typ. / max | Sortie typ. / max | Coût typ. | Coût max | Prix | Marge au plafond (plancher) | Marge typique (référence) | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| — | `qwen3.5-397b-a17b`, `qwen3.5-122b-a10b` | 54,0 k / 176 k | 20,0 k / 93,7 k | 100 F | 334 F | 0 | — | — | gratuit — borné par le quota |

<details><summary>Détail des étapes</summary>

| Étape | Modèle | Appels typ. / max | Entrée typ. / max | Sortie typ. / max | Coût typ. / max |
|---|---|---|---|---|---|
| Facteurs du secteur | `qwen/qwen3.5-122b-a10b` | 1 / 1 | 10,0 k / 20,0 k | 6,0 k / 20,0 k | 8,7 F / 27 F |
| Scénarios | `qwen/qwen3.5-397b-a17b` | 2 / 6 | 20,0 k / 96,0 k | 8,0 k / 49,2 k | 22 F / 130 F |
| Analyse et recommandations | `qwen/qwen3.5-122b-a10b` | 2 / 3 | 24,0 k / 60,0 k | 6,0 k / 24,6 k | 11 F / 38 F |
| Résultats de recherche web | `web_result` | 25 / 60 | — | — | 58 F / 138 F |

Budget d’exécution : alerte au-delà de 334 F, arrêt (mode `enforce`) au-delà de 1 001 F.

</details>

> Facturée à l’acte depuis le portefeuille (1 500 à 9 500 F) : la marge se lit sur le prix de l’offre.

## 4. Actions dont le prix ne tient pas les deux règles

| Action | Cran | Prix actuel | Coût typ. | Coût max | Prix minimum (R1 + R2) |
|---|---|---|---|---|---|
| Business plan complet | Low | 667 F | 455 F | 2 683 F | **3157 F** |
| Business plan complet | Medium | 667 F | 486 F | 2 790 F | **3283 F** |
| Business plan complet | High | 667 F | 516 F | 2 862 F | **3368 F** |
| Business plan complet | Ultra | 1667 F | 521 F | 2 860 F | **3366 F** |
| Pitch deck | Low | 333 F | 84 F | 238 F | **346 F** |
| Pitch deck | Medium | 333 F | 103 F | 287 F | **426 F** |
| Pitch deck | High | 333 F | 122 F | 324 F | **502 F** |
| Logo et charte graphique | Low | 500 F | 289 F | 608 F | **1192 F** |
| Logo et charte graphique | Medium | 500 F | 317 F | 670 F | **1306 F** |
| Logo et charte graphique | High | 500 F | 342 F | 714 F | **1409 F** |
| Visuel 100 % généré par IA | Low | 100 F | 49 F | 51 F | **203 F** |
| Visuel 100 % généré par IA | Medium | 100 F | 50 F | 54 F | **208 F** |
| Visuel 100 % généré par IA | High | 100 F | 51 F | 55 F | **213 F** |
| Visuel 100 % généré par IA | Ultra | 100 F | 52 F | 56 F | **214 F** |
| Vidéo motion design (15 s, 1 format, HD) | Low | 300 F | 16 F | 742 F | **873 F** |
| Vidéo motion design (15 s, 1 format, HD) | Medium | 300 F | 35 F | 790 F | **929 F** |
| Vidéo motion design (15 s, 1 format, HD) | High | 300 F | 49 F | 820 F | **965 F** |
| Vidéo motion design (15 s, 1 format, HD) | Ultra | 300 F | 43 F | 804 F | **946 F** |
| Clip vidéo IA (8 s) | — | 1500 F | 556 F | 559 F | **2295 F** |
| iCode — build standard | — | 25 F | 5,5 F | 47 F | **56 F** |
| iCode — action premium | — | 75 F | 10 F | 90 F | **106 F** |
| iCode — clip vidéo de site (5-6 s) | — | 1000 F | 346 F | 415 F | **1428 F** |

## 5. Exposition maximale par offre (pire cas mensuel)

Chaque groupe consommé jusqu’à sa limite mensuelle, chaque fois au coût plafond de son action la plus chère. Ce pire cas est théorique : le plafond de dépense mensuel l’arrête bien avant.

| Offre | Pire cas sans plafond | Plafond de dépense mensuel |
|---|---|---|
| Gratuit (Découverte / Hobby) | $479.625 (276 744 F) | $1.500 (866 F) |
| Essentiel / Starter | $2510.798 (1 448 730 F) | $18.000 (10 386 F) |
| Croissance / Pro | $5073.279 (2 927 282 F) | $45.000 (25 965 F) |
| Cabinet / Studio / Scale | $12551.975 (7 242 490 F) | $110.000 (63 470 F) |
| Bêta premium (offerte) | $1228.666 (708 940 F) | $15.000 (8 655 F) |

## 6. Scénario cible : coûts après optimisation et prix recommandés

Les mêmes enveloppes, rejouées avec les leviers de la phase 1 du plan d’action (`config/cost-scenarios.ts`). Le prix recommandé est le plus bas qui tient R1 et R2 : le prix actuel quand il suffit, sinon le minimum arrondi. Une action qui suit la jauge garde un seul prix de base, multiplié par cran.

| Levier | Changement |
|---|---|
| **L1** · Rédacteurs sur DeepSeek V4 Flash | Les étapes de rédaction servies par Gemini 3.8 Flash passent sur DeepSeek V4 Flash (poids ouverts, licence MIT, sortie ~20× moins chère), après test A/B par `npm run ai:models`. |
| **L2** · Recherche web bornée | 6 résultats par recherche au lieu de 12, 2 recherches par section au plus au lieu de 3 (`SEARCH_RESULTS_PER_QUERY`, `MAX_SEARCH_QUERIES`). |
| **L3** · Cache du contexte iCode | Le préfixe stable du contexte (système, fichiers du projet) est envoyé en premier pour être lu depuis le cache d’OpenRouter : 60 % des jetons d’entrée au tarif « cache ». |
| **L4** · Visuel IA sur FLUX.2 | Le visuel IA quitte Gemini Image (0,077 $) pour FLUX.2 klein (0,0034 $), déjà utilisé partout ailleurs ; Gemini reste réservé aux mises en situation de la charte. |
| **L5** · Retouche scindée | « Révision » (1 cr) ne couvre plus que la retouche de texte ; la page réécrite par l’auteur devient « retouche de page » et l’import de document « analyse de document ». |

| Action | Cran | Coût typ. aujourd’hui → cible | Coût max aujourd’hui → cible | Prix actuel | Prix recommandé | Marge typique | Marge au plafond |
|---|---|---|---|---|---|---|---|
| Business plan complet | Low | 455 F → 178 F | 2 683 F → 700 F | 667 F | **1040 F** | 82 % | 21 % |
| Business plan complet | Medium | 486 F → 209 F | 2 790 F → 808 F | 667 F | **1040 F** | 79 % | 9 % |
| Business plan complet | High | 516 F → 239 F | 2 862 F → 879 F | 667 F | **1040 F** | 76 % | 1 % |
| Business plan complet | Ultra | 521 F → 244 F | 2 860 F → 878 F | 1667 F | **1040 F** | 76 % | 1 % |
| Business plan — nouvelle mise en page | Low | 22 F → 22 F | 79 F → 79 F | 500 F | 500 F | 95 % | 81 % |
| Business plan — nouvelle mise en page | Medium | 53 F → 53 F | 175 F → 175 F | 500 F | 500 F | 89 % | 59 % |
| Business plan — nouvelle mise en page | High | 83 F → 83 F | 242 F → 242 F | 500 F | 500 F | 83 % | 43 % |
| Business plan — nouvelle mise en page | Ultra | 88 F → 88 F | 245 F → 245 F | 500 F | 500 F | 82 % | 42 % |
| Pitch deck | Low | 84 F → 19 F | 238 F → 52 F | 333 F | 333 F | 94 % | 82 % |
| Pitch deck | Medium | 103 F → 39 F | 287 F → 101 F | 333 F | 333 F | 88 % | 64 % |
| Pitch deck | High | 122 F → 57 F | 324 F → 138 F | 333 F | 333 F | 82 % | 51 % |
| Pitch deck | Ultra | 123 F → 59 F | 321 F → 135 F | 1333 F | **333 F** | 82 % | 52 % |
| Pitch deck — nouvelle mise en page | Low | 14 F → 14 F | 32 F → 32 F | 300 F | 300 F | 95 % | 87 % |
| Pitch deck — nouvelle mise en page | Medium | 33 F → 33 F | 73 F → 73 F | 300 F | 300 F | 89 % | 71 % |
| Pitch deck — nouvelle mise en page | High | 51 F → 51 F | 106 F → 106 F | 300 F | 300 F | 82 % | 58 % |
| Pitch deck — nouvelle mise en page | Ultra | 53 F → 53 F | 108 F → 108 F | 300 F | 300 F | 82 % | 58 % |
| Logo et charte graphique | Low | 289 F → 151 F | 608 F → 263 F | 500 F | **860 F** | 82 % | 64 % |
| Logo et charte graphique | Medium | 317 F → 179 F | 670 F → 325 F | 500 F | **860 F** | 79 % | 56 % |
| Logo et charte graphique | High | 342 F → 204 F | 714 F → 369 F | 500 F | **860 F** | 76 % | 50 % |
| Logo et charte graphique | Ultra | 344 F → 207 F | 715 F → 370 F | 1500 F | **860 F** | 75 % | 49 % |
| Kit juridique OHADA | — | 29 F → 29 F | 98 F → 98 F | 500 F | 500 F | 94 % | 77 % |
| Prévisions financières 3 ans | — | 16 F → 16 F | 185 F → 185 F | 333 F | 333 F | 95 % | 35 % |
| Manuel de procédures (feuille de route) | — | 38 F → 38 F | 137 F → 137 F | 0 F | 0 F | — | — |
| Stratégie de communication | — | 16 F → 16 F | 38 F → 38 F | 1000 F | 1000 F | 98 % | 96 % |
| Calendrier éditorial | — | 20 F → 20 F | 46 F → 46 F | 500 F | 500 F | 96 % | 89 % |
| Période de communication | — | 28 F → 28 F | 65 F → 65 F | 500 F | 500 F | 94 % | 85 % |
| Visuel / flyer | Low | 5,7 F → 2,1 F | 12 F → 7,3 F | 100 F | 100 F | 98 % | 91 % |
| Visuel / flyer | Medium | 6,8 F → 3,3 F | 16 F → 11 F | 100 F | 100 F | 97 % | 87 % |
| Visuel / flyer | High | 8,0 F → 4,4 F | 18 F → 13 F | 100 F | 100 F | 95 % | 85 % |
| Visuel / flyer | Ultra | 8,4 F → 4,8 F | 19 F → 13 F | 100 F | 100 F | 95 % | 84 % |
| Visuel 100 % généré par IA | Low | 49 F → 3,1 F | 51 F → 3,8 F | 100 F | 100 F | 97 % | 95 % |
| Visuel 100 % généré par IA | Medium | 50 F → 4,2 F | 54 F → 5,9 F | 100 F | 100 F | 96 % | 93 % |
| Visuel 100 % généré par IA | High | 51 F → 5,4 F | 55 F → 7,6 F | 100 F | 100 F | 94 % | 91 % |
| Visuel 100 % généré par IA | Ultra | 52 F → 5,8 F | 56 F → 7,9 F | 100 F | 100 F | 94 % | 91 % |
| Carrousel (jusqu’à 10 vues) | Low | 12 F → 5,4 F | 22 F → 13 F | 200 F | 200 F | 97 % | 92 % |
| Carrousel (jusqu’à 10 vues) | Medium | 19 F → 12 F | 40 F → 31 F | 200 F | 200 F | 94 % | 82 % |
| Carrousel (jusqu’à 10 vues) | High | 26 F → 19 F | 56 F → 47 F | 200 F | 200 F | 90 % | 72 % |
| Carrousel (jusqu’à 10 vues) | Ultra | 28 F → 21 F | 60 F → 50 F | 200 F | 200 F | 89 % | 70 % |
| Carte de visite | Low | 7,5 F → 2,2 F | 22 F → 11 F | 167 F | 167 F | 99 % | 92 % |
| Carte de visite | Medium | 9,9 F → 4,5 F | 30 F → 19 F | 167 F | 167 F | 97 % | 87 % |
| Carte de visite | High | 12 F → 7,1 F | 34 F → 23 F | 167 F | 167 F | 96 % | 84 % |
| Carte de visite | Ultra | 13 F → 7,9 F | 35 F → 24 F | 1167 F | **167 F** | 95 % | 83 % |
| Vidéo motion design (15 s, 1 format, HD) | Low | 16 F → 14 F | 742 F → 736 F | 300 F | **960 F** | 98 % | 10 % |
| Vidéo motion design (15 s, 1 format, HD) | Medium | 35 F → 33 F | 790 F → 784 F | 300 F | **960 F** | 96 % | 4 % |
| Vidéo motion design (15 s, 1 format, HD) | High | 49 F → 48 F | 820 F → 814 F | 300 F | **960 F** | 95 % | 0 % |
| Vidéo motion design (15 s, 1 format, HD) | Ultra | 43 F → 41 F | 804 F → 798 F | 300 F | **960 F** | 96 % | 2 % |
| Vidéo — nouvel export | — | 0,0 F → 0,0 F | 12 F → 12 F | 100 F | 100 F | 100 % | 86 % |
| Clip vidéo IA (8 s) | — | 556 F → 554 F | 559 F → 554 F | 1500 F | **2290 F** | 75 % | 72 % |
| Retouche IA (révision) | — | 7,0 F → 0,5 F | 18 F → 1,2 F | 0 F | 0 F | — | — |
| Nouvelles palettes / polices | — | 6,9 F → 0,5 F | 17 F → 1,2 F | 100 F | 100 F | 99 % | 99 % |
| Relance de logos | — | 14 F → 14 F | 48 F → 48 F | 100 F | 100 F | 86 % | 44 % |
| Nouveaux logos depuis le panneau | — | 14 F → 14 F | 44 F → 44 F | 100 F | 100 F | 86 % | 49 % |
| Génération initiale d’une application (gratuite) | — | 9,0 F → 8,1 F | 58 F → 53 F | 0 F | 0 F | — | — |
| iCode — message / planification | — | 1,8 F → 1,5 F | 6,0 F → 5,0 F | 25 F | 25 F | 94 % | 77 % |
| iCode — build standard | — | 5,5 F → 4,8 F | 47 F → 41 F | 25 F | **50 F** | 90 % | 4 % |
| iCode — action premium | — | 10 F → 7,6 F | 90 F → 65 F | 75 F | **80 F** | 90 % | 4 % |
| iCode — image de site générée | — | 2,0 F → 2,0 F | 3,9 F → 3,9 F | 25 F | 25 F | 92 % | 82 % |
| iCode — clip vidéo de site (5-6 s) | — | 346 F → 346 F | 415 F → 415 F | 1000 F | **1430 F** | 75 % | 66 % |
| Retouche de page (page réécrite par l’auteur) *(nouvelle)* | — | 3,8 F → 3,8 F | 6,0 F → 6,0 F | — | **20 F** | 80 % | 65 % |
| Analyse de document importé (relevé, plan existant) *(nouvelle)* | — | 1,3 F → 1,3 F | 5,5 F → 5,5 F | — | **7 F** | 81 % | 8 % |
