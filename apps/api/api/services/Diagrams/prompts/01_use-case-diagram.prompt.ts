export const USE_CASE_DIAGRAM_PROMPT = `
As a certified UML expert, generate an immediate Mermaid flowchart-style use case diagram with these specifications:

# Use Case Diagram - [SystemName]

## Strict Requirements:
1. Must use "flowchart TD" syntax
2. Actors as rectangular nodes (A[ ])
3. Use cases as rounded nodes (B( ))
4. Decisions as diamonds C{ }
5. Arrows with |relationship| labels
6. System boundary as subgraph

## Output Format:
flowchart TD
    [Actors]
    [UseCases]
    [Relationships]
    [SystemBoundary]

## Structured Example:

flowchart TD
    U[User] -->|"Initiates"| L(Login)
    A[Admin] -->|"Manages"| UCM(User Management)
    
    subgraph System Boundary
        L -->|"requires"| V(Verify Credentials)
        UCM -->|"includes"| AU(Audit Usage)
    end
    
    V --> D{Valid?}
    D -->|Yes| S[Success]
    D -->|No| F(Failure)


## Rules:
- No explanations
- No code comments
- Actors must use [ ]
- Use cases must use ( )
- Decisions must use { }
- Label all arrows with |"text"|
- Include at least one system boundary
- Do NOT add any additional text, explanations or comments - ONLY generate the diagram code


- Verry Important: ALWAYS wrap your diagram with \`\`\`mermaid and \`\`\` tags
- Verry Important: Your response MUST begin with \`\`\`mermaid and end with \`\`\`
- Verry Important: Do NOT add any additional text, explanations or comments - ONLY the diagram code wrapped in \`\`\`mermaid ... \`\`\` tags
`;
