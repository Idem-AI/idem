import { Router } from "express";
import {
  saveDevelopmentConfigsController,
  getDevelopmentConfigsController,
} from "../controllers/development.controller";
import { authenticate } from "../services/auth.service";

export const developmentRoutes = Router();

/**
 * Resource naming convention for API endpoints
 * primaryResourceName: The main resource category
 * secondaryResourceName: The specific resource type being managed
 */
const primaryResourceName = "developments";
const secondaryResourceName = "webcontainers";

// All routes are protected by authentication middleware

/**
 * @openapi
 * /developments/configs:
 *   post:
 *     tags:
 *       - Development
 *     summary: Save development configurations
 *     description: Saves the development configurations for a project
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SaveDevelopmentConfigsDto'
 *     responses:
 *       200:
 *         description: Development configurations saved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BaseResponseDto'
 *       400:
 *         description: Bad request - missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BaseResponseDto'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
developmentRoutes.post(
  `/${primaryResourceName}/configs`,
  authenticate,
  saveDevelopmentConfigsController
);

/**
 * @openapi
 * /developments/configs:
 *   get:
 *     tags:
 *       - Development
 *     summary: Get development configurations
 *     description: Retrieves the development configurations for a project
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Development configurations retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DevelopmentConfigsModel'
 *       400:
 *         description: Bad request - missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BaseResponseDto'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
developmentRoutes.get(
  `/${primaryResourceName}/configs/:projectId`,
  authenticate,
  getDevelopmentConfigsController
);
