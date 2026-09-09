import { Router, Request, Response } from 'express';
import { buildRepairPrompt, lintGeneratedFiles } from '../design/slopLint.js';
import { buildSecurityRepairPrompt, scanGeneratedFiles } from '../design/securityLint.js';
import { ChatLogger } from '../utils/logger.js';

const router = Router();

/**
 * Design linter for freshly generated projects.
 *
 * The client posts the file map it just parsed out of the artifact and gets
 * back the violations plus a ready-to-send repair prompt. Nothing here calls a
 * model, so the check itself is free; only the repair costs tokens, and only
 * when there is something to repair.
 */
router.post('/lint', (req: Request, res: Response) => {
  const { files, expectedLogo } = req.body as {
    files?: Record<string, string>;
    expectedLogo?: string | string[];
  };

  if (!files || typeof files !== 'object' || Array.isArray(files)) {
    return res.status(400).json({ error: 'Expected a `files` object mapping paths to contents.' });
  }

  const report = lintGeneratedFiles(files, {
    expectedLogo:
      typeof expectedLogo === 'string' || Array.isArray(expectedLogo) ? expectedLogo : undefined,
  });
  const repairPrompt = buildRepairPrompt(report, files);

  ChatLogger.setContext('QualityRoute');
  ChatLogger.info('LINT', 'Linted generated project', {
    filesScanned: report.filesScanned,
    errors: report.errorCount,
    warnings: report.warningCount,
    rules: [...new Set(report.violations.map((violation) => violation.rule))],
  });

  return res.json({
    ...report,
    repairPrompt,
    /** The client only auto-repairs when something is actually broken. */
    shouldRepair: report.errorCount > 0 || report.warningCount >= 4,
  });
});

/**
 * Scan de sécurité avant publication.
 *
 * Comme le linter de design, ce sont des règles déterministes : le scan ne
 * coûte rien et peut donc tourner à chaque génération plutôt qu'à la demande.
 * Seule la réparation consomme des tokens, et seulement s'il y a quelque chose
 * à réparer.
 */
router.post('/security', (req: Request, res: Response) => {
  const { files } = req.body as { files?: Record<string, string> };

  if (!files || typeof files !== 'object' || Array.isArray(files)) {
    return res.status(400).json({ error: 'Expected a `files` object mapping paths to contents.' });
  }

  const report = scanGeneratedFiles(files);
  const repairPrompt = buildSecurityRepairPrompt(report);

  ChatLogger.setContext('QualityRoute');
  ChatLogger.info('SECURITY', 'Scanned generated project', {
    filesScanned: report.filesScanned,
    critical: report.criticalCount,
    high: report.highCount,
    medium: report.mediumCount,
    rules: [...new Set(report.findings.map((finding) => finding.rule))],
  });

  return res.json({ ...report, repairPrompt });
});

export default router;
