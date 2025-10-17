import { Router } from "express";
import {
  createArchetypeController,
  getArchetypesController,
  getArchetypeByIdController,
  updateArchetypeController,
  deleteArchetypeController,
  getArchetypesByProviderController,
  getArchetypesByCategoryController,
  generateTerraformTfvarsController,
} from "../controllers/archetype.controller";
import { authenticate } from "../services/auth.service";

const router = Router();

/**
 * @swagger
 * /archetypes:
 *   post:
 *     summary: Create a new archetype
 *     tags: [Archetypes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - description
 *               - provider
 *               - category
 *               - terraformVariables
 *             properties:
 *               name:
 *                 type: string
 *                 description: Name of the archetype
 *               description:
 *                 type: string
 *                 description: Description of the archetype
 *               provider:
 *                 type: string
 *                 enum: [aws, gcp, azure]
 *                 description: Cloud provider
 *               category:
 *                 type: string
 *                 description: Category of the archetype
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Tags for the archetype
 *               icon:
 *                 type: string
 *                 description: Icon URL or identifier
 *               version:
 *                 type: string
 *                 description: Version of the archetype
 *               terraformVariables:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     type:
 *                       type: string
 *                       enum: [string, number, bool, list(string), list(number), map(string), map(number), object]
 *                     description:
 *                       type: string
 *                     required:
 *                       type: boolean
 *                     sensitive:
 *                       type: boolean
 *                     default:
 *                       type: any
 *               defaultValues:
 *                 type: object
 *                 description: Default values for variables
 *               isActive:
 *                 type: boolean
 *                 description: Whether the archetype is active
 *     responses:
 *       201:
 *         description: Archetype created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post("/", createArchetypeController);

/**
 * @swagger
 * /archetypes:
 *   get:
 *     summary: Get all archetypes for the authenticated user
 *     tags: [Archetypes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Archetypes retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get("/", getArchetypesController);

/**
 * @swagger
 * /archetypes/{archetypeId}:
 *   get:
 *     summary: Get archetype by ID
 *     tags: [Archetypes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: archetypeId
 *         required: true
 *         schema:
 *           type: string
 *         description: Archetype ID
 *     responses:
 *       200:
 *         description: Archetype retrieved successfully
 *       404:
 *         description: Archetype not found
 *       401:
 *         description: Unauthorized
 */
router.get("/:archetypeId", authenticate, getArchetypeByIdController);

/**
 * @swagger
 * /archetypes/{archetypeId}:
 *   put:
 *     summary: Update archetype
 *     tags: [Archetypes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: archetypeId
 *         required: true
 *         schema:
 *           type: string
 *         description: Archetype ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               provider:
 *                 type: string
 *                 enum: [aws, gcp, azure]
 *               category:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               icon:
 *                 type: string
 *               version:
 *                 type: string
 *               terraformVariables:
 *                 type: array
 *                 items:
 *                   type: object
 *               defaultValues:
 *                 type: object
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Archetype updated successfully
 *       404:
 *         description: Archetype not found
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.put("/:archetypeId", authenticate, updateArchetypeController);

/**
 * @swagger
 * /archetypes/{archetypeId}:
 *   delete:
 *     summary: Delete archetype
 *     tags: [Archetypes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: archetypeId
 *         required: true
 *         schema:
 *           type: string
 *         description: Archetype ID
 *     responses:
 *       200:
 *         description: Archetype deleted successfully
 *       404:
 *         description: Archetype not found
 *       401:
 *         description: Unauthorized
 */
router.delete("/:archetypeId", authenticate, deleteArchetypeController);

/**
 * @swagger
 * /archetypes/provider/{provider}:
 *   get:
 *     summary: Get archetypes by provider
 *     tags: [Archetypes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema:
 *           type: string
 *           enum: [aws, gcp, azure]
 *         description: Cloud provider
 *     responses:
 *       200:
 *         description: Archetypes retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/provider/:provider",
  authenticate,
  getArchetypesByProviderController
);

/**
 * @swagger
 * /archetypes/category/{category}:
 *   get:
 *     summary: Get archetypes by category
 *     tags: [Archetypes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: category
 *         required: true
 *         schema:
 *           type: string
 *         description: Category name
 *     responses:
 *       200:
 *         description: Archetypes retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/category/:category",
  authenticate,
  getArchetypesByCategoryController
);

/**
 * @swagger
 * /archetypes/{archetypeId}/terraform/tfvars:
 *   post:
 *     summary: Generate Terraform tfvars for an archetype
 *     tags: [Archetypes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: archetypeId
 *         required: true
 *         schema:
 *           type: string
 *         description: Archetype ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               customValues:
 *                 type: object
 *                 description: Custom values to override defaults
 *     responses:
 *       200:
 *         description: Terraform tfvars generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     archetypeId:
 *                       type: string
 *                     archetypeName:
 *                       type: string
 *                     provider:
 *                       type: string
 *                     tfvarsContent:
 *                       type: string
 *       404:
 *         description: Archetype not found
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/:archetypeId/terraform/tfvars",
  authenticate,
  generateTerraformTfvarsController
);

export default router;
