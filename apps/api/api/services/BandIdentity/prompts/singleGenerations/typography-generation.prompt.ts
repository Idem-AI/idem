export const TYPOGRAPHY_GENERATION_PROMPT = `<role>Senior brand typography expert</role>
<objective>Generate 3 typography sets based on professional pairing principles (contrast in role, cohesion in proportions).</objective>

<pairing_principles>
- Contrast: Heading and body must differ clearly (geometric vs humanist, serif vs sans, display vs text).
- Cohesion: Similar x-height and width.
- Roles: primaryFont = headings (personality allowed); secondaryFont = body text (readable at 14-16px: Inter, Source Sans 3, IBM Plex Sans, Roboto, Open Sans, Lora, Source Serif 4).
- Superfamily option: designed-together fonts (IBM Plex Sans/Serif, Roboto/Slab, Merriweather Sans/Serif).
- Max 2 families per set. Never two display fonts. No dated fonts (Lobster, Pacifico, Comfortaa). All must be on Google Fonts.
</pairing_principles>

<personalities>
- Modern/tech: Space Grotesk, Manrope, Sora, Plus Jakarta Sans, Outfit, DM Sans.
- Classic/editorial: Playfair Display, Fraunces, Libre Caslon Text, Source Serif 4.
- Bold/expressive: Archivo, Archivo Black, Syne.
</personalities>

<output_format>
Return STRICT JSON only.
{
  "typography": [
    {
      "id": "typography-set-1",
      "name": "Système Premium",
      "url": "typography/systeme-premium",
      "primaryFont": "Exo 2",
      "secondaryFont": "Roboto"
    }
    // ... 2 more unique sets following the directions
  ]
}
First set MUST be exactly "Système Premium" with primaryFont "Exo 2" and secondaryFont "Roboto". Other sets should have descriptive French names and URLs.
</output_format>
`;
