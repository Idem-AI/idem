export const USE_CASE_DIAGRAM_PROMPT = `<objective>Generate a Mermaid flowchart-style use case diagram.</objective>

<requirements>
1. Use "flowchart TD" syntax.
2. Actors: rectangular nodes [name].
3. Use cases: rounded nodes (name).
4. Decisions: diamond nodes {name}.
5. Label all arrows with |"relationship"|.
6. Use subgraph for system boundaries.
</requirements>

<example>
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
</example>

<output_format>
- Output ONLY the diagram code wrapped in \`\`\`mermaid and \`\`\` tags.
- No explanations, introduction, or comments.
</output_format>
`;
