import { SelectedMockupSupport } from '../mockupAnalyzer.service';

/**
 * Système de prompts dynamiques pour la génération de mockups photoréalistes
 * Les prompts s'adaptent automatiquement au projet, à l'industrie et au support sélectionné
 */

export const MOCKUP_GENERATION_PROMPT = {
  /**
   * Instructions pour le logo - s'assurer que le logo fourni est reproduit exactement
   */
  logoInstructions: (brandName: string) => ({
    withLogo: `🎯 IMAGE DU LOGO FOURNIE : J'ai attaché le logo EXACT de cette marque.

**RÈGLES CRITIQUES POUR LE LOGO :**
1. **Examiner attentivement** l'image du logo fournie — étudiez CHAQUE détail
2. **REPRODUIRE CE LOGO EXACTEMENT** dans la scène — NE PAS créer un logo différent
3. **Respecter TOUTES les caractéristiques** : formes, couleurs, typographie, proportions
4. **Placer le logo de manière proéminente** sur le support de communication
5. **Si le logo contient du texte** : reproduire EXACTEMENT — NE PAS modifier ou traduire
6. **Le logo doit être parfaitement lisible** et professionnel dans son intégration
7. **Taille appropriée** : ni trop petit (invisible), ni trop grand (écrasant)`,

    withoutLogo: `⚠️ Aucune image de logo fournie.
Afficher le nom de marque "${brandName}" dans un style typographique propre et professionnel en utilisant les couleurs de la marque.`,
  }),

  /**
   * Construit un prompt dynamique basé sur le support sélectionné par l'analyseur
   */
  buildDynamicPrompt: (params: {
    brandName: string;
    brandColors: { primary: string; secondary: string; accent: string };
    projectDescription: string;
    hasLogo: boolean;
    selectedSupport: SelectedMockupSupport;
    pdfFormat?: string;
  }) => {
    const { brandName, brandColors, projectDescription, hasLogo, selectedSupport, pdfFormat } =
      params;

    // Déterminer les dimensions et orientation selon le format PDF
    const formatSpecs =
      pdfFormat === 'A4_PORTRAIT'
        ? {
            orientation: 'PORTRAIT (VERTICAL)',
            dimensions: '210mm × 297mm',
            aspectRatio: '1:1.414 (A4 portrait)',
            imageSize: 'Largeur: 1654px, Hauteur: 2339px',
            description: 'Format document classique vertical',
          }
        : {
            orientation: 'PAYSAGE (HORIZONTAL)',
            dimensions: '297mm × 167mm',
            aspectRatio: '16:9 (paysage)',
            imageSize: 'Largeur: 2339px, Hauteur: 1315px',
            description: 'Format présentation moderne horizontal',
          };

    const logoInstruction = hasLogo
      ? MOCKUP_GENERATION_PROMPT.logoInstructions(brandName).withLogo
      : MOCKUP_GENERATION_PROMPT.logoInstructions(brandName).withoutLogo;

    // Construire les exemples de supports
    const supportExamples = selectedSupport.examples
      .map((ex, idx) => `   ${idx + 1}. ${ex}`)
      .join('\n');

    // Déterminer le niveau de priorité
    const priorityText =
      selectedSupport.priority === 'primary'
        ? '**SUPPORT PRINCIPAL** — Le plus iconique et impactant pour cette marque'
        : '**SUPPORT COMPLÉMENTAIRE** — Secondaire mais toujours professionnel et pertinent';

    return `Vous êtes un photographe commercial d'élite et directeur artistique spécialisé dans la mise en scène de marques.

Créez une photographie de mockup PHOTORÉALISTE et PROFESSIONNELLE de haute qualité.

═══════════════════════════════════════════════════════════════════════════════
📋 INFORMATIONS DE LA MARQUE
═══════════════════════════════════════════════════════════════════════════════

• **Nom de la marque** : "${brandName}"
• **Contexte industrie** : ${selectedSupport.industryContext}
• **Couleurs de marque** :
  - Primaire : ${brandColors.primary}
  - Secondaire : ${brandColors.secondary}
  - Accent : ${brandColors.accent}
• **Description du projet** : ${projectDescription}

═══════════════════════════════════════════════════════════════════════════════
🎯 VOTRE MISSION — MOCKUP #${selectedSupport.mockupIndex}
═══════════════════════════════════════════════════════════════════════════════

${logoInstruction}

**TYPE DE SUPPORT SÉLECTIONNÉ** : ${priorityText}

📦 **${selectedSupport.supportName}**

**Exemples spécifiques à créer** :
${supportExamples}

**Contexte de mise en scène** :
${selectedSupport.context}

═══════════════════════════════════════════════════════════════════════════════
💡 DIRECTIVES SPÉCIFIQUES POUR CE SUPPORT
═══════════════════════════════════════════════════════════════════════════════

**Choisissez UN exemple spécifique** parmi la liste ci-dessus qui correspond le MIEUX :
• Au contexte du projet (${selectedSupport.industryContext})
• À la description : "${projectDescription.substring(0, 150)}..."
• Aux couleurs de marque (${brandColors.primary}, ${brandColors.secondary}, ${brandColors.accent})

**Créez une scène UNIQUE et MÉMORABLE** :
• NE PAS créer un mockup générique ou cliché
• Analyser le projet pour comprendre son essence
• Créer une mise en scène qui RACONTE L'HISTOIRE de la marque
• Le support doit être le HÉROS de la photographie
• L'environnement doit renforcer l'identité de la marque

═══════════════════════════════════════════════════════════════════════════════
📸 EXIGENCES PHOTOGRAPHIQUES PROFESSIONNELLES
═══════════════════════════════════════════════════════════════════════════════

**1. RÉALISME PHOTOGRAPHIQUE ABSOLU**
   • Ceci doit ressembler à une VRAIE PHOTOGRAPHIE prise par un photographe professionnel
   • PAS d'illustration numérique, PAS de rendu 3D artificiel
   • Grain photographique subtil, imperfections naturelles

**2. ÉCLAIRAGE PROFESSIONNEL**
   • Éclairage studio ou en situation réelle (lumière naturelle + artificielle)
   • Ombres douces et naturelles
   • Reflets réalistes sur les surfaces (verre, métal, plastique)
   • Pas de sur-exposition ni de sous-exposition

**3. COMPOSITION ARTISTIQUE**
   • Règle des tiers respectée
   • Profondeur de champ cinématographique (arrière-plan légèrement flouté)
   • Le support avec le logo est le HÉROS de l'image — clairement visible et mis en valeur
   • Cadrage professionnel (pas trop serré, pas trop large)

**4. TEXTURES ET MATÉRIAUX RÉALISTES**
   • Grain du papier visible sur les supports imprimés
   • Texture du tissu sur les vêtements (fibres, coutures)
   • Brillance métallique sur les finitions premium
   • Reflets du verre, transparence réaliste
   • Usure légère et naturelle (pas trop neuf, pas abîmé)

**5. INTÉGRATION DES COULEURS DE MARQUE**
   • Les couleurs ${brandColors.primary}, ${brandColors.secondary}, ${brandColors.accent} doivent être visibles
   • Intégration subtile et professionnelle (pas forcée)
   • Harmonie chromatique avec l'environnement

**6. CONTEXTE ET MISE EN SCÈNE**
   • Environnement cohérent avec le contexte "${selectedSupport.industryContext}"
   • Éléments de contexte pertinents (bureau, café, boutique, extérieur, etc.)
   • Pas de distraction visuelle — focus sur le support brandé
   • Ambiance professionnelle et premium

**7. QUALITÉ TECHNIQUE**
   • Haute résolution visuelle
   • Netteté parfaite sur le logo et le support principal
   • Pas de déformation, pas d'aberration chromatique
   • Perspective réaliste et naturelle

**8. FORMAT ET DIMENSIONS DE L'IMAGE** ⚠️ CRITIQUE
   • **Orientation** : ${formatSpecs.orientation}
   • **Dimensions de page** : ${formatSpecs.dimensions}
   • **Ratio d'aspect** : ${formatSpecs.aspectRatio}
   • **Taille d'image recommandée** : ${formatSpecs.imageSize}
   • **Description** : ${formatSpecs.description}
   • L'image DOIT couvrir 100% de la hauteur ET 100% de la largeur de la page
   • Le mockup doit être cadré pour remplir ENTIÈREMENT le format ${formatSpecs.orientation}
   • Pas d'espace vide sur les bords — l'image doit être FULL-PAGE
   • Composition adaptée à l'orientation ${formatSpecs.orientation}

═══════════════════════════════════════════════════════════════════════════════
⚠️ RÈGLES CRITIQUES À RESPECTER
═══════════════════════════════════════════════════════════════════════════════

✅ **À FAIRE ABSOLUMENT** :
• Créer UNE scène photoréaliste centrée sur le support "${selectedSupport.supportName}"
• Reproduire le logo EXACTEMENT comme fourni (si image fournie)
• Créer une photographie digne d'un portfolio professionnel (Behance/Dribbble)
• Intégrer subtilement les couleurs de marque dans l'environnement
• Montrer le support dans un contexte RÉEL et NATUREL pour cette industrie
• Créer une ambiance qui reflète les valeurs du projet

❌ **À ÉVITER ABSOLUMENT** :
• NE PAS créer un mockup générique ou cliché
• NE PAS ignorer le type de support spécifié (${selectedSupport.supportName})
• NE PAS créer un logo différent de celui fourni
• NE PAS faire un rendu 3D artificiel — PHOTORÉALISME UNIQUEMENT
• NE PAS surcharger la scène avec trop d'éléments distracteurs
• NE PAS utiliser des couleurs qui contredisent la marque
• NE PAS créer une mise en scène irréaliste ou fantaisiste
• NE PAS créer le même mockup que les autres (chaque mockup doit être UNIQUE)

═══════════════════════════════════════════════════════════════════════════════
🎨 STYLE FINAL ET LIVRABLE
═══════════════════════════════════════════════════════════════════════════════

**Style photographique** : Photographie commerciale haut de gamme
**Inspiration** : Portfolio de marque professionnel (Behance, Dribbble, Brand New)
**Qualité** : Digne d'une agence de branding premium internationale
**Support** : ${selectedSupport.supportName} — ${selectedSupport.priority === 'primary' ? 'APPLICATION PRINCIPALE' : 'APPLICATION COMPLÉMENTAIRE'}
**Contexte industrie** : ${selectedSupport.industryContext}

**IMPORTANT** : Générez UNIQUEMENT l'image photoréaliste, aucune réponse textuelle.

La photographie doit être si convaincante qu'elle pourrait être utilisée immédiatement dans une présentation client ou un portfolio d'agence.`;
  },
};
