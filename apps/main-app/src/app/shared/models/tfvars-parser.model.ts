/**
 * Models for parsing and managing Terraform tfvars files
 */

export type TfVarType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'list'
  | 'map'
  | 'object';

export interface TfVarValue {
  type: TfVarType;
  value: any;
  originalValue?: string; // Pour conserver le format original
}

export interface TfVariable {
  key: string;
  type: TfVarType;
  value: any;
  description?: string;
  required?: boolean;
  sensitive?: boolean;
  originalLine?: number;
  originalFormat?: string;
}

export interface TfVarsSection {
  name: string;
  variables: TfVariable[];
  order: number;
}

export interface ParsedTfVars {
  variables: TfVariable[];
  sections?: TfVarsSection[];
  rawContent: string;
  parseErrors?: string[];
}

export interface TfVarFormField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'textarea' | 'array' | 'object';
  value: any;
  required: boolean;
  description?: string;
  placeholder?: string;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
  };
}

export interface TfVarFormSection {
  name: string;
  label: string;
  description?: string;
  fields: TfVarFormField[];
  collapsible: boolean;
  collapsed: boolean;
}

export interface TfVarsFormData {
  sections: TfVarFormSection[];
  customFields: TfVarFormField[];
}

/**
 * Edit mode for tfvars files
 */
export type TfVarsEditMode = 'code' | 'form';

/**
 * Edit state for tfvars files
 */
export interface TfVarsEditState {
  mode: TfVarsEditMode;
  canSwitchToCode: boolean;
  canSwitchToForm: boolean;
  hasUnsavedChanges: boolean;
}
