export const CLASS_DIAGRAM_PROMPT = `<objective>Generate a Mermaid class diagram.</objective>

<requirements>
1. Strict, valid Mermaid syntax.
2. UML 2.5 notation (PascalCase/CamelCase naming).
3. 3 levels of visibility (+, -, #).
4. Explicit primitive types (String, int, bool, etc.).
5. Methods with typed parameters.
6. Clear relationships with explicit cardinalities.
</requirements>

<example>
classDiagram
    class Client {
        +String name
        +String email
        +placeOrder(Article[] articles) bool
    }

    Client "1" --> "*" Order : places
    Order *-- Article : contains
</example>

<output_format>
- Output ONLY the diagram code wrapped in \`\`\`mermaid and \`\`\` tags.
- No explanations, introduction, or comments.
</output_format>
`;
