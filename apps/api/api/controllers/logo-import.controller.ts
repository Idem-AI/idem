import { Request, Response } from 'express';
import { processLogoImport, convertSvgToPng, resolveSvgContent } from '../services/logo-import.service';
import { generateLogoVariations } from '../services/logoVariationEngine.service';
import { logoAnalysisService } from '../services/BandIdentity/logoAnalysis.service';
import { storageService } from '../services/storage.service';
import logger from '../config/logger';

/**
 * POST /api/logo/import
 * Accepts a multipart/form-data upload with field "logo".
 * Returns: svg, logoUrl (MinIO if projectId provided), variations (programmatic), extractedColors.
 */
export const importLogoController = async (req: Request, res: Response): Promise<void> => {
  try {
    const file = req.file;

    if (!file || !file.buffer) {
      logger.warn('Logo import: no file uploaded');
      res.status(400).json({
        success: false,
        error: 'No file uploaded. Please provide a logo file (SVG, PNG, JPG, or WebP).',
      });
      return;
    }

    logger.info(`Logo import: processing file "${file.originalname}" (${file.size} bytes)`);

    const result = await processLogoImport(file.buffer, file.originalname);

    logger.info(
      `Logo import: success - ${result.width}x${result.height}, SVG length: ${result.svg.length}, extracted ${result.extractedColors.length} colors`
    );

    // Generate variations with the hybrid engine (deterministic OKLCH transforms + rendered QA)
    const variations = await generateLogoVariations(result.svg);

    // Optional MinIO upload when projectId is provided
    let logoUrl: string | undefined;
    const projectId = req.body?.projectId as string | undefined;
    const userId = (req as any).user?.uid as string | undefined;

    if (projectId && userId) {
      try {
        const folderPath = `users/${userId}/projects/${projectId}/logos`;
        const uploadResult = await storageService.uploadFile(
          result.svg,
          `logo-imported-${Date.now()}.svg`,
          folderPath,
          'image/svg+xml'
        );
        logoUrl = uploadResult.downloadURL;
        logger.info(`Logo import: uploaded to MinIO - ${logoUrl}`);
      } catch (uploadErr: any) {
        logger.warn(`Logo import: MinIO upload failed (non-critical): ${uploadErr.message}`);
      }
    }

    res.status(200).json({
      success: true,
      svg: result.svg,
      logoUrl,
      variations,
      width: result.width,
      height: result.height,
      extractedColors: result.extractedColors,
    });
  } catch (error: any) {
    logger.error(`Logo import error: ${error.message}`, { stack: error.stack });

    let statusCode = 500;
    if (
      error.message.includes('Unsupported file format') ||
      error.message.includes('empty') ||
      error.message.includes('exceeds maximum')
    ) {
      statusCode = 400;
    } else if (error.message.includes('timed out')) {
      statusCode = 408;
    } else if (error.message.includes('too complex')) {
      statusCode = 422;
    }

    res.status(statusCode).json({
      success: false,
      error: error.message || 'An unexpected error occurred during logo processing.',
    });
  }
};



/**
 * POST /api/logo/analyze
 * Accepts JSON body with { svg: string }.
 * Runs a vision analysis of the imported logo and returns a structured
 * redesign brief for the "improve my logo" flow (maps onto LogoPreferences).
 */
export const analyzeLogoController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { svg } = req.body;

    if (!svg || typeof svg !== 'string') {
      res.status(400).json({
        success: false,
        error: 'SVG content is required in the request body.',
      });
      return;
    }

    // The frontend may send the stored MinIO URL instead of inline SVG content
    let svgContent: string;
    try {
      svgContent = await resolveSvgContent(svg);
    } catch (resolveError: any) {
      res.status(400).json({
        success: false,
        error: resolveError.message || 'The provided content is not a valid SVG.',
      });
      return;
    }

    logger.info(`Logo analysis: analyzing imported logo (${svgContent.length} chars)`);

    const analysis = await logoAnalysisService.analyzeLogo(svgContent);

    logger.info(
      `Logo analysis: success - type: ${analysis.logoType}, colors: ${analysis.colors.join(', ')}`
    );

    res.status(200).json({
      success: true,
      analysis,
    });
  } catch (error: any) {
    logger.error(`Logo analysis error: ${error.message}`, { stack: error.stack });
    res.status(500).json({
      success: false,
      error: error.message || 'An unexpected error occurred during logo analysis.',
    });
  }
};

/**
 * POST /api/logo/export/png
 * Accepts JSON body with { svg: string, width?: number, height?: number }.
 * Converts SVG to PNG and returns the PNG buffer.
 */
export const exportLogoPngController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { svg, width, height } = req.body;

    if (!svg || typeof svg !== 'string') {
      res.status(400).json({
        success: false,
        error: 'SVG content is required in the request body.',
      });
      return;
    }

    logger.info(`Logo export PNG: converting SVG (${svg.length} chars) to PNG`);

    const pngBuffer = await convertSvgToPng(svg, width, height);

    res.set({
      'Content-Type': 'image/png',
      'Content-Length': pngBuffer.length.toString(),
      'Content-Disposition': 'attachment; filename="logo.png"',
    });

    res.status(200).send(pngBuffer);
  } catch (error: any) {
    logger.error(`Logo export PNG error: ${error.message}`, { stack: error.stack });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to convert SVG to PNG.',
    });
  }
};
