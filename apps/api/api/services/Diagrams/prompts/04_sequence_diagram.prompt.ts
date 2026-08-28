export const SEQUENCE_DIAGRAM_PROMPT = `<objective>Generate a Mermaid sequence diagram.</objective>

<requirements>
1. Strict, valid Mermaid sequence diagram syntax.
2. UML 2.5 compliant.
3. Clear participant ordering.
4. Synchronous/asynchronous arrows (use ->, ->>, -->, -->> correctly).
5. Activation bars and return messages where needed.
</requirements>

<example>
sequenceDiagram
    participant Client
    participant Server
    participant Database

    Client->>Server: LoginRequest()
    activate Server
    Server->>Database: QueryCredentials()
    Database-->>Server: Results
    Server-->>Client: AuthResponse()
    deactivate Server
</example>

<output_format>
- Output ONLY the diagram code wrapped in \`\`\`mermaid and \`\`\` tags.
- No explanations, introduction, or comments.
</output_format>
`;
