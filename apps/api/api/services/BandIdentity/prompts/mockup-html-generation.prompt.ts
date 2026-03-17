/**
 * Prompt pour la génération dynamique du HTML d'affichage des mockups
 * L'IA génère un HTML professionnel et adapté au projet
 */

interface MockupHtmlGenerationParams {
  projectName: string;
  projectDescription: string;
  industry: string;
  brandColors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  mockups: Array<{
    url: string;
    title: string;
    description: string;
    supportType: string;
    priority: 'primary' | 'secondary';
  }>;
  logoUrl?: string;
}

export const MOCKUP_HTML_GENERATION_PROMPT = {
  /**
   * Construit le prompt pour générer le HTML d'une SEULE page de mockup
   */
  buildSingleMockupPrompt: (
    params: MockupHtmlGenerationParams & {
      mockup: {
        url: string;
        title: string;
        description: string;
        supportType: string;
        priority: 'primary' | 'secondary';
      };
      mockupIndex: number;
      totalMockups: number;
    }
  ): string => {
    const { projectName, industry, mockup, mockupIndex, totalMockups } = params;
    return `Génère un HTML MINIMALISTE pour afficher le mockup "${mockup.title}".

Projet: ${projectName}
Industrie: ${industry}

Mockup:
- Titre: ${mockup.title}
- Type: ${mockup.supportType}
- URL: ${mockup.url}

DESIGN MINIMALISTE REQUIS:
1. En-tête sobre (5%): Titre du mockup compact et discret
2. Image HERO (92%): Le mockup en TRÈS TRÈS GRAND, occupant le MAXIMUM d'espace, centré
3. Footer minimal (3%): Numéro de page "${mockupIndex}/${totalMockups}" très discret

STYLE:
- Fond blanc pur ou très légèrement grisé (#FAFAFA)
- Pas de couleurs décoratives (déjà dans section couleurs)
- Pas de badges, pas de palette affichée
- Typographie simple et élégante (Inter, system-ui)
- Paddings MINIMAUX (8-10mm maximum)
- Image doit occuper le MAXIMUM d'espace disponible
- Ombres très subtiles si nécessaire
- Design épuré, professionnel, sobre

IMPORTANT:
- NE PAS spécifier de dimensions fixes (width:210mm, height:297mm)
- Utiliser width:100% et height:100% pour s'adapter au conteneur
- Le conteneur parent gère déjà les dimensions A4

CSS inline uniquement. Pas d'explications.

GÉNÈRE UNIQUEMENT LE HTML.`;
  },

  /**
   * Construit le prompt pour générer le HTML d'affichage des mockups (ANCIEN)
   */
  buildPrompt: (params: MockupHtmlGenerationParams): string => {
    const { projectName, projectDescription, industry, brandColors, mockups } = params;

    return `Tu es un expert en design d'identité visuelle et en développement web. Ta mission est de générer un HTML professionnel et élégant pour afficher les mockups d'une charte graphique.

═══════════════════════════════════════════════════════════════════════════════
📋 INFORMATIONS DU PROJET
═══════════════════════════════════════════════════════════════════════════════

**Nom du projet :** ${projectName}
**Description :** ${projectDescription}
**Industrie :** ${industry}

**Couleurs de marque :**
• Primaire : ${brandColors.primary}
• Secondaire : ${brandColors.secondary}
• Accent : ${brandColors.accent}

**Mockups à afficher (${mockups.length}) :**
${mockups
  .map(
    (m, i) => `${i + 1}. **${m.title}** (${m.priority})
   - Type : ${m.supportType}
   - Description : ${m.description}
   - URL : ${m.url}`
  )
  .join('\n')}

═══════════════════════════════════════════════════════════════════════════════
🎨 OBJECTIFS DE DESIGN
═══════════════════════════════════════════════════════════════════════════════

1. **Professionnalisme absolu**
   • Design digne d'une agence de branding premium
   • Mise en page sophistiquée et moderne
   • Typographie élégante et hiérarchisée

2. **Adaptation au projet**
   • Le design doit refléter l'industrie "${industry}"
   • Utiliser les couleurs de marque de manière subtile et élégante
   • Le style visuel doit correspondre au ton du projet

3. **Mise en valeur des mockups**
   • Les mockups sont les héros de la page
   • Présentation visuelle impactante
   • Hiérarchie claire entre mockups primary et secondary

4. **Expérience utilisateur premium**
   • Layout responsive et équilibré
   • Espacement harmonieux
   • Transitions et effets subtils

═══════════════════════════════════════════════════════════════════════════════
📐 SPÉCIFICATIONS TECHNIQUES
═══════════════════════════════════════════════════════════════════════════════

**Format de page :**
• Dimensions : 210mm × 297mm (A4)
• Orientation : Portrait
• Marges : 10-12mm
• Background : Élégant, subtil, adapté à l'industrie

**Structure HTML requise :**
\`\`\`html
<div style="width:210mm;height:297mm;...">
  <!-- En-tête avec titre de section -->
  <!-- Zone principale avec mockups -->
  <!-- Footer avec règles/guidelines (optionnel) -->
</div>
\`\`\`

**Contraintes CSS :**
• Utiliser uniquement du CSS inline (style="...")
• Pas de classes CSS externes
• Pas de JavaScript
• Compatible avec la génération PDF

═══════════════════════════════════════════════════════════════════════════════
🎭 STYLES RECOMMANDÉS PAR INDUSTRIE
═══════════════════════════════════════════════════════════════════════════════

**Technology :** Minimaliste, géométrique, futuriste, espaces blancs généreux
**Finance :** Sobre, élégant, symétrique, couleurs neutres dominantes
**Healthcare :** Propre, rassurant, aéré, touches de bleu/vert
**Food & Beverage :** Chaleureux, appétissant, textures, couleurs vibrantes
**Fashion :** Avant-gardiste, asymétrique, bold, haute couture
**Retail & E-commerce :** Dynamique, coloré, grille organisée, call-to-action
**Education :** Accessible, clair, structuré, couleurs douces
**Sports & Fitness :** Énergique, dynamique, angles vifs, contraste fort
**Travel & Hospitality :** Inspirant, panoramique, couleurs chaudes, évasion
**Beauty & Cosmetics :** Luxueux, délicat, dégradés, finitions premium
**Construction :** Robuste, structuré, angles droits, couleurs industrielles
**Real Estate :** Prestigieux, spacieux, élégant, photos grandes
**Sustainability :** Naturel, organique, vert/terre, textures naturelles
**Delivery & Logistics :** Efficace, moderne, flèches/mouvement, couleurs vives

═══════════════════════════════════════════════════════════════════════════════
💡 INSPIRATIONS DE LAYOUT
═══════════════════════════════════════════════════════════════════════════════

**Pour 2 mockups :**
• Layout asymétrique : 1 grand (60%) + 1 moyen (35%)
• Split vertical : 50/50 avec séparateur élégant
• Hero + Support : 1 pleine largeur + 1 en bas
• Diagonal : Mockups en disposition diagonale créative

**Pour 3+ mockups :**
• Grille masonry : Tailles variées, disposition organique
• Timeline : Mockups en séquence narrative
• Focal point : 1 grand central + petits autour
• Grid moderne : Disposition en grille avec gaps élégants

═══════════════════════════════════════════════════════════════════════════════
✨ ÉLÉMENTS DE DESIGN À INCLURE
═══════════════════════════════════════════════════════════════════════════════

**En-tête :**
• Tag/badge avec "BRAND MOCKUPS" ou équivalent créatif
• Titre principal accrocheur (ex: "Applications de marque", "Brand in Action")
• Sous-titre descriptif court
• Palette de couleurs visible (3 cercles ou rectangles)

**Mockups :**
• Images avec border-radius subtil (8-16px)
• Ombres portées élégantes (box-shadow)
• Overlay avec titre et description au survol visuel
• Badge de priorité (primary/secondary) si pertinent

**Éléments décoratifs :**
• Formes géométriques subtiles en arrière-plan
• Lignes de séparation élégantes
• Dégradés de couleurs de marque (très subtils)
• Patterns ou textures légères (optionnel)

**Footer/Guidelines (optionnel) :**
• 2-3 règles d'utilisation courtes
• Icônes ou badges visuels
• Présentation en cartes ou pills

═══════════════════════════════════════════════════════════════════════════════
⚠️ RÈGLES CRITIQUES
═══════════════════════════════════════════════════════════════════════════════

✅ **À FAIRE ABSOLUMENT :**
• Générer UN SEUL bloc HTML complet et valide
• Utiliser les URLs exactes des mockups fournis
• Intégrer les couleurs de marque de manière harmonieuse
• Créer un design UNIQUE adapté au projet (pas de template générique)
• Assurer une hiérarchie visuelle claire
• Rendre le design professionnel et premium
• Optimiser pour l'impression PDF (210mm × 297mm)

❌ **À ÉVITER ABSOLUMENT :**
• NE PAS utiliser de classes CSS externes
• NE PAS ajouter de JavaScript
• NE PAS créer un design générique ou cliché
• NE PAS surcharger avec trop d'éléments
• NE PAS ignorer les couleurs de marque
• NE PAS créer un layout déséquilibré
• NE PAS utiliser de fonts non-standard (rester sur Inter, Helvetica, Arial)

═══════════════════════════════════════════════════════════════════════════════
📤 FORMAT DE SORTIE
═══════════════════════════════════════════════════════════════════════════════

Génère UNIQUEMENT le code HTML complet, sans explications, sans markdown.
Le HTML doit commencer par <div style="width:210mm;height:297mm;..."> et se terminer par </div>.

**Exemple de structure attendue :**
\`\`\`html
<div style="width:210mm;height:297mm;background:#f8f9fa;position:relative;font-family:'Inter',sans-serif;overflow:hidden;">
  <!-- Éléments décoratifs background -->
  <div style="position:absolute;..."></div>

  <!-- Contenu principal -->
  <div style="position:relative;z-index:1;padding:12mm;height:100%;display:flex;flex-direction:column;">
    <!-- En-tête -->
    <div style="...">
      <div style="...">BRAND MOCKUPS</div>
      <h2 style="...">Applications de marque</h2>
      <p style="...">Mise en situation professionnelle</p>
    </div>

    <!-- Mockups -->
    <div style="flex:1;display:flex;gap:16px;...">
      <div style="...">
        <img src="${mockups[0]?.url}" style="..." />
        <div style="...">
          <h3>${mockups[0]?.title}</h3>
          <p>${mockups[0]?.description}</p>
        </div>
      </div>
      <!-- Autres mockups... -->
    </div>

    <!-- Footer optionnel -->
    <div style="...">
      <!-- Guidelines... -->
    </div>
  </div>
</div>
\`\`\`

═══════════════════════════════════════════════════════════════════════════════
🎯 MISSION
═══════════════════════════════════════════════════════════════════════════════

Génère maintenant le HTML complet pour afficher ces ${mockups.length} mockups de manière professionnelle, élégante et adaptée au projet "${projectName}" dans l'industrie "${industry}".

Le design doit être UNIQUE, PREMIUM et refléter parfaitement l'identité du projet.

**GÉNÈRE UNIQUEMENT LE CODE HTML, SANS AUCUNE EXPLICATION.**`;
  },

  /**
   * Prompt système pour Gemini
   */
  systemPrompt: `Tu es un expert en design minimaliste et épuré. Tu génères du HTML inline CSS sobre pour mockups.

Règles MINIMALISTES:
• Design épuré, sobre, professionnel
• Mockup en HERO (92% de la page) - MAXIMUM d'espace
• Fond blanc pur ou très légèrement grisé (#FAFAFA)
• Pas de couleurs décoratives (déjà dans section couleurs)
• Pas de badges, pas de palette affichée
• Typographie simple et compacte (Inter, system-ui)
• Paddings MINIMAUX (8-10mm maximum)
• Image doit occuper le MAXIMUM d'espace disponible
• CSS inline uniquement
• Pas d'explications, que du HTML
• IMPORTANT: Utiliser width:100% et height:100% (PAS de dimensions fixes en mm)
• Le conteneur parent gère les dimensions A4`,
};
