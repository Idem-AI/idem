import { Schema } from 'mongoose';

export const ContactSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    subject: { type: String, required: true },
    message: { type: String, required: true },
    status: { 
      type: String, 
      enum: ['new', 'read', 'replied', 'archived'],
      default: 'new' 
    },
    ipAddress: { type: String },
    userAgent: { type: String }
  },
  {
    timestamps: true,
    collection: 'contacts'
  }
);

ContactSchema.index({ status: 1, createdAt: -1 });
ContactSchema.index({ email: 1 });
