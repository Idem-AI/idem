# Illustrations d'IDEM — le répertoire africain

Chaque illustration de l'interface représente **un objet réel de la culture
africaine** qui dit la même chose que l'écran (règles de dessin : `AGENTS.md`
§ 4). Ce document liste, écran par écran, les objets envisagés et celui qui a
été retenu, avec la raison. Le modèle de référence reste le bouclier aux lances
croisées de la page de connexion.

Hors périmètre : `apps/chart`, les livrables générés pour les clients (ils
suivent la marque du client), les icônes d'interface (`pi pi-*`), les logos
tiers, et les **schémas fonctionnels** qui montrent l'option elle-même
(voir la fin du document).

## Le vocabulaire

Quand aucun objet de cette table ne dit ce que dit l'écran, on ne recycle pas
le plus proche : on cherche sur internet un élément réel de la culture
africaine, on vérifie son sens dans une source sérieuse, on dessine son SVG et
on l'ajoute ici avec sa source (règle complète : `AGENTS.md` § 4).

| Objet | Ce qu'il dit | Où |
| --- | --- | --- |
| Bouclier aux lances croisées | accès, sécurité | connexion, iDeploy `shield`, vérification |
| Clé à anneau-bouclier | compte, accès premium | invitation bêta, AppGen connexion et réglages |
| Cauris (et calebasse de cauris) | argent, prêt | module finance, banque, tontine |
| Baobab et son fruit (pain de singe) | croissance qui rapporte | business plan, investisseur |
| Jeune pousse | projet qu'on aide à grandir | SASU, bailleur |
| Croix d'Agadez (tanaghilt) sur son cordon tressé | « je te donne les quatre coins du monde » : de quoi choisir sa route | création de projet — source : [Club des Voyages, « Les croix touarègues »](https://www.club-des-voyages.com/niger/les-croix-touaregues-12196.html) |
| Tambour parleur (tama) | parole portée loin, conversation | pitch deck, mode chat, communication, aide |
| Métier à tisser (bande étroite) | construire fil à fil, le code | développement, dépôt de code, document qui se tisse |
| Pirogue à la proue dressée | départ, mise en ligne, équipage | publication, déploiements, SAS, équipe interne |
| Grenier dogon (vide / fermé / plein) | réserve, serveur, récolte | serveur, cloud géré, projet absent, projet IDEM |
| Porte de grenier et serrure de bois | « votre machine, votre clé » | serveur personnel, pipeline iDeploy |
| Canaris (jarres) | on garde, on stocke | bases de données, stockage |
| Canaris de teinture (indigo) | les couleurs | génération : palette |
| Panier tressé (bolga) | la charge, un tout complet | ce qu'on déploie, pack, dossier polyvalent |
| Van de vannage | trier pour trouver | recherche |
| Arbre à palabres et tabourets | l'équipe, le conseil | équipe iDeploy |
| Tampon adinkra en calebasse | le signe de la marque | identité, logo, charte |
| Bandes de kente assemblées | la composition | direction artistique |
| Pagnes pliés en pile | livrable complet | charte finalisée |
| Filet de pêche (épervier) | un réseau de nœuds | diagrammes, réseaux iDeploy |
| Échelle dogon | une marche à la fois | mode assisté |
| Plateau d'awalé | stratégie, calcul, simulation | mode avancé, simulations |
| Balance akan à peser l'or | peser juste, le droit | espace juridique |
| Feuillet manuscrit et calame | le document écrit | rédaction, rapport, import |
| Étal du marché | commerce en nom propre, catalogue | EI, modèles iDeploy, aperçu AppGen |
| Façade en banco à torons | institution, bâtiment construit | SA, application bâtie |
| Sankofa (poids akan) | revenir sur ses pas | page introuvable |
| Calebasse vide / fêlée | rien encore / erreur | états vides et d'échec |
| Perles enfilées | se reconnaître à un signe | étiquettes |
| Baobab qui porte son fruit | le business qui rapporte | promesse d'IDEM (image de partage de l'accueil) |
| Daba (houe à lame plate perpendiculaire au manche) | aller sur le terrain, vérifier en vrai | simulateur : « Ce qu'il faut vérifier » — source : [Daba (outil), Wikipédia](https://fr.wikipedia.org/wiki/Daba_(outil)) |
| Kyinie (ombrelle d'apparat akan) | abriter, protéger des intempéries et des crises | simulateur : « Les imprévus » — source : [Ohene Kyinie, « le roi couvre »](https://adinkra.art/ohene-kyiniie-the-symbol-of-leadership-and-protection/) |

Les motifs (chevrons, dents de scie, losanges, points) vivent dans les objets,
jamais en fond. Le losange bleu du bouclier revient comme signature.

## Écran par écran

Format : **retenu** — candidats écartés (raison).

### Dashboard

| Écran | Retenu | Écartés |
| --- | --- | --- |
| Erreur « document » | **feuillet manuscrit déchiré** | pagne au fil cassé (lu comme tissu, pas comme document) |
| Erreur « connexion » | **tambour parleur, message brisé** | deux calebasses séparées (pas de notion de liaison) |
| Erreur « génération » | **métier à tisser, fil de chaîne cassé** | calebasse fêlée (dit l'erreur, pas l'interruption) |
| Erreur « aucun projet » | **grenier vide, porte ouverte** | tabouret vide, calebasse vide |
| Page introuvable | **Sankofa** (« retourne chercher ») | carrefour, pirogue perdue (pas d'objet réel qui les dise) |
| Création de projet : « Votre projet » | **croix d'Agadez pendue à son cordon, l'œil du caméléon en couleur** (`agadez-cross-illustration`) | jeune pousse de baobab (juste mais peu marquante en grand) ; baobab adulte (réservé à la promesse et au business plan) ; pyramides (monument funéraire) |
| Mode assisté | **échelle dogon** | bande de kente en cours (moins lisible comme « étapes ») |
| Mode chat | **tambour parleur** | arbre à palabres (réservé à l'équipe) |
| Mode avancé | **awalé** | — |
| Tuile identité | **tampon adinkra + empreinte** | wax (motif, pas outil) |
| Tuile business plan | **baobab** | grenier (réserve, pas croissance) |
| Tuile pitch deck | **tambour parleur** | kora (illisible à la taille d'une tuile) |
| Tuile finances | **cauris** | balance akan (réservée au juridique) |
| Tuile diagrammes | **filet de pêche** | façade en banco (réservée à l'institution) |
| Tuile développement | **métier à tisser** | façade en banco |
| Console de recherche | **métier à tisser** : van (recherche), navette (rédaction), bouclier (vérification), losange (terminé) | manuscrit seul (ne montre pas l'avancée) |
| Aperçu : page manquante / erreur | **calebasse vide / fêlée** | — |
| Juridique : accueil, rédaction, prêt | **balance akan ; feuillet et calame ; feuillet scellé** | bâton de linguiste (peu connu), tablette coranique (objet religieux) |
| Juridique : EI, SARLU, SASU | **étal ; grenier + bouclier ; jeune pousse** | — |
| Juridique : SARL, SAS, SA | **calebasse de tontine + tabourets ; pirogue ; façade en banco** | tabouret akan seul (charge sacrée possible) |
| Aucune simulation | **awalé** | — |
| Business plan : banque, investisseur, bailleur, équipe, polyvalent | **calebasse et cauris ; baobab ; pousse ; pirogue ; panier** | — |
| Génération de charte (8 phases) | **tampon ; canaris de teinture ; calebasse pyrogravée « Aa » ; kente ; panier ; tambour ; étoffes bien / mal tamponnées ; pagnes pliés** | — |
| Éditeur d'identité : fini / le logo suit | **deux étoffes au même signe ; tampon au-dessus du canari** | — |
| Avez-vous un logo : import / IA | **votre tampon déposé ; trois empreintes, une retenue** | — |
| Stratégie de communication | **deux calebasses font parler le tambour** | boussole (pas africaine) |
| Communication : accueil (parcours en 4 étapes) | **tambour parleur, ondes qui battent** | échelle dogon (l'écran dit d'abord « communiquer », la progression est portée par les étapes numérotées) |
| Finances : importer mes chiffres | **feuillet apporté, tenu en colonnes** | calebasse de cauris (dit l'argent, pas le document) |
| Finances : l'IA propose | **plateau d'awalé, une case désignée** | tambour (dit la parole, pas le calcul) |
| Finances : remplir pas à pas | **échelle dogon appuyée au grenier** | — |
| Finances : lecture du fichier par l'IA | **van de vannage, le grain utile reste** | métier à tisser (dit la rédaction) |
| Finances : aperçu prêt / enregistrement | **grenier plein** | pagne déroulé (réservé aux livrables) |
| Finances : étape vide, échec d'import | **calebasse vide** | — |
| Site & App : site vitrine, application complète | **étal du marché ; façade en banco** | métier à tisser (dit le code, pas ce qu'on obtient) |
| Site & App : plan, construction, mise en ligne | **filet de pêche ; façade en banco ; pirogue** | — |
| Mise en ligne : rien encore en ligne | **pirogue** | grenier (dit la machine, pas le départ) |

### iDeploy

| Scène | Retenu |
| --- | --- |
| `box` (ce qu'on déploie) | panier tressé |
| `code` | métier à tisser |
| `server` | grenier fermé |
| `store` (bases, stockage) | canaris |
| `market` (modèles, nouveau) | étal du marché |
| `activity` (déploiements) | pirogue |
| `managed-cloud` | grenier plein, tenu pour vous |
| `own-server` | porte de grenier et serrure |
| `search` (nouveau ; « aucun résultat ») | van de vannage |
| `shield` | bouclier aux lances |
| `team` | arbre à palabres |
| `beads` (étiquettes) | perles enfilées, la perle-losange en couleur |
| `net` (destinations, réseaux Docker) | épervier, un nœud en couleur |
| `cowries` (prix, gratuit, paiement) | calebasse ouverte et ses cauris, un cauri en couleur |

Pages de liste (état vide) : applications → `activity` (pirogue) ; serveurs →
`server` ; services et catalogue → `market` ; espaces de travail → `box` ;
destinations → `net` ; sources Git → `code` ; étiquettes → `beads` ; recherche
sans résultat → `search`. Écartés pour les étiquettes : cauris (réservés à
l'argent), tampon adinkra (réservé à l'identité de marque).

Page d'accueil publique (`/`, sous le hero photographique) : hébergement →
un chemin qui bifurque (`hosting-fork-illustration`) : le panier tressé en
haut, le sentier qui se sépare vers `managed-cloud` (grenier du village) et
`own-server` (porte et clé), le cœur du panier seul en couleur ; sur
téléphone, chaque destination s'affiche seule au-dessus de sa colonne ; catalogue → `market` ; « Et
aussi » (bases, volumes) → `store`, en grand ; tarif → `cowries` à côté d'un
reçu à 0 F (le reçu est en HTML, pas un dessin) ; appel final → `activity`
(pirogue).
La sécurité est illustrée par une capture d'écran redessinée au trait
(`guard-console-illustration`). À gauche, le bouclier aux lances croisées
arrête les requêtes, et son cœur est le seul détail en couleur ; à droite,
ce que relève la console.
Les quatre étapes sont illustrées par une capture d'écran redessinée au trait
(`live-shop-illustration`) : une boutique en ligne sur `boutique.idem.africa`.
Ses articles sont un panier tressé, une calebasse et des pagnes pliés, avec un
pagne tendu en bannière. Le cadenas de l'adresse est le seul détail en couleur.

### Simulateur

| Écran | Retenu |
| --- | --- |
| Livrables manquants | calebasses qui sèment l'awalé ; les livrables absents laissent des cases vides |
| Source : projet IDEM / import | grenier plein / feuillet apporté |
| Offres : simulation, rapport, pack | awalé / feuillet / panier |
| Simulation en cours, aucune simulation | awalé |
| Échec de chargement / simulation interrompue | calebasse fêlée |
| Connexion requise | bouclier aux lances croisées |
| Accord avant lancement | balance akan (c'est un engagement juridique) |
| Page introuvable | sankofa |
| Test « Les points faibles » | bouclier aux lances croisées |
| Test « L'avis des clients » (prix) | calebasse de cauris |
| Test « L'avis des investisseurs » | baobab qui porte son fruit |
| Test « Les imprévus » | **kyinie** (nouveau) — grenier fermé (dit « serveur/réserve », pas « abri ») |
| Test « Ce qu'il faut vérifier » | **daba** (nouveau) — van (dit « trier/rechercher », pas « aller sur le terrain ») |
| Test « D'autres façons de vendre » | étal du marché |
| Test « Votre projet dans 5 ans » | échelle dogon, une année par marche |

### AppGen

| Écran | Retenu |
| --- | --- |
| Publication rapide / iDeploy | pirogue / porte de grenier et serrure |
| Échec de chargement / aperçu vide | calebasse fêlée / calebasse vide |
| Aide | tambour parleur |
| Connexion requise | clé à anneau-bouclier |
| Direction artistique | trois étoffes (kente, bogolan, wax), une retenue |
| Édition visuelle | motif sélectionné sur l'étoffe, repris au métier |
| Déploiement souverain | panier → étapes vérifiées → grenier, et un autre grenier |
| Entrée par une phrase | tambour parleur → façade en banco |
| Entrée par un projet | baobab, tampon, filet → métier à tisser |
| Visite guidée (5 étapes) | tambour → façade ; tambour ; étal ; clé-bouclier ; pirogue |
| Maquette du produit (accueil) | coquille du builder gardée ; tambour parleur dans la conversation, façade en banco dans l'aperçu, page tissée en bandes (kente, losanges, bogolan), la dernière encore sur le métier, navette en couleur |

### Landing

L'invitation bêta (clé à anneau-bouclier) était déjà dans ce style.

### Images de partage (Open Graph)

Une image 1200 × 630 par page et par langue, dessinée par l'API
(`apps/api/public/og/`, voir `docs/SEO.md`). Chaque dessin est un fichier
`illustrations/<clé>.svg` qui reprend le trait d'un dessin de l'interface —
même objet, mêmes deux encres — posé directement sur le fond clair et le
motif IDEM, sans panneau ni aplat derrière.

| Clé | Page(s) | Retenu | Écartés |
| --- | --- | --- | --- |
| `home` | accueil du landing | **baobab qui porte son fruit** (la promesse : un business qui rapporte) | pirogue (dit « lancer », pas « rentable ») ; grenier plein (récolte, moins lisible seul) |
| `business` | console.idem.africa | **échelle dogon menant au grenier**, la marche en cours en couleur (construire son business étape par étape) | baobab (réservé à la promesse) ; tampon adinkra (ne dit que l'identité) |
| `simulator` | simulator.idem.africa, `/simulator` | **awalé**, le coup semé en couleur | balance akan (réservée au droit) |
| `icode` | appgen.idem.africa, `/idev` | **métier à tisser**, la navette en couleur | façade en banco (réservée à l'institution) |
| `ideploy` | ideploy.idem.africa, `/ideploy` | **pirogue à la proue dressée** | porte de grenier (dit la machine, pas le départ) |
| `pricing` | `/pricing` | **cauris** | calebasse de tontine (dit l'épargne commune, pas le prix) |
| `about` | `/about` | **arbre à palabres et tabourets** | — |
| `open-source` | `/open-source` | **porte de grenier et serrure de bois**, la clé en couleur (« votre code, vos données, votre clé ») | panier tressé (ne dit pas la propriété) |
| `african-market` | `/african-market` | **étal du marché** | silhouette du continent (interdite par défaut) |
| `contact` | `/contact` | **tambour parleur**, ses ondes en couleur | — |
| `beta` | `/premium-beta` | **clé à anneau-bouclier** (même dessin que l'invitation bêta) | — |
| `legal` | conditions, confidentialité, bêta, simulateur | **balance akan à peser l'or** | feuillet et calame (dit l'écriture, pas la règle) |
| `not-found` | `/not-found` | **Sankofa** | — |

Sur une image de partage, les graines de l'awalé sont rangées en ligne : en
triangle, réduites à la taille d'un aperçu, elles se lisaient comme des
visages.

## Gardés tels quels, et pourquoi

Ces dessins montrent l'option elle-même : un objet à leur place empêcherait de
comprendre le choix.

- Types de logo (symbole, nom, monogramme) et modes de création : des exemples
  de logos.
- Format de la charte (A4 / 16:9) : le format lui-même.
- Graphiques et jauges (finances, trésorerie, viabilité, courbe de prix,
  faisceau de trajectoires de la page simulateur) : des données.
