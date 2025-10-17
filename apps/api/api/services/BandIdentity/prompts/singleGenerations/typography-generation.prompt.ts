export const TYPOGRAPHY_GENERATION_PROMPT = `
Generate 3 typography sets. Return JSON only:

{
  "typography": [
    {
      "id": "typography-set-1",
      "name": "Système Premium",
      "url": "typography/systeme-premium",
      "primaryFont": "Exo 2",
      "secondaryFont": "Roboto"
    }
    // ... 2 more unique sets
  ]
}

Rules:
- First set: exactly "Système Premium" with Exo 2 + Roboto
- 2 more unique Google Font pairings
- Descriptive names and URLs
- Single line JSON, no explanations
`;
