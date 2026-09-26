import { Response } from 'express';
import logger from '../config/logger';
import { CustomRequest } from '../interfaces/express.interface';
import { FontSourceId } from '../models/brand-identity.model';
import { fontCatalogService } from '../services/font-catalog.service';
import { InvalidFontFileError, customFontService } from '../services/customFont.service';

/**
 * Catalogue de polices et import de polices propres.
 *
 * Le front ne parle à aucun fournisseur directement : la clé Google reste
 * côté serveur, et les catalogues (Google, Fontshare, Fontsource) sont mis en
 * cache une fois pour tous les utilisateurs. Les polices importées, elles, ne
 * sortent jamais du compte qui les a envoyées.
 */

const KNOWN_SOURCES: FontSourceId[] = ['google', 'fontshare', 'fontsource', 'custom'];

export class FontController {
  /**
   * GET /fonts?q=&category=&source=&limit=
   *
   * `source` accepte une liste séparée par des virgules ; absente, toutes les
   * sources sont interrogées.
   */
  static async searchFonts(req: CustomRequest, res: Response): Promise<void> {
    const query = typeof req.query.q === 'string' ? req.query.q : '';
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const limit = Number.parseInt(String(req.query.limit ?? ''), 10);
    const sources = parseSources(req.query.source);

    try {
      const result = await fontCatalogService.search({
        query,
        category,
        sources,
        limit: Number.isNaN(limit) ? undefined : limit,
        userId: req.user?.uid,
      });

      res.status(200).json({
        success: true,
        data: result,
        message: 'Fonts retrieved successfully',
      });
    } catch (error: any) {
      // Une source injoignable est déjà absorbée par le catalogue agrégé : si
      // on arrive ici, c'est notre code qui a cassé, pas un fournisseur.
      logger.error('Error searching the font catalog:', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Error retrieving fonts',
        error: error.message,
      });
    }
  }

  /** GET /fonts/sources — les catalogues proposés dans le filtre du front. */
  static async listSources(_req: CustomRequest, res: Response): Promise<void> {
    res.status(200).json({
      success: true,
      data: { sources: fontCatalogService.availableSources() },
      message: 'Font sources retrieved successfully',
    });
  }

  /**
   * POST /fonts/custom — téléverse une famille et renvoie sa feuille.
   *
   * C'est l'URL de cette feuille (`cssUrl`, servie par notre bucket) que le
   * front stocke ensuite dans la typographie du projet, à la place du lien
   * Google.
   */
  static async importFont(req: CustomRequest, res: Response): Promise<void> {
    const userId = req.user?.uid;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    const family = typeof req.body?.family === 'string' ? req.body.family : '';
    const category = typeof req.body?.category === 'string' ? req.body.category : 'sans-serif';

    try {
      const font = await customFontService.importFont(
        userId,
        // Sans nom donné, celui du premier fichier fait un point de départ
        // utilisable — l'utilisateur pourra toujours le corriger.
        family || familyFromFileName(files[0]?.originalname),
        files.map((file) => ({
          originalname: file.originalname,
          buffer: file.buffer,
          size: file.size,
        })),
        category
      );

      res.status(201).json({
        success: true,
        data: font,
        message: 'Font imported successfully',
      });
    } catch (error: any) {
      if (error instanceof InvalidFontFileError) {
        res.status(400).json({ success: false, code: error.code, message: error.message });
        return;
      }
      logger.error('Error importing a custom font:', { error: error.message, userId });
      res.status(500).json({
        success: false,
        message: 'Error importing the font',
        error: error.message,
      });
    }
  }

  /** GET /fonts/custom — la bibliothèque de l'utilisateur. */
  static async listCustomFonts(req: CustomRequest, res: Response): Promise<void> {
    const userId = req.user?.uid;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    try {
      const fonts = await customFontService.listFonts(userId);
      res.status(200).json({
        success: true,
        data: { fonts },
        message: 'Imported fonts retrieved successfully',
      });
    } catch (error: any) {
      logger.error('Error listing imported fonts:', { error: error.message, userId });
      res.status(500).json({
        success: false,
        message: 'Error retrieving imported fonts',
        error: error.message,
      });
    }
  }

  /** DELETE /fonts/custom/:fontId */
  static async deleteCustomFont(req: CustomRequest, res: Response): Promise<void> {
    const userId = req.user?.uid;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    try {
      const removed = await customFontService.deleteFont(userId, req.params.fontId as string);
      if (!removed) {
        res.status(404).json({ success: false, message: 'Font not found' });
        return;
      }
      res.status(200).json({ success: true, message: 'Font deleted successfully' });
    } catch (error: any) {
      logger.error('Error deleting an imported font:', { error: error.message, userId });
      res.status(500).json({
        success: false,
        message: 'Error deleting the font',
        error: error.message,
      });
    }
  }
}

function parseSources(raw: unknown): FontSourceId[] | undefined {
  const value = Array.isArray(raw) ? raw.join(',') : typeof raw === 'string' ? raw : '';
  const requested = value
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .filter((entry): entry is FontSourceId => KNOWN_SOURCES.includes(entry as FontSourceId));
  return requested.length ? [...new Set(requested)] : undefined;
}

/** « Satoshi-Bold.woff2 » → « Satoshi ». */
function familyFromFileName(fileName?: string): string {
  if (!fileName) return '';
  return fileName
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[-_]?(thin|extra ?light|ultra ?light|light|regular|normal|book|medium|semi ?bold|demi ?bold|extra ?bold|ultra ?bold|bold|black|heavy|italic|oblique|[1-9]00)/gi, '')
    .replace(/[-_]+/g, ' ')
    .trim();
}
