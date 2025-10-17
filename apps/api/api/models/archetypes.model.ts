/**
 * Archetype model representing infrastructure templates and their configurations
 */
export interface ArchetypeModel {
  id: string;
  name: string;
  description: string;
  provider: "aws" | "gcp" | "azure";
  category: string;
  tags: string[];
  icon: string;
  version: string;
  terraformVariables: TerraformVariable[];
  defaultValues: Record<string, any>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Terraform variable definition for archetype templates
 */
export interface TerraformVariable {
  name: string;
  type: "string" | "number" | "bool" | "list(string)" | "list(number)" | "map(string)" | "map(number)" | "object";
  description?: string;
  default?: any;
  required: boolean;
  sensitive: boolean;
  validation?: {
    condition: string;
    error_message: string;
  };
  allowed_values?: any[];
  min_length?: number;
  max_length?: number;
  min_value?: number;
  max_value?: number;
}

/**
 * Template model for backward compatibility
 */
export interface TemplateModel {
  archetype_id: string;
  archetype_url: string;
  description: string;
  inputs: TemplateInput[];
}

export interface TemplateInput {
  name: string;
  type: string;
  default?: any;
  required?: boolean;
  sensitive?: boolean;
  optional?: boolean;
  allowed_values?: string[];
  fields?: Record<string, string>;
  object_fields?: Record<string, string | Record<string, any>>;
}

/**
 * Create archetype payload for API calls
 */
export interface CreateArchetypePayload {
  name: string;
  description: string;
  provider: "aws" | "gcp" | "azure";
  category: string;
  tags?: string[];
  icon?: string;
  version?: string;
  terraformVariables: TerraformVariable[];
  defaultValues?: Record<string, any>;
  isActive?: boolean;
}

/**
 * Update archetype payload for API calls
 */
export interface UpdateArchetypePayload {
  name?: string;
  description?: string;
  provider?: "aws" | "gcp" | "azure";
  category?: string;
  tags?: string[];
  icon?: string;
  version?: string;
  terraformVariables?: TerraformVariable[];
  defaultValues?: Record<string, any>;
  isActive?: boolean;
}

/**
 * Archetype validation helpers
 */
export class ArchetypeValidators {
  static validateCreatePayload(payload: CreateArchetypePayload): string[] {
    const errors: string[] = [];

    if (!payload.name || payload.name.trim().length === 0) {
      errors.push("Name is required");
    }

    if (!payload.description || payload.description.trim().length === 0) {
      errors.push("Description is required");
    }

    if (!payload.provider) {
      errors.push("Provider is required");
    }

    if (!payload.category || payload.category.trim().length === 0) {
      errors.push("Category is required");
    }

    if (!payload.terraformVariables || payload.terraformVariables.length === 0) {
      errors.push("At least one Terraform variable is required");
    } else {
      payload.terraformVariables.forEach((variable, index) => {
        if (!variable.name || variable.name.trim().length === 0) {
          errors.push(`Terraform variable at index ${index} must have a name`);
        }
        if (!variable.type) {
          errors.push(`Terraform variable '${variable.name}' must have a type`);
        }
      });
    }

    return errors;
  }

  static validateTerraformVariable(variable: TerraformVariable): string[] {
    const errors: string[] = [];

    if (!variable.name || variable.name.trim().length === 0) {
      errors.push("Variable name is required");
    }

    const validTypes = ["string", "number", "bool", "list(string)", "list(number)", "map(string)", "map(number)", "object"];
    if (!variable.type || !validTypes.includes(variable.type)) {
      errors.push(`Variable type must be one of: ${validTypes.join(", ")}`);
    }

    if (!variable.description || variable.description.trim().length === 0) {
      errors.push("Variable description is required");
    }

    return errors;
  }
}
  