import { Router, Request, Response } from 'express';
import multer from 'multer';
import { createHash } from 'crypto';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
});

/**
 * Marque de propriété d'un site Netlify : préfixe dérivé de l'uid IDEM.
 * Tous les sites vivent sur le même compte Netlify ; sans cette marque, un
 * `siteId` fourni par le client permettait d'écraser le site d'un autre.
 */
function ownerPrefix(uid: string): string {
  const secret = process.env.DEPLOY_OWNER_SECRET || process.env.NETLIFY_TOKEN || '';
  const tag = createHash('sha256').update(`${secret}:${uid}`).digest('hex').slice(0, 12);
  return `idem-app-${tag}-`;
}

type NetlifySite = {
  id: string;
  name?: string;
  url?: string;
  ssl_url?: string;
  admin_url?: string;
};

/**
 * Checks that a previously created site still exists and still belongs to this
 * account. Returns the site when reusable, null when it should be recreated.
 */
async function fetchExistingSite(
  baseUrl: string,
  accessToken: string,
  siteId: string
): Promise<NetlifySite | null> {
  try {
    const response = await fetch(`${baseUrl}/${siteId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (response.ok) {
      return (await response.json()) as NetlifySite;
    }

    console.warn(`Site ${siteId} not reusable (status ${response.status}), creating a new one`);
    return null;
  } catch (error) {
    console.error('Failed to look up existing site:', error);
    return null;
  }
}

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

    // The client sends back the siteId of a previous deploy so a redeploy
    // updates the very same site (same URL) instead of creating a new one.
    const requestedSiteId =
      typeof req.body?.siteId === 'string' && req.body.siteId.trim() ? req.body.siteId.trim() : null;

    let site: NetlifySite | null = null;
    let isNewSite = false;

    const uid = req.idemUser?.uid;
    if (!uid) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const prefix = ownerPrefix(uid);

    if (requestedSiteId) {
      console.log('Reusing existing Netlify site:', requestedSiteId);
      site = await fetchExistingSite(url, accessToken, requestedSiteId);
      // Un site qui n'appartient pas à l'appelant n'est jamais redéployé.
      if (site && !site.name?.startsWith(prefix)) {
        console.warn('Refused redeploy of a site owned by someone else:', requestedSiteId);
        site = null;
      }
    }

    if (!site) {
      console.log('Creating new site on Netlify...');
      const createSiteResponse = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          name: `${prefix}${Date.now()}`,
        }),
      });

      if (!createSiteResponse.ok) {
        const errorText = await createSiteResponse.text();
        console.error('Failed to create site:', createSiteResponse.status, errorText);
        return res.json({
          success: false,
          message: `Failed to create site (${createSiteResponse.status})`,
        });
      }

      site = (await createSiteResponse.json()) as NetlifySite;
      isNewSite = true;
      console.log('Site created:', site.id);
    }

    const deployUrl = `${url}/${site.id}/deploys`;
    console.log(isNewSite ? 'Deploying to new site:' : 'Redeploying to site:', deployUrl);

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

    const responseText = await response.text();

    if (response.ok) {
      try {
        const deployInfo = JSON.parse(responseText);
        // A deploy payload carries the deploy-scoped url (e.g. 68f--site.netlify.app).
        // The stable production url lives on the site itself.
        const publicUrl =
          site.ssl_url || site.url || deployInfo.ssl_url || deployInfo.url || deployInfo.deploy_url;

        console.log('Deployment successful:', publicUrl);

        return res.json({
          success: true,
          url: publicUrl,
          siteId: site.id,
          siteName: site.name || deployInfo.name,
          adminUrl: site.admin_url || deployInfo.admin_url,
          deployId: deployInfo.id,
          isNewSite,
          siteInfo: deployInfo,
        });
      } catch (parseError) {
        console.error('Failed to parse Netlify response:', parseError);
        return res.json({
          success: false,
          message: 'Invalid response from Netlify',
        });
      }
    } else {
      console.error(`Failed to deploy. Status code: ${response.status}`);
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
