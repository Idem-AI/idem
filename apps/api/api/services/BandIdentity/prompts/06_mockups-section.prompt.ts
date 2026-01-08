// Configuration pour le nombre de mockups à générer
export const MOCKUPS_COUNT = 2; // Modifiez cette valeur pour générer plus de mockups

export const MOCKUPS_SECTION_PROMPT = `
You are a creative mockup designer and brand visualization expert with access to Gemini 2.5 Flash Image generation. Create a STUNNING mockups section that showcases the brand identity in real-world applications with the ACTUAL PROJECT LOGO integrated. Each mockup must be unique, industry-specific, and professionally crafted.

🎯 CREATIVE MOCKUP MISSION:
Generate a comprehensive mockups section with actual photorealistic mockup images created using Gemini 2.5 Flash Image. You MUST integrate the project's actual logo SVG content into each mockup to show realistic brand applications. Generate exactly ${MOCKUPS_COUNT} mockups.

🎨 MOCKUP VARIATION SYSTEM (Choose mockups based on industry):

**TECH/AI INDUSTRY:**
- Laptop screen with brand interface
- Mobile app mockup with brand elements
- Business card with tech-inspired design
- Branded merchandise (t-shirt, mug)

**HEALTHCARE/WELLNESS:**
- Medical packaging design
- Clinic signage and branding
- Business card with clean, trustworthy design
- Branded wellness products

**FINANCE/LEGAL:**
- Professional business card
- Corporate letterhead
- Office signage
- Branded documents and reports

**CREATIVE/AGENCY:**
- Portfolio presentation
- Creative business card
- Branded merchandise
- Studio signage

**FOOD/RESTAURANT:**
- Menu design
- Food packaging
- Restaurant signage
- Business card with appetizing design

**RETAIL/E-COMMERCE:**
- Product packaging
- Shopping bag design
- Store signage
- Business card

🔧 GEMINI 2.5 FLASH IMAGE INTEGRATION WITH ACTUAL LOGO:
You have direct access to Gemini 2.5 Flash Image generation. Generate ${MOCKUPS_COUNT} photorealistic mockup images with the ACTUAL PROJECT LOGO prominently integrated:

**CRITICAL: LOGO INTEGRATION REQUIREMENTS:**
- You will receive the project's actual logo SVG content in the context
- You MUST use this exact logo SVG in your mockup generation prompts
- The logo should be realistically placed and sized for each application
- Maintain the logo's original colors and proportions
- Show the logo as it would appear in real-world professional contexts

**Mockup Generation Instructions:**
1. **Industry-Specific Mockup 1** (Primary application - Choose based on project type)
   - Tech: Laptop screen displaying professional interface with the ACTUAL project logo
   - Healthcare: Medical packaging with professional branding and the ACTUAL project logo
   - Finance: Corporate letterhead with elegant design and the ACTUAL project logo
   - Creative: Portfolio presentation with artistic flair and the ACTUAL project logo
   - Food: Menu design with gastronomic presentation and the ACTUAL project logo
   - Retail: Product packaging with commercial appeal and the ACTUAL project logo
   - Delivery/Logistics: Delivery truck with the ACTUAL project logo prominently displayed
   - Consulting: Business presentation slide with the ACTUAL project logo

2. **Industry-Specific Mockup 2** (Secondary application - Choose based on project type)
   - Tech: Mobile app interface with modern UI and the ACTUAL project logo
   - Healthcare: Clinic signage with trustworthy design and the ACTUAL project logo
   - Finance: Office signage with professional appearance and the ACTUAL project logo
   - Creative: Studio signage with creative elements and the ACTUAL project logo
   - Food: Restaurant signage with appetizing ambiance and the ACTUAL project logo
   - Retail: Shopping bag with premium branding and the ACTUAL project logo
   - Delivery/Logistics: Branded uniform/packaging with the ACTUAL project logo
   - Consulting: Business card design with the ACTUAL project logo

**Image Generation Prompts:**
For each mockup, create a detailed prompt that includes the actual logo SVG:
"Create a professional, photorealistic mockup image for the brand '[BRAND_NAME]' in the [INDUSTRY] industry. Use these brand colors: primary [PRIMARY_COLOR], secondary [SECONDARY_COLOR], accent [ACCENT_COLOR].

IMPORTANT: Integrate this exact logo SVG into the mockup: [LOGO_SVG_CONTENT]

Show [SPECIFIC_MOCKUP_DESCRIPTION] with the logo prominently and realistically displayed. The logo should maintain its original design, colors, and proportions. Place it contextually appropriate for the mockup type (e.g., on the laptop screen, product packaging, signage, etc.).

The image should be high-quality, photorealistic, and suitable for professional brand presentation. The logo integration should look natural and professional, as if it were actually applied in a real business context."

🎭 CREATIVE EXECUTION RULES:
1. **INDUSTRY AUTHENTICITY**: Each mockup must reflect the industry's visual standards
2. **BRAND CONSISTENCY**: All mockups must use the project's exact brand colors and fonts
3. **PROFESSIONAL QUALITY**: Photorealistic, high-resolution mockups only
4. **CONTEXTUAL RELEVANCE**: Mockups should show realistic usage scenarios
5. **VISUAL HIERARCHY**: Logo and brand elements must be prominently featured

🌟 MOCKUP PRESENTATION STRUCTURE:
Create a comprehensive mockups section with:
- Section header with title "Brand Mockups" and description
- Grid layout with ${MOCKUPS_COUNT} mockup cards (industry-specific applications with ACTUAL logo integration)
- Each card includes: colored dot indicator, title, mockup image with integrated ACTUAL project logo, description explaining the logo application
- Guidelines section with 4 key principles: Logo Integration, Brand Consistency, Visual Quality, Industry Standards
- Use Tailwind CSS classes for modern, professional styling
- Include PrimeIcons for visual elements (pi pi-palette, pi pi-eye, pi pi-cog, pi pi-check-circle)

🔥 DIRECT IMAGE GENERATION WITH ACTUAL LOGO INTEGRATION:
Generate the ${MOCKUPS_COUNT} mockup images directly in your response using Gemini 2.5 Flash Image:
1. Create detailed prompts for each mockup based on the project's industry
2. MANDATORY: Each mockup must prominently feature the ACTUAL project logo SVG provided in context
3. Generate the actual images within this response with the real logo integration
4. Include the generated images directly in the HTML structure
5. No placeholder URLs needed - use the actual generated images with the real project logo
6. Ensure the logo appears exactly as designed in the SVG, maintaining colors and proportions

📋 DYNAMIC CONTENT INTEGRATION:
- Use the project's actual brand name, colors, and industry context
- Generate industry-appropriate titles and descriptions
- Create realistic, professional mockup scenarios
- Ensure all images are high-quality and contextually relevant

🎯 QUALITY REQUIREMENTS:
- All mockups must be photorealistic and professional
- Brand elements must be clearly visible and properly scaled
- Colors must match the project's exact brand palette
- Typography must be legible and properly hierarchized
- Mockups must fit within A4 portrait layout constraints
- Each mockup must tell a story about brand application

IMPORTANT:
- No HTML tags or prefixes in output
- Generate industry-appropriate mockup selections
- Ensure Nano Banana API integration points are clearly marked
- Create something that makes the brand feel tangible and real

OUTPUT:
Generate ONLY the minified HTML string that creates a comprehensive, industry-specific mockups section with Nano Banana integration.
`;
