// Configuration pour le nombre de mockups à générer
export const MOCKUPS_COUNT = 2; // Modifiez cette valeur pour générer plus de mockups

export const MOCKUPS_SECTION_PROMPT = `
Vous êtes un directeur artistique spécialisé dans la mise en situation de marque. Créez une PLEINE PAGE présentant les applications de la marque dans le monde réel — spécifiques à L'INDUSTRIE de ce projet.

NOTE: Cette page est un fallback. Les vraies images de mockups photoréalistes seront générées séparément. Créez une page HTML/Tailwind qui illustre visuellement comment la marque s'applique dans son industrie, en utilisant les couleurs réelles de la marque.

RÈGLE CRÉATIVE CRITIQUE:
Ne produisez PAS toujours les mêmes mockups génériques (carte de visite + écran laptop). Étudiez l'industrie, le nom de marque, et la personnalité du projet, puis choisissez des applications physiques qui ont du SENS pour CE type d'entreprise.

CONTENU DE LA PAGE:
1. Titre de section: "Applications de Marque" — stylé avec la personnalité de la marque
2. Exactement ${MOCKUPS_COUNT} représentations visuelles de mockups pertinents pour l'industrie
3. Chaque mockup doit:
   - Être construit en HTML/Tailwind comme une représentation visuelle de l'objet physique
   - Utiliser les couleurs RÉELLES de la marque (bg-[#hex])
   - Avoir un titre descriptif et une courte légende (en français)
4. Petite section en bas: "Principes d'Application" — 3-4 règles courtes

CONTRAINTES A4 (NON-NÉGOCIABLE):
- L'élément racine DOIT utiliser: w-[210mm] h-[297mm] overflow-hidden relative
- Padding interne de sécurité: p-[12mm]
- TOUT le contenu doit tenir dans cette boîte 210×297mm
- Ne PAS utiliser min-h-screen — utiliser h-[297mm] exactement

RÈGLES TECHNIQUES:
- HTML brut + Tailwind CSS uniquement, sortie minifiée sur une seule ligne
- Pas de CSS custom, pas de JS
- Tout le texte en français

IMPORTANT:
- Ne PAS ajouter de balise "html" ou de préfixe dans la sortie
- Utiliser les couleurs HEX réelles de la marque

CONTEXTE DU PROJET:
`;
