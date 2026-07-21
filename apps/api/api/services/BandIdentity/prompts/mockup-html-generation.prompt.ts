/**
 * Prompt pour la génération dynamique du HTML d'affichage des mockups
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
  typography?: {
    primaryFont?: string;
    secondaryFont?: string;
  };
}

export const MOCKUP_HTML_GENERATION_PROMPT = {
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
      typography?: {
        primaryFont?: string;
        secondaryFont?: string;
      };
    }
  ): string => {
    const {
      projectName,
      projectDescription,
      industry,
      brandColors,
      mockup,
      mockupIndex,
      totalMockups,
      typography,
    } = params;

    const primaryFont = typography?.primaryFont || 'Inter';
    const secondaryFont = typography?.secondaryFont || 'Inter';

    return `<objective>Générer un HTML moderne et unique pour afficher le mockup "${mockup.title}" en format Paysage 16:9 pleine page.</objective>

<project_context>
- Projet: ${projectName}
- Description: ${projectDescription}
- Industrie: ${industry}
- Couleurs de marque: Primaire ${brandColors.primary}, Secondaire ${brandColors.secondary}, Accent ${brandColors.accent}
- Typographie: headings='${primaryFont}', body='${secondaryFont}'
- Mockup: ${mockup.title} (${mockup.supportType}, ${mockupIndex}/${totalMockups})
- Image URL: ${mockup.url}
</project_context>

<creative_guidelines>
1. CHARTE GRAPHIQUE: Utiliser les couleurs (${brandColors.primary}, ${brandColors.secondary}) dans le dégradé de fond (pas de noir générique). Appliquer les polices du projet.
2. DESCRIPTION: Rédiger une description unique (15-25 mots en français) adaptée à l'industrie et au support (${mockup.supportType}).
3. DESIGN: Overlay en bas avec dégradé transparent. Titre principal + description + numéro. Espacement équilibré.
</creative_guidelines>

<technical_structure>
- Conteneur: width:100%, height:100%, position:relative, overflow:hidden, margin:0, padding:0.
- Image mockup: width:100%, height:100%, object-fit:cover.
- Section description: position:absolute, bottom:0, left:0, right:0.
- Typographie: style="font-family: '${primaryFont}', '${secondaryFont}'".
- Contraste: Conforme WCAG AA.
- Format: PAYSAGE 16:9 (297mm × 167mm).
</technical_structure>

<rules>
- CSS inline uniquement (pas de classes externes).
- Pas de JavaScript.
- Générer UNIQUEMENT le HTML, sans markdown ni explications.
</rules>`;
  },

  buildPrompt: (params: MockupHtmlGenerationParams): string => {
    const { projectName, projectDescription, industry, brandColors, mockups } = params;

    return `<role>Expert en design d'identité visuelle et développement web.</role>
<objective>Générer un HTML professionnel et élégant (210mm × 297mm A4) pour afficher les mockups d'une charte graphique.</objective>

<project_context>
- Projet: ${projectName}
- Description: ${projectDescription}
- Industrie: ${industry}
- Couleurs de marque: Primaire ${brandColors.primary}, Secondaire ${brandColors.secondary}, Accent ${brandColors.accent}
- Mockups à afficher:
${mockups
  .map(
    (m, i) => `  ${i + 1}. ${m.title} (${m.priority}) - Type: ${m.supportType}, URL: ${m.url}`
  )
  .join('\n')}
</project_context>

<design_principles>
- Style adapté à l'industrie "${industry}" (ex: tech=minimaliste, finance=sobre/élégant, food=chaleureux/vibrant, fashion=avant-gardiste).
- Mise en valeur des mockups comme héros de la page.
- Layout équilibré (si 2 mockups: layout asymétrique 60/35 ou split vertical 50/50).
- Éléments: Badge/tag "BRAND MOCKUPS", titre principal, sous-titre, palette de couleurs visible, border-radius (8-16px) et ombres sur les images.
</design_principles>

<technical_rules>
- Dimensions du conteneur: A4 (w-[210mm] h-[297mm]), overflow-hidden, position relative, no min-h-screen.
- CSS inline uniquement. Pas de classes CSS externes. Pas de JavaScript.
- All text in French. Conforme WCAG AA.
</technical_rules>

<output_format>
Générer UNIQUEMENT le code HTML complet (de <div style="..."> à </div>), sans markdown, sans explications.
</output_format>`;
  },

  systemPrompt: `Tu es un expert en design moderne et identité visuelle. Tu génères du HTML inline CSS pour mockups en FORMAT PAYSAGE 16:9 PLEINE PAGE avec respect de la charte graphique.

Règles FULL-PAGE:
• Design moderne, impactant, pleine page
• Format PAYSAGE 16:9 (297mm × 167mm)
• Image mockup couvre 100% hauteur ET largeur (width:100%, height:100%, object-fit:cover)
• Conteneur: position:relative, overflow:hidden, margin:0, padding:0

Règles CHARTE GRAPHIQUE:
• Overlay avec dégradé utilisant les COULEURS DE MARQUE (pas de noir générique)
• Utiliser la TYPOGRAPHIE du projet (polices spécifiées)
• Texte avec couleurs adaptées pour contraste optimal
• Description UNIQUE et contextuelle pour chaque mockup
• Design qui reflète l'identité visuelle du projet

Règles TECHNIQUES:
• Section description: position:absolute, bottom:0
• Dégradé avec couleurs de marque et transparence
• Titre: gras, grande taille (24px), police principale
• Description: courte, percutante, contextuelle
• Info projet et numéro de page
• CSS inline uniquement
• Pas d'explications, que du HTML
• IMPORTANT: Image doit COUVRIR toute la page avec object-fit:cover`,
};
