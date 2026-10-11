/**
 * Déclarations d'outils (function-calling) des agents, au format de schéma que
 * `PromptService` traduit en `tools` OpenAI. `Type` garde les valeurs en
 * MAJUSCULES : c'est l'écriture des déclarations existantes, mise en minuscules
 * à la traduction.
 */
export const Type = {
  STRING: 'STRING',
  NUMBER: 'NUMBER',
  INTEGER: 'INTEGER',
  BOOLEAN: 'BOOLEAN',
  ARRAY: 'ARRAY',
  OBJECT: 'OBJECT',
} as const;

export interface ToolSchema {
  type?: string;
  description?: string;
  enum?: string[];
  properties?: Record<string, ToolSchema>;
  required?: string[];
  items?: ToolSchema;
}

export interface FunctionDeclaration {
  name?: string;
  description?: string;
  parameters?: ToolSchema;
}
