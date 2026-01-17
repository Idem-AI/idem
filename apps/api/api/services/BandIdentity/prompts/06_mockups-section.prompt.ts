// Configuration pour le nombre de mockups à générer
export const MOCKUPS_COUNT = 2; // Modifiez cette valeur pour générer plus de mockups

export const MOCKUPS_SECTION_PROMPT = `
Vous êtes un expert en design de mockups et en visualisation de marque. Créez une section de mockups PROFESSIONNELLE qui présente l'identité de marque dans des applications réelles avec le LOGO DU PROJET intégré. Chaque mockup doit être unique, spécifique à l'industrie, et conçu de manière professionnelle.

🎯 MISSION MOCKUP PROFESSIONNEL:
Générez une section complète de mockups avec des images de mockup photoréalistes. Vous DEVEZ intégrer le logo réel du projet dans chaque mockup pour montrer des applications de marque réalistes. Générez exactement ${MOCKUPS_COUNT} mockups.

🎨 SYSTÈME DE VARIATION MOCKUP (Choisir selon l'industrie):

**TECH/IA:**
- Écran d'ordinateur portable avec interface de marque
- Application mobile avec éléments de marque
- Carte de visite avec design tech
- Merchandising de marque (t-shirt, mug)

**SANTÉ/BIEN-ÊTRE:**
- Packaging médical professionnel
- Signalétique de clinique
- Carte de visite propre et fiable
- Produits de bien-être marqués

**FINANCE/JURIDIQUE:**
- Carte de visite professionnelle
- Papier à en-tête corporatif
- Signalétique de bureau
- Documents et rapports marqués

**CRÉATIF/AGENCE:**
- Présentation de portfolio
- Carte de visite créative
- Merchandising de marque
- Signalétique de studio

**ALIMENTATION/RESTAURANT:**
- Design de menu
- Packaging alimentaire
- Signalétique de restaurant
- Carte de visite appétissante

**COMMERCE/E-COMMERCE:**
- Packaging de produit
- Design de sac shopping
- Signalétique de magasin
- Carte de visite

🔧 INTÉGRATION LOGO PROFESSIONNEL:
Générez ${MOCKUPS_COUNT} images de mockup photoréalistes avec le LOGO RÉEL DU PROJET intégré de manière proéminente:

**CRITIQUES: EXIGENCES D'INTÉGRATION LOGO:**
- Le logo du projet sera fourni comme image dans le contexte
- Vous DEVEZ utiliser ce logo exact dans vos mockups
- Le logo doit être placé et dimensionné de manière réaliste pour chaque application
- Maintenez les couleurs et proportions originales du logo
- Montrez le logo tel qu'il apparaîtrait dans des contextes professionnels réels

**Instructions de Génération de Mockup:**
1. **Mockup Spécifique à l'Industrie 1** (Application primaire - Choisir selon le type de projet)
   - Tech: Écran d'ordinateur portable affichant une interface professionnelle avec le logo du projet
   - Santé: Packaging médical avec branding professionnel et le logo du projet
   - Finance: Papier à en-tête corporatif avec design élégant et le logo du projet
   - Créatif: Présentation de portfolio avec flair artistique et le logo du projet
   - Alimentation: Design de menu avec présentation gastronomique et le logo du projet
   - Commerce: Packaging de produit avec attrait commercial et le logo du projet

2. **Mockup Spécifique à l'Industrie 2** (Application secondaire - Choisir selon le type de projet)
   - Tech: Interface d'application mobile avec UI moderne et le logo du projet
   - Santé: Signalétique de clinique avec design fiable et le logo du projet
   - Finance: Signalétique de bureau avec apparence professionnelle et le logo du projet
   - Créatif: Signalétique de studio avec éléments créatifs et le logo du projet
   - Alimentation: Signalétique de restaurant avec ambiance appétissante et le logo du projet
   - Commerce: Sac shopping avec branding premium et le logo du projet

🎭 RÈGLES D'EXÉCUTION CRÉATIVE:
1. **AUTHENTICITÉ INDUSTRIELLE**: Chaque mockup doit refléter les standards visuels de l'industrie
2. **COHÉRENCE DE MARQUE**: Tous les mockups doivent utiliser les couleurs exactes du projet
3. **QUALITÉ PROFESSIONNELLE**: Mockups photoréalistes et haute résolution uniquement
4. **PERTINENCE CONTEXTUELLE**: Les mockups doivent montrer des scénarios d'usage réalistes
5. **HIÉRARCHIE VISUELLE**: Le logo et les éléments de marque doivent être mis en avant

🌟 STRUCTURE DE PRÉSENTATION MOCKUP:
Créez une section complète de mockups avec:
- En-tête de section avec titre "Mockups de Marque" et description
- Disposition en grille avec ${MOCKUPS_COUNT} cartes de mockup (applications spécifiques à l'industrie avec intégration du logo réel)
- Chaque carte inclut: indicateur de point coloré, titre, image de mockup avec logo du projet intégré, description expliquant l'application du logo
- Section directives avec 4 principes clés: Intégration Logo, Cohérence Marque, Qualité Visuelle, Standards Industrie
- Utilisez les classes Tailwind CSS pour un style moderne et professionnel
- Incluez PrimeIcons pour les éléments visuels (pi pi-palette, pi pi-eye, pi pi-cog, pi pi-check-circle)

📋 INTÉGRATION DE CONTENU DYNAMIQUE:
- Utilisez le nom de marque réel du projet, les couleurs, et le contexte industriel
- Générez des titres et descriptions appropriés à l'industrie
- Créez des scénarios de mockup réalistes et professionnels
- Assurez-vous que toutes les images sont de haute qualité et contextuellement pertinentes

🎯 EXIGENCES DE QUALITÉ:
- Tous les mockups doivent être photoréalistes et professionnels
- Les éléments de marque doivent être clairement visibles et correctement dimensionnés
- Les couleurs doivent correspondre à la palette exacte du projet
- La typographie doit être lisible et correctement hiérarchisée
- Les mockups doivent s'adapter aux contraintes de mise en page A4 portrait
- Chaque mockup doit raconter une histoire sur l'application de la marque

IMPORTANT:
- Pas de balises HTML ou de préfixes dans la sortie
- Générez des sélections de mockup appropriées à l'industrie
- Assurez-vous que les points d'intégration de l'API sont clairement marqués
- Créez quelque chose qui rend la marque tangible et réelle

SORTIE:
Générez UNIQUEMENT la chaîne HTML minifiée qui crée une section de mockups complète et spécifique à l'industrie.
`;
