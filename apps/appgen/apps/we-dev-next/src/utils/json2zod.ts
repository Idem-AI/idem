import { z } from 'zod';

export function jsonSchemaToZodSchema(jsonSchema: any): z.ZodTypeAny {
  if (!jsonSchema || typeof jsonSchema !== 'object') {
    return z.any();
  }

  const { type, properties, required = [], items, enum: enumValues } = jsonSchema;

  switch (type) {
    case 'string':
      if (enumValues && Array.isArray(enumValues)) {
        return z.enum(enumValues as [string, ...string[]]);
      }
      return z.string();

    case 'number':
      return z.number();

    case 'integer':
      return z.number().int();

    case 'boolean':
      return z.boolean();

    case 'array':
      if (items) {
        return z.array(jsonSchemaToZodSchema(items));
      }
      return z.array(z.any());

    case 'object':
      if (properties && typeof properties === 'object') {
        const shape: Record<string, z.ZodTypeAny> = {};

        for (const [key, value] of Object.entries(properties)) {
          const zodType = jsonSchemaToZodSchema(value);
          shape[key] = required.includes(key) ? zodType : zodType.optional();
        }

        return z.object(shape);
      }
      return z.record(z.any());

    default:
      return z.any();
  }
}
