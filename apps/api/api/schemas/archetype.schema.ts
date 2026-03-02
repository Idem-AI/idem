import { Schema } from 'mongoose';

export const ArchetypeSchema = new Schema(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    provider: { 
      type: String, 
      enum: ['aws', 'gcp', 'azure'],
      required: true 
    },
    category: { type: String, required: true },
    tags: [{ type: String }],
    icon: { type: String },
    version: { type: String, default: '1.0.0' },
    terraformVariables: [{
      name: { type: String, required: true },
      type: { 
        type: String, 
        enum: ['string', 'number', 'bool', 'list(string)', 'list(number)', 'map(string)', 'map(number)', 'object'],
        required: true 
      },
      description: { type: String },
      default: { type: Schema.Types.Mixed },
      required: { type: Boolean, default: false },
      sensitive: { type: Boolean, default: false },
      validation: {
        condition: { type: String },
        error_message: { type: String }
      },
      allowed_values: [{ type: Schema.Types.Mixed }],
      min_length: { type: Number },
      max_length: { type: Number },
      min_value: { type: Number },
      max_value: { type: Number }
    }],
    defaultValues: { type: Schema.Types.Mixed },
    isActive: { type: Boolean, default: true }
  },
  {
    timestamps: true,
    collection: 'archetypes'
  }
);

ArchetypeSchema.index({ provider: 1, category: 1 });
ArchetypeSchema.index({ isActive: 1 });
ArchetypeSchema.index({ name: 'text', description: 'text' });
