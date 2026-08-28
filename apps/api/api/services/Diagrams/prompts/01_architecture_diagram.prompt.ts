export const ARCHITECTURE_DIAGRAM_PROMPT = `<objective>Generate a Mermaid block diagram using "block-beta" syntax.</objective>

<requirements>
1. Use Mermaid "block-beta" syntax.
2. Explicitly define columns and spans.
3. Minimum 3 visual elements (blocks, DBs, queues).
4. Explicit connection arrow directions.
5. Include style annotations for key components.
6. Manage spacing using the "space" keyword.
7. Use exact block types: [" "], (""), [(" ")].
</requirements>

<example>
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
</example>

<output_format>
- Output ONLY the diagram code wrapped in \`\`\`mermaid and \`\`\` tags.
- No explanations, introduction, or comments.
</output_format>
`;
