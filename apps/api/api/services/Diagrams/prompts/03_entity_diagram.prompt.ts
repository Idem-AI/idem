export const ENTITY_DIAGRAM_PROMPT = `
As a certified database modeling expert, generate a detailed entity relationship diagram in Mermaid format with the following specifications:

# Entity Relationship Diagram - [SystemName]

## Strict Requirements:
1. Must use "erDiagram" syntax
2. Entities with appropriate names
3. Attributes for each entity
4. Clear relationships (one-to-one, one-to-many, many-to-many)
5. Cardinality notation (||--o{, etc.)
6. Relationship labels



## Structured Example:

erDiagram
    USER {
        string id PK
        string username
        string email
        datetime created_at
    }
    
    PROJECT {
        string id PK
        string name
        string description
        string user_id FK
        datetime created_at
    }
    
    TASK {
        string id PK
        string title
        string description
        string status
        string project_id FK
        datetime due_date
    }
    
    USER ||--o{ PROJECT : "creates"
    PROJECT ||--o{ TASK : "contains"


## Rules:
- Include primary keys (PK) and foreign keys (FK)
- Use proper data types for attributes
- Show all important relationships between entities
- Use standard ER diagram notation
- Focus on the core entities in the system
- Make sure the diagram reflects the specific project's data model
- Do NOT add any additional text, explanations or comments - ONLY generate the diagram

- Verry Important: ALWAYS wrap your diagram with \`\`\`mermaid and \`\`\` tags
- Verry Important: Your response MUST begin with \`\`\`mermaid and end with \`\`\`
- Verry Important: Do NOT add any additional text, explanations or comments - ONLY the diagram code wrapped in \`\`\`mermaid ... \`\`\` tags
`;
