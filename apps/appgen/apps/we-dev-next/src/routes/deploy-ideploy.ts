import { Router, Request, Response } from 'express';
import multer from 'multer';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/', upload.single('file'), async (req: Request, res: Response) => {
  try {
    console.log('=== IDEPLOY DEPLOY API CALLED ===');
    
    const idemToken = process.env.IDEM_API_TOKEN;
    const idemUrl = process.env.IDEM_DEPLOY_URL || 'https://ideploy.africa';

    if (!idemToken) {
      return res.json({
        success: false,
        message: 'IDEM_API_TOKEN not configured',
      });
    }

    const file = req.file;
    if (!file) {
      return res.json({
        success: false,
        message: 'No file provided',
      });
    }

    if (file.mimetype !== 'application/zip') {
      return res.json({
        success: false,
        message: 'Invalid file type. Please upload a zip file',
      });
    }

    console.log('Deploying to iDeploy...', {
      url: `${idemUrl}/api/one-click-deploy`,
      fileSize: file.size,
    });

    const formData = new FormData();
    formData.append('file', new Blob([file.buffer]), file.originalname);
    formData.append('project_name', `appgen-${Date.now()}`);

    const response = await fetch(`${idemUrl}/api/one-click-deploy`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${idemToken}`,
      },
      body: formData,
    });

    const responseText = await response.text();
    console.log('iDeploy response:', responseText);

    if (response.ok) {
      const data = JSON.parse(responseText);
      return res.json({
        success: true,
        url: data.url,
        application_uuid: data.application_uuid,
      });
    } else {
      return res.json({
        success: false,
        message: `iDeploy deployment failed: ${response.status}`,
      });
    }
  } catch (error) {
    console.error('Deploy API error:', error);
    return res.json({
      success: false,
      message: `Server error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
});

export default router;
