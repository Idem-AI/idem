import {
  DeploymentModel,
  QuickDeploymentModel,
  TemplateDeploymentModel,
  AiAssistantDeploymentModel,
  ExpertDeploymentModel,
  ChatMessage,
  PipelineStep,
  CreateDeploymentPayload,
  DeploymentFormData,
  DeploymentValidators,
  EnvironmentVariable,
} from "../../models/deployment.model";
import logger from "../../config/logger";
import {
  PromptService,
  LLMProvider,
  AIChatMessage,
  PromptConfig,
} from "../prompt.service";
import { GenericService } from "../common/generic.service";
import { spawn } from "child_process";
import { ProjectModel } from "../../models/project.model";
import { AI_CHAT_INITIAL_PROMPT } from "./prompts/ai-chat.prompt";
import { MAIN_TF_PROMPT } from "./prompts/terraform/00_main.prompt";
import * as crypto from "crypto";
import * as fs from "fs-extra";
import * as path from "path";
import { tmpdir } from "os";

export class DeploymentService extends GenericService {
  private readonly ENCRYPTION_ALGORITHM = "aes-256-gcm";
  private readonly ENCRYPTION_KEY: string;

  constructor(promptService: PromptService) {
    super(promptService);

    // Get encryption key from environment variable or generate a default one
    this.ENCRYPTION_KEY =
      process.env.SENSITIVE_VARS_ENCRYPTION_KEY || this.generateDefaultKey();

    if (!process.env.SENSITIVE_VARS_ENCRYPTION_KEY) {
      logger.warn(
        "SENSITIVE_VARS_ENCRYPTION_KEY not set in environment. Using default key (not recommended for production)."
      );
    }

    logger.info("DeploymentService initialized.");
  }

  /**
   * Generate a default encryption key (for development only)
   */
  private generateDefaultKey(): string {
    return crypto
      .scryptSync("idem-api-default-key", "salt", 32)
      .toString("hex");
  }

  private encryptValue(value: string): string {
    try {
      const key = Buffer.from(this.ENCRYPTION_KEY, "hex");
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(this.ENCRYPTION_ALGORITHM, key, iv);
      cipher.setAAD(Buffer.from("idem-deployment-vars"));

      let encrypted = cipher.update(value, "utf8", "hex");
      encrypted += cipher.final("hex");

      const authTag = cipher.getAuthTag();

      // Combine IV, auth tag, and encrypted data
      const result =
        iv.toString("hex") + ":" + authTag.toString("hex") + ":" + encrypted;

      logger.info("Successfully encrypted sensitive value");
      return result;
    } catch (error) {
      logger.error("Error encrypting sensitive value:", error);
      throw new Error("Failed to encrypt sensitive value");
    }
  }

  private decryptValue(encryptedValue: string): string {
    try {
      const key = Buffer.from(this.ENCRYPTION_KEY, "hex");
      const parts = encryptedValue.split(":");

      if (parts.length !== 3) {
        throw new Error("Invalid encrypted value format");
      }

      const iv = Buffer.from(parts[0], "hex");
      const authTag = Buffer.from(parts[1], "hex");
      const encrypted = parts[2];

      const decipher = crypto.createDecipheriv(
        this.ENCRYPTION_ALGORITHM,
        key,
        iv
      );
      decipher.setAAD(Buffer.from("idem-deployment-vars"));
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");

      logger.info("Successfully decrypted sensitive value");
      return decrypted;
    } catch (error) {
      logger.error("Error decrypting sensitive value:", error);
      throw new Error("Failed to decrypt sensitive value");
    }
  }

  async createDeployment(
    userId: string,
    projectId: string,
    payload: CreateDeploymentPayload
  ): Promise<DeploymentModel> {
    logger.info(
      `createDeployment called for userId: ${userId}, projectId: ${projectId}`
    );

    try {
      console.log("projectId", projectId);
      const project = await this.getProject(projectId, userId);
      if (project == null) {
        throw new Error("Project not found");
      }
      console.log("+++project", project);
      const formData: DeploymentFormData = {
        mode: "beginner",
        name: payload.name,
        environment: payload.environment,
        repoUrl: payload.gitRepository?.url,
        branch: payload.gitRepository?.branch,
        environmentVariables: payload.environmentVariables,
      };

      const validationErrors = this.validateDeploymentData(formData);
      if (validationErrors.length > 0) {
        throw new Error(`Validation failed: ${validationErrors.join(", ")}`);
      }

      const deploymentId = `deployment_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      const baseDeployment = {
        id: deploymentId,
        projectId,
        name: payload.name,
        environment: payload.environment,
        status: "configuring" as const,
        gitRepository: payload.gitRepository,
        environmentVariables: payload.environmentVariables || [],
        pipeline: {
          currentStage: "Initial Configuration",
          steps: this.initializePipelineSteps(),
          startedAt: undefined,
          estimatedCompletionTime: undefined,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Create the appropriate deployment model based on mode
      let newDeployment: DeploymentModel;

      const mode = payload.mode || "beginner";

      switch (mode) {
        case "template":
          const templateDeployment: TemplateDeploymentModel = {
            ...baseDeployment,
            mode: "template" as const,
            templateId: payload.architectureTemplate || "",
            templateName: payload.architectureTemplate
              ? "Template Architecture"
              : "",
          };

          newDeployment = templateDeployment;
          break;

        case "ai-assistant":
          const aiDeployment: AiAssistantDeploymentModel = {
            ...baseDeployment,
            mode: "ai-assistant" as const,
            chatMessages: project.activeChatMessages,
            aiGeneratedArchitecture: !!payload.aiGeneratedConfig,
            aiRecommendations: [],
            architectureComponents: payload.generatedComponents!,
          };

          newDeployment = aiDeployment;
          break;

        case "expert":
          const expertDeployment: ExpertDeploymentModel = {
            ...baseDeployment,
            mode: "expert" as const,
            cloudComponents: [],
            architectureComponents: payload.architectureComponents!,
            customInfrastructureCode: false,
          };

          newDeployment = expertDeployment;
          break;

        case "beginner":
        default:
          const quickDeployment: QuickDeploymentModel = {
            ...baseDeployment,
            mode: "beginner" as const,
            frameworkType: "",
            buildCommand: "",
            startCommand: "",
          };

          newDeployment = quickDeployment;
          break;
      }

      const updatedProject = await this.projectRepository.update(
        projectId,
        {
          deployments: [...(project.deployments || []), newDeployment],
          ...(mode === "ai-assistant" ? { activeChatMessages: [] } : {}),
        },
        `users/${userId}/projects`
      );

      if (!updatedProject) {
        throw new Error("Project not found");
      }

      logger.info(
        `Deployment created successfully - UserId: ${userId}, ProjectId: ${projectId}, DeploymentId: ${newDeployment.id}`
      );

      const generatedDeployment = await this.generateDeployment(
        userId,
        updatedProject,
        newDeployment
      );

      logger.info(
        `Deployment generated successfully - UserId: ${userId}, ProjectId: ${updatedProject.id}, DeploymentId: ${generatedDeployment.id}`
      );
      await this.projectRepository.update(
        projectId,
        {
          deployments: [...(project.deployments || []), generatedDeployment],
          ...(mode === "ai-assistant" ? { activeChatMessages: [] } : {}),
        },
        `users/${userId}/projects`
      );
      return generatedDeployment;
    } catch (error: any) {
      logger.error(
        `Error creating deployment for userId: ${userId}, projectId: ${projectId}. Error: ${error.message}`,
        { error: error.stack }
      );
      throw error;
    }
  }

  async executeDeployment(userId: string, deploymentId: string): Promise<void> {
    logger.info(
      `executeDeployment called for userId: ${userId}, deploymentId: ${deploymentId}`
    );

    try {
      // Retrieve deployment
      const deployment = await this.getDeploymentById(userId, deploymentId);
      if (!deployment) {
        throw new Error("Deployment not found");
      }

      // Mark deployment as deploying
      await this.updateDeployment(userId, deploymentId, {
        status: "deploying",
      });

      logger.info(`Executing Docker command for deployment: ${deployment.id}`);

      const deploymentExecutionCommand = `
      docker run --rm \
      -v $(pwd):/deploy \
      -e CLOUD_PROVIDER=aws \
      -e TF_BACKEND_BUCKET=idem-tf-state \
      -e TF_BACKEND_KEY=project-x/terraform.tfstate \
      -e TF_LOCK_TABLE=terraform-locks \
      -e TF_REGION=us-east-1 \
      -e TF_FIRST_RUN=true \
      -e TEMPLATE_URL="https://github.com/Idem-IA/ecs_aws_template.git" \
      ghcr.io/idem-ia/idem-worker:1.3
      `;

      // Compute the temp folder path used during generation for this deployment (if any)
      const tempDir = path.join(tmpdir(), "idem-deployments", deployment.id);

      // Ensure temporary directory exists
      await fs.ensureDir(tempDir);

      // Create terraform.tfvars file with sensitive variables injected
      if (deployment.generatedTerraformTfvarsFileContent) {
        // Inject sensitive variables into the tfvars content
        let tfvarsContent = this.injectSensitiveVariables(
          deployment.generatedTerraformTfvarsFileContent,
          deployment
        );

        // Strip markdown fences if present
        const trimmed = tfvarsContent.trim();
        if (trimmed.startsWith("```")) {
          tfvarsContent = trimmed.replace(
            /^```(?:terraform\.tfvars)?\s*\n?/,
            ""
          );
          tfvarsContent = tfvarsContent.replace(/\n?```\s*$/, "");
        }

        // Write terraform.tfvars file to temporary directory
        const tfvarsPath = path.join(tempDir, "terraform.tfvars");
        await fs.writeFile(tfvarsPath, tfvarsContent, "utf8");

        logger.info(
          `Created terraform.tfvars file with sensitive variables at: ${tfvarsPath}`,
          { deploymentId: deployment.id }
        );
      }

      // Log the full command being executed
      logger.info(
        `Executing Docker command: ${deploymentExecutionCommand.trim()}`,
        { deploymentId: deployment.id, tempDir }
      );

      try {
        const child = spawn(deploymentExecutionCommand, {
          shell: true,
          env: {
            ...process.env,
            DOCKER_BUILDKIT: "0",
            TF_LOG: "INFO",
            GIT_TRACE: "1",
            VERBOSE: "1",
            DEBUG: "1",
          },
          stdio: ["pipe", "pipe", "pipe"],
        });

        // Capture and log ALL output with timestamps
        child.stdout.on("data", (data: Buffer) => {
          const msg = data.toString();
          const timestamp = new Date().toISOString();
          try {
            process.stdout.write(`[${timestamp}] ${msg}`);
          } catch {}
          const lines = msg
            .split("\n")
            .filter((line) => line.trim().length > 0);
          lines.forEach((line) => {
            logger.info(`[DOCKER-STDOUT] ${line.trim()}`);
          });
        });

        child.stderr.on("data", (data: Buffer) => {
          const msg = data.toString();
          const timestamp = new Date().toISOString();
          try {
            process.stderr.write(`[${timestamp}] ${msg}`);
          } catch {}
          const lines = msg
            .split("\n")
            .filter((line) => line.trim().length > 0);
          lines.forEach((line) => {
            logger.warn(`[DOCKER-STDERR] ${line.trim()}`);
          });
        });

        logger.info(`Docker process started with PID: ${child.pid}`);

        const exitCode: number = await new Promise((resolve, reject) => {
          child.on("error", (err) => {
            logger.error(`Docker process error: ${err.message}`, {
              error: err,
            });
            reject(err);
          });
          child.on("close", (code) => {
            logger.info(`Docker process completed with exit code: ${code}`);
            resolve(code ?? 0);
          });
        });

        if (exitCode !== 0) {
          throw new Error(`Docker process exited with code ${exitCode}`);
        }

        // Success: mark deployment as deployed
        await this.updateDeployment(userId, deploymentId, {
          status: "deployed",
          deployedAt: new Date(),
        });

        logger.info(
          `Deployment executed successfully - UserId: ${userId}, DeploymentId: ${deployment.id}`
        );
      } finally {
        try {
          // await fs.remove(tempDir);
          logger.info(`Temporary deployment folder deleted: ${tempDir}`, {
            deploymentId: deployment.id,
          });
        } catch (cleanupErr: any) {
          logger.warn(
            `Failed to delete temporary deployment folder ${tempDir}: ${
              cleanupErr?.message || cleanupErr
            }`,
            { deploymentId: deployment.id }
          );
        }
      }
    } catch (error: any) {
      // Failure: mark deployment as failed
      try {
        await this.updateDeployment(userId, deploymentId, { status: "failed" });
      } catch {}

      logger.error(
        `Error executing deployment for userId: ${userId}, deploymentId: ${deploymentId}. Error: ${error.message}`,
        { error: error.stack }
      );
      throw error;
    }
  }

  /**
   * Execute deployment with streaming logs via SSE callback
   */
  async executeDeploymentWithStreaming(
    userId: string,
    deploymentId: string,
    streamCallback?: (logData: {
      type: "stdout" | "stderr" | "info" | "error" | "status";
      message: string;
      timestamp: string;
      step?: string;
    }) => Promise<void>
  ): Promise<void> {
    logger.info(
      `executeDeploymentWithStreaming called for userId: ${userId}, deploymentId: ${deploymentId}`
    );

    const sendLog = async (
      type: "stdout" | "stderr" | "info" | "error" | "status",
      message: string,
      step?: string
    ) => {
      const logData = {
        type,
        message,
        timestamp: new Date().toISOString(),
        ...(step && { step }),
      };

      if (streamCallback) {
        await streamCallback(logData);
      }
    };

    try {
      await sendLog(
        "info",
        "Starting deployment execution...",
        "initialization"
      );

      // Retrieve deployment
      const deployment = await this.getDeploymentById(userId, deploymentId);
      if (!deployment) {
        await sendLog("error", "Deployment not found");
        throw new Error("Deployment not found");
      }

      await sendLog(
        "info",
        `Found deployment: ${deployment.name}`,
        "validation"
      );

      // Mark deployment as deploying
      await this.updateDeployment(userId, deploymentId, {
        status: "deploying",
      });

      await sendLog(
        "status",
        'Deployment status updated to "deploying"',
        "status-update"
      );
      // Compute the temp folder path used during generation for this deployment (if any)
      const tempDir = path.join(tmpdir(), "idem-deployments", deployment.id);

      console.log("tempDir", tempDir);

      // Ensure temporary directory exists
      await fs.ensureDir(tempDir);
      await sendLog(
        "info",
        `Created temporary directory: ${tempDir}`,
        "docker-setup"
      );

      // Create terraform.tfvars file in temporary directory
      if (deployment.generatedTerraformTfvarsFileContent) {
        await sendLog(
          "info",
          "Processing terraform.tfvars file content...",
          "terraform-setup"
        );

        // Inject sensitive variables into the tfvars content
        let tfvarsContent = this.injectSensitiveVariables(
          deployment.generatedTerraformTfvarsFileContent,
          deployment
        );

        // Strip markdown fences if present, e.g., ```terraform.tfvars ... ```
        const trimmed = tfvarsContent.trim();
        if (trimmed.startsWith("```")) {
          // Remove leading fence with optional language hint
          tfvarsContent = trimmed.replace(
            /^```(?:terraform\.tfvars)?\s*\n?/,
            ""
          );
          // Remove trailing fence
          tfvarsContent = tfvarsContent.replace(/\n?```\s*$/, "");
        }

        // Write terraform.tfvars file to temporary directory
        const tfvarsPath = path.join(tempDir, "terraform.tfvars");
        await fs.writeFile(tfvarsPath, tfvarsContent, "utf8");

        await sendLog(
          "info",
          `Created terraform.tfvars file at: ${tfvarsPath}`,
          "terraform-setup"
        );
      } else {
        await sendLog(
          "info",
          "No terraform.tfvars content found in deployment",
          "terraform-setup"
        );
      }

      await sendLog(
        "info",
        `Preparing Docker command for deployment: ${deployment.id}`,
        "docker-setup"
      );

      const deploymentExecutionCommand = `
      docker run --rm \
      -v "${tempDir}":/deploy \
      -e CLOUD_PROVIDER=aws \
      -e TF_BACKEND_BUCKET=idem-tf-state \
      -e TF_BACKEND_KEY=project-x/terraform.tfstate \
      -e TF_LOCK_TABLE=terraform-locks \
      -e TF_REGION=us-east-1 \
      -e TF_FIRST_RUN=true \
      -e TEMPLATE_URL="https://github.com/Idem-IA/ecs_aws_template.git" \
      ghcr.io/idem-ia/idem-worker:1.6
      `;

      await sendLog(
        "info",
        `Docker command prepared. Temp directory: ${tempDir}`,
        "docker-setup"
      );
      await sendLog(
        "info",
        `Executing: ${deploymentExecutionCommand.trim()}`,
        "docker-execution"
      );

      logger.info(
        `Executing Docker command: ${deploymentExecutionCommand.trim()}`,
        { deploymentId: deployment.id, tempDir }
      );

      try {
        const child = spawn(deploymentExecutionCommand, {
          shell: true,
          cwd: tempDir, // Run from temporary directory
          env: {
            ...process.env,
            DOCKER_BUILDKIT: "0",
            TF_LOG: "INFO",
            GIT_TRACE: "1",
            VERBOSE: "1",
            DEBUG: "1",
          },
          stdio: ["pipe", "pipe", "pipe"],
        });

        await sendLog(
          "info",
          `Docker process started with PID: ${child.pid}`,
          "docker-execution"
        );

        // Capture and stream ALL output with timestamps
        child.stdout.on("data", async (data: Buffer) => {
          const msg = data.toString();
          const timestamp = new Date().toISOString();
          try {
            process.stdout.write(`[${timestamp}] ${msg}`);
          } catch {}
          const lines = msg
            .split("\n")
            .filter((line) => line.trim().length > 0);

          for (const line of lines) {
            logger.info(`[DOCKER-STDOUT] ${line.trim()}`);
            await sendLog("stdout", line.trim(), "docker-execution");
          }
        });

        child.stderr.on("data", async (data: Buffer) => {
          const msg = data.toString();
          const timestamp = new Date().toISOString();
          try {
            process.stderr.write(`[${timestamp}] ${msg}`);
          } catch {}
          const lines = msg
            .split("\n")
            .filter((line) => line.trim().length > 0);

          for (const line of lines) {
            logger.warn(`[DOCKER-STDERR] ${line.trim()}`);
            await sendLog("stderr", line.trim(), "docker-execution");
          }
        });

        logger.info(`Docker process started with PID: ${child.pid}`);

        const exitCode: number = await new Promise((resolve, reject) => {
          child.on("error", async (err) => {
            logger.error(`Docker process error: ${err.message}`, {
              error: err,
            });
            await sendLog(
              "error",
              `Docker process error: ${err.message}`,
              "docker-execution"
            );
            reject(err);
          });
          child.on("close", async (code) => {
            logger.info(`Docker process completed with exit code: ${code}`);
            await sendLog(
              "info",
              `Docker process completed with exit code: ${code}`,
              "docker-execution"
            );
            resolve(code ?? 0);
          });
        });

        if (exitCode !== 0) {
          await sendLog(
            "error",
            `Docker process exited with code ${exitCode}`,
            "docker-execution"
          );
          throw new Error(`Docker process exited with code ${exitCode}`);
        }

        await sendLog(
          "info",
          "Docker execution completed successfully",
          "docker-execution"
        );
        await sendLog(
          "status",
          'Updating deployment status to "deployed"',
          "status-update"
        );

        // Success: mark deployment as deployed
        await this.updateDeployment(userId, deploymentId, {
          status: "deployed",
          deployedAt: new Date(),
        });

        await sendLog(
          "status",
          "Deployment completed successfully!",
          "completion"
        );
        logger.info(
          `Deployment executed successfully - UserId: ${userId}, DeploymentId: ${deployment.id}`
        );
      } finally {
        try {
          await sendLog(
            "info",
            `Cleaning up temporary folder: ${tempDir}`,
            "cleanup"
          );
          // await fs.remove(tempDir);
          logger.info(`Temporary deployment folder deleted: ${tempDir}`, {
            deploymentId: deployment.id,
          });
          await sendLog("info", "Cleanup completed", "cleanup");
        } catch (cleanupErr: any) {
          const cleanupMessage = `Failed to delete temporary deployment folder ${tempDir}: ${
            cleanupErr?.message || cleanupErr
          }`;
          logger.warn(cleanupMessage, { deploymentId: deployment.id });
          await sendLog("error", cleanupMessage, "cleanup");
        }
      }
    } catch (error: any) {
      // Failure: mark deployment as failed
      try {
        await this.updateDeployment(userId, deploymentId, { status: "failed" });
        await sendLog(
          "status",
          'Deployment status updated to "failed"',
          "status-update"
        );
      } catch {}

      const errorMessage = `Error executing deployment: ${error.message}`;
      await sendLog("error", errorMessage, "error");
      logger.error(
        `Error executing deployment for userId: ${userId}, deploymentId: ${deploymentId}. Error: ${error.message}`,
        { error: error.stack }
      );
      throw error;
    }
  }

  // Legacy method for backward compatibility
  async generateDeployment(
    userId: string,
    project: ProjectModel,
    deployment: DeploymentModel
  ): Promise<DeploymentModel> {
    logger.info(
      `generateDeployment called for userId: ${userId}, projectId: ${project.id}`
    );

    try {
      const generatedFile = await this.generateTerraformTfvarsFile(
        deployment,
        project,
        userId
      );
      if (!generatedFile) {
        throw new Error("Terraform tfvars file not generated");
      }

      deployment.generatedTerraformTfvarsFileContent = generatedFile;
      // Write the generated tfvars to a temp folder for this deployment
      const tempDir = path.join(tmpdir(), "idem-deployments", deployment.id);
      await fs.ensureDir(tempDir);
      const tfvarsPath = path.join(tempDir, "terraform.tfvars");
      await fs.writeFile(tfvarsPath, generatedFile, "utf8");
      logger.info(`Terraform tfvars saved to temporary folder: ${tfvarsPath}`, {
        deploymentId: deployment.id,
      });

      // Update the project with the new deployment
      await this.projectRepository.update(
        project.id!,
        project,
        `users/${userId}/projects`
      );

      logger.info(
        `Successfully generated deployment for userId: ${userId}, projectId: ${project.id}, deploymentId: ${deployment.id}`
      );
      return deployment;
    } catch (error: any) {
      logger.error(
        `Error generating deployment for userId: ${userId}, projectId: ${project.id}. Error: ${error.message}`,
        { error: error.stack }
      );
      throw error;
    }
  }

  /**
   * Generate Terraform files for a deployment
   * @param deployment Deployment model
   * @returns Array of file contents with name and content
   */
  private async generateTerraformTfvarsFile(
    deployment: DeploymentModel,
    Project: ProjectModel,
    userId: string,
    customValues: Record<string, any> = {}
  ): Promise<string> {
    logger.info(
      `Generating Terraform tfvars file using AI for deployment: ${deployment.id}`
    );

    try {
      // Import ArchetypeService to get all archetypes
      const { ArchetypeService } = await import("../archetype.service");
      const archetypeService = new ArchetypeService();

      // Get all available archetypes to include in the AI prompt
      const allArchetypes = await archetypeService.getArchetypes();

      logger.info(
        `Retrieved ${allArchetypes.length} archetypes for AI context`,
        {
          deploymentId: deployment.id,
          archetypeCount: allArchetypes.length,
        }
      );

      // Prepare deployment context for AI
      const deploymentContext = {
        projectName: Project.name,
        deployment: {
          name: deployment.name,
          environment: deployment.environment,
          // Include non-secret environment variables only
          environmentVariables:
            deployment.environmentVariables?.filter((env) => !env.isSecret) ||
            [],
        },
        architectureTemplate: deployment.architectureComponents,
        customValues,
      };

      // Format archetypes for AI prompt
      const archetypesForPrompt = allArchetypes.map((archetype) => ({
        archetype_id: archetype.id,
        name: archetype.name,
        description: archetype.description,
        provider: archetype.provider,
        category: archetype.category,
        tags: archetype.tags,
        terraformVariables: archetype.terraformVariables.map((variable) => ({
          name: variable.name,
          type: variable.type,
          description: variable.description,
          default: variable.default,
          required: variable.required,
          sensitive: variable.sensitive,
          allowed_values: variable.allowed_values,
          validation: variable.validation,
        })),
        defaultValues: archetype.defaultValues,
      }));

      // Build the AI prompt with system prompt and context
      const systemPrompt = MAIN_TF_PROMPT;
      const userPrompt = `
Please generate a terraform.tfvars file for the following deployment:

**Deployment Information:**
${JSON.stringify(deploymentContext, null, 2)}

**Available Archetypes:**
${JSON.stringify(archetypesForPrompt, null, 2)}

**Instructions:**
1. Analyze the deployment requirements and architecture template
2. Select the most appropriate archetype from the available list
3. Generate a complete terraform.tfvars file based on the selected archetype
4. Include all required variables with appropriate values
5. Use deployment-specific information (name, environment, etc.) in the variable values
6. Include environment variables as terraform variables where appropriate
7. Follow the archetype's variable definitions strictly

Please provide only the terraform.tfvars file content as output.`;

      // Use AI to generate the tfvars content
      const promptConfig: PromptConfig = {
        provider: LLMProvider.GEMINI,
        modelName: "gemini-2.5-flash",
        llmOptions: {
          temperature: 0.3,
          maxOutputTokens: 4000,
        },
        userId,
        promptType: "terraform_tfvars_generation",
      };

      const messages: AIChatMessage[] = [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ];

      const aiResponse = await this.promptService.runPrompt(
        promptConfig,
        messages
      );

      if (!aiResponse || aiResponse.trim().length === 0) {
        logger.error(
          `AI failed to generate tfvars content for deployment ${deployment.id}`
        );
        return "";
      }

      logger.info(
        `AI generated Terraform tfvars file for deployment: ${deployment.id}`,
        {
          deploymentId: deployment.id,
          contentLength: aiResponse.length,
          archetypesUsed: allArchetypes.length,
        }
      );

      // Return the AI-generated content WITHOUT injecting sensitive variables
      // Sensitive variables will be injected only during execution in executeDeployment/executeDeploymentWithStreaming
      return aiResponse;
    } catch (error) {
      logger.error(
        `Error generating Terraform tfvars file with AI for deployment ${deployment.id}:`,
        {
          error: error instanceof Error ? error.message : error,
          stack: error instanceof Error ? error.stack : undefined,
          deploymentId: deployment.id,
        }
      );
      return "";
    }
  }

  /**
   * Inject sensitive variables into the generated tfvars content
   * @param tfvarsContent Original tfvars content generated by AI
   * @param deployment Deployment containing sensitive variables
   * @returns Modified tfvars content with sensitive variables injected
   */
  private injectSensitiveVariables(
    tfvarsContent: string,
    deployment: DeploymentModel
  ): string {
    if (
      !deployment.sensitiveVariables ||
      deployment.sensitiveVariables.length === 0
    ) {
      logger.info(
        `No sensitive variables to inject for deployment ${deployment.id}`
      );
      return tfvarsContent;
    }

    let modifiedContent = tfvarsContent;

    // Inject each sensitive variable into the tfvars content
    deployment.sensitiveVariables.forEach((variable) => {
      const variableName = variable.key;

      // Decrypt the sensitive value before injection
      let decryptedValue: string;
      try {
        decryptedValue = this.decryptValue(variable.value);
      } catch (error) {
        logger.error(
          `Failed to decrypt sensitive variable ${variableName} for deployment ${deployment.id}:`,
          error
        );
        return; // Skip this variable if decryption fails
      }

      // Format the value based on type (string values need quotes)
      const formattedValue =
        typeof decryptedValue === "string"
          ? `"${decryptedValue}"`
          : decryptedValue;

      // Check if variable already exists in the content
      const variableRegex = new RegExp(`^\\s*${variableName}\\s*=.*$`, "gm");

      if (variableRegex.test(modifiedContent)) {
        // Replace existing variable
        modifiedContent = modifiedContent.replace(
          variableRegex,
          `${variableName} = ${formattedValue}`
        );
        logger.info(
          `Replaced sensitive variable ${variableName} in tfvars for deployment ${deployment.id}`
        );
      } else {
        // Add new variable at the end
        modifiedContent += `\n\n# Sensitive variable injected securely\n${variableName} = ${formattedValue}`;
        logger.info(
          `Added sensitive variable ${variableName} to tfvars for deployment ${deployment.id}`
        );
      }
    });

    logger.info(
      `Successfully injected ${deployment.sensitiveVariables.length} sensitive variables for deployment ${deployment.id}`
    );

    return modifiedContent;
  }

  async getDeploymentsByProject(
    userId: string,
    projectId: string
  ): Promise<DeploymentModel[]> {
    logger.info(
      `getDeploymentsByProject called for userId: ${userId}, projectId: ${projectId}`
    );
    try {
      const project = await this.getProject(projectId, userId);
      if (!project) {
        throw new Error("Project not found");
      }
      const deployments = project.deployments || [];

      logger.info(
        `Found ${deployments.length} deployments for userId: ${userId}, projectId: ${projectId}`
      );
      return deployments;
    } catch (error: any) {
      logger.error(
        `Error getting deployments for userId: ${userId}, projectId: ${projectId}. Error: ${error.message}`,
        { error: error.stack }
      );
      throw error;
    }
  }

  async getDeploymentById(
    userId: string,
    deploymentId: string
  ): Promise<DeploymentModel | null> {
    logger.info(
      `getDeploymentById called for userId: ${userId}, deploymentId: ${deploymentId}`
    );
    try {
      // First try to find the project directly by deploymentId (if deploymentId is actually a projectId)
      let project = await this.getProject(deploymentId, userId);

      // If not found, we need to search through all projects to find the one containing this deployment
      if (!project) {
        const allProjects = await this.projectRepository.findAll(
          `users/${userId}/projects`
        );
        for (const proj of allProjects) {
          if (
            proj.deployments &&
            proj.deployments.some((d) => d.id === deploymentId)
          ) {
            project = proj;
            break;
          }
        }

        if (!project) {
          throw new Error("Project containing deployment not found");
        }
      }

      const deployment = (project.deployments || []).find(
        (deployment) => deployment.id === deploymentId
      );
      if (deployment) {
        logger.info(
          `Deployment found - UserId: ${userId}, DeploymentId: ${deploymentId}`
        );
      } else {
        logger.warn(
          `Deployment not found - UserId: ${userId}, DeploymentId: ${deploymentId}`
        );
        throw new Error("Deployment not found");
      }
      return deployment;
    } catch (error: any) {
      logger.error(
        `Error getting deployment for userId: ${userId}, deploymentId: ${deploymentId}. Error: ${error.message}`,
        { error: error.stack }
      );
      throw error;
    }
  }

  async updateDeployment(
    userId: string,
    deploymentId: string,
    updateData: Partial<DeploymentModel>
  ): Promise<DeploymentModel> {
    logger.info(
      `updateDeployment called for userId: ${userId}, deploymentId: ${deploymentId}`
    );
    try {
      // First try to find the project directly by deploymentId (if deploymentId is actually a projectId)
      let project = await this.getProject(deploymentId, userId);
      let projectId = deploymentId;

      // If not found, we need to search through all projects to find the one containing this deployment
      if (!project) {
        const allProjects = await this.projectRepository.findAll(
          `users/${userId}/projects`
        );
        for (const proj of allProjects) {
          if (
            proj.deployments &&
            proj.deployments.some((d) => d.id === deploymentId)
          ) {
            project = proj;
            projectId = proj.id!;
            break;
          }
        }

        if (!project) {
          throw new Error("Project containing deployment not found");
        }
      }

      const existingDeploymentIndex = (project.deployments || []).findIndex(
        (deployment) => deployment.id === deploymentId
      );

      if (existingDeploymentIndex === -1) {
        logger.warn(
          `Deployment not found for update - UserId: ${userId}, DeploymentId: ${deploymentId}`
        );
        throw new Error("Deployment not found");
      }

      const existingDeployment = project.deployments[existingDeploymentIndex];

      // Create a type-safe updated deployment object
      const updatedDeployment: DeploymentModel = {
        ...existingDeployment,
        ...updateData,
        updatedAt: new Date(),
        // Ensure required fields are present
        id: existingDeployment.id,
        projectId: existingDeployment.projectId,
        name: existingDeployment.name,
        environment: existingDeployment.environment,
        status: existingDeployment.status || "configuring",
        mode: existingDeployment.mode,
        createdAt: existingDeployment.createdAt,
      } as DeploymentModel;

      // Create a new deployments array with the updated deployment
      const updatedDeployments = [...project.deployments];
      updatedDeployments[existingDeploymentIndex] = updatedDeployment;

      const updatedProject = await this.projectRepository.update(
        projectId,
        { deployments: updatedDeployments },
        `users/${userId}/projects`
      );
      if (!updatedProject) {
        throw new Error("Project not found");
      }

      // Find the updated deployment in the updated project
      const resultDeployment = updatedProject.deployments?.find(
        (deployment) => deployment.id === deploymentId
      );
      if (!resultDeployment) {
        throw new Error("Deployment not found");
      }

      logger.info(
        `Deployment updated successfully - UserId: ${userId}, DeploymentId: ${deploymentId}`
      );
      return resultDeployment;
    } catch (error: any) {
      logger.error(
        `Error updating deployment for userId: ${userId}, deploymentId: ${deploymentId}. Error: ${error.message}`,
        { error: error.stack }
      );
      throw error;
    }
  }

  async deleteDeployment(
    userId: string,
    deploymentId: string
  ): Promise<boolean> {
    logger.info(
      `deleteDeployment called for userId: ${userId}, deploymentId: ${deploymentId}`
    );
    try {
      // First try to find the project directly by deploymentId (if deploymentId is actually a projectId)
      let project = await this.getProject(deploymentId, userId);
      let projectId = deploymentId;

      // If not found, we need to search through all projects to find the one containing this deployment
      if (!project) {
        const allProjects = await this.projectRepository.findAll(
          `users/${userId}/projects`
        );
        for (const proj of allProjects) {
          if (
            proj.deployments &&
            proj.deployments.some((d) => d.id === deploymentId)
          ) {
            project = proj;
            projectId = proj.id!;
            break;
          }
        }

        if (!project) {
          logger.warn(
            `Project containing deployment not found - UserId: ${userId}, DeploymentId: ${deploymentId}`
          );
          return false;
        }
      }

      // If we found the project by deploymentId, it means the deploymentId is actually a projectId
      // and we should delete the entire project
      if (projectId === deploymentId) {
        const success = await this.projectRepository.delete(projectId, userId);
        if (success) {
          logger.info(
            `Project deleted successfully - UserId: ${userId}, ProjectId: ${projectId}`
          );
        } else {
          logger.warn(
            `Project not found for deletion - UserId: ${userId}, ProjectId: ${projectId}`
          );
        }
        return success;
      }

      // Otherwise, we need to remove just the deployment from the project
      const updatedDeployments = (project.deployments || []).filter(
        (deployment) => deployment.id !== deploymentId
      );

      if (updatedDeployments.length === (project.deployments || []).length) {
        logger.warn(
          `Deployment not found for deletion - UserId: ${userId}, DeploymentId: ${deploymentId}`
        );
        return false;
      }

      const updatedProject = await this.projectRepository.update(
        projectId,
        { deployments: updatedDeployments },
        `users/${userId}/projects`
      );

      if (updatedProject) {
        logger.info(
          `Deployment deleted successfully - UserId: ${userId}, DeploymentId: ${deploymentId}`
        );
        return true;
      } else {
        logger.warn(
          `Failed to update project after deployment deletion - UserId: ${userId}, DeploymentId: ${deploymentId}`
        );
        return false;
      }
    } catch (error: any) {
      logger.error(
        `Error deleting deployment for userId: ${userId}, deploymentId: ${deploymentId}. Error: ${error.message}`,
        { error: error.stack }
      );
      throw error;
    }
  }

  async addChatMessage(
    userId: string,
    projectId: string,
    message: ChatMessage
  ): Promise<ChatMessage | null> {
    logger.info(
      `addChatMessage called for userId: ${userId}, projectId: ${projectId}, sender: ${message.sender}`
    );

    try {
      const project = await this.getProject(projectId, userId);
      if (!project) {
        logger.warn(`Project not found: ${projectId}`);
        return null;
      }
      // If the message is from a user, generate an AI response
      if (message.sender === "user") {
        logger.info(
          `Generating AI response for user message in deployment ${projectId}`
        );

        try {
          if (!project.activeChatMessages) {
            project.activeChatMessages = [];
          }
          project.activeChatMessages.push(message);
          const promptMessages = this.convertToPromptMessages(
            project.activeChatMessages,
            project
          );

          // Call the PromptService to generate a response
          const aiResponse = await this.promptService.runPrompt(
            {
              provider: LLMProvider.GEMINI,
              modelName: "gemini-2.5-flash",
              llmOptions: {
                temperature: 0.7,
                maxOutputTokens: 1024,
              },
            },
            promptMessages
          );
          console.log("aiResponse", aiResponse);

          // Create an AI message and parse the response as JSON if possible

          try {
            // Try to extract JSON from the response (it might be wrapped in markdown code blocks)
            const jsonMatch = aiResponse.match(
              /```(?:json)?\s*([\s\S]*?)\s*```/
            ) || [null, aiResponse];
            const jsonContent = jsonMatch[1].trim();
            const parsedResponse = JSON.parse(jsonContent);

            // Create an AI message from the structured response
            const aiMessage: ChatMessage = {
              sender: "ai",
              text: parsedResponse.message || aiResponse, // Fallback to raw response if message field missing
              timestamp: new Date(),
              isRequestingDetails: parsedResponse.isRequestingDetails || false,
              isProposingArchitecture:
                parsedResponse.isProposingArchitecture || false,
              isRequestingSensitiveVariables:
                parsedResponse.isRequestingSensitiveVariables || false,
              proposedComponents: parsedResponse.proposedComponents || [],
              asciiArchitecture: parsedResponse.asciiArchitecture || "",
              archetypeUrl: parsedResponse.archetypeUrl || "",
              requestedSensitiveVariables:
                parsedResponse.requestedSensitiveVariables || [],
            };
            project.activeChatMessages.push(aiMessage);

            logger.info(
              `Successfully parsed AI response as structured JSON for project ${projectId}`
            );
          } catch (error: unknown) {
            // Type guard for error.message
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            logger.warn(
              `Failed to parse AI response as JSON for project ${projectId}: ${errorMessage}`
            );

            // Fallback to treating the response as plain text
            const message: ChatMessage = {
              sender: "ai",
              text: aiResponse,
              timestamp: new Date(),
              isRequestingDetails: false,
              isProposingArchitecture: false,
              isRequestingSensitiveVariables: false,
            };
            project.activeChatMessages.push(message);
          }
        } catch (promptError: any) {
          logger.error(
            `Error generating AI response for project ${projectId}: ${promptError.message}`,
            { error: promptError.stack }
          );

          project.activeChatMessages.push({
            sender: "ai",
            text: "I'm sorry, I encountered an error while processing your request. Please try again later.",
            timestamp: new Date(),
            isRequestingDetails: false,
            isProposingArchitecture: false,
            isRequestingSensitiveVariables: false,
          });
        }
      }
      await this.projectRepository.update(
        projectId,
        project,
        `users/${userId}/projects`
      );
      // Update the deployment with the new messages
      return project.activeChatMessages[project.activeChatMessages.length - 1];
    } catch (error: any) {
      logger.error(
        `Error adding chat message for project ${projectId}: ${error.message}`,
        { error: error.stack }
      );
      throw error;
    }
  }

  /**
   * Converts deployment chat messages to the format expected by PromptService
   */
  private convertToPromptMessages(
    chatMessages: ChatMessage[],
    project: ProjectModel
  ): { role: "user" | "assistant" | "system"; content: string }[] {
    logger.info(
      `Converting prompt messages for project: ${project.id}, deployment chat`
    );

    // Extract deployment information from project
    const deploymentInfo =
      project.deployments && project.deployments.length > 0
        ? project.deployments[project.deployments.length - 1]
        : null;

    // Create project context string
    let projectContext = `
      Project Name: ${project.name}
      Project ID: ${project.id}
      Description: ${project.description}
      Type: ${project.type}
      Constraints: ${project.constraints}
      Team Size: ${project.teamSize}
      Scope: ${project.scope}
      Budget: ${project.budgetIntervals || "Not specified"}
      Targets: ${project.targets}
    `;

    // Add deployment specific context if available
    if (deploymentInfo) {
      projectContext += `
        Current Deployment Information:
        - Name: ${deploymentInfo.name}
        - Status: ${deploymentInfo.status}
        - Environment: ${deploymentInfo.environment}
        - Mode: ${deploymentInfo.mode}
        ${
          deploymentInfo.gitRepository
            ? `- Git Repository: ${deploymentInfo.gitRepository.provider} (${deploymentInfo.gitRepository.url})`
            : ""
        }
        ${deploymentInfo.url ? `- Deployed URL: ${deploymentInfo.url}` : ""}
        ${
          deploymentInfo.pipelines && deploymentInfo.pipelines.length > 0
            ? `- Current Pipeline Stage: ${
                deploymentInfo.pipelines[deploymentInfo.pipelines.length - 1].id
              }`
            : ""
        }
      `;
    }

    // Start with a system message that provides context about the deployment
    const promptMessages: {
      role: "user" | "assistant" | "system";
      content: string;
    }[] = [
      {
        role: "system",
        content: `${AI_CHAT_INITIAL_PROMPT}\n\n${projectContext}`,
      },
    ];

    // Add all conversation history if less than 5 messages, otherwise limit to last 5
    const messagesToInclude =
      chatMessages.length <= 5 ? chatMessages : chatMessages.slice(-5);

    messagesToInclude.forEach((msg) => {
      promptMessages.push({
        role: msg.sender === "user" ? "user" : "assistant",
        content: msg.text,
      });
    });

    return promptMessages;
  }

  // Pipeline Management Methods
  async startDeploymentPipeline(
    userId: string,
    deploymentId: string
  ): Promise<DeploymentModel | null> {
    logger.info(
      `startDeploymentPipeline called for userId: ${userId}, deploymentId: ${deploymentId}`
    );

    try {
      const deployment = await this.getDeploymentById(userId, deploymentId);
      if (!deployment) {
        return null;
      }

      // Validate deployment is ready for pipeline execution
      const validationErrors = this.validateDeploymentForPipeline(deployment);
      if (validationErrors.length > 0) {
        throw new Error(
          `Pipeline validation failed: ${validationErrors.join(", ")}`
        );
      }

      // Generate a unique pipeline ID using timestamp and random string
      const pipelineId = `pipe-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 8)}`;

      const updatedPipeline = {
        id: pipelineId,
        steps: this.initializePipelineSteps().map((step) => ({
          ...step,
          status:
            step.name === "Code Analysis"
              ? ("in-progress" as const)
              : ("pending" as const),
          startedAt: step.name === "Code Analysis" ? new Date() : undefined,
        })),
        startedAt: new Date(),
        estimatedCompletionTime: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes estimate
      };

      const updatedDeployment = await this.updateDeployment(
        userId,
        deploymentId,
        {
          status: "building",
          pipelines: [updatedPipeline],
        }
      );

      // Start asynchronous pipeline execution
      this.executePipeline(userId, deploymentId, pipelineId);

      return updatedDeployment;
    } catch (error: any) {
      logger.error(
        `Error starting deployment pipeline for deployment ${deploymentId}: ${error.message}`,
        { error: error.stack }
      );
      throw error;
    }
  }

  async updatePipelineStep(
    userId: string,
    deploymentId: string,
    stepName: string,
    pipelineIndex: number,
    stepUpdate: Partial<PipelineStep>
  ): Promise<DeploymentModel | null> {
    logger.info(
      `updatePipelineStep called for userId: ${userId}, deploymentId: ${deploymentId}, step: ${stepName}, pipelineIndex: ${pipelineIndex}`
    );

    try {
      const deployment = await this.getDeploymentById(userId, deploymentId);
      if (!deployment) {
        logger.warn(`Deployment not found: ${deploymentId}`);
        return null;
      }

      // Check if pipelines exists and is properly structured
      if (!deployment.pipelines) {
        logger.warn(`No pipelines found in deployment ${deploymentId}`);
        return null;
      }

      // Ensure pipelines is an array
      const pipelinesArray = Array.isArray(deployment.pipelines)
        ? deployment.pipelines
        : [deployment.pipelines];

      // Check if the specified pipeline index exists
      if (pipelineIndex < 0 || pipelineIndex >= pipelinesArray.length) {
        logger.warn(
          `Invalid pipeline index ${pipelineIndex} for deployment ${deploymentId}`
        );
        return null;
      }

      // Get the target pipeline
      const targetPipeline = pipelinesArray[pipelineIndex];

      // Ensure the pipeline has steps and steps is an array
      if (!targetPipeline.steps || !Array.isArray(targetPipeline.steps)) {
        logger.warn(
          `No steps array found in pipeline ${pipelineIndex} of deployment ${deploymentId}`
        );
        return null;
      }

      // Update the specific step in the target pipeline
      const updatedSteps = targetPipeline.steps.map((step) =>
        step.name === stepName ? { ...step, ...stepUpdate } : step
      );

      // Create a copy of the pipelines array to update
      const updatedPipelines = [...pipelinesArray];

      // Update the specific pipeline with the new steps
      updatedPipelines[pipelineIndex] = {
        ...targetPipeline,
        steps: updatedSteps,
      };

      // Update the deployment with the modified pipelines
      return await this.updateDeployment(userId, deploymentId, {
        pipelines: updatedPipelines,
      });
    } catch (error: any) {
      logger.error(
        `Error updating pipeline step for deployment ${deploymentId}: ${error.message}`,
        { error: error.stack }
      );
      throw error;
    }
  }

  // Validation Methods
  private validateDeploymentData(formData: DeploymentFormData): string[] {
    const errors: string[] = [];

    errors.push(...DeploymentValidators.validateBasicInfo(formData));

    if (formData.repoUrl || formData.branch) {
      const gitRepo = {
        url: formData.repoUrl,
        branch: formData.branch,
      };
      errors.push(...DeploymentValidators.validateGitRepository(gitRepo));
    }

    if (formData.customComponents) {
      errors.push(
        ...DeploymentValidators.validateArchitectureComponents(
          formData.customComponents
        )
      );
    }

    return errors;
  }

  private validateDeploymentForPipeline(deployment: DeploymentModel): string[] {
    const errors: string[] = [];

    if (!deployment.gitRepository) {
      errors.push(
        "Git repository configuration is required for pipeline execution"
      );
    }

    if (deployment.status === "building" || deployment.status === "deploying") {
      errors.push("Deployment pipeline is already running");
    }

    // Mode-specific validations
    switch (deployment.mode) {
      case "beginner":
        const quickDeployment = deployment as QuickDeploymentModel;
        if (!quickDeployment.frameworkType) {
          errors.push(
            "Framework type is required for beginner mode deployments"
          );
        }
        break;

      case "template":
        const templateDeployment = deployment as TemplateDeploymentModel;
        if (!templateDeployment.templateId) {
          errors.push("Template ID is required for template mode deployments");
        }
        break;

      case "expert":
        const expertDeployment = deployment as ExpertDeploymentModel;
        if (
          !expertDeployment.architectureComponents ||
          expertDeployment.architectureComponents.length === 0
        ) {
          errors.push(
            "At least one architecture component is required for expert mode deployments"
          );
        }
        break;

      case "ai-assistant":
        // AI assistant mode might not need additional validations as it's guided
        break;

      default:
        errors.push(`Unknown deployment mode: ${(deployment as any).mode}`);
    }

    return errors;
  }

  // Helper Methods
  private initializePipelineSteps(): PipelineStep[] {
    return [
      {
        name: "Code Analysis",
        status: "pending",
      },
      {
        name: "Security Scan",
        status: "pending",
      },
      {
        name: "Build",
        status: "pending",
      },
      {
        name: "Infrastructure Provisioning",
        status: "pending",
      },
      {
        name: "Deployment",
        status: "pending",
      },
      {
        name: "Post-deployment Tests",
        status: "pending",
      },
    ];
  }

  private async executePipeline(
    userId: string,
    deploymentId: string,
    pipelineId: string
  ): Promise<void> {
    const steps = [
      "Code Analysis",
      "Security Scan",
      "Build",
      "Infrastructure Provisioning",
      "Deployment",
      "Post-deployment Tests",
    ];

    for (let i = 0; i < steps.length; i++) {
      const stepName = steps[i];

      // Start step
      await this.updatePipelineStep(userId, deploymentId, stepName, 0, {
        status: "in-progress",
        startedAt: new Date(),
      });

      // For the Build step, run a Docker container
      if (stepName === "Build") {
        try {
          // Run Docker container for build process
          const containerName = `build-${deploymentId}-${pipelineId}`;
          const dockerRunCommand = `echo 'Build completed successfully'`;

          // Log Docker command execution
          logger.info(
            `Executing Docker build command for deployment ${deploymentId}:`,
            {
              command: dockerRunCommand,
              containerName,
              pipelineId,
            }
          );

          // Execute the Docker command (streaming)
          let buildOutput = "";
          const childBuild = spawn(dockerRunCommand, {
            shell: true,
            env: process.env,
          });

          childBuild.stdout.on("data", (data: Buffer) => {
            const msg = data.toString();
            buildOutput += msg;
            if (msg.trim().length > 0) {
              logger.info(`[build stdout] ${msg.trim()}`);
            }
          });

          childBuild.stderr.on("data", (data: Buffer) => {
            const msg = data.toString();
            if (msg.trim().length > 0) {
              logger.warn(`[build stderr] ${msg.trim()}`);
            }
          });

          const exitCode: number = await new Promise((resolve, reject) => {
            childBuild.on("error", (err) => reject(err));
            childBuild.on("close", (code) => resolve(code ?? 0));
          });

          if (exitCode !== 0) {
            throw new Error(`Build process exited with code ${exitCode}`);
          }

          // Update logs with Docker container start information
          await this.updatePipelineStep(userId, deploymentId, stepName, 0, {
            logs: `Running build in Docker container: ${containerName}\nCommand: ${dockerRunCommand}\n\n[Container Started]\n${buildOutput}\nContainer started successfully with ID ${containerName}\n\nBuilding project...`,
          });

          // Wait a moment to let container start working
          await new Promise((resolve) => setTimeout(resolve, 2000));

          // Update step logs with collected output
          const currentStep = (
            await this.getDeploymentById(userId, deploymentId)
          )?.pipelines?.[0]?.steps?.find((s) => s.name === "Build");
          const currentLogs = currentStep?.logs || "";
          await this.updatePipelineStep(userId, deploymentId, stepName, 0, {
            logs: `${
              currentLogs.split("[Container Logs]")[0]
            }[Container Logs]\n${buildOutput}`,
          });
        } catch (error: any) {
          logger.error(`Docker build execution failed: ${error.message}`, {
            error,
          });
          await this.updatePipelineStep(userId, deploymentId, stepName, 0, {
            status: "failed",
            finishedAt: new Date(),
            logs: `Build step failed: ${error.message}`,
          });

          // Update deployment status to failed
          await this.updateDeployment(userId, deploymentId, {
            status: "failed",
          });

          return; // Exit the pipeline execution
        }
      }

      // Simulate step execution time - longer for build and infrastructure steps
      const stepDuration =
        stepName === "Build" || stepName === "Infrastructure Provisioning"
          ? 3000
          : 2000;
      await new Promise((resolve) => setTimeout(resolve, stepDuration));

      // Complete step
      if (stepName === "Build") {
        // For Build step, get current logs first, then append completion message
        const currentStep = (
          await this.getDeploymentById(userId, deploymentId)
        )?.pipelines?.[0]?.steps?.find((s) => s.name === "Build");
        const currentLogs = currentStep?.logs || "";

        await this.updatePipelineStep(userId, deploymentId, stepName, 0, {
          status: "succeeded",
          finishedAt: new Date(),
          logs: `${currentLogs}\n\nDocker container completed successfully. Build artifacts generated.`,
        });
      } else {
        // For other steps, just set the standard success message
        await this.updatePipelineStep(userId, deploymentId, stepName, 0, {
          status: "succeeded",
          finishedAt: new Date(),
          logs: `Step ${stepName} completed successfully`,
        });
      }

      // Update deployment status based on current step
      if (stepName === "Infrastructure Provisioning") {
        await this.updateDeployment(userId, deploymentId, {
          status: "infrastructure-provisioning",
        });
      } else if (stepName === "Deployment") {
        await this.updateDeployment(userId, deploymentId, {
          status: "deploying",
        });
      }
    }

    // Complete deployment
    await this.updateDeployment(userId, deploymentId, {
      status: "deployed",
      deployedAt: new Date(),
      url: `https://${deploymentId}.example.com`,
      version: `v1.0.0-${Date.now()}`,
    });

    logger.info(`Pipeline execution completed for deployment ${deploymentId}`);
  }

  /**
   * Store sensitive variables for a deployment
   * @param userId User ID
   * @param projectId Project ID
   * @param deploymentId Deployment ID
   * @param sensitiveVariables Array of sensitive variables to store
   * @returns Updated deployment
   */
  async storeSensitiveVariables(
    userId: string,
    projectId: string,
    deploymentId: string,
    sensitiveVariables: EnvironmentVariable[]
  ): Promise<DeploymentModel | null> {
    logger.info(
      `storeSensitiveVariables called for userId: ${userId}, projectId: ${projectId}, deploymentId: ${deploymentId}`
    );

    try {
      const project = await this.getProject(projectId, userId);
      if (!project) {
        logger.warn(`Project not found: ${projectId} for user: ${userId}`);
        return null;
      }

      const deployment = project.deployments?.find(
        (d) => d.id === deploymentId
      );
      if (!deployment) {
        logger.warn(
          `Deployment not found: ${deploymentId} in project: ${projectId}`
        );
        return null;
      }

      // Encrypt all sensitive variables before storage
      const encryptedVariables = sensitiveVariables.map((variable) => ({
        ...variable,
        isSecret: true,
        value: this.encryptValue(variable.value),
      }));

      // Store sensitive variables separately
      deployment.sensitiveVariables = encryptedVariables;

      // Update the project with the modified deployment
      await this.projectRepository.update(
        projectId,
        project,
        `users/${userId}/projects`
      );

      logger.info(
        `Successfully stored ${sensitiveVariables.length} sensitive variables for deployment ${deploymentId}`
      );
      return deployment;
    } catch (error: any) {
      logger.error(
        `Error storing sensitive variables for userId: ${userId}, projectId: ${projectId}, deploymentId: ${deploymentId}. Error: ${error.message}`,
        { error: error.stack }
      );
      throw error;
    }
  }

  /**
   * Edit a deployment's Terraform tfvars file
   * @param userId User ID
   * @param deploymentId Deployment ID
   * @param tfvarsFileContent New Terraform tfvars file content
   * @returns Updated DeploymentModel
   */
  async editTerraformTfvarsFile(
    userId: string,
    projectId: string,
    deploymentId: string,
    tfvarsFileContent: string
  ): Promise<DeploymentModel | null> {
    logger.info(
      `editTerraformTfvarsFile called for userId: ${userId}, projectId: ${projectId}, deploymentId: ${deploymentId}`
    );

    try {
      const deployment = await this.getDeploymentById(userId, deploymentId);
      if (!deployment) {
        return null;
      }

      // Update generatedTerraformTfvarsFileContent
      deployment.generatedTerraformTfvarsFileContent = tfvarsFileContent;

      // Update the deployment
      await this.updateDeployment(userId, deploymentId, deployment);

      logger.info(
        `Successfully edited Terraform tfvars file for deployment ${deploymentId}`
      );
      return deployment;
    } catch (error: any) {
      logger.error(
        `Error editing Terraform tfvars file for userId: ${userId}, projectId: ${projectId}, deploymentId: ${deploymentId}. Error: ${error.message}`,
        { error: error.stack }
      );
      throw error;
    }
  }
}
