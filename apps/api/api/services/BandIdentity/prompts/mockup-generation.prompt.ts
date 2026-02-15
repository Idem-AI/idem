/**
 * Prompt professionnel pour la génération de mockups photoréalistes avec Gemini
 * Ce prompt guide l'IA pour créer des mockups de haute qualité montrant le logo
 * sur des supports de communication réels et pertinents pour l'industrie
 */

export const MOCKUP_GENERATION_PROMPT = {
  /**
   * Instructions pour le logo - s'assurer que le logo fourni est reproduit exactement
   */
  logoInstructions: (brandName: string) => ({
    withLogo: `IMAGE DU LOGO FOURNIE : J'ai attaché le logo EXACT de cette marque. Vous DEVEZ :

1. **Examiner attentivement** l'image du logo fournie — étudiez sa forme, ses couleurs, sa typographie et son design
2. **REPRODUIRE CE LOGO EXACTEMENT** dans la scène de mockup — NE PAS créer un logo différent
3. Le logo doit apparaître **EXACTEMENT comme fourni** — mêmes formes, mêmes couleurs, mêmes proportions
4. Placer le logo de manière **proéminente et naturelle** sur le support de communication
5. Si le logo contient du texte, reproduire ce texte **EXACTEMENT** — NE PAS le modifier ou le traduire
6. Le logo doit être **parfaitement lisible** et **professionnel** dans son intégration`,

    withoutLogo: `Aucune image de logo fournie. Afficher le nom de marque "${brandName}" dans un style typographique propre et professionnel en utilisant les couleurs de la marque.`,
  }),

  /**
   * Prompt principal pour la génération de mockup
   */
  buildPrompt: (params: {
    brandName: string;
    industry: string;
    brandColors: { primary: string; secondary: string; accent: string };
    projectDescription: string;
    mockupIndex: number;
    hasLogo: boolean;
  }) => {
    const { brandName, industry, brandColors, projectDescription, mockupIndex, hasLogo } = params;

    const logoInstruction = hasLogo
      ? MOCKUP_GENERATION_PROMPT.logoInstructions(brandName).withLogo
      : MOCKUP_GENERATION_PROMPT.logoInstructions(brandName).withoutLogo;

    return `Vous êtes un photographe commercial d'élite et directeur artistique spécialisé dans la mise en scène de marques.

Créez une photographie de mockup PHOTORÉALISTE et PROFESSIONNELLE de haute qualité.

═══════════════════════════════════════════════════════════════════════════════
📋 INFORMATIONS DE LA MARQUE
═══════════════════════════════════════════════════════════════════════════════

• **Nom de la marque** : "${brandName}"
• **Industrie** : ${industry}
• **Couleurs de marque** :
  - Primaire : ${brandColors.primary}
  - Secondaire : ${brandColors.secondary}
  - Accent : ${brandColors.accent}
• **Description du projet** : ${projectDescription}

═══════════════════════════════════════════════════════════════════════════════
🎯 VOTRE MISSION
═══════════════════════════════════════════════════════════════════════════════

${logoInstruction}

**Mockup #${mockupIndex}** : ${
      mockupIndex === 1
        ? "Choisissez l'APPLICATION PRINCIPALE de la marque (le support le plus iconique et impactant pour cette industrie)"
        : 'Choisissez une APPLICATION COMPLÉMENTAIRE différente (secondaire mais toujours professionnelle et pertinente)'
    }

═══════════════════════════════════════════════════════════════════════════════
💡 SUPPORTS DE COMMUNICATION À CONSIDÉRER
═══════════════════════════════════════════════════════════════════════════════

Analysez l'industrie "${industry}" et la description du projet pour choisir le support le PLUS PERTINENT parmi :

**Supports vestimentaires & textiles** :
• T-shirt, polo, sweat-shirt avec logo brodé ou imprimé
• Casquette, bonnet, bandana brandé
• Tablier, blouse professionnelle
• Sac tote bag en toile, sac à dos
• Uniforme professionnel complet

**Supports papeterie & bureau** :
• Carte de visite premium (finition mate, vernis sélectif, dorure)
• Papier à en-tête, enveloppe
• Bloc-notes, carnet moleskine
• Chemise à rabats, dossier de présentation
• Badge nominatif, porte-badge

**Supports packaging & produits** :
• Boîte produit (carton, bois, métal)
• Sachet, pochette cadeau
• Étiquette produit, sticker
• Emballage alimentaire (si restaurant/food)
• Packaging cosmétique (si beauté/santé)

**Supports signalétique & extérieur** :
• Enseigne lumineuse de façade
• Panneau directionnel, totem
• Vitrine de magasin
• Véhicule brandé (camionnette, voiture)
• Banderole, kakémono

**Supports digitaux & tech** :
• Écran d'ordinateur portable avec interface web/app
• Smartphone avec application mobile
• Tablette avec présentation
• Badge de conférence avec QR code

**Supports événementiels** :
• Stand d'exposition
• Roll-up, kakémono
• Goodies (gourde, stylo, clé USB)
• Invitation, flyer événement

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
   • Environnement cohérent avec l'industrie "${industry}"
   • Éléments de contexte pertinents (bureau, café, boutique, extérieur, etc.)
   • Pas de distraction visuelle — focus sur le support brandé
   • Ambiance professionnelle et premium

**7. QUALITÉ TECHNIQUE**
   • Haute résolution visuelle
   • Netteté parfaite sur le logo et le support principal
   • Pas de déformation, pas d'aberration chromatique
   • Perspective réaliste et naturelle

═══════════════════════════════════════════════════════════════════════════════
⚠️ RÈGLES CRITIQUES À RESPECTER
═══════════════════════════════════════════════════════════════════════════════

✅ **À FAIRE** :
• Choisir UN support spécifique et pertinent pour l'industrie
• Créer une photographie qui pourrait figurer dans un portfolio Behance/Dribbble
• Reproduire le logo EXACTEMENT comme fourni
• Créer une ambiance premium et professionnelle
• Montrer le support dans un contexte réel et naturel

❌ **À ÉVITER** :
• NE PAS toujours choisir "carte de visite + laptop" par défaut
• NE PAS créer un logo différent de celui fourni
• NE PAS faire un rendu 3D artificiel
• NE PAS surcharger la scène avec trop d'éléments
• NE PAS utiliser des couleurs qui ne correspondent pas à la marque
• NE PAS créer une mise en scène irréaliste ou fantaisiste

═══════════════════════════════════════════════════════════════════════════════
🎨 STYLE FINAL
═══════════════════════════════════════════════════════════════════════════════

Style : **Photographie commerciale haut de gamme**
Inspiration : Portfolio de marque professionnel (Behance, Dribbble, Brand New)
Qualité : Digne d'une agence de branding premium

Générez UNIQUEMENT l'image, aucune réponse textuelle.`;
  },
};
