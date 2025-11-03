import { Injectable } from '@angular/core';
import {
  TfVariable,
  TfVarType,
  ParsedTfVars,
  TfVarsFormData,
  TfVarFormSection,
  TfVarFormField,
} from '../models/tfvars-parser.model';

@Injectable({
  providedIn: 'root',
})
export class TfVarsParserService {
  /**
   * Parse tfvars content into structured data
   */
  parseTfVarsContent(content: string): ParsedTfVars {
    const variables: TfVariable[] = [];
    const parseErrors: string[] = [];

    try {
      const lines = content.split('\n');
      let currentLineNumber = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        currentLineNumber = i + 1;

        // Skip empty lines and comments
        if (!line || line.startsWith('#') || line.startsWith('//')) {
          continue;
        }

        try {
          const variable = this.parseLine(line, currentLineNumber, lines, i);
          if (variable) {
            variables.push(variable);
          }
        } catch (error) {
          parseErrors.push(`Line ${currentLineNumber}: ${error}`);
        }
      }

      return {
        variables,
        rawContent: content,
        parseErrors: parseErrors.length > 0 ? parseErrors : undefined,
      };
    } catch (error) {
      return {
        variables: [],
        rawContent: content,
        parseErrors: [`Global parsing error: ${error}`],
      };
    }
  }

  /**
   * Parse a single line to extract variable
   */
  private parseLine(
    line: string,
    lineNumber: number,
    allLines: string[],
    currentIndex: number
  ): TfVariable | null {
    // Match variable assignment pattern: key = value
    const assignmentMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/);

    if (!assignmentMatch) {
      return null;
    }

    const key = assignmentMatch[1];
    let valueString = assignmentMatch[2];

    // Handle multi-line values (objects, arrays)
    if (valueString.includes('{') || valueString.includes('[')) {
      const multiLineValue = this.parseMultiLineValue(valueString, allLines, currentIndex);
      valueString = multiLineValue.value;
    }

    const { type, value } = this.parseValue(valueString);

    return {
      key,
      type,
      value,
      originalLine: lineNumber,
      originalFormat: line,
    };
  }

  /**
   * Parse multi-line values (objects, arrays)
   */
  private parseMultiLineValue(
    initialValue: string,
    allLines: string[],
    startIndex: number
  ): { value: string; endIndex: number } {
    let value = initialValue;
    let braceCount =
      (initialValue.match(/{/g) || []).length - (initialValue.match(/}/g) || []).length;
    let bracketCount =
      (initialValue.match(/\[/g) || []).length - (initialValue.match(/\]/g) || []).length;

    let endIndex = startIndex;

    // Continue reading lines until braces/brackets are balanced
    while ((braceCount > 0 || bracketCount > 0) && endIndex < allLines.length - 1) {
      endIndex++;
      const nextLine = allLines[endIndex].trim();
      value += '\n' + nextLine;

      braceCount += (nextLine.match(/{/g) || []).length - (nextLine.match(/}/g) || []).length;
      bracketCount += (nextLine.match(/\[/g) || []).length - (nextLine.match(/\]/g) || []).length;
    }

    return { value, endIndex };
  }

  /**
   * Parse value and determine type
   */
  private parseValue(valueString: string): { type: TfVarType; value: any } {
    const trimmed = valueString.trim();

    // Boolean
    if (trimmed === 'true' || trimmed === 'false') {
      return { type: 'boolean', value: trimmed === 'true' };
    }

    // Number
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      return { type: 'number', value: parseFloat(trimmed) };
    }

    // String (quoted)
    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
      return { type: 'string', value: trimmed.slice(1, -1) };
    }

    // Array
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const arrayContent = trimmed.slice(1, -1);
        const items = this.parseArrayItems(arrayContent);
        return { type: 'list', value: items };
      } catch {
        return { type: 'string', value: trimmed };
      }
    }

    // Object/Map
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const objectContent = trimmed.slice(1, -1);
        const obj = this.parseObjectContent(objectContent);
        return { type: 'object', value: obj };
      } catch {
        return { type: 'string', value: trimmed };
      }
    }

    // Default to string
    return { type: 'string', value: trimmed };
  }

  /**
   * Parse array items
   */
  private parseArrayItems(content: string): any[] {
    const items: any[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.endsWith(',')) {
        continue;
      }

      const itemValue = trimmed.replace(/,$/, '').trim();
      if (itemValue) {
        const { value } = this.parseValue(itemValue);
        items.push(value);
      }
    }

    return items;
  }

  /**
   * Parse object content
   */
  private parseObjectContent(content: string): Record<string, any> {
    const obj: Record<string, any> = {};
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const match = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/);
      if (match) {
        const key = match[1];
        const valueString = match[2].replace(/,$/, '').trim();
        const { value } = this.parseValue(valueString);
        obj[key] = value;
      }
    }

    return obj;
  }

  /**
   * Convert parsed variables to form data
   */
  convertToFormData(parsedTfVars: ParsedTfVars): TfVarsFormData {
    const sections: TfVarFormSection[] = [];

    // Group variables by logical sections
    const groupedVars = this.groupVariablesBySection(parsedTfVars.variables);

    for (const [sectionName, variables] of Object.entries(groupedVars)) {
      const fields: TfVarFormField[] = variables.map((variable) =>
        this.convertVariableToFormField(variable)
      );

      sections.push({
        name: sectionName,
        label: this.formatSectionLabel(sectionName),
        description: this.getSectionDescription(sectionName),
        fields,
        collapsible: true,
        collapsed: false,
      });
    }

    return {
      sections,
      customFields: [],
    };
  }

  /**
   * Group variables by logical sections
   */
  private groupVariablesBySection(variables: TfVariable[]): Record<string, TfVariable[]> {
    const sections: Record<string, TfVariable[]> = {
      deployment: [],
      aws: [],
      networking: [],
      services: [],
      database: [],
      security: [],
      other: [],
    };

    for (const variable of variables) {
      const sectionName = this.determineSectionForVariable(variable.key);
      sections[sectionName].push(variable);
    }

    // Remove empty sections
    return Object.fromEntries(Object.entries(sections).filter(([_, vars]) => vars.length > 0));
  }

  /**
   * Determine which section a variable belongs to
   */
  private determineSectionForVariable(key: string): string {
    const lowerKey = key.toLowerCase();

    if (lowerKey.includes('deployment') || lowerKey.includes('name') || lowerKey.includes('tag')) {
      return 'deployment';
    }
    if (
      lowerKey.includes('aws') ||
      lowerKey.includes('region') ||
      lowerKey.includes('access') ||
      lowerKey.includes('secret')
    ) {
      return 'aws';
    }
    if (
      lowerKey.includes('vpc') ||
      lowerKey.includes('subnet') ||
      lowerKey.includes('cidr') ||
      lowerKey.includes('zone')
    ) {
      return 'networking';
    }
    if (
      lowerKey.includes('service') ||
      lowerKey.includes('web') ||
      lowerKey.includes('app') ||
      lowerKey.includes('docker')
    ) {
      return 'services';
    }
    if (
      lowerKey.includes('db') ||
      lowerKey.includes('database') ||
      lowerKey.includes('mysql') ||
      lowerKey.includes('postgres')
    ) {
      return 'database';
    }
    if (
      lowerKey.includes('waf') ||
      lowerKey.includes('security') ||
      lowerKey.includes('ssl') ||
      lowerKey.includes('cert')
    ) {
      return 'security';
    }

    return 'other';
  }

  /**
   * Convert variable to form field
   */
  private convertVariableToFormField(variable: TfVariable): TfVarFormField {
    const field: TfVarFormField = {
      key: variable.key,
      label: this.formatFieldLabel(variable.key),
      type: this.mapTypeToFormType(variable.type),
      value: variable.value,
      required: this.isFieldRequired(variable.key),
      description: this.getFieldDescription(variable.key),
    };

    // Add validation rules
    field.validation = this.getFieldValidation(variable.key, variable.type);

    return field;
  }

  /**
   * Map TfVarType to form field type
   */
  private mapTypeToFormType(type: TfVarType): TfVarFormField['type'] {
    switch (type) {
      case 'string':
        return 'text';
      case 'number':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'list':
        return 'array';
      case 'object':
      case 'map':
        return 'object';
      default:
        return 'text';
    }
  }

  /**
   * Format section label
   */
  private formatSectionLabel(sectionName: string): string {
    const labels: Record<string, string> = {
      deployment: 'Deployment Configuration',
      aws: 'AWS Configuration',
      networking: 'Network Configuration',
      services: 'Services Configuration',
      database: 'Database Configuration',
      security: 'Security Configuration',
      other: 'Other Configuration',
    };

    return labels[sectionName] || sectionName;
  }

  /**
   * Get section description
   */
  private getSectionDescription(sectionName: string): string {
    const descriptions: Record<string, string> = {
      deployment: 'Basic deployment settings and metadata',
      aws: 'AWS credentials and region configuration',
      networking: 'VPC, subnets, and network configuration',
      services: 'Application services and container configuration',
      database: 'Database engine and connection settings',
      security: 'Security groups, WAF rules, and certificates',
      other: 'Additional configuration options',
    };

    return descriptions[sectionName] || '';
  }

  /**
   * Format field label
   */
  private formatFieldLabel(key: string): string {
    return key
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  }

  /**
   * Check if field is required
   */
  private isFieldRequired(key: string): boolean {
    const requiredFields = [
      'deployment_name',
      'region',
      'aws_access_key',
      'aws_secret_key',
      'root_domain',
    ];

    return requiredFields.includes(key);
  }

  /**
   * Get field description
   */
  private getFieldDescription(key: string): string {
    const descriptions: Record<string, string> = {
      deployment_name: 'Name of your deployment',
      region: 'AWS region where resources will be created',
      aws_access_key: 'AWS access key for authentication',
      aws_secret_key: 'AWS secret key for authentication',
      root_domain: 'Primary domain for your application',
      vpc_cidr: 'CIDR block for the VPC',
      log_retention_days: 'Number of days to retain CloudWatch logs',
    };

    return descriptions[key] || '';
  }

  /**
   * Get field validation rules
   */
  private getFieldValidation(key: string, type: TfVarType): TfVarFormField['validation'] {
    const validation: TfVarFormField['validation'] = {};

    if (key.includes('email')) {
      validation.pattern = '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$';
    }

    if (key.includes('domain')) {
      validation.pattern = '^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\\.[a-zA-Z]{2,}$';
    }

    if (type === 'number') {
      if (key.includes('port')) {
        validation.min = 1;
        validation.max = 65535;
      }
      if (key.includes('retention') || key.includes('days')) {
        validation.min = 1;
        validation.max = 3653; // 10 years
      }
    }

    return Object.keys(validation).length > 0 ? validation : undefined;
  }

  /**
   * Convert form data back to tfvars content
   */
  convertFormDataToTfVars(formData: TfVarsFormData): string {
    let content = '';

    for (const section of formData.sections) {
      if (section.fields.length === 0) continue;

      content += `# ${section.label}\n`;
      if (section.description) {
        content += `# ${section.description}\n`;
      }

      for (const field of section.fields) {
        content += this.formatVariableAssignment(field);
      }

      content += '\n';
    }

    // Add custom fields
    if (formData.customFields.length > 0) {
      content += '# Custom Fields\n';
      for (const field of formData.customFields) {
        content += this.formatVariableAssignment(field);
      }
    }

    return content.trim();
  }

  /**
   * Format a single variable assignment
   */
  private formatVariableAssignment(field: TfVarFormField): string {
    const value = this.formatValue(field.value, field.type);
    return `${field.key} = ${value}\n`;
  }

  /**
   * Format value based on type
   */
  private formatValue(value: any, type: TfVarFormField['type']): string {
    if (value === null || value === undefined) {
      return 'null';
    }

    switch (type) {
      case 'text':
      case 'textarea':
        return `"${value}"`;

      case 'number':
        return value.toString();

      case 'boolean':
        return value ? 'true' : 'false';

      case 'array':
        if (Array.isArray(value)) {
          const items = value.map((item) => this.formatValue(item, 'text')).join(',\n  ');
          return `[\n  ${items}\n]`;
        }
        return '[]';

      case 'object':
        if (typeof value === 'object' && value !== null) {
          const entries = Object.entries(value)
            .map(([key, val]) => `  ${key} = ${this.formatValue(val, 'text')}`)
            .join('\n');
          return `{\n${entries}\n}`;
        }
        return '{}';

      default:
        return `"${value}"`;
    }
  }
}
