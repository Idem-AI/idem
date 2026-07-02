export const ENTITY_DIAGRAM_PROMPT = `<objective>Generate a detailed entity relationship diagram in Mermaid format.</objective>

<requirements>
1. Use "erDiagram" syntax.
2. Include primary keys (PK) and foreign keys (FK) with proper data types.
3. Use cardinality notation (e.g., ||--o{).
4. Add relationship labels.
5. Reflect the project data model focusing on core entities.
</requirements>

<example>
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
</example>

<output_format>
- Output ONLY the diagram code wrapped in \`\`\`mermaid and \`\`\` tags.
- No explanations, introduction, or comments.
</output_format>
`;
