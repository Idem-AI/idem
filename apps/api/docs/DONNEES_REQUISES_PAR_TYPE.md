# Données à fournir pour un business plan complet, par type de plan

Ce document liste, pour chacun des dix modèles de business plan d'IDEM et pour la composition libre, les données que l'utilisateur doit fournir pour que le plan soit complet et crédible auprès de son destinataire.

Il est dérivé du code au 14 septembre 2026 : modèles ([structure/templates.ts](structure/templates.ts)), catalogue des sections ([structure/section-catalog.ts](structure/section-catalog.ts)), consignes de section ([prompts/sections/](prompts/sections/)), lentilles de lecture par destinataire ([prompts/audience-lens.prompt.ts](prompts/audience-lens.prompt.ts)), service ([businessPlan.service.ts](businessPlan.service.ts)) et module Finance ([../Finance/finance-blocks.ts](../Finance/finance-blocks.ts)). Si une consigne de section change, ce document doit changer avec elle.

**Légende des niveaux**

- `O` **Obligatoire** : sans cette donnée, la section est vide, reste générale ou repose sur une supposition du modèle.
- `R` **Recommandé** : la section tient sans, mais le destinataire remarque le manque.
- `W` **Recherché sur le web** : l'équipe de recherche trouve et cite la donnée. Ne la fournissez que si vous avez mieux (étude terrain, devis, statistique locale). Cela ne vaut que pour la génération avec l'équipe de recherche. En génération simple, ces chiffres viennent du modèle, et c'est là que vos propres données comptent le plus.

---

## 1. D'où le générateur tire ses données

### 1.1 Les sources lues

| Source | Champs effectivement lus par le business plan | Ce qu'ils alimentent |
|---|---|---|
| Création du projet | nom, description longue (à défaut, description), type, portée (local → international), cibles | Toutes les sections : c'est le premier bloc de chaque prompt. |
| Informations additionnelles (formulaire du business plan) | email, téléphone, adresse, ville, **pays**, code postal, membres de l'équipe (nom, rôle, email, **bio**, photo, liens) | Toutes les sections. Le **pays** décide aussi du référentiel comptable, des libellés d'exercice et du marché ciblé par la recherche web. |
| Charte graphique (module Branding) | logo, couleurs, typographies, direction artistique | Couverture et mise en page. Aucun contenu. |
| Module Finance, **calculé** | produits, ventes, charges, investissements, plan de financement, calendrier, ratios | Tableaux posés par le serveur dans le Plan financier. Résumé chiffré transmis au Modèle économique, au Plan opérationnel, à la Demande de financement, aux Garanties, à la Stratégie de sortie et à la Pérennité. |
| Recherche web | marché, concurrents, prix, marges sectorielles, réglementation, dispositifs de garantie, transactions comparables, indicateurs de développement | Sections marquées `W`. Le marché ciblé est le pays des informations additionnelles. |
| Langue de l'interface | `fr` → français, sinon anglais | Langue de rédaction. |

### 1.2 Ce qu'aucun champ ne recueille aujourd'hui

Les consignes de section exigent des données pour lesquelles il n'existe **aucun champ** : forme juridique, n° RCCM, date de création, capital et répartition des parts, apport personnel du promoteur, garanties, clients et traction, partenaires, licences et agréments, concurrents connus du terrain, bénéficiaires et valeurs de référence, indicateurs, risques, jalons, conditions de prêt souhaitées.

**Tant que ces champs n'existent pas, ces données doivent être écrites dans la description longue du projet**, et tout ce qui concerne les personnes dans la **bio** des membres de l'équipe. Sinon, le modèle ne peut que les supposer ou rester vague. L'[annexe A](#annexe-a--modèle-de-description-longue) donne un modèle de description longue prêt à remplir.

Deux données saisies ailleurs dans IDEM **ne parviennent pas** au business plan :

- la taille de l'équipe, la fourchette de budget et les contraintes, saisies à la création du projet ;
- le contexte du module Documents juridiques (forme juridique, capital, associés et parts, siège, site web).

Il faut donc les recopier dans la description longue.

### 1.3 Le piège du plan de financement

Le module Finance calcule :

> **besoin de financement = coût total du projet − toutes les ressources saisies**
> (apport en capital + compte courant d'associés + CMT + crédit-bail + crédit fournisseurs + autofinancement + subvention)

Le **coût total du projet** vaut investissements + besoin en fonds de roulement de démarrage (frais de premier fonctionnement compris).

Toute ressource saisie est donc présentée dans le plan comme **déjà mobilisée**. Seul le solde devient le « concours sollicité ». Une ressource saisie mais non obtenue passe donc pour acquise aux yeux du lecteur.

- **Règle générale** : ne saisissez dans le plan de financement que les ressources **acquises**. Ce que vous demandez au destinataire (la levée, la subvention) reste hors du plan : il apparaît alors comme montant sollicité.
- **Exception, dossier bancaire** : un prêt non saisi n'a ni intérêts ni échéances dans le compte d'exploitation, alors que c'est précisément ce que l'analyste crédit vérifie. Saisissez donc l'emprunt sollicité en **CMT** (montant, taux, durée, mode d'amortissement). Le plan affichera alors « plan de financement équilibré ». Pour corriger la lecture, écrivez dans la description longue : *« Le crédit moyen terme de X FCFA sur N ans à T % est le concours sollicité auprès de [banque], non encore accordé. Différé souhaité : N mois. »* (le module ne modélise pas le différé).
- **Sans investissement saisi**, la VAN, le TRI et l'indice de profitabilité sont déclarés « non significatifs » : l'année 0 ne porte aucun décaissement.

---

## 2. Le socle commun à tous les types

### 2.1 Identité et coordonnées

| Donnée | Où la saisir | Niveau | Pourquoi |
|---|---|---|---|
| Nom de l'entreprise | Création du projet | `O` | Couverture et toutes les sections. |
| Description longue : ce qui est vendu, à qui, où, stade (idée, prototype, pilote, en activité depuis quand), ce qui diffère des alternatives | Création du projet | `O` | Socle de toutes les sections. Voir l'annexe A pour le reste. |
| Type de projet, portée géographique, cibles | Création du projet | `R` | Cadrent le marché et la cible. |
| **Pays** | Informations additionnelles | `O` | Référentiel comptable (SYSCOHADA et exercice civil obligatoire dans les 17 États OHADA ; IFRS et clôture libre au Nigeria, au Kenya, en Afrique du Sud…), libellés d'exercice, marché de la recherche web. |
| Ville, adresse, code postal, email, téléphone | Informations additionnelles | `O` | Coordonnées du dossier ; la ville situe la zone de chalandise. |

### 2.2 Équipe

Pour chaque membre : nom, rôle, email, photo, LinkedIn, et surtout une **bio** `O` qui contient :

- les années d'expérience **dans ce secteur**, les postes et entreprises précédents ;
- les diplômes et certifications utiles à l'activité ;
- ce que la personne a déjà fait de comparable (création, gestion d'une activité similaire) ;
- la part du capital détenue et le temps consacré au projet (plein temps, partiel) ;
- pour le promoteur : l'apport personnel et les engagements en cours (autres activités, prêts, cautions données).

Une bio qui liste des titres sans lien avec l'activité produit une section Direction & équipe que les consignes qualifient elles-mêmes de remplissage.

### 2.3 Charte graphique

Logo, couleurs et typographies viennent du module Branding `R`. Sans logo, la couverture n'a pas de signature. Sans couleurs, le plan retombe sur des couleurs par défaut. La direction artistique est générée automatiquement si elle manque. La couverture ne porte **aucun chiffre** : inutile d'en prévoir.

### 2.4 Module Finance

Les tableaux financiers n'apparaissent que si le module est **rempli et calculé**. Sinon, le Plan financier est rédigé sans tableau et les autres sections ne reçoivent que les prix des produits.

Quand il est calculé, le serveur pose dans le Plan financier : les chiffres de tête, la courbe chiffre d'affaires / résultat net, le compte d'exploitation, le coût du projet, le plan de financement avec le montant sollicité, le seuil de rentabilité, le point mort, la trésorerie au point bas, puis la VAN, le TRI, le délai de récupération et l'indice de profitabilité.

| Bloc du module | Données | Niveau |
|---|---|---|
| Paramètres | Devise ; horizon de projection (3 ans par défaut, 7 au plus) | `O` / `R` |
| Calendrier comptable | Première année d'exercice ; mois de démarrage réel de l'activité (un démarrage en cours d'année crée un exercice 1 court, que le plan signale) ; mois de clôture (seulement hors zone OHADA) | `O` |
| Produits (20 au plus) | Nom, prix de vente unitaire par année, coût unitaire par année, note justifiant le prix | `O` |
| Objectifs de ventes | Quantités **mensuelles** sur 36 mois par produit (saisonnalité réelle, montée en charge) ; croissance mensuelle à partir du mois 25 | `O` |
| Chiffre d'affaires | Créances clients en % du chiffre d'affaires (délai de paiement des clients) | `R` |
| Charges variables | Lignes mensuelles : achats de marchandises et matières, emballages, transport, sous-traitance, publicité, commissions d'intermédiaires, frais bancaires… ; dette fournisseur en % ; stock de sécurité en % | `O` |
| Charges fixes | Loyers, assurances, entretien, cotisations, patentes et licences… ; **salaires bruts mensuels par poste** ; taux de charges sociales et de taxe sur salaires | `O` |
| Impôts et taxes | Régime (réel ou forfait), taux d'IS, taille des locaux. Les valeurs par défaut sont exprimées en FCFA (tranches de patente, taxe sur salaires 7,5 %, charges sociales 33,6 %, IS 30 %) : **à vérifier pour votre pays**. | `R` |
| Investissements | Une ligne par investissement : catégorie (incorporel, bâtiment, matériel, mobilier, financier), libellé, montant, mois d'engagement | `O` |
| Plan de financement | Apport en capital ; compte courant d'associés ; CMT ; crédit-bail (montant, taux, durée, mode d'amortissement pour chacun) ; crédit fournisseurs ; autofinancement ; subvention. **Voir le piège 1.3.** | `O` |
| Ratios | Taux d'actualisation (10 % par défaut), taux de distribution des dividendes, CMPC, nombre d'actions | `R` |

### 2.5 Les cohérences que le lecteur vérifie

Les consignes demandent au modèle de ne pas contredire le module Finance. Encore faut-il que les données fournies ailleurs concordent avec lui :

- les **prix** annoncés dans la description = les prix des produits du module ;
- le **budget marketing** par canal = les lignes publicité et commissions des charges ;
- les **emplois créés** annoncés = les postes de la masse salariale ;
- chaque **équipement** décrit (Plan opérationnel) = une ligne d'investissement, au même montant ;
- le **montant demandé**, la devise et les années = ceux du module ;
- les **recrutements** prévus = les salaires qui démarrent aux mois correspondants.

### 2.6 Ce que chaque destinataire refuse, et la donnée qui l'évite

**Banque et microfinance** : l'analyste cherche la capacité de rembourser, mois après mois.

| Motif de refus | Donnée à fournir |
|---|---|
| Projection sans scénario dégradé | Ventes mensuelles réalistes ; le plan construit un scénario à −20 %. |
| Chiffre contradictoire dans le document | Les cohérences 2.5. |
| Montant absent | Plan de financement renseigné selon 1.3. |
| Apport personnel jamais chiffré | Montant, nature, valorisation et justificatif de l'apport. |
| Licence nécessaire jamais mentionnée | Statut de chaque autorisation : obtenue, demandée (date), à demander. |

Ce qui inspire confiance à ce lecteur : un promoteur qui a déjà fait quelque chose de comparable, des contrats signés, un marché qui existait l'an dernier, des coûts nommés.

**Investisseur, incubateur** : l'associé cherche une entreprise qui peut devenir grande, vite, et rester défendable.

| Motif de refus | Donnée à fournir |
|---|---|
| Marché trop petit | Hypothèses de SOM atteignable en 3 ans avec les fonds levés. |
| Avantage copiable en un an | L'avantage précis et ce qui le protège. |
| Traction maquillée | Chiffres absolus, période, base de calcul, rétention. |
| Équipe sans raison de gagner ce problème | Expérience de chaque fondateur liée au problème. |
| Finances sans chemin vers les chiffres | CAC, valeur d'un client, burn mensuel, runway. |

Ce qui inspire confiance à ce lecteur : des preuves plutôt que des arguments. Pour chaque point, dites ce qui est prouvé, ce qui est en test et ce qui est un pari.

**Bailleur de subvention** : l'évaluateur cherche un changement mesurable chez des bénéficiaires nommés.

| Motif de refus | Donnée à fournir |
|---|---|
| Bénéficiaires décrits comme une catégorie | Qui, combien, comment ils sont identifiés et atteints. |
| Impact affirmé, jamais mesuré | Valeur de référence, cible et méthode de collecte par indicateur. |
| Budget qui finance la structure plus que le programme | Budget par ligne de programme, coût par bénéficiaire. |
| Aucune réponse à « et après la subvention ? » | Sources de revenus visées, montants, dates. |
| Doublon d'un programme déjà financé localement | Programmes existants sur le territoire et ce qui vous en distingue. |

Ce qui inspire confiance à ce lecteur : une valeur de référence, un partenaire qui a signé, un récit honnête de ce qui n'a pas marché avant.

**Interne (direction)** : l'équipe cherche les décisions à prendre, les ressources à engager et les seuils de révision. Elle refuse qu'on lui vende le projet. Données à fournir : responsables nommés, jalons datés, un indicateur par objectif, ce qui est choisi et ce qui est refusé.

**Général** : le lecteur peut être prêteur, investisseur ou partenaire, et juge le plan sur son affirmation la moins étayée. Il refuse les contradictions entre sections, les paragraphes qui iraient à n'importe quelle entreprise et les chiffres sans origine. Données à fournir : le détail local, le concurrent nommé, le prix réel, la contrainte réelle.

---

## 3. Les données par type de plan

| # | Modèle (`id`) | Destinataire | Structure d'origine | Sections | Pages |
|---|---|---|---|---|---|
| 3.1 | IDEM standard (`idem-standard`, par défaut) | Général | Structure historique IDEM | 9 | 25-35 |
| 3.2 | SBA traditionnel (`sba-traditional`) | Banque | U.S. Small Business Administration | 10 | 25-40 |
| 3.3 | Dossier bancaire en 9 points (`bank-financing-9`) | Banque | Guide bancaire de dossier de financement | 9 | 20-30 |
| 3.4 | Dossier de crédit (`bank-credit-file`) | Banque | Comité d'engagement bancaire | 14 | 35-50 |
| 3.5 | Amorçage / série A (`vc-seed`) | Investisseur | Fonds d'amorçage et de série A | 17 | 20-30 |
| 3.6 | Lean Canvas (`lean-canvas`) | Interne | Ash Maurya, validation d'hypothèses | 9 | 10-15 |
| 3.7 | Demande de subvention (`grant-nonprofit`) | Bailleur | Bailleurs et fondations | 15 | 25-40 |
| 3.8 | Microfinance OHADA (`microfinance-ohada`) | Banque | Institutions de microfinance, zone OHADA | 12 | 20-30 |
| 3.9 | Candidature incubateur (`incubator-application`) | Investisseur | Incubateurs et accélérateurs | 12 | 15-25 |
| 3.10 | Plan stratégique interne (`internal-strategic`) | Interne | Pilotage, comité de direction | 11 | 20-30 |
| 3.11 | Composition libre (`custom`) | Celui du modèle de départ, sinon général | — | 3 à 20 | — |

Chaque tableau ci-dessous suit l'ordre du document. La colonne « Fiche » renvoie au détail de la [partie 4](#4-fiches-par-section). Les mentions **Pour ce lecteur** sont les exigences ajoutées par la lentille du destinataire.

### 3.1 IDEM standard (`idem-standard`)

Destinataire **général** (voir 2.6). Aucune lentille propre : chaque section suit sa consigne de base.

| # | Section | Fiche | Données clés à fournir |
|---|---|---|---|
| 1 | Couverture | F1 | Nom, logo, charte. |
| 2 | Présentation de l'entreprise | F4 | Mission en une phrase, vision datée, histoire réelle de la création, forme juridique et actionnariat, dirigeants et apport de chacun, 4 à 6 valeurs. |
| 3 | Opportunité | F10 | Problème et qui le subit, pourquoi maintenant, hypothèses de passage TAM → SAM → SOM, segment d'entrée, différenciation. `W` taille du marché, tendances, concurrents. |
| 4 | Cible | F12 | 2 à 3 personas réels, douleurs classées, déclencheur d'achat, parcours client, canaux du secteur. `W` taille des segments, pouvoir d'achat. |
| 5 | Produits & services | F15 | Offres, différences avec les alternatives, prix (= module Finance), feuille de route datée, livraison et service après-vente. |
| 6 | Marketing & ventes | F20 | Message, canaux nommés et coût par canal, processus de vente, fidélisation, indicateurs cibles, budget par canal (= charges du module), phases datées. |
| 7 | Plan financier | F29 | Module Finance calculé ; pourquoi les volumes sont atteignables ; montant demandé et remboursement ; risques financiers et ce qui les absorbe. |
| 8 | Objectifs | F26 | Objectifs datés et mesurables, jalons et livrables, ressources par phase, risques bloquants, ce qui se passe si un jalon est manqué. |
| 9 | Annexes | F37 | Éléments réglementaires ; sources propres éventuelles. |

### 3.2 SBA traditionnel (`sba-traditional`)

Destinataire **banque** (voir 2.6).

| # | Section | Fiche | Données clés à fournir |
|---|---|---|---|
| 1 | Couverture | F1 | Nom, logo, charte. |
| 2 | Résumé exécutif | F2 | Ce que fait l'entreprise, chiffres de tête, montant et usage. **Pour ce lecteur :** montant demandé et horizon de remboursement en ouverture ; apport personnel et garantie dans le même paragraphe. |
| 3 | Présentation de l'entreprise | F4 | Mission, vision, histoire, dirigeants, valeurs. **Pour ce lecteur :** forme juridique, capital social exact, part détenue par chaque associé. |
| 4 | Analyse de marché | F11 | Marché visé, clientèle, barrières à l'entrée. `W` volume, évolution, acteurs. **Pour ce lecteur :** zone de chalandise, demande à portée de l'entreprise, saisonnalité qui pèse sur la trésorerie. |
| 5 | Direction & équipe | F7 | Organigramme et postes vacants, expérience qualifiante de chaque personne clé, plan de recrutement chiffré, lacunes. **Pour ce lecteur :** seconde signature et délégation si le promoteur est indisponible trois mois. |
| 6 | Produits & services | F15 | Offres, prix (= module Finance), feuille de route, service après-vente. **Pour ce lecteur :** l'offre qui porte le chiffre d'affaires. |
| 7 | Marketing & ventes | F20 | Canaux et coût par canal, processus de vente, budget. **Pour ce lecteur :** le budget marketing figure dans les charges du module Finance, au même montant. |
| 8 | Demande de financement | F30 | Montant, forme, usage par ligne lié à un jalon, remboursement, ce qui est déjà apporté. **Pour ce lecteur :** durée, différé, échéancier ; apport personnel en % du besoin total. |
| 9 | Plan financier | F29 | Module calculé avec l'emprunt en CMT (voir 1.3), ventes mensuelles réalistes. **Pour ce lecteur :** le plan présente la trésorerie mensuelle sur 12 à 18 mois, le service de la dette, le mois au plus bas, le ratio de couverture et un scénario à −20 %. |
| 10 | Annexes | F37 | **Pour ce lecteur :** liste des pièces justificatives (devis, bail, relevés bancaires, certificat d'immatriculation) avec date et émetteur. |

### 3.3 Dossier bancaire en 9 points (`bank-financing-9`)

Destinataire **banque** (voir 2.6). Ce modèle n'a pas de section Demande de financement : le montant sollicité ne sort que du Plan financier, d'où l'importance du piège 1.3.

| # | Section | Fiche | Données clés à fournir |
|---|---|---|---|
| 1 | Couverture | F1 | Nom, logo, charte. |
| 2 | Synthèse en une page | F3 | Raison sociale, forme juridique, n° RCCM, date de création, siège social, secteur ; historique et produits ; but poursuivi ; moyens nécessaires. **Pour ce lecteur :** ces faits d'identité doivent être présents et exacts, sinon le dossier est renvoyé avant lecture. |
| 3 | Direction & équipe | F7 | Organigramme, personnes clés, recrutements chiffrés, lacunes. **Pour ce lecteur :** seconde signature et délégation. |
| 4 | Analyse de marché | F11 | `W` marché. **Pour ce lecteur :** zone de chalandise, demande à portée, saisonnalité. |
| 5 | Stratégie & jalons | F19 | Part de marché visée, premiers clients visés, positionnement, SWOT avec de vraies faiblesses, étapes datées. **Pour ce lecteur :** chaque étape porte la condition qui déclenche la suivante et la dépense qu'elle débloque. |
| 6 | Marketing & ventes | F20 | Canaux et coûts, processus, budget. **Pour ce lecteur :** budget présent dans les charges au même montant. |
| 7 | Plan opérationnel | F24 | Moyens commerciaux, de production et humains, processus, contrôle qualité, capacité maximale. **Pour ce lecteur :** pour chaque équipement financé, le prix, le fournisseur et le devis. |
| 8 | Plan financier | F29 | Module calculé, emprunt en CMT. **Pour ce lecteur :** trésorerie mensuelle, service de la dette, ratio de couverture, scénario à −20 %. |
| 9 | Ressources & actifs | F25 | Brevets et marques (numéros), actifs hors exploitation mobilisables, savoir-faire, ressources propres et familiales, chacun avec valorisation et justificatif. **Pour ce lecteur :** indiquer si chaque actif est déjà nanti ailleurs. |

### 3.4 Dossier de crédit (`bank-credit-file`)

Destinataire **banque** (voir 2.6). C'est le modèle le plus exigeant en données non financières.

| # | Section | Fiche | Données clés à fournir |
|---|---|---|---|
| 1 | Couverture | F1 | Nom, logo, charte. |
| 2 | Résumé exécutif | F2 | **Pour ce lecteur :** montant et horizon de remboursement en ouverture, apport personnel et garantie. |
| 3 | Profil du promoteur | F6 | Identité, parcours, diplômes, expérience liée à cette activité, motivation, autres activités et engagements. **Pour ce lecteur :** apport personnel chiffré, sa nature et sa valorisation ; en l'absence d'apport, ce qui le remplace. |
| 4 | Présentation de l'entreprise | F4 | **Pour ce lecteur :** forme juridique, capital, part de chaque associé. |
| 5 | Analyse de marché | F11 | **Pour ce lecteur :** zone de chalandise, demande à portée, saisonnalité. |
| 6 | Analyse concurrentielle | F13 | Concurrents connus du terrain, critères d'achat, forces réelles des concurrents. `W` concurrents, substituts. **Pour ce lecteur :** comment prendre sa part sans guerre des prix impossible à financer. |
| 7 | Produits & services | F15 | **Pour ce lecteur :** l'offre qui porte le chiffre d'affaires ; prix = module Finance. |
| 8 | Plan opérationnel | F24 | **Pour ce lecteur :** prix, fournisseur et devis de chaque équipement financé ; capacité. |
| 9 | Direction & équipe | F7 | **Pour ce lecteur :** seconde signature et délégation. |
| 10 | Plan financier | F29 | **Pour ce lecteur :** trésorerie mensuelle sur 12 à 18 mois, service de la dette, ratio de couverture, scénario à −20 %. |
| 11 | Demande de financement | F30 | **Pour ce lecteur :** durée, différé, échéancier, apport personnel en % du besoin. |
| 12 | Garanties & sûretés | F31 | Nature, détenteur, valeur, méthode et auteur de l'évaluation de chaque garantie ; sûretés déjà données ailleurs ; évolution avec l'amortissement du prêt. `W` fonds de garantie du pays et leur taux de couverture. |
| 13 | Risques | F28 | Risques propres à l'entreprise et au pays, probabilité, impact, signal précoce, parade, assurances. **Pour ce lecteur :** ce que vous couperiez d'abord si le chiffre d'affaires restait 20 % sous le plan pendant un an. |
| 14 | Annexes | F37 | **Pour ce lecteur :** liste des pièces justificatives avec date et émetteur. |

### 3.5 Amorçage / série A (`vc-seed`)

Destinataire **investisseur** (voir 2.6). Pour le module Finance : laissez la levée prévue **hors** du plan de financement, afin qu'elle apparaisse comme montant sollicité.

| # | Section | Fiche | Données clés à fournir |
|---|---|---|---|
| 1 | Couverture | F1 | Nom, logo, charte. |
| 2 | Résumé exécutif | F2 | **Pour ce lecteur :** taille de l'opportunité et pourquoi maintenant en ouverture ; traction dans le premier tiers, même mince. |
| 3 | Problème | F9 | Qui subit le problème, coût, contournements actuels. `W` statistiques. **Pour ce lecteur :** le changement technologique, réglementaire ou comportemental qui ouvre la fenêtre. |
| 4 | Solution | F14 | Parcours utilisateur, mécanisme non copiable, avant/après, ce qu'elle ne fait pas, preuves, ce qui reste à construire. **Pour ce lecteur :** stade exact de chaque brique (en production, prototype, spécification). |
| 5 | Proposition de valeur | F16 | Phrase « pour qui, quel résultat, contrairement à quoi » ; trois affirmations vérifiables et leur preuve ; deux alternatives les plus proches. |
| 6 | Analyse de marché | F11 | `W` marché. **Pour ce lecteur :** structure du marché (fragmenté, concentré) et ce qu'elle implique. |
| 7 | Cible | F12 | Personas, douleurs, déclencheurs, parcours. **Pour ce lecteur :** segment tête de pont, sa taille, pourquoi il est atteignable en premier. |
| 8 | Modèle économique | F18 | Sources de revenus, économie unitaire, CAC (mesuré ou hypothèse déclarée), structure de coûts. `W` prix concurrents, marges. **Pour ce lecteur :** délai de récupération du CAC, trajectoire de marge brute, ce qui devient moins cher à dix fois le volume. |
| 9 | Traction & preuves | F22 | Chiffres absolus (utilisateurs, clients, chiffre d'affaires, pilotes, lettres d'intention), courbe avec période et base, apprentissages. **Pour ce lecteur :** rétention et cohortes. |
| 10 | Analyse concurrentielle | F13 | `W` concurrents. **Pour ce lecteur :** réaction de l'acteur le mieux financé, délai, ce qui tient ensuite. |
| 11 | Avantage déloyal | F17 | L'avantage précis, pourquoi un concurrent financé ne le reproduit pas en deux ans, ce qui l'éroderait. **Pour ce lecteur :** ce qui tient après l'arrivée d'un concurrent financé. |
| 12 | Go-to-market | F21 | Segment tête de pont, comment atteindre les dix premiers clients, séquence datée, coût et preuve attendue par phase. |
| 13 | Direction & équipe | F7 | **Pour ce lecteur :** pour chaque fondateur, l'expérience qui en fait la bonne personne pour ce problème ; le rôle qui manque aujourd'hui. |
| 14 | Plan financier | F29 | Module calculé. **Pour ce lecteur :** burn mensuel actuel, runway après le tour, jalon à atteindre avant le tour suivant, trajectoire de marge brute. |
| 15 | Demande de financement | F30 | Montant, usage par ligne et jalon, ce qui est déjà apporté. **Pour ce lecteur :** taille du tour, instrument, ce que le tour doit prouver ; valorisation seulement si les fondateurs ont une position. |
| 16 | Stratégie de sortie | F32 | Voies de sortie réalistes, horizon, acquéreurs actifs dans le secteur, valorisation d'entrée, nombre d'actions (module Finance › Ratios). `W` transactions comparables et multiples. |
| 17 | Annexes | F37 | Sources propres éventuelles, éléments réglementaires. |

### 3.6 Lean Canvas (`lean-canvas`)

Destinataire **interne** (voir 2.6). Ce modèle sert à valider des hypothèses : pour chaque affirmation, indiquez si elle est **validée** (avec la preuve), **en test** ou **non testée**. Donnez un responsable et une date à chaque décision.

| # | Section | Fiche | Données clés à fournir |
|---|---|---|---|
| 1 | Couverture | F1 | Nom, logo, charte. |
| 2 | Problème | F9 | Problème comme fait, qui le subit et à quel coût, contournements, ce qui a changé. `W` statistiques. |
| 3 | Solution | F14 | Mécanisme, preuves, ce qui reste à construire, ce que la solution ne fait pas. |
| 4 | Proposition de valeur | F16 | Phrase de proposition, affirmations vérifiables, alternatives. |
| 5 | Avantage déloyal | F17 | L'avantage précis, ou l'aveu d'une concurrence sur l'exécution. |
| 6 | Cible | F12 | Personas issus d'entretiens, segments dimensionnés. `W` taille des segments. |
| 7 | Modèle économique | F18 | Revenus, prix, économie unitaire, CAC, coûts fixes et variables. `W` prix et marges. |
| 8 | Indicateurs clés | F27 | 3 à 5 indicateurs : valeur actuelle, cible, échéance, méthode de mesure, responsable, seuil de révision. |
| 9 | Plan financier | F29 | Module Finance calculé, même sommaire. |

### 3.7 Demande de subvention (`grant-nonprofit`)

Destinataire **bailleur** (voir 2.6). Deux limites du module Finance pour ce modèle :

- il raisonne par nature comptable. Le budget **par ligne de programme** et le **coût par bénéficiaire** doivent donc être fournis dans la description longue ;
- saisissez les subventions **acquises** dans le champ subvention, et laissez la subvention **demandée** hors du plan de financement (voir 1.3).

| # | Section | Fiche | Données clés à fournir |
|---|---|---|---|
| 1 | Couverture | F1 | Nom, logo, charte. |
| 2 | Résumé exécutif | F2 | **Pour ce lecteur :** bénéficiaires et changement visé, chiffrés, en ouverture ; puis montant demandé et cofinancements acquis. |
| 3 | Mission & vision | F5 | Vision avec horizon et élément mesurable, valeurs, principes de fonctionnement. **Pour ce lecteur :** une mission qui nomme les bénéficiaires et le changement dans la même phrase. |
| 4 | Problème | F9 | Causes, coût pour les bénéficiaires, contournements. **Pour ce lecteur :** valeur de référence sur le territoire concerné, pas une moyenne nationale. |
| 5 | Cible | F12 | **Pour ce lecteur :** bénéficiaires, pas clients : comment ils sont identifiés et atteints, combien sont dans le périmètre, critères de vulnérabilité. |
| 6 | Produits & services | F15 | **Pour ce lecteur :** programmes, pas produits : activités, bénéficiaires atteints, coût par bénéficiaire. |
| 7 | Théorie du changement | F33 | Causes profondes, intrants, activités, réalisations dénombrables, effets mesurables, impact de long terme, hypothèse de chaque lien. |
| 8 | Direction & équipe | F7 | **Pour ce lecteur :** personnel affecté au programme, part de temps de chacun, instance de gouvernance qui le supervise. |
| 9 | Partenariats & écosystème | F23 | Partenaires, apport, statut, dépendances. **Pour ce lecteur :** pour chaque lettre de soutien ou convention, le nom du document, sa date et l'engagement qu'il porte. |
| 10 | Suivi & évaluation | F35 | Indicateurs, valeur de référence, cible, fréquence, source, collecteur ; dispositif d'évaluation ; calendrier de reporting ; budget de mesure. |
| 11 | Impact social & économique | F34 | Emplois directs par année et qualification (= masse salariale), effets indirects, bénéficiaires, effet environnemental positif et négatif, méthode de mesure. `W` priorités de développement locales. |
| 12 | Plan financier | F29 | Module calculé. **Pour ce lecteur :** budget par ligne de programme, ce que chaque ligne produit, coût par bénéficiaire, part couverte par la demande face aux cofinancements acquis. |
| 13 | Demande de financement | F30 | **Pour ce lecteur :** coût total du programme, part demandée, chaque cofinanceur nommé avec le statut de son engagement. |
| 14 | Pérennité | F36 | Mix de revenus actuel et dépendance, mix cible, revenus propres, coûts réductibles, réserves en mois, scénario de retrait du bailleur principal, sources visées avec montant et date. |
| 15 | Annexes | F37 | Lettres et conventions référencées, sources propres. |

### 3.8 Microfinance OHADA (`microfinance-ohada`)

Destinataire **banque** (voir 2.6). Pays OHADA : SYSCOHADA révisé et exercice du 1er janvier au 31 décembre. Renseignez le mois de démarrage réel de l'activité pour que l'exercice 1 court soit signalé.

| # | Section | Fiche | Données clés à fournir |
|---|---|---|---|
| 1 | Couverture | F1 | Nom, logo, charte. |
| 2 | Profil du promoteur | F6 | Parcours, expérience liée à l'activité, engagements existants. **Pour ce lecteur :** apport personnel chiffré, sa nature, sa valorisation. |
| 3 | Présentation de l'entreprise | F4 | **Pour ce lecteur :** forme juridique, capital, part de chaque associé. |
| 4 | Analyse de marché | F11 | **Pour ce lecteur :** zone de chalandise, demande à portée, saisonnalité. |
| 5 | Produits & services | F15 | **Pour ce lecteur :** l'offre qui porte le chiffre d'affaires ; prix = module Finance. |
| 6 | Plan opérationnel | F24 | **Pour ce lecteur :** prix, fournisseur et devis de chaque équipement financé. |
| 7 | Direction & équipe | F7 | **Pour ce lecteur :** seconde signature et délégation. |
| 8 | Plan financier | F29 | Module calculé, emprunt en CMT. **Pour ce lecteur :** trésorerie mensuelle, service de la dette, ratio de couverture, scénario à −20 %. |
| 9 | Demande de financement | F30 | **Pour ce lecteur :** durée, différé, échéancier, apport personnel en % du besoin. |
| 10 | Garanties & sûretés | F31 | Nature, détenteur, valeur et évaluateur de chaque garantie ; sûretés déjà données. `W` fonds de garantie et dispositifs publics du pays. |
| 11 | Impact social & économique | F34 | Bénéficiaires, effets indirects, effet environnemental. **Pour ce lecteur :** emplois créés et impôts générés par année, avec le niveau de qualification (critères des lignes bonifiées et des garanties publiques). |
| 12 | Annexes | F37 | **Pour ce lecteur :** liste des pièces justificatives avec date et émetteur. |

### 3.9 Candidature incubateur (`incubator-application`)

Destinataire **investisseur** (voir 2.6). Ce modèle n'a pas de section Demande de financement : le besoin éventuel sort du Plan financier.

| # | Section | Fiche | Données clés à fournir |
|---|---|---|---|
| 1 | Couverture | F1 | Nom, logo, charte. |
| 2 | Résumé exécutif | F2 | **Pour ce lecteur :** taille de l'opportunité, pourquoi maintenant, traction même mince. |
| 3 | Problème | F9 | `W` statistiques. **Pour ce lecteur :** ce qui a changé récemment. |
| 4 | Solution | F14 | **Pour ce lecteur :** stade exact de chaque brique ; preuves. |
| 5 | Cible | F12 | **Pour ce lecteur :** segment tête de pont et sa taille. |
| 6 | Modèle économique | F18 | **Pour ce lecteur :** CAC et son délai de récupération, trajectoire de marge brute. |
| 7 | Traction & preuves | F22 | Chiffres absolus, période, base. **Pour ce lecteur :** rétention. Si la traction est mince, dites-le. |
| 8 | Analyse concurrentielle | F13 | **Pour ce lecteur :** réaction de l'acteur le mieux financé. |
| 9 | Direction & équipe | F7 | **Pour ce lecteur :** adéquation de chaque fondateur au problème ; rôle manquant. |
| 10 | Go-to-market | F21 | Tête de pont, dix premiers clients, séquence datée, coût et preuve par phase. |
| 11 | Objectifs | F26 | Objectifs datés, jalons, ressources par phase, risques, plan en cas de jalon manqué (cohérent avec le programme de l'incubateur). |
| 12 | Plan financier | F29 | **Pour ce lecteur :** burn mensuel, runway, jalon avant le prochain financement. |

### 3.10 Plan stratégique interne (`internal-strategic`)

Destinataire **interne** (voir 2.6). Ce modèle n'a **pas de couverture**. Pour chaque décision : responsable nommé, date, coût, indicateur.

| # | Section | Fiche | Données clés à fournir |
|---|---|---|---|
| 1 | Résumé exécutif | F2 | Ce que fait l'entreprise, marché, équipe, chiffres de tête, ressources à engager. |
| 2 | Présentation de l'entreprise | F4 | Mission, vision datée, organisation, valeurs qui arbitrent des décisions. |
| 3 | Analyse de marché | F11 | Évolution et structure du marché, barrières. `W` marché. |
| 4 | Analyse concurrentielle | F13 | Concurrents, là où ils sont forts, réactions probables. `W` concurrents. |
| 5 | Stratégie & jalons | F19 | Part de marché visée, positionnement, SWOT actionnable, ce qui est poursuivi et ce qui est refusé, étapes datées. |
| 6 | Plan opérationnel | F24 | Moyens, processus, capacité maximale et coût du palier suivant. |
| 7 | Direction & équipe | F7 | Organigramme, postes vacants, recrutements, lacunes. |
| 8 | Objectifs | F26 | Objectifs datés, jalons, ressources par phase, plan en cas de jalon manqué. |
| 9 | Indicateurs clés | F27 | 3 à 5 indicateurs avec valeur actuelle, cible, responsable, cadence de revue, seuil de révision. |
| 10 | Risques | F28 | Registre des risques spécifiques, signal précoce, parade, scénario de deux risques simultanés. |
| 11 | Plan financier | F29 | Module Finance calculé. |

### 3.11 Composition libre (`custom`)

- **Destinataire** : celui du modèle dont l'utilisateur est parti, s'il en a retiré ou déplacé des sections ; sinon lecture générale, sans lentille.
- **Taille** : 3 à 20 sections, uniquement issues du catalogue.
- **Section propre à ce mode** : *Cadre juridique et réglementaire* (F8), absente de tous les modèles.
- **Données à fournir** : la réunion des fiches des sections retenues, plus le socle commun (partie 2).
- **Dépendances** : certaines sections s'appuient sur d'autres si elles sont présentes. Le Résumé exécutif reprend l'Opportunité, l'Analyse de marché, les Produits & services et le Plan financier. Les Objectifs reprennent le Marketing & ventes et le Plan financier. Les Risques reprennent le Plan financier et le Plan opérationnel. Une section retirée ne casse rien, mais ses données ne nourrissent plus les autres : fournissez-les alors dans la description longue.

---

## 4. Fiches par section

Chaque fiche traduit la consigne de la section (`mustCover`) en données à fournir, puis ajoute les exigences propres à chaque destinataire (`lenses`). Entre crochets : la clé du catalogue et le nom canonique.

### Ouverture

#### F1 · Couverture [`cover-page`, *Cover Page*]
Utilisée par tous les modèles sauf le plan stratégique interne.
- `O` Nom de l'entreprise *(création du projet)*.
- `O` Logo *(module Branding)* : c'est la signature de la couverture.
- `R` Couleurs et typographies de la charte.
- La couverture ne porte **aucun chiffre** (ni montant, ni pourcentage, ni indicateur). Date et version sont posées automatiquement.

#### F2 · Résumé exécutif [`executive-summary`, *Executive Summary*]
Utilisée par : SBA, dossier de crédit, amorçage, subvention, incubateur, stratégique interne.
- `O` Une phrase : ce que fait l'entreprise, pour qui, quel résultat.
- `O` Le chiffre qui rend le problème réel (`W` si Opportunité ou Analyse de marché figurent au plan).
- `O` L'offre et le mécanisme qui la fait fonctionner là où d'autres échouent.
- `O` Taille du marché, croissance, segment attaqué en premier (`W` via les sections marché).
- `O` Ce qui qualifie cette équipe pour ce problème *(bios)*.
- `O` Chiffres de tête : chiffre d'affaires à l'horizon, point mort, marge *(module Finance)*.
- `O` Montant demandé, usage, ce qu'il permet *(module Finance + description)*.

Rien n'y est introduit que le plan ne développe ensuite.

**Selon le destinataire.**
- **Banque** : montant demandé et horizon de remboursement en ouverture ; apport personnel et garantie dans le même paragraphe.
- **Investisseur** : taille de l'opportunité et pourquoi maintenant ; traction dans le premier tiers.
- **Bailleur** : bénéficiaires et changement visé, chacun chiffré ; puis montant et cofinancements acquis.

#### F3 · Synthèse en une page [`one-page-summary`, *One-Page Summary*]
Utilisée par : dossier bancaire en 9 points.
- `O` Raison sociale, forme juridique, n° d'immatriculation (RCCM), date de création, siège social, secteur d'activité *(description longue)*.
- `O` Présentation synthétique : historique, produits, créations et développements.
- `O` But ultime poursuivi.
- `O` Ce qui est nécessaire pour l'atteindre : moyens, partenaires, financement.

**Selon le destinataire.**
- **Banque** : identité présente et exacte, sinon le dossier est renvoyé avant lecture.

### L'entreprise

#### F4 · Présentation de l'entreprise [`company-summary`, *Company Summary*]
Utilisée par : IDEM standard, SBA, dossier de crédit, microfinance, stratégique interne.
- `O` Mission en une phrase : ce que fait l'entreprise, pour qui, concrètement.
- `O` Vision, avec un horizon.
- `R` Histoire de la création : le problème rencontré et ce qui l'a rendu digne d'être résolu. Un fait réel : si rien de précis ne s'est passé, dites ce que les fondateurs ont constaté.
- `O` Forme juridique et actionnariat *(description longue)*.
- `O` Dirigeants et ce que chacun apporte à ce problème *(bios)*.
- `R` 4 à 6 valeurs, chacune capable de changer une décision.
- `R` Date de création, effectif, marchés couverts.

**Selon le destinataire.**
- **Banque** : forme juridique, capital et part détenue par chaque associé, précisément : ils déterminent qui est responsable.
- **Investisseur** : l'histoire ne reste que si elle explique pourquoi cette équipe a vu le problème avant les autres ; sinon, plus de place pour les dirigeants.

#### F5 · Mission & vision [`mission-vision`, *Mission & Vision*]
Utilisée par : subvention.
- `O` Mission : qui est servi, ce qui change pour eux, par quels moyens.
- `O` Vision : un horizon et un élément mesurable.
- `R` 4 à 6 valeurs, chacune avec une décision qu'elle interdit.
- `R` Principes qui régissent le fonctionnement au quotidien.

**Selon le destinataire.**
- **Bailleur** : bénéficiaires et changement nommés dans la même phrase que la mission.

#### F6 · Profil du promoteur [`promoter-profile`, *Promoter Profile*]
Utilisée par : dossier de crédit, microfinance.
- `O` Identité, parcours, diplômes *(bio)*.
- `O` Expérience professionnelle et entrepreneuriale en lien avec **cette** activité ; là où elle manque, qui comble le vide.
- `O` Apport personnel : fonds, équipement, local, réseau, avec montant, mode de valorisation et justificatif.
- `R` Motivation, et ce qui a déjà été engagé à ses propres risques.
- `O` Engagements existants et autres activités.

**Selon le destinataire.**
- **Banque** : l'apport personnel est le chiffre pour lequel la section existe. Un promoteur sans apport le dit et explique ce qui le remplace.

#### F7 · Direction & équipe [`management-team`, *Management & Team*]
Utilisée par : SBA, 9 points, dossier de crédit, amorçage, subvention, microfinance, incubateur, stratégique interne.
- `O` Organigramme : qui rend compte à qui, quels postes sont vacants.
- `O` Personnes clés : poste et expérience qui les qualifie *(bios)*.
- `R` La décision que cette équipe est particulièrement apte à bien prendre.
- `O` Plan de recrutement : postes, date, coût (= salaires du module Finance).
- `R` Conseillers, conseil d'administration, expertises externes.
- `O` Lacunes assumées : un plan qui annonce une équipe complète n'est pas cru.

**Selon le destinataire.**
- **Banque** : continuité, avec la seconde signature et la délégation si le promoteur est indisponible trois mois.
- **Investisseur** : l'expérience précise qui fait de chaque fondateur la bonne personne pour ce problème ; le rôle qui manque.
- **Bailleur** : personnel réellement affecté au programme, part de temps, instance de gouvernance.

#### F8 · Cadre juridique et réglementaire [`legal-regulatory`, *Legal & Regulatory Framework*]
Utilisée par : composition libre uniquement.
- `O` Forme juridique choisie et pourquoi, conséquences sur la responsabilité et la fiscalité.
- `O` Actionnariat et structure du capital.
- `O` Pour chaque licence, permis ou agrément : statut (obtenu, demandé le…, à demander). `W` autorité, coût, délai dans le pays.
- `W` Réglementations sectorielles (secteur, données, consommateurs) et évolutions récentes.
- `R` Propriété intellectuelle détenue ou en cours de dépôt.
- `R` Contrats importants : bail, approvisionnement, distribution, travail.

**Selon le destinataire.**
- **Banque** : une activité exercée sans autorisation requise est un motif de refus ; indiquer ce que fait l'entreprise en attendant.

### Le marché

#### F9 · Problème [`problem`, *Problem Statement*]
Utilisée par : amorçage, Lean Canvas, subvention, incubateur.
- `O` Le problème comme fait du monde, pas comme absence de votre produit.
- `O` Qui le subit, à quelle fréquence, ce qu'il coûte en argent ou en temps. `W` statistiques.
- `R` Comment il est traité aujourd'hui et le coût de ces contournements. `W`.
- `R` Pourquoi il n'est pas encore résolu.
- `O` Ce qui a changé récemment et rend la résolution possible.

**Selon le destinataire.**
- **Investisseur** : le changement technologique, réglementaire ou comportemental qui ouvre la fenêtre.
- **Bailleur** : une valeur de référence pour le territoire concerné, pas une moyenne nationale.

#### F10 · Opportunité [`opportunity`, *Opportunity*]
Utilisée par : IDEM standard.
- `O` Le problème et qui le subit.
- `W` Tendances documentées du secteur.
- `R` Pourquoi maintenant.
- `W` TAM, SAM, SOM avec unité, année et dérivation. `R` Vos hypothèses de passage : zone couverte, segments retenus, taux de captation.
- `W` Paysage concurrentiel.
- `O` La différenciation, exprimée comme un mécanisme.
- `O` Segment d'entrée et pourquoi celui-là.

**Selon le destinataire.**
- **Banque** : stabilité, avec une demande qui existait l'an dernier et le comportement du marché en récession.
- **Investisseur** : le SOM atteignable en trois ans avec les fonds levés, pas le plafond théorique.

#### F11 · Analyse de marché [`market-analysis`, *Market Analysis*]
Utilisée par : SBA, 9 points, dossier de crédit, amorçage, microfinance, stratégique interne.
- `O` Quel marché : local, régional, national, international *(portée du projet)*.
- `W` Évolution : volume, chiffre d'affaires, tendance, années des chiffres.
- `R` Clientèle : qui achète, à quelle fréquence, à quel prix. `W`.
- `W` Acteurs présents et forces relatives. `R` Ceux que vous connaissez sur le terrain.
- `W` Structure : concentrée, fragmentée, réglementée.
- `R` Barrières à l'entrée et position du projet face à elles.
- `W` Tendances et évolutions réglementaires à l'horizon du plan.

**Selon le destinataire.**
- **Banque** : la zone de chalandise est le sujet ; demande à portée de l'entreprise et saisonnalité qui affecte la trésorerie `O`.
- **Investisseur** : structure du marché dite honnêtement et ce qu'elle implique (consolidation lente, réaction d'un acteur installé).

#### F12 · Cible [`target-audience`, *Target Audience*]
Utilisée par : IDEM standard, amorçage, Lean Canvas, subvention, incubateur.
- `O` 2 à 3 personas réels (idéalement issus d'entretiens) : nom, âge, rôle, ce qu'ils essaient de faire, ce qui les bloque, ce que le produit change.
- `R` Douleurs classées par ce qu'elles coûtent au client.
- `R` Ce qui déclenche réellement l'achat.
- `W` Taille par segment, comportement d'achat, pouvoir d'achat.
- `R` Parcours client, du premier contact à l'usage récurrent.
- `R` Canaux d'acquisition qui fonctionnent dans ce secteur.

**Selon le destinataire.**
- **Bailleur** : bénéficiaires, avec leur mode d'identification et d'accès, leur nombre dans le périmètre et les critères de vulnérabilité.
- **Investisseur** : segment tête de pont, sa taille, pourquoi il est atteignable en premier.

#### F13 · Analyse concurrentielle [`competition`, *Competitive Analysis*]
Utilisée par : dossier de crédit, amorçage, incubateur, stratégique interne.
- `W` Concurrents directs : taille, offre, prix. `R` Ceux que vous affrontez réellement.
- `W` Concurrents indirects et substituts, y compris « ne rien faire ».
- `R` Les critères que pèse l'acheteur.
- `O` Là où chaque concurrent est fort : au moins un axe concédé.
- `O` L'espace occupé par le projet et pourquoi il est défendable.
- `R` Réaction probable des concurrents et réponse prévue.

**Selon le destinataire.**
- **Banque** : les concurrents installés prouvent la demande ; comment prendre sa part sans guerre des prix impossible à financer.
- **Investisseur** : ce que ferait l'acteur le mieux financé, en combien de temps, et ce qui tient ensuite.

### L'offre

#### F14 · Solution [`solution`, *Solution*]
Utilisée par : amorçage, Lean Canvas, incubateur.
- `O` Ce que fait la solution, dans l'ordre vécu par l'utilisateur.
- `O` Le mécanisme qu'un concurrent ne copie pas en lisant la page.
- `R` L'avant et l'après, mesurés.
- `R` Ce qu'elle ne fait volontairement pas.
- `O` Preuves : pilote, prototype, premiers utilisateurs, validation technique.
- `O` Ce qui reste à construire.

**Selon le destinataire.**
- **Investisseur** : stade sans décoration, en séparant ce qui est en production, en prototype ou en spécification.

#### F15 · Produits & services [`products-services`, *Products & Services*]
Utilisée par : IDEM standard, SBA, dossier de crédit, subvention, microfinance.
- `O` Les offres réelles, décrites par ce qu'elles font pour le client.
- `O` Les caractéristiques qui diffèrent vraiment des alternatives.
- `R` Résultat pour le client : un avant, un après.
- `R` Comparaison aux alternatives sur les critères de l'acheteur.
- `R` Feuille de route datée.
- `O` Tarification : modèle, niveaux, justification de chaque niveau, **mêmes prix que le module Finance**.
- `R` Livraison et support après la vente.

**Selon le destinataire.**
- **Banque** : l'offre qui porte le chiffre d'affaires. Huit produits de poids égal donnent l'image d'une entreprise qui n'a pas choisi.
- **Bailleur** : programmes, avec pour chacun les activités, les bénéficiaires atteints et le coût par bénéficiaire.

#### F16 · Proposition de valeur unique [`value-proposition`, *Unique Value Proposition*]
Utilisée par : amorçage, Lean Canvas.
- `O` Une phrase : pour qui, quel résultat, contrairement à quoi.
- `R` Pourquoi ce client tient plus que tout autre à ce résultat.
- `O` Trois affirmations vérifiables, et la preuve de chacune.
- `O` Positionnement face aux deux alternatives les plus proches.

#### F17 · Avantage déloyal [`unfair-advantage`, *Unfair Advantage*]
Utilisée par : amorçage, Lean Canvas.
- `O` L'avantage précis : données propriétaires, accès exclusif, effet de réseau, position réglementaire, brevet, canal de distribution fermé aux autres, structure de coûts inimitable. S'il n'y en a pas, dites que vous concourez sur l'exécution.
- `O` Pourquoi un concurrent financé ne le reproduit pas en deux ans.
- `R` Comment il se renforce avec la croissance.
- `R` Ce qui l'éroderait, et ce qui le protège.

**Selon le destinataire.**
- **Investisseur** : ce qui tient encore après l'arrivée d'un concurrent financé.

#### F18 · Modèle économique [`business-model`, *Business Model*]
Utilisée par : amorçage, Lean Canvas, incubateur. Reçoit le résumé du module Finance.
- `O` Sources de revenus : quoi, à qui, à quelle fréquence *(module Finance › Produits)*.
- `O` Modèle de prix et ce qui justifie son niveau.
- `O` Économie unitaire : revenu par client, coût de service, marge brute.
- `O` Coût d'acquisition client, mesuré ou déclaré comme hypothèse, et délai de récupération.
- `O` Structure de coûts : ce qui est fixe, ce qui suit le volume *(module Finance)*.
- `R` Comment le modèle s'améliore avec l'échelle, ou pourquoi il ne s'améliore pas.
- `W` Prix pratiqués par les concurrents, marges de référence du secteur.

**Selon le destinataire.**
- **Banque** : marge sur coût variable par unité et base de coûts fixes, qui fixent le volume couvrant l'échéance du prêt.
- **Investisseur** : délai de récupération du CAC, trajectoire de marge brute, ce qui devient structurellement moins cher à dix fois le volume.
- **Bailleur** : si le modèle n'est pas commercial, mix de financement avec sources, part de chacune, durée et risque de non-renouvellement.

### La stratégie

#### F19 · Stratégie & jalons [`strategy-milestones`, *Strategy & Key Milestones*]
Utilisée par : 9 points, stratégique interne.
- `O` Part de marché visée et premiers clients visés.
- `O` Positionnement, formulé comme une décision.
- `O` SWOT : 3 à 5 entrées par quadrant, de vraies faiblesses, chacune avec l'action qui y répond.
- `R` Choix stratégiques : ce qui est poursuivi, ce qui est refusé.
- `O` Étapes clés datées, chacune avec la condition qui déclenche la suivante.

**Selon le destinataire.**
- **Banque** : chaque étape porte la condition de passage et la dépense qu'elle débloque.

#### F20 · Marketing & ventes [`marketing-sales`, *Marketing & Sales*]
Utilisée par : IDEM standard, SBA, 9 points.
- `O` Positionnement et message qui le porte.
- `O` Canaux d'acquisition **nommés**, avec le coût attendu sur chacun (hypothèse de coût par acquisition).
- `O` Processus de vente adapté au ticket : libre-service, vente à distance, terrain.
- `R` Fidélisation : ce qui retient le client et ce que cela coûte.
- `R` Indicateurs pilotés et leur cible.
- `O` Budget réparti par canal, **présent dans les charges du module Finance**.
- `R` Déploiement en phases datées.

**Selon le destinataire.**
- **Banque** : budget marketing au même montant dans la structure de coûts ; un plan commercial qui ne coûte rien dans la projection rend la projection fausse.
- **Bailleur** : sensibilisation plutôt que vente, avec la façon dont les bénéficiaires apprennent l'existence du programme, les relais locaux et le coût pour atteindre les plus éloignés.

#### F21 · Go-to-market [`go-to-market`, *Go-to-Market Strategy*]
Utilisée par : amorçage, incubateur.
- `O` Segment tête de pont et pourquoi celui-là d'abord.
- `O` Comment les premiers clients seront réellement atteints : canaux nommés.
- `R` Mode de vente adapté au ticket.
- `R` Partenariats et distribution qui raccourcissent le chemin.
- `O` Séquence de lancement en phases datées.
- `O` Coût de chaque phase et ce qu'elle doit prouver avant la suivante.

#### F22 · Traction & preuves [`traction`, *Traction & Proof Points*]
Utilisée par : amorçage, incubateur.
- `O` Ce qui existe aujourd'hui en chiffres absolus : utilisateurs, clients, chiffre d'affaires, pilotes, lettres d'intention.
- `O` Courbe de croissance avec la période et la base de calcul.
- `O` Rétention et usage.
- `R` Partenariats, prix, certifications réellement obtenus.
- `R` Ce qui a été appris et ce qui a changé en conséquence.

**Selon le destinataire.**
- **Investisseur** : la rétention décide de la section. Une croissance sans rétention est un seau percé.

#### F23 · Partenariats & écosystème [`partnerships`, *Partnerships & Ecosystem*]
Utilisée par : subvention.
- `O` Partenaires engagés, ce que chacun apporte concrètement, statut (signé, en discussion, identifié).
- `R` Partenaires visés et état de la discussion.
- `R` Ce que le partenariat apporte à chaque partie.
- `O` Fournisseurs et dépendance qu'ils créent.
- `R` Acteurs institutionnels, académiques ou publics impliqués.
- `O` Risque de la dépendance la plus critique, et l'alternative.

**Selon le destinataire.**
- **Bailleur** : pour chaque lettre de soutien ou convention signée, le document, sa date et l'engagement qu'il porte.
- **Banque** : fournisseur unique sans alternative, présenté comme un risque chiffré.

### L'exploitation

#### F24 · Plan opérationnel [`operations-plan`, *Operational Plan*]
Utilisée par : 9 points, dossier de crédit, microfinance, stratégique interne. Reçoit le résumé du module Finance.
- `O` Moyens commerciaux : force de vente, points de vente, distribution, outils.
- `O` Moyens de production : locaux, équipements, capacité, fournisseurs, délais.
- `O` Moyens humains : effectif par fonction, qualifications, masse salariale (= module Finance).
- `O` Processus de production ou de prestation, étape par étape.
- `R` Contrôle qualité et service après-vente.
- `O` Limite de capacité : volume supporté par l'installation actuelle, et coût du palier suivant.

Chaque moyen a un coût, présent au même montant dans le module Finance.

**Selon le destinataire.**
- **Banque** : pour chaque équipement financé, le prix, le fournisseur et le devis d'origine `O`.

#### F25 · Ressources & actifs [`resources-assets`, *Resources & Assets*]
Utilisée par : 9 points.
- `R` Brevets, marques, dessins et modèles : déposés ou accordés, avec numéro.
- `R` Actifs détenus hors de l'exploitation et mobilisables.
- `R` Savoir-faire particulier, et qui le détient.
- `R` Franchises, licences, partenariats produit.
- `O` Ressources propres et familiales engagées dans le projet.
- `R` Produits ou procédés innovants pas encore exploités.

Chaque élément vient avec une valorisation et son justificatif.

**Selon le destinataire.**
- **Banque** : pour chaque actif, indiquer s'il est déjà nanti ailleurs.

#### F26 · Objectifs [`goal-planning`, *Goal Planning*]
Utilisée par : IDEM standard, incubateur, stratégique interne.
- `O` Objectifs stratégiques mesurables et datés.
- `O` Jalons qui les marquent, avec leur livrable.
- `O` Calendrier en phases.
- `R` Ressources par phase : personnes, budget, outils.
- `O` Les risques qui arrêteraient réellement le plan.
- `R` Indicateurs qui diront si cela fonctionne.
- `R` Ce qui se passe si un jalon est manqué.

#### F27 · Indicateurs clés [`kpi-metrics`, *Key Metrics & KPIs*]
Utilisée par : Lean Canvas, stratégique interne.
- `O` Les 3 à 5 indicateurs qui pilotent réellement l'entreprise.
- `O` Pour chacun : valeur actuelle, cible, échéance, méthode de mesure.
- `R` Indicateurs avancés, qui bougent avant les résultats.
- `O` Cadence de revue et responsable de chaque indicateur.
- `R` Seuil à partir duquel le plan est révisé.

#### F28 · Risques [`risk-analysis`, *Risk Analysis & Mitigation*]
Utilisée par : dossier de crédit, stratégique interne.
- `O` Les risques qui arrêteraient le plan (marché, opérationnel, financier, réglementaire, humain), propres à cette entreprise dans ce pays.
- `O` Pour chacun : probabilité, impact, premier signal.
- `O` Parade en place, et celle qui serait activée.
- `R` Scénario où deux risques surviennent ensemble.
- `R` Assurances, réserves, clauses, protections contractuelles.

**Selon le destinataire.**
- **Banque** : scénario d'un chiffre d'affaires 20 % sous le plan pendant un an. La dette est-elle encore servie, et que coupe-t-on d'abord ?

### Les finances

#### F29 · Plan financier [`financial-plan`, *Financial Plan*]
Utilisée par : tous les modèles. Reçoit les tableaux posés par le serveur et le résumé du module Finance.
- `O` Module Finance rempli et calculé (partie 2.4).
- `O` Ce sur quoi repose le modèle : pourquoi ces volumes sont atteignables sur **ce** marché *(description, notes des produits)*.
- `O` Montant demandé, ce qu'il finance, comment il est remboursé (voir 1.3).
- `R` Risques financiers, chacun avec ce qui l'absorbe : clause, réserve, coût compressible, contrat renégociable.
- `R` Hypothèses de chaque levier : délai d'encaissement, coût du prêt.
- `W` Marges et structures de coûts de référence du secteur, prix des concurrents.

Le serveur produit à partir du module : coût variable/fixe, seuil de rentabilité et point mort, référentiel comptable et libellés d'exercice.

**Selon le destinataire.**
- **Banque** : trésorerie mensuelle sur les 12 à 18 premiers mois, service de la dette, mois au plus bas, ratio de couverture, scénario à −20 %. Saisissez des ventes et des charges mensuelles réalistes (saisonnalité).
- **Investisseur** : burn mensuel actuel, runway après le tour, jalon à atteindre avant le suivant, trajectoire de marge brute.
- **Bailleur** : budget par ligne de programme, ce que chaque ligne produit, coût par bénéficiaire, part couverte par la demande face aux cofinancements acquis *(description longue : le module ne découpe pas par programme)*.

#### F30 · Demande de financement [`funding-request`, *Funding Request & Use of Funds*]
Utilisée par : SBA, dossier de crédit, amorçage, subvention, microfinance. Reçoit le résumé du module Finance.
- `O` Montant, dans la devise du module (= besoin de financement, voir 1.3).
- `O` Forme : fonds propres, prêt, subvention, garantie, ou combinaison.
- `O` Conditions attendues : taux, durée, différé, dilution.
- `O` Utilisation des fonds par ligne, chaque ligne liée à un jalon.
- `R` Autonomie financière que le montant procure, et ce qui doit être vrai à la fin.
- `O` Remboursement (échéancier) ou chemin vers la liquidité (fonds propres).
- `O` Ce qui a déjà été apporté, et par qui.

**Selon le destinataire.**
- **Banque** : durée, différé et échéancier, avec la trésorerie projetée qui couvre chaque échéance ; apport personnel en % du besoin total, ou son absence expliquée.
- **Investisseur** : taille du tour, instrument, ce que le tour doit prouver ; valorisation seulement si les fondateurs ont une position.
- **Bailleur** : coût total du programme, part demandée, chaque cofinanceur nommé avec le statut de son engagement.

#### F31 · Garanties & sûretés [`guarantees`, *Guarantees & Collateral*]
Utilisée par : dossier de crédit, microfinance. Reçoit le résumé du module Finance.
- `O` Garanties offertes : nature, détenteur, valeur, méthode et auteur de l'évaluation.
- `O` Apport personnel et part du besoin total qu'il couvre.
- `O` Engagements et sûretés déjà donnés ailleurs.
- `W` Fonds de garantie, dispositifs publics ou mutuelles de garantie du pays, avec leur taux de couverture. `R` Ceux déjà sollicités.
- `O` Capacité de remboursement : ratio calculé à partir du module Finance.
- `R` Évolution de la garantie à mesure que le prêt s'amortit.

Une valorisation surévaluée est découverte à l'expertise et met fin au dossier.

#### F32 · Stratégie de sortie [`exit-strategy`, *Exit Strategy & Investor Returns*]
Utilisée par : amorçage. Reçoit le résumé du module Finance.
- `O` Voies de sortie réalistes pour ce type d'entreprise sur ce marché : cession industrielle, cession secondaire, rachat, dividendes, introduction en bourse.
- `O` Horizon, et ce à quoi l'entreprise doit ressembler à ce moment-là.
- `W` Transactions comparables du secteur avec multiples et dates. `R` Acquéreurs actifs que vous connaissez.
- `O` Rendement implicite pour un investisseur entrant maintenant : valorisation d'entrée et montant *(description)*, nombre d'actions et taux de distribution *(module Finance › Ratios)*. Un multiple non sourcé est présenté comme hypothèse.
- `R` Scénario sans sortie, et ce que détient alors l'investisseur.

### L'impact

#### F33 · Théorie du changement [`theory-of-change`, *Theory of Change*]
Utilisée par : subvention.
- `O` Le problème et ses causes profondes, pas ses symptômes.
- `O` Intrants : ce qui est investi.
- `O` Activités : ce qui en est fait.
- `O` Réalisations : ce qui est produit, dénombrable.
- `O` Effets : ce qui change pour les bénéficiaires, mesurable.
- `O` Impact : le changement de long terme visé.
- `O` Hypothèse sur laquelle repose chaque lien, surtout entre réalisations et effets (former des personnes n'est pas leur trouver un emploi).

#### F34 · Impact social & économique [`impact`, *Social & Economic Impact*]
Utilisée par : subvention, microfinance.
- `O` Emplois directs par année et par niveau de qualification (= postes de la masse salariale).
- `R` Effets indirects sur l'économie locale : fournisseurs, sous-traitants, impôts.
- `O` Bénéficiaires servis et ce qui change pour eux, de façon mesurable.
- `O` Effet environnemental, positif et négatif, et ce qui limite le négatif.
- `R` Contribution aux priorités de développement locales ou nationales, nommées. `W`.
- `O` Méthode de mesure de chacun de ces effets.

**Selon le destinataire.**
- **Banque** : emplois créés et impôts générés par année, avec la qualification, car c'est sur eux que sont évaluées les garanties publiques et les lignes bonifiées.

#### F35 · Suivi & évaluation [`monitoring-evaluation`, *Monitoring & Evaluation*]
Utilisée par : subvention.
- `O` Indicateurs suivis, alignés sur les effets annoncés.
- `O` Pour chacun : valeur de référence, cible, fréquence, source de données, personne qui collecte. Une valeur de référence qui n'existe pas encore devient la première activité du programme, jamais une invention.
- `R` Dispositif d'évaluation : revue interne, évaluation externe, groupe témoin.
- `O` Calendrier de reporting et destinataires de chaque rapport.
- `R` Comment les résultats reviennent dans le programme.
- `O` Budget alloué à la mesure.

#### F36 · Pérennité [`sustainability`, *Sustainability Plan*]
Utilisée par : subvention. Reçoit le résumé du module Finance.
- `O` Mix de revenus actuel et dépendance qu'il crée envers un financeur.
- `O` Mix cible à l'horizon et comment on y parvient.
- `O` Revenus propres, recouvrement de coûts ou activité commerciale en développement.
- `R` Structure de coûts et ce qui peut être réduit sans arrêter la mission.
- `R` Politique de réserves et nombre de mois couverts.
- `O` Scénario de retrait du bailleur principal, et la réponse.
- `O` Sources visées : nom, montant, date de conclusion attendue. « Nous diversifierons nos financements » n'est pas un plan.

### La clôture

#### F37 · Annexes [`appendix`, *Appendix*]
Utilisée par : IDEM standard, SBA, dossier de crédit, amorçage, subvention, microfinance.
- `R` Sources des chiffres, nommées et datées. La bibliographie « Ressources » est ajoutée automatiquement en fin de document quand des sections citent des sources web.
- Tableaux détaillés et glossaire du secteur : produits à partir du reste du plan.
- `R` Éléments réglementaires ou juridiques qui concernent l'activité.

Rien de nouveau n'est introduit en annexe.

**Selon le destinataire.**
- **Banque** : liste des pièces qui accompagneront le dossier (devis, baux, relevés, certificat d'immatriculation) avec date et émetteur, même non jointes `O`.

---

## Annexe A · Modèle de description longue

À recopier dans la description longue du projet, en ne gardant que les rubriques utiles au type de plan choisi. Tout ce qui est écrit ici est lu par **toutes** les sections.

```text
IDENTITÉ JURIDIQUE
- Raison sociale : …            Nom commercial : …
- Forme juridique : SARL / SAS / SA / Entreprise individuelle / GIE / Association / Coopérative
- N° RCCM : …   N° contribuable : …   Date de création : …
- Siège social : …   Capital social : … (devise)
- Associés et parts : Nom — % ; Nom — %

ACTIVITÉ ET STADE
- Ce que nous vendons, à qui, où : …
- Stade : idée / prototype / pilote / en activité depuis (mois, année)
- Ce qui a changé récemment et rend le projet possible maintenant : …

PROMOTEUR
- Apport personnel : montant … ; nature (numéraire, matériel, local, fonds de commerce) ;
  mode de valorisation … ; justificatif …
- Autres activités, prêts en cours, cautions déjà données : …

CLIENTS ET PREUVES
- Clients ou utilisateurs actuels (chiffres absolus) : …   Chiffre d'affaires réalisé : … sur …
- Rétention / réachat : …
- Contrats signés, bons de commande, lettres d'intention : …
- Pilotes, prix, certifications obtenus : …

MARCHÉ ET CONCURRENCE (ce que vous savez du terrain)
- Zone de chalandise : …   Saisonnalité : …
- Concurrents : nom — prix — force — faiblesse
- Part de marché visée et hypothèse qui la fonde : …

OPÉRATIONS
- Locaux : surface, loyer, bail jusqu'au …
- Équipements : désignation — prix — fournisseur — devis (n°, date)
- Capacité maximale actuelle : … par mois   Coût du palier suivant : …
- Fournisseurs clés et alternative pour chacun : …

AUTORISATIONS
- Licence / agrément : obtenu le … / demandé le … / à demander — autorité — coût

PARTENAIRES
- Nom — apport concret — statut (signé le … / en discussion / identifié)

FINANCEMENT RECHERCHÉ
- Montant sollicité : …   Forme : prêt / fonds propres / subvention   Auprès de : …
- Conditions : durée …, taux …, différé … mois — ou instrument, dilution acceptée
- Si le prêt est saisi en CMT dans le module Finance : « ce CMT est le concours sollicité, non encore accordé »
- Utilisation : ligne — montant — jalon
- Garanties offertes : nature — valeur — évaluée par — déjà nantie (oui / non)

PILOTAGE
- Objectifs datés : …
- Indicateurs (3 à 5) : valeur actuelle → cible, échéance, responsable
- Risques principaux : risque — premier signal — parade

IMPACT (subvention, microfinance)
- Bénéficiaires : qui, combien, comment identifiés et atteints
- Indicateurs : valeur de référence → cible, méthode de collecte
- Cofinancements : financeur — montant — statut
- Budget par ligne de programme : ligne — montant — bénéficiaires
```

---

## Annexe B · Écarts relevés dans le code

Ces écarts expliquent pourquoi une partie des données doit aujourd'hui passer par la description longue. Chacun est une piste de champ à ajouter.

1. **Données d'onboarding non transmises.** `extractProjectDescription` ([../common/generic.service.ts](../common/generic.service.ts)) ne lit que le nom, la description, le type, la portée et les cibles. La taille d'équipe, la fourchette de budget et les contraintes sont perdues pour le plan.
2. **Contexte juridique non transmis.** Le contexte du module Documents juridiques (forme juridique, capital, associés et parts, siège, site web) n'est lu nulle part dans `services/BusinessPlan`.
3. **Aucun champ pour les données bancaires clés.** Rien ne recueille le RCCM, la date de création, l'apport personnel, les garanties, la traction, les partenaires, les licences, les bénéficiaires ou les risques. Or les consignes des modèles bancaires et de subvention en font leur premier critère.
4. **Ressource sollicitée indiscernable d'une ressource acquise.** `computeFinancing` ([../Finance/finance-calculator.service.ts](../Finance/finance-calculator.service.ts)) additionne toutes les ressources saisies. Un prêt saisi en CMT pour obtenir son service de la dette annule le besoin de financement et passe pour obtenu (voir 1.3).
5. **Trésorerie mensuelle et burn non transmis.** Les lentilles banque et investisseur exigent la trésorerie mensuelle, le burn et le runway. `buildFinanceNarrative` ([../Finance/finance-blocks.ts](../Finance/finance-blocks.ts)) ne transmet que la trésorerie de clôture annuelle, alors que le module calcule des séries mensuelles. Le modèle doit donc les reconstruire ou les supposer.
6. **Budget par programme absent.** La lentille bailleur demande un budget par ligne de programme et un coût par bénéficiaire, que le module Finance, organisé par nature comptable, ne produit pas.
7. **Différé de remboursement non modélisé.** `LoanParams` n'a pas de période de différé, alors que la Demande de financement doit l'indiquer pour une banque.
