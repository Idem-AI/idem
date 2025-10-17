import { Response } from "express";
import { ArchetypeService } from "../services/archetype.service";
import {
  CreateArchetypePayload,
  UpdateArchetypePayload,
} from "../models/archetypes.model";
import { CustomRequest } from "../interfaces/express.interface";
import logger from "../config/logger";

const archetypeService = new ArchetypeService();

/**
 * Create a new archetype
 */
export const createArchetypeController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  // const userId = req.user?.uid;

  // if (!userId) {
  //   res.status(401).json({
  //     success: false,
  //     message: "Unauthorized",
  //   });
  //   return;
  // }
  const payload: CreateArchetypePayload = req.body;

  logger.info(`Creating archetype...`, {
    payload,
  });

  try {
    const archetype = await archetypeService.createArchetype(payload);

    logger.info(`Archetype created successfully:`, {
      archetypeId: archetype.id,
      name: archetype.name,
    });

    res.status(201).json({
      success: true,
      message: "Archetype created successfully",
      data: archetype,
    });
    return;
  } catch (error) {
    logger.error(`Error creating archetype:`, {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,

      payload,
    });

    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to create archetype",
    });
    return;
  }
};

/**
 * Get all archetypes for a user
 */
export const getArchetypesController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;

  // if (!userId) {
  //   res.status(401).json({
  //     success: false,
  //     message: "Unauthorized",
  //   });
  //   return;
  // }

  logger.info(`Retrieving archetypes`);

  try {
    const archetypes = await archetypeService.getArchetypes();

    logger.info(`Retrieved ${archetypes.length} archetypes`);

    res.status(200).json({
      success: true,
      message: "Archetypes retrieved successfully",
      data: archetypes,
    });
    return;
  } catch (error) {
    logger.error(`Error retrieving archetypes for user ${userId}:`, {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });

    res.status(500).json({
      success: false,
      message: "Failed to retrieve archetypes",
    });
    return;
  }
};

/**
 * Get archetype by ID
 */
export const getArchetypeByIdController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;

  if (!userId) {
    res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
    return;
  }
  const archetypeId = req.params.archetypeId;

  logger.info(`Retrieving archetype: ${archetypeId}`);

  try {
    const archetype = await archetypeService.getArchetypeById(archetypeId);

    if (!archetype) {
      logger.warn(`Archetype not found: ${archetypeId}`);
      res.status(404).json({
        success: false,
        message: "Archetype not found",
      });
      return;
    }

    logger.info(`Archetype retrieved successfully:`, {
      archetypeId,
      name: archetype.name,
    });

    res.status(200).json({
      success: true,
      message: "Archetype retrieved successfully",
      data: archetype,
    });
    return;
  } catch (error) {
    logger.error(`Error retrieving archetype ${archetypeId}:`, {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,

      archetypeId,
    });

    res.status(500).json({
      success: false,
      message: "Failed to retrieve archetype",
    });
    return;
  }
};

/**
 * Update archetype
 */
export const updateArchetypeController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;

  if (!userId) {
    res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
    return;
  }
  const archetypeId = req.params.archetypeId;
  const payload: UpdateArchetypePayload = req.body;

  logger.info(`Updating archetype: ${archetypeId}`);

  try {
    const archetype = await archetypeService.updateArchetype(
      archetypeId,
      payload
    );

    if (!archetype) {
      logger.warn(`Archetype not found for update: ${archetypeId}`);
      res.status(404).json({
        success: false,
        message: "Archetype not found",
      });
      return;
    }

    logger.info(`Archetype updated successfully:`, {
      archetypeId,
      name: archetype.name,
    });

    res.status(200).json({
      success: true,
      message: "Archetype updated successfully",
      data: archetype,
    });
    return;
  } catch (error) {
    logger.error(`Error updating archetype ${archetypeId}:`, {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,

      archetypeId,
      payload,
    });

    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to update archetype",
    });
    return;
  }
};

/**
 * Delete archetype
 */
export const deleteArchetypeController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;

  if (!userId) {
    res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
    return;
  }
  const archetypeId = req.params.archetypeId;

  logger.info(`Deleting archetype: ${archetypeId}`);

  try {
    const deleted = await archetypeService.deleteArchetype(archetypeId);

    if (!deleted) {
      logger.warn(`Archetype not found for deletion: ${archetypeId}`);
      res.status(404).json({
        success: false,
        message: "Archetype not found",
      });
      return;
    }

    logger.info(`Archetype deleted successfully:`, {
      archetypeId,
    });

    res.status(200).json({
      success: true,
      message: "Archetype deleted successfully",
    });
    return;
  } catch (error) {
    logger.error(`Error deleting archetype ${archetypeId}:`, {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,

      archetypeId,
    });

    res.status(500).json({
      success: false,
      message: "Failed to delete archetype",
    });
    return;
  }
};

/**
 * Get archetypes by provider
 */
export const getArchetypesByProviderController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;

  if (!userId) {
    res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
    return;
  }
  const provider = req.params.provider as "aws" | "gcp" | "azure";

  logger.info(`Retrieving archetypes by provider: ${provider}`);

  try {
    const archetypes = await archetypeService.getArchetypesByProvider(provider);

    logger.info(
      `Retrieved ${archetypes.length} archetypes for provider ${provider}`
    );

    res.status(200).json({
      success: true,
      message: "Archetypes retrieved successfully",
      data: archetypes,
    });
    return;
  } catch (error) {
    logger.error(`Error retrieving archetypes by provider ${provider}:`, {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,

      provider,
    });

    res.status(500).json({
      success: false,
      message: "Failed to retrieve archetypes",
    });
    return;
  }
};

/**
 * Get archetypes by category
 */
export const getArchetypesByCategoryController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;

  if (!userId) {
    res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
    return;
  }
  const category = req.params.category;

  logger.info(`Retrieving archetypes by category: ${category}`);

  try {
    const archetypes = await archetypeService.getArchetypesByCategory(category);

    logger.info(
      `Retrieved ${archetypes.length} archetypes for category ${category}`
    );

    res.status(200).json({
      success: true,
      message: "Archetypes retrieved successfully",
      data: archetypes,
    });
    return;
  } catch (error) {
    logger.error(`Error retrieving archetypes by category ${category}:`, {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,

      category,
    });

    res.status(500).json({
      success: false,
      message: "Failed to retrieve archetypes",
    });
    return;
  }
};

/**
 * Generate Terraform tfvars for an archetype
 */
export const generateTerraformTfvarsController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;

  if (!userId) {
    res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
    return;
  }
  const archetypeId = req.params.archetypeId;
  const customValues = req.body.customValues || {};

  logger.info(`Generating Terraform tfvars for archetype: ${archetypeId}`);

  try {
    // Get the archetype
    const archetype = await archetypeService.getArchetypeById(archetypeId);

    if (!archetype) {
      logger.warn(`Archetype not found for tfvars generation:`, {
        archetypeId,
      });
      res.status(404).json({
        success: false,
        message: "Archetype not found",
      });
      return;
    }

    // Generate tfvars content
    const tfvarsContent = archetypeService.generateTerraformTfvars(
      archetype,
      customValues
    );

    logger.info(
      `Terraform tfvars generated successfully for archetype: ${archetypeId}`,
      {
        archetypeId,
        contentLength: tfvarsContent.length,
      }
    );

    res.status(200).json({
      success: true,
      message: "Terraform tfvars generated successfully",
      data: {
        archetypeId,
        archetypeName: archetype.name,
        provider: archetype.provider,
        tfvarsContent,
      },
    });
    return;
  } catch (error) {
    logger.error(
      `Error generating Terraform tfvars for archetype ${archetypeId}:`,
      {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,

        archetypeId,
      }
    );

    res.status(500).json({
      success: false,
      message: "Failed to generate Terraform tfvars",
    });
    return;
  }
};
