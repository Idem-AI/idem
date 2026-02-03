import { Router, Request, Response } from 'express';
import multer from 'multer';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/', upload.single('file'), async (req: Request, res: Response) => {
  try {
    console.log('=== DEPLOY API CALLED ===');
    console.log('NETLIFY_TOKEN:', process.env.NETLIFY_TOKEN ? 'Present' : 'Missing');
    console.log('NETLIFY_DEPLOY_URL:', process.env.NETLIFY_DEPLOY_URL);

    const accessToken = process.env.NETLIFY_TOKEN;
    const url = process.env.NETLIFY_DEPLOY_URL;

    if (!accessToken || !url) {
      console.error('Missing Netlify configuration');
      return res.json({
        success: false,
        message: 'Netlify configuration missing',
      });
    }

    const file = req.file;

    if (!file) {
      console.error('No file provided');
      return res.json({
        success: false,
        message: 'No file provided',
      });
    }

    console.log('File info:', {
      name: file.originalname,
      type: file.mimetype,
      size: file.size,
    });

    if (file.mimetype !== 'application/zip') {
      console.error('Invalid file type:', file.mimetype);
      return res.json({
        success: false,
        message: 'Invalid file type. Please upload a zip file',
      });
    }

    console.log('Creating new site on Netlify...');
    const createSiteResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        name: `idem-app-${Date.now()}`,
      }),
    });

    if (!createSiteResponse.ok) {
      const errorText = await createSiteResponse.text();
      console.error('Failed to create site:', createSiteResponse.status, errorText);
      return res.json({
        success: false,
        message: `Failed to create site: ${createSiteResponse.status} - ${errorText}`,
      });
    }

    const siteData = (await createSiteResponse.json()) as { id: string };
    console.log('Site created:', siteData);

    const deployUrl = `${url}/${siteData.id}/deploys`;
    console.log('Deploying to site:', deployUrl);

    const headers = {
      'Content-Type': 'application/zip',
      Authorization: `Bearer ${accessToken}`,
    };

    console.log('Sending deployment request to Netlify...');
    const response = await fetch(deployUrl, {
      method: 'POST',
      headers: headers,
      body: file.buffer,
    });

    console.log('Netlify response status:', response.status);
    console.log('Netlify response headers:', Object.fromEntries(response.headers.entries()));

    const responseText = await response.text();
    console.log('Netlify response body:', responseText);

    if (response.ok) {
      try {
        const siteInfo = JSON.parse(responseText);
        console.log('Site created and deployed successfully');
        console.log('Site URL:', siteInfo.url);

        return res.json({
          success: true,
          url: siteInfo.url,
          siteInfo: siteInfo,
        });
      } catch (parseError) {
        console.error('Failed to parse Netlify response:', parseError);
        return res.json({
          success: false,
          message: 'Invalid response from Netlify',
        });
      }
    } else {
      console.error(`Failed to create site. Status code: ${response.status}`);
      console.error(`Response content: ${responseText}`);

      return res.json({
        success: false,
        message: `Netlify deployment failed: ${response.status} - ${responseText}`,
        status: response.status,
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
