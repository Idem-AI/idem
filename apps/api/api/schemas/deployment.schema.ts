import { Schema } from 'mongoose';

export const DeploymentSchema = new Schema(
  {
    projectId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    mode: { 
      type: String, 
      enum: ['beginner', 'template', 'ai-assistant', 'expert'],
      required: true 
    },
    environment: { 
      type: String, 
      enum: ['development', 'staging', 'production'],
      required: true 
    },
    status: {
      type: String,
      enum: [
        'configuring',
        'pending',
        'building',
        'infrastructure-provisioning',
        'deploying',
        'deployed',
        'rollback',
        'failed',
        'cancelled'
      ],
      default: 'configuring'
    },
    gitRepository: {
      provider: { type: String, enum: ['github', 'gitlab', 'bitbucket', 'azure-repos'] },
      url: { type: String },
      branch: { type: String },
      accessToken: { type: String },
      webhookId: { type: String }
    },
    environmentVariables: [{
      key: { type: String },
      value: { type: String },
      isSecret: { type: Boolean, default: false }
    }],
    sensitiveVariables: [{
      key: { type: String },
      value: { type: String },
      isSecret: { type: Boolean, default: true }
    }],
    pipelines: [{
      id: { type: String },
      steps: [{
        name: { type: String },
        status: { type: String, enum: ['pending', 'in-progress', 'succeeded', 'failed', 'skipped'] },
        startedAt: { type: Date },
        finishedAt: { type: Date },
        logs: { type: String },
        errorMessage: { type: String },
        aiRecommendation: { type: String }
      }],
      startedAt: { type: Date },
      estimatedCompletionTime: { type: Date }
    }],
    staticCodeAnalysis: {
      score: { type: Number },
      issues: [{
        severity: { type: String },
        count: { type: Number }
      }],
      reportUrl: { type: String }
    },
    costEstimation: {
      monthlyCost: { type: Number },
      hourlyCost: { type: Number },
      oneTimeCost: { type: Number },
      currency: { type: String, default: 'USD' },
      estimatedAt: { type: Date },
      breakdown: [{
        componentId: { type: String },
        componentName: { type: String },
        cost: { type: Number },
        description: { type: String }
      }]
    },
    url: { type: String },
    version: { type: String },
    logs: { type: String },
    deployedAt: { type: Date },
    rollbackVersions: [{ type: String }],
    lastSuccessfulDeployment: { type: String },
    architectureComponents: [{ type: Schema.Types.Mixed }],
    generatedTerraformTfvarsFileContent: { type: String },
    generatedK8sFiles: [{
      name: { type: String },
      content: { type: String }
    }],
    generatedDockerFiles: [{
      name: { type: String },
      content: { type: String }
    }],
    // Mode-specific fields
    frameworkType: { type: String },
    buildCommand: { type: String },
    startCommand: { type: String },
    templateId: { type: String },
    templateName: { type: String },
    templateVersion: { type: String },
    customizations: { type: Schema.Types.Mixed },
    chatMessages: [{
      sender: { type: String, enum: ['user', 'ai'] },
      text: { type: String },
      timestamp: { type: Date },
      isRequestingDetails: { type: Boolean },
      isProposingArchitecture: { type: Boolean },
      isRequestingSensitiveVariables: { type: Boolean },
      proposedComponents: [{ type: Schema.Types.Mixed }],
      asciiArchitecture: { type: String },
      archetypeUrl: { type: String },
      requestedSensitiveVariables: [{ type: Schema.Types.Mixed }]
    }],
    aiGeneratedArchitecture: { type: Boolean },
    aiRecommendations: [{ type: String }],
    cloudComponents: [{ type: Schema.Types.Mixed }],
    customInfrastructureCode: { type: Boolean },
    infrastructureAsCodeFiles: [{
      name: { type: String },
      content: { type: String }
    }]
  },
  {
    timestamps: true,
    collection: 'deployments'
  }
);

DeploymentSchema.index({ projectId: 1, createdAt: -1 });
DeploymentSchema.index({ status: 1 });
DeploymentSchema.index({ environment: 1 });
