import { Router } from 'express';
import multer from 'multer';

import {
  analyseProjectController,
  createSimulationController,
  deleteSimulationController,
  generateReportController,
  getPricingController,
  downloadReportPdfController,
  getReportController,
  getSimulationController,
  listSimulationsController,
  runLabController,
} from '../controllers/simulation.controller';
import { checkPolicyAcceptance } from '../middleware/policyCheck.middleware';
import { checkQuota } from '../middleware/quota.middleware';
import { authenticate } from '../services/auth.service';

export const simulationRoutes = Router();

const resource = 'simulations';

/** Import d'un business plan externe: texte uniquement, 10 Mo maximum. */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const accepted = ['text/plain', 'text/markdown', 'application/json'];
    cb(null, accepted.includes(file.mimetype));
  },
});

/**
 * @openapi
 * /project/simulations/{projectId}:
 *   get:
 *     tags: [Simulation]
 *     summary: List the simulations of a project
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: Simulation summaries, most recently updated first
 *       '401': { description: Not authenticated }
 *       '404': { description: Project not found }
 */
simulationRoutes.get(`/${resource}/:projectId`, authenticate, listSimulationsController);

/**
 * @openapi
 * /project/simulations/{projectId}/pricing:
 *   get:
 *     tags: [Simulation]
 *     summary: Get the simulation plans and their prices
 *     description: >
 *       Simulation is billed separately from the rest of IDEM. Projects that
 *       already exist in IDEM get a reduced price because the engine has less
 *       to research.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: origin
 *         schema: { type: string, enum: [idem-project, imported-document] }
 *     responses:
 *       '200': { description: Available plans }
 */
simulationRoutes.get(`/${resource}/:projectId/pricing`, authenticate, getPricingController);

/**
 * @openapi
 * /project/simulations/{projectId}/analysis:
 *   post:
 *     tags: [Simulation]
 *     summary: Read the project before anything is billed
 *     description: >
 *       Returns what the engine knows, what it must research, what stays
 *       uncertain and what is missing, plus the numeric baseline the scenario
 *       engine will run on. Nothing is persisted and nothing is charged.
 *       Send a `document` file or a `documentText` field to analyse an
 *       imported business plan instead of the IDEM project.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200': { description: Structured reading of the project }
 *       '429': { description: Quota exceeded }
 */
simulationRoutes.post(
  `/${resource}/:projectId/analysis`,
  authenticate,
  checkPolicyAcceptance,
  checkQuota,
  upload.single('document'),
  analyseProjectController
);

/**
 * @openapi
 * /project/simulations/{projectId}:
 *   post:
 *     tags: [Simulation]
 *     summary: Start a simulation
 *     description: >
 *       Responds immediately with the created simulation in `running` state.
 *       The pipeline runs in the background; poll the simulation to follow it.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tier]
 *             properties:
 *               name: { type: string }
 *               tier: { type: string, enum: [run, report, pack] }
 *               origin: { type: string, enum: [idem-project, imported-document] }
 *               documentName: { type: string }
 *               previousRunId: { type: string }
 *               answers:
 *                 type: object
 *                 additionalProperties: { type: string }
 *     responses:
 *       '202': { description: Simulation accepted and started }
 *       '400': { description: Invalid tier or origin }
 *       '429': { description: Quota exceeded }
 */
simulationRoutes.post(
  `/${resource}/:projectId`,
  authenticate,
  checkPolicyAcceptance,
  checkQuota,
  createSimulationController
);

/**
 * @openapi
 * /project/simulations/{projectId}/{simulationId}:
 *   get:
 *     tags: [Simulation]
 *     summary: Get one simulation, including its progress
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200': { description: The simulation }
 *       '404': { description: Simulation not found }
 *   delete:
 *     tags: [Simulation]
 *     summary: Delete a simulation
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '204': { description: Deleted }
 *       '404': { description: Simulation not found }
 */
simulationRoutes.get(
  `/${resource}/:projectId/:simulationId`,
  authenticate,
  getSimulationController
);
simulationRoutes.delete(
  `/${resource}/:projectId/:simulationId`,
  authenticate,
  deleteSimulationController
);

/**
 * @openapi
 * /project/simulations/{projectId}/{simulationId}/report:
 *   get:
 *     tags: [Simulation]
 *     summary: Get the full report of a simulation
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200': { description: The report }
 *       '404': { description: Report not generated }
 *   post:
 *     tags: [Simulation]
 *     summary: Generate the full report
 *     description: >
 *       Billed separately from the run: it adds a sensitivity read, the
 *       viability conditions and prioritised recommendations.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200': { description: The generated report }
 *       '409': { description: The simulation has no result yet }
 */
simulationRoutes.get(
  `/${resource}/:projectId/:simulationId/report`,
  authenticate,
  getReportController
);
simulationRoutes.post(
  `/${resource}/:projectId/:simulationId/report`,
  authenticate,
  checkPolicyAcceptance,
  checkQuota,
  generateReportController
);

/**
 * @openapi
 * /project/simulations/{projectId}/{simulationId}/report/pdf:
 *   get:
 *     tags: [Simulation]
 *     summary: Download the simulation report as a PDF
 *     description: >
 *       Renders the generated report with the fixed IDEM template (Jura, brand
 *       colours, motif) and streams it as a PDF. Composed server-side so the
 *       document is identical whatever the reader's browser.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200':
 *         description: The report, as application/pdf
 *         content:
 *           application/pdf:
 *             schema: { type: string, format: binary }
 *       '404': { description: The simulation has no report yet }
 */
simulationRoutes.get(
  `/${resource}/:projectId/:simulationId/report/pdf`,
  authenticate,
  downloadReportPdfController
);

/**
 * @openapi
 * /project/simulations/{projectId}/{simulationId}/labs/{lab}:
 *   post:
 *     tags: [Simulation]
 *     summary: Run a complementary analysis on a completed simulation
 *     description: >
 *       `redTeam` attacks the project from six adversarial angles.
 *       `customers` builds a synthetic customer panel and a price curve.
 *       `investors` puts the project in front of four investor theses.
 *       `blackSwan` replays rare but plausible shocks through the engine.
 *       `universes` tests alternative business models on the same scenarios.
 *       `timeMachine` projects the trajectories over five years.
 *       `experiments` ranks the real-world tests that reduce uncertainty most.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: lab
 *         required: true
 *         schema:
 *           type: string
 *           enum: [redTeam, customers, investors, blackSwan, universes, timeMachine, experiments]
 *     responses:
 *       '200': { description: The simulation, with the lab result attached }
 *       '400': { description: Unknown lab }
 *       '409': { description: The simulation is not completed }
 */
simulationRoutes.post(
  `/${resource}/:projectId/:simulationId/labs/:lab`,
  authenticate,
  checkPolicyAcceptance,
  checkQuota,
  runLabController
);
