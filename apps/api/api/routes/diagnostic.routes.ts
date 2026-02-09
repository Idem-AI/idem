import { Router, Request, Response } from 'express';
import { PdfService } from '../services/pdf.service';
import logger from '../config/logger';

const router = Router();

/**
 * Endpoint de diagnostic pour vérifier l'état de Puppeteer
 */
router.get('/pdf-health', async (req: Request, res: Response) => {
  try {
    logger.info('PDF health check requested');

    // Vérifier si le service PDF est initialisé
    const healthStatus = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      puppeteerExecutablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      chromeAvailable: false,
      browserInitialized: false,
      error: null as string | null
    };

    try {
      // Test simple de génération PDF
      const pdfService = new PdfService();
      const testPdfPath = await pdfService.generatePdf({
        projectName: 'Health Check',
        projectDescription: 'Test PDF generation',
        sections: [{
          id: 'test',
          name: 'Test Section',
          data: '<h1>PDF Health Check</h1><p>This is a test PDF generation.</p>',
          type: 'html',
          summary: 'Test section for PDF health check'
        }],
        title: 'Health Check PDF'
      });

      healthStatus.browserInitialized = true;
      healthStatus.chromeAvailable = true;

      logger.info('PDF health check passed');
      res.status(200).json({
        status: 'healthy',
        message: 'PDF service is working correctly',
        details: healthStatus,
        testPdfGenerated: !!testPdfPath
      });

    } catch (error: any) {
      healthStatus.error = error.message;
      healthStatus.browserInitialized = false;

      logger.error('PDF health check failed:', error);
      res.status(500).json({
        status: 'unhealthy',
        message: 'PDF service is not working',
        details: healthStatus,
        error: error.message
      });
    }

  } catch (error: any) {
    logger.error('PDF health check endpoint error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      error: error.message
    });
  }
});

/**
 * Endpoint pour tester la génération PDF avec du contenu personnalisé
 */
router.post('/test-pdf', async (req: Request, res: Response) => {
  try {
    const { projectName = 'Test Project', sections = [] } = req.body;

    logger.info(`Test PDF generation requested for project: ${projectName}`);

    const defaultSections = sections.length > 0 ? sections : [{
      id: 'test-section',
      name: 'Test Section',
      data: '<h1>Test PDF</h1><p>This is a test PDF with custom content.</p>',
      type: 'html',
      summary: 'Test section with custom content'
    }];

    const pdfService = new PdfService();
    const pdfPath = await pdfService.generatePdf({
      projectName,
      projectDescription: 'Test PDF generation with custom content',
      sections: defaultSections,
      title: `Test PDF - ${projectName}`
    });

    if (pdfPath) {
      res.status(200).json({
        success: true,
        message: 'PDF generated successfully',
        pdfPath: pdfPath
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'PDF generation failed - no path returned'
      });
    }

  } catch (error: any) {
    logger.error('Test PDF generation failed:', error);
    res.status(500).json({
      success: false,
      message: 'PDF generation failed',
      error: error.message
    });
  }
});

export default router;
