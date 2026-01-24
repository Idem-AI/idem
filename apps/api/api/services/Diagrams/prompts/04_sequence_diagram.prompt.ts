export const SEQUENCE_DIAGRAM_PROMPT = `
As a certified UML expert, generate an immediate Mermaid sequence diagram with these specifications:

# Sequence Diagram - [InteractionName]

## Strict Requirements:
1. Valid Mermaid syntax
2. UML 2.5 compliant
3. Clear participant ordering
4. Synchronous/asynchronous arrows
5. Activation bars
6. Return messages where needed

## Output Format:
sequenceDiagram
    [Participants]
    [Interaction sequence]

## Structured Example:
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

## Rules:
- No explanations
- No code comments
- Use exact arrow types (->, ->>, -->, -->>)
- Include activations where appropriate
- Verry Important: ALWAYS wrap your diagram with \`\`\`mermaid and \`\`\` tags
- Verry Important: Your response MUST begin with \`\`\`mermaid and end with \`\`\`
- Verry Important: Do NOT add any additional text, explanations or comments - ONLY the diagram code wrapped in \`\`\`mermaid ... \`\`\` tags
`;
