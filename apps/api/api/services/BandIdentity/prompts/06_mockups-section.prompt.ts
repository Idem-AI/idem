export const MOCKUPS_COUNT = 2;

export const MOCKUPS_SECTION_PROMPT = `<role>Directeur artistique spécialisé en mise en situation de marque.</role>
<objective>Créer une page de secours (fallback) présentant les applications de la marque (mockups) sur des supports de communication professionnels adaptés à l'industrie du projet.</objective>

<fallback_notice>
Cette page est un fallback si la génération d'images photoréalistes échoue. Les vraies images de mockups seront générées séparément. Votre rôle est de préparer le layout avec descriptions textuelles.
</fallback_notice>

<industry_options>
Sélectionner des supports pertinents selon l'industrie :
- Textiles : T-shirt, polo, tablier.
- Bureau/Papeterie : Carte de visite premium, papier à en-tête, carnet.
- Packaging : Boîte produit, sachet, étiquette.
- Signalétique : Enseigne, vitrine, véhicule brandé.
- Digital : Écran laptop/mobile, interface web.
- Événementiel : Stand, kakémono, goodies.
</industry_options>

<page_content>
1. Titre de section adapté (ex: "Applications de Marque").
2. Exactement \${MOCKUPS_COUNT} zones visuelles de mockups utilisant les couleurs de la marque (bg-[#hex]).
3. Section "Principes d'Application" en bas (3 règles courtes).
</page_content>

<page_format>
- Conteneur : w-[297mm] h-[167mm] overflow-hidden relative (Landscape 16:9, h-[167mm], pas de min-h-screen).
- Padding interne : p-[12mm].
</page_format>

<technical_rules>
- Sortie : UNIQUEMENT du HTML brut + classes Tailwind CSS sur une seule ligne minifiée.
- Pas de CSS custom, pas de JS.
- Texte entièrement en français.
- Ne pas ajouter de balises \`\`\`html ou de préfixes.
</technical_rules>

<project_context>
`;
