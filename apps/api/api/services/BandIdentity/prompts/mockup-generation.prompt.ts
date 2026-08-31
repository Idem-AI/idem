import { SelectedMockupSupport } from '../mockupAnalyzer.service';

/**
 * Système de prompts dynamiques pour la génération de mockups photoréalistes
 */

export const MOCKUP_GENERATION_PROMPT = {
  logoInstructions: (brandName: string) => ({
    withLogo: `<logo_rules>
- Une image du logo exact de cette marque est fournie.
- Étudier attentivement chaque détail de l'image du logo fournie et le reproduire EXACTEMENT dans la scène.
- Respecter toutes les formes, couleurs, typographie et proportions originelles.
- Placer le logo de manière visible et lisible sur le support. Ne pas modifier ou traduire le texte du logo.
- Choisir une taille équilibrée (ni invisible ni écrasante).
</logo_rules>`,

    withoutLogo: `<logo_rules>
- Aucune image de logo n'est fournie.
- Afficher le nom de marque "${brandName}" dans un style typographique propre et professionnel avec les couleurs de la marque.
</logo_rules>`,
  }),

  buildDynamicPrompt: (params: {
    brandName: string;
    brandColors: { primary: string; secondary: string; accent: string };
    projectDescription: string;
    hasLogo: boolean;
    selectedSupport: SelectedMockupSupport;
    pdfFormat?: string;
    /** Fragment de rendu issu de la direction artistique (anglais, rendu uniquement). */
    artDirectionModifier?: string;
    /** Prompt négatif du style retenu. */
    artDirectionNegative?: string;
    /** Nom lisible du style, pour situer la consigne. */
    artDirectionName?: string;
  }) => {
    const {
      brandName,
      brandColors,
      projectDescription,
      hasLogo,
      selectedSupport,
      pdfFormat,
      artDirectionModifier,
      artDirectionNegative,
      artDirectionName,
    } = params;

    const formatSpecs =
      pdfFormat === 'A4_PORTRAIT'
        ? {
            orientation: 'PORTRAIT (VERTICAL)',
            dimensions: '210mm × 297mm',
            aspectRatio: '1:1.414 (A4 portrait)',
            imageSize: '2480px × 3508px',
            description: 'Format vertical. L\'image DOIT être verticale.',
            criticalInstructions: 'CRITIQUE: Orientation PORTRAIT obligatoire. Ratio 1:1.414. Cadrage vertical serré pour remplir toute la hauteur.',
          }
        : {
            orientation: 'PAYSAGE (HORIZONTAL)',
            dimensions: '297mm × 167mm',
            aspectRatio: '16:9 (paysage)',
            imageSize: '2480px × 1395px',
            description: 'Format horizontal. L\'image DOIT être horizontale.',
            criticalInstructions: 'CRITIQUE: Orientation PAYSAGE obligatoire. Ratio 16:9. Cadrage horizontal large pour remplir toute la largeur.',
          };

    const logoInstruction = hasLogo
      ? MOCKUP_GENERATION_PROMPT.logoInstructions(brandName).withLogo
      : MOCKUP_GENERATION_PROMPT.logoInstructions(brandName).withoutLogo;

    const supportExamples = selectedSupport.examples
      .map((ex, idx) => `  - ${ex}`)
      .join('\n');

    const priorityText =
      selectedSupport.priority === 'primary'
        ? 'SUPPORT PRINCIPAL (le plus iconique pour cette marque)'
        : 'SUPPORT COMPLÉMENTAIRE (secondaire mais pertinent)';

    return `<role>Photographe commercial d'élite et directeur artistique spécialisé dans la mise en scène de marques.</role>
<objective>Créer une photographie de mockup photoréaliste et professionnelle de haute qualité.</objective>

<brand_context>
- Nom: "${brandName}"
- Industrie: ${selectedSupport.industryContext}
- Couleurs: Primaire ${brandColors.primary}, Secondaire ${brandColors.secondary}, Accent ${brandColors.accent}
- Description: ${projectDescription}
</brand_context>

<mockup_mission>
Mockup index: #${selectedSupport.mockupIndex}
Priority: ${priorityText}
Support Name: ${selectedSupport.supportName}

${logoInstruction}

Exemples de supports à créer :
${supportExamples}

Mise en scène :
${selectedSupport.context}
</mockup_mission>

${
      artDirectionModifier
        ? `<art_direction>
La marque a une direction artistique arrêtée${artDirectionName ? ` : ${artDirectionName}` : ''}. Elle décide du RENDU de cette photographie — lumière, matière, étalonnage, cadrage — et prime sur les réglages photographiques génériques ci-dessous chaque fois qu'ils divergent. Le sujet, lui, reste le support à présenter.
Rendu attendu (à appliquer littéralement) : ${artDirectionModifier}
${artDirectionNegative ? `À proscrire dans l'image : ${artDirectionNegative}` : ''}
Cette photo sera vue à côté des autres supports de la marque : elle doit avoir la MÊME lumière et le MÊME étalonnage qu'eux.
</art_direction>

`
        : ''
    }<photographic_rules>
1. RÉALISME PHOTOGRAPHIQUE ABSOLU: Vraie photographie commerciale (pas d'illustration numérique, pas de rendu 3D artificiel). Grain subtil, imperfections naturelles.
2. ÉCLAIRAGE: Éclairage studio ou lumière naturelle réaliste, ombres douces, reflets sur verre/métal/plastique.
3. COMPOSITION: Règle des tiers, profondeur de champ cinématographique (arrière-plan flouté). Le support brandé est le héros clairement visible.
4. TEXTURES: Fibres de tissu visibles, grain de papier, brillance métallique, usure naturelle légère.
5. COULEURS: Intégration subtile et harmonieuse des couleurs de marque (${brandColors.primary}, ${brandColors.secondary}, ${brandColors.accent}) dans la scène.
6. CONTEXTE: Environnement cohérent (${selectedSupport.industryContext}). Pas de distraction visuelle.
</photographic_rules>

<format_rules>
- Orientation: ${formatSpecs.orientation}
- Dimensions: ${formatSpecs.dimensions}
- Ratio: ${formatSpecs.aspectRatio}
- Résolution: ${formatSpecs.imageSize}
- Règle: ${formatSpecs.description}
- ${formatSpecs.criticalInstructions}
- L'image doit couvrir 100% de la hauteur et de la largeur (FULL-PAGE, pas de bordures blanches).
</format_rules>

<forbidden>
- Mockup générique / cliché : le mockup « carte de visite posée en biais sur un bureau en marbre blanc avec une plante verte » est LE rendu par défaut de tous les générateurs. Composer autre chose.
- Rendu 3D artificiel, plastique, sur-éclairé.
- Logo différent du logo fourni.
- Surcharger la scène : un support héros, un contexte, rien d'autre.
- Filigrane, texte déformé, artefacts de génération, sur-saturation HDR.
${artDirectionNegative ? `- ${artDirectionNegative}` : ''}
</forbidden>

GÉNÉRER UNIQUEMENT L'IMAGE PHOTORÉALISTE. AUCUNE RÉPONSE TEXTUELLE.`;
  },
};
