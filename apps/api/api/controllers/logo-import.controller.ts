import { Request, Response } from 'express';
import { processLogoImport, convertSvgToPng } from '../services/logo-import.service';
import logger from '../config/logger';

/**
 * POST /api/logo/import
 * Accepts a multipart/form-data upload with field "logo".
 * Detects file type, processes (SVG optimize or raster vectorize), returns clean SVG.
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

    res.status(200).json({
      success: true,
      svg: result.svg,
      width: result.width,
      height: result.height,
      extractedColors: result.extractedColors,
    });
  } catch (error: any) {
    logger.error(`Logo import error: ${error.message}`, { stack: error.stack });

    // Determine appropriate status code based on error type
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
