// Configuration pour le nombre de mockups à générer
export const MOCKUPS_COUNT = 2; // Modifiez cette valeur pour générer plus de mockups

export const MOCKUPS_SECTION_PROMPT = `
Vous êtes un directeur artistique spécialisé dans la mise en situation de marque. Créez une PLEINE PAGE de mockups physiques montrant le logo et l'identité de marque dans des applications tangibles du monde réel — spécifiques à L'INDUSTRIE de ce projet.

RÈGLE CRÉATIVE CRITIQUE:
Ne produisez PAS toujours les mêmes mockups génériques (carte de visite + écran laptop). Étudiez l'industrie, le nom de marque, et la personnalité du projet, puis choisissez des applications physiques qui ont du SENS pour CE type d'entreprise. Un restaurant a besoin d'un menu et d'une enseigne, pas d'un écran de laptop.

SÉLECTION DE MOCKUPS PAR INDUSTRIE (choisir ce qui correspond):
- Tech/SaaS: écran laptop avec interface, badge employé, stickers, packaging tech
- Restaurant/Food: menu, enseigne de façade, packaging take-away, tablier, carte de fidélité
- Mode/Beauté: étiquette vêtement, sac shopping, packaging produit, vitrine
- Santé: blouse médicale brodée, signalétique clinique, carte de rendez-vous, packaging pharma
- Finance: papier à en-tête, carte de visite premium, rapport annuel, plaque de porte
- Éducation: cahier, badge étudiant, signalétique campus, certificat
- Immobilier: panneau "À vendre", brochure propriété, carte de visite, enseigne agence
- Créatif/Agence: portfolio imprimé, carte de visite créative, merchandising (tote bag, mug)
- Commerce: sac shopping, packaging produit, enseigne magasin, étiquette prix

CONTENU DE LA PAGE:
1. Titre de section: "Applications de Marque" — stylé avec la personnalité de la marque
2. Exactement ${MOCKUPS_COUNT} mockups, chacun pertinent pour l'industrie du projet
3. Chaque mockup doit:
   - Montrer le logo du projet intégré de manière réaliste (via <img> avec l'URL du logo)
   - Utiliser les couleurs RÉELLES de la marque (bg-[#hex])
   - Avoir un titre descriptif et une courte légende expliquant l'application (en français)
   - Être construit en HTML/Tailwind comme une représentation visuelle réaliste de l'objet physique
4. Petite section en bas: "Principes d'Application" — 3-4 règles courtes pour maintenir la cohérence

RÈGLES DE DESIGN:
- Créez des représentations visuelles réalistes des objets physiques en HTML/Tailwind (ombres, perspectives, textures)
- Le logo doit être visible et correctement dimensionné dans chaque mockup
- Utilisez les couleurs RÉELLES de la marque, pas des couleurs génériques
- Chaque mockup doit raconter une histoire sur comment la marque vit dans le monde réel
- Présentation élégante avec espacement généreux

RÈGLES TECHNIQUES:
- HTML brut + Tailwind CSS uniquement, sortie minifiée sur une seule ligne
- A4 portrait, overflow-hidden, optimisé pour l'impression
- PrimeIcons (pi pi-icon-name) pour les icônes
- Pas de CSS custom, pas de JS
- Tout le texte en français
- Conformité WCAG AA pour le contraste

IMPORTANT:
- Ne PAS ajouter de balise "html" ou de préfixe dans la sortie
- Ne PAS toujours faire carte de visite + laptop — adapter à l'industrie
- Utiliser les couleurs HEX réelles de la marque

CONTEXTE DU PROJET:
`;
