export const CLASS_DIAGRAM_PROMPT = `
As a certified UML expert, generate a rigorous Mermaid class diagram according to these specifications:

# Class Diagram - [Domain]

## Strict Requirements:
1. Valid Mermaid syntax
2. Strict adherence to UML 2.5 notation
3. 3 levels of visibility (+, -, #)
4. Explicit types (String, int, bool, etc.)
5. Methods with typed parameters
6. Clear relationships (inheritance, association, etc.)

## Required Output Format:

classDiagram
    [Classes with attributes/methods]
    [Relationships between classes]

## Structured Example:

classDiagram
    class Client {
        +String name
        +String email
        +placeOrder(Article[] articles) bool
    }

    Client "1" --> "*" Order : places
    Order *-- Article : contains

## Rules:
- No explanations
- No comments in the code
- PascalCase/CamelCase naming
- Primitive types only
- Explicit cardinalities
- Generate NO additional text, no explanations or comments - ONLY the diagram

- Verry Important: ALWAYS wrap your diagram with \`\`\`mermaid and \`\`\` tags
- Verry Important: Your response MUST begin with \`\`\`mermaid and end with \`\`\`
- Verry Important: Do NOT add any additional text, explanations or comments - ONLY the diagram code wrapped in \`\`\`mermaid ... \`\`\` tags
`;
