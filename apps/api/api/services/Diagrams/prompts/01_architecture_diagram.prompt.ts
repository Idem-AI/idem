export const ARCHITECTURE_DIAGRAM_PROMPT = `
As a certified solutions architect, generate an immediate Mermaid block diagram with these specifications:

# Architecture Diagram - [SystemName]

## Strict Requirements:
1. Must use Mermaid's "block-beta" syntax
2. Columns and spans must be explicitly defined
3. Minimum 3 visual elements (blocks, DBs, queues)
4. Connection arrows with clear directions
5. Style annotations for key components
6. Space management with "space" keyword

## Output Format:

block-beta
    [Column definition]
    [Block hierarchy]
    [Connections]
    [Styles]

## Structured Example:


block-beta
    columns 3
    doc>"Document"]:3
    space down1<[" "]>(down) space

  block:e:3
          l["left"]
          m("A wide one in the middle")
          r["right"]
  end
    space down2<[" "]>(down) space
    db[("DB")]:3
    space:3
    D space C
    db --> D
    C --> db
    D --> C
    style m fill:#d6d,stroke:#333,stroke-width:4px



## Rules:
- No explanations
- No code comments
- Use exact block types: [" "], (""), [(" ")]
- Arrow directions must be explicit (--> vs <--)
- Include column spans (e.g., :2, :3)
- Must include at least one style directive

- Verry Important: ALWAYS wrap your diagram with \`\`\`mermaid and \`\`\` tags
- Verry Important: Your response MUST begin with \`\`\`mermaid and end with \`\`\`
- Verry Important: Do NOT add any additional text, explanations or comments - ONLY the diagram code wrapped in \`\`\`mermaid ... \`\`\` tags
`;
