import {z} from "zod";

interface JsonSchemaBase {
    type: string;
    description?: string;
}

interface JsonSchemaObject extends JsonSchemaBase {
    type: 'object';
    properties?: { [key: string]: JsonSchema };
    required?: string[];
    additionalProperties?: boolean;
}

interface JsonSchemaArray extends JsonSchemaBase {
    type: 'array';
    items?: JsonSchema;
}

type JsonSchema =
    | JsonSchemaBase
    | JsonSchemaObject
    | JsonSchemaArray
    | {
    type: 'string' | 'number' | 'boolean';
    description?: string;
};

export function jsonSchemaToZodSchema(jsonSchema: JsonSchema): z.ZodType {
    if (jsonSchema.type === 'object') {
        const objectSchema = jsonSchema as JsonSchemaObject;
        const properties = objectSchema.properties || {};
        const requiredFields = objectSchema.required || [];

        const zodSchemaFields: { [key: string]: z.ZodType } = {};

        // 遍历每个属性
        Object.keys(properties).forEach(key => {
            const prop = properties[key];
            let zodType: z.ZodType;

            // 根据类型转换到对应的 Zod 类型
            switch (prop.type) {
                case 'string':
                    zodType = z.string();
                    break;
                case 'number':
                    zodType = z.number();
                    break;
                case 'boolean':
                    zodType = z.boolean();
                    break;
                case 'array':
                    const arraySchema = prop as JsonSchemaArray;
                    zodType = z.array(jsonSchemaToZodSchema(arraySchema.items || { type: 'any' }));
                    break;
                case 'object':
                    zodType = jsonSchemaToZodSchema(prop);
                    break;
                default:
                    zodType = z.any();
            }

            if (prop.description) {
                zodType = zodType.describe(prop.description);
            }

            if (!requiredFields.includes(key)) {
                zodType = zodType.optional();
            }

            zodSchemaFields[key] = zodType;
        });

        const additionalProperties = objectSchema.additionalProperties ?? true;

        return additionalProperties ? z.object(zodSchemaFields).passthrough() : z.object(zodSchemaFields).strict();
    }

    switch (jsonSchema.type) {
        case 'string':
            return z.string().describe(jsonSchema.description);
        case 'number':
            return z.number().describe(jsonSchema.description);
        case 'boolean':
            return z.boolean().describe(jsonSchema.description);
        case 'array':
            const arraySchema = jsonSchema as JsonSchemaArray;
            return z.array(jsonSchemaToZodSchema(arraySchema.items || { type: 'any' }))
                .describe(arraySchema.description);
        default:
            return z.any();
    }
}