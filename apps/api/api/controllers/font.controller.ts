import { Request, Response } from 'express';
import logger from '../config/logger';
import {
  GoogleFontsNotConfiguredError,
  googleFontsService,
} from '../services/google-fonts.service';

/**
 * Expose le catalogue Google Fonts au front, sans jamais lui donner la clé API.
 */
export class FontController {
  /**
   * GET /fonts?q=&category=&limit=
   */
  static async searchFonts(req: Request, res: Response): Promise<void> {
    const query = typeof req.query.q === 'string' ? req.query.q : '';
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const limit = Number.parseInt(String(req.query.limit ?? ''), 10);

    try {
      const result = await googleFontsService.search(
        query,
        category,
        Number.isNaN(limit) ? undefined : limit
      );

      res.status(200).json({
        success: true,
        data: result,
        message: 'Fonts retrieved successfully',
      });
    } catch (error: any) {
      if (error instanceof GoogleFontsNotConfiguredError) {
        // 503 et pas 500 : rien n'est cassé, la fonctionnalité n'est simplement
        // pas configurée. Le front bascule sur sa liste de secours intégrée.
        logger.warn('Google Fonts search called but GOOGLE_FONTS_API_KEY is not set');
        res.status(503).json({
          success: false,
          code: 'GOOGLE_FONTS_NOT_CONFIGURED',
          message: 'Google Fonts API key is not configured on this server',
        });
        return;
      }

      logger.error('Error searching Google Fonts:', {
        error: error.message,
        status: error.response?.status,
      });
      res.status(502).json({
        success: false,
        message: 'Error retrieving fonts from Google Fonts',
        error: error.message,
      });
    }
  }
}
