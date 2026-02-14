// Configuration pour le nombre de mockups à générer
export const MOCKUPS_COUNT = 2; // Modifiez cette valeur pour générer plus de mockups

export const MOCKUPS_SECTION_PROMPT = `
Vous êtes un directeur artistique spécialisé dans la mise en situation de marque.

IMPORTANT: Cette page HTML/Tailwind est un FALLBACK utilisé uniquement si la génération d'images photoréalistes échoue. Les vraies images de mockups seront générées par un outil d'IA séparé et injectées dans le HTML final. Votre rôle est de créer une page de secours visuellement acceptable.

Créez une PLEINE PAGE présentant les applications de la marque dans le monde réel — spécifiques à L'INDUSTRIE de ce projet.

RÈGLE CRÉATIVE CRITIQUE:
Étudiez l'industrie, le nom de marque, et la personnalité du projet, puis choisissez des applications physiques qui ont du SENS pour CE type d'entreprise. NE PAS toujours utiliser carte de visite + laptop.

Exemples par industrie:
- Livraison: camion brandé, colis avec logo, uniforme livreur
- Restaurant: menu, enseigne, tablier, packaging take-away
- Santé: façade clinique, packaging médical, badge personnel
- Tech: interface web, app mobile, badge conférence
- Finance: papeterie corporate, réception bureau, carte premium
- Commerce: sac shopping, vitrine, packaging produit
- Sport: maillot, gourde, enseigne salle
- Beauté: packaging cosmétique, salon intérieur

CONTENU DE LA PAGE:
1. Titre de section adapté à l'industrie (pas toujours "Applications de Marque")
2. Exactement ${MOCKUPS_COUNT} zones visuelles représentant des mockups pertinents
3. Chaque zone doit utiliser les couleurs RÉELLES de la marque (bg-[#hex])
4. Section "Principes d'Application" en bas — 3 règles courtes adaptées à l'industrie

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
