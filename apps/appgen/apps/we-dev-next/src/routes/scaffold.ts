import { Router, Request, Response } from 'express';
import { resolveBuildTarget } from '../config/buildTarget.js';
import { buildScaffold } from '../scaffold/index.js';
import type { BrandLogoSource } from '../scaffold/shared.js';
import { embeddableLogoUrls } from '../design/charter.js';
import { fetchBrandAsset } from '../utils/brandAsset.js';
import { ProjectModel } from '../types/project.js';
import { ChatLogger } from '../utils/logger.js';
import { forwardedCredentials } from '../middleware/auth.js';
import { fetchBrandMark, withBrandMark } from '../siteEngine/redesign/idemClient.js';
import { headerBrandMarkOf } from '../siteEngine/siteData.js';

const router = Router();

/**
 * Le starter préconfiguré, servi à l'espace de travail.
 *
 * Le client appelle cette route à l'ouverture d'un projet neuf, monte les
 * fichiers reçus dans WebContainer, puis parle au modèle. La génération
 * commence donc sur un projet qui démarre déjà, avec la charte en place : le
 * modèle n'a plus qu'à écrire le produit.
 *
 * Aucun appel de modèle ici — le starter est du calcul pur, donc gratuit.
 */
/**
 * Le logo de la charte, déposé dans le projet.
 *
 * SVG de préférence : il devient `public/brand/logo.svg`, servi à la racine du
 * site. Une image matricielle est embarquée en data URI. Si rien n'a pu être
 * récupéré, la marque garde l'adresse d'origine.
 */
async function resolveBrandLogo(
  projectData?: ProjectModel
): Promise<{ source?: BrandLogoSource; file?: { path: string; content: string } } | undefined> {
  const logo = projectData?.analysisResultModel?.branding?.logo;
  if (!logo) return undefined;

  // L'adresse fixe du logo : rien à déposer, le site affichera toujours le logo actuel de la charte.
  const fixed = headerBrandMarkOf(projectData)?.publicSrc;
  if (fixed) return { source: { remote: fixed } };

  // La marque d'en-tête (logo rogné au plus juste) d'abord : le logo enregistré garde souvent la toile vide de
  // l'image d'origine, et tient alors en quelques pixels dans un en-tête de 36 px.
  const header = headerBrandMarkOf(projectData)?.src;
  for (const url of [...(header ? [header] : []), ...embeddableLogoUrls(logo).filter((u) => u !== header)]) {
    const asset = await fetchBrandAsset(url);
    if (!asset) continue;

    if (asset.text) {
      return {
        source: { path: '/brand/logo.svg' },
        file: { path: 'public/brand/logo.svg', content: asset.text },
      };
    }

    if (asset.base64) {
      return { source: { dataUri: `data:${asset.contentType};base64,${asset.base64}` } };
    }
  }

  return undefined;
}

router.post('/', async (req: Request, res: Response) => {
  const { projectData, product, platform, language } = req.body as {
    projectData?: ProjectModel;
    product?: unknown;
    platform?: unknown;
    language?: string;
  };

  try {
    const target = resolveBuildTarget(product, platform, projectData);
    // Site vitrine : la marque d'en-tête du projet (logotype seul, ou icône + nom), calculée une fois par l'API puis
    // gardée. Bornée : le socle doit arriver avant que l'atelier ne lance la génération sans lui.
    const mark = target === 'site' && projectData?.id && !headerBrandMarkOf(projectData)?.publicSrc ? await fetchBrandMark(projectData.id, forwardedCredentials(req), { timeoutMs: 4000 }) : null;
    const project = withBrandMark(projectData, mark);
    const brand = target === 'site' ? await resolveBrandLogo(project) : undefined;
    const scaffold = buildScaffold({ target, projectData: project, language, brand });

    ChatLogger.setContext('ScaffoldRoute');
    ChatLogger.info('SCAFFOLD', 'Starter served', {
      target,
      version: scaffold.version,
      files: Object.keys(scaffold.files).length,
      locked: scaffold.locked.length,
      project: projectData?.name,
      logo: brand?.file ? 'déposé (SVG)' : brand?.source?.dataUri ? 'embarqué' : 'adresse d’origine',
    });

    return res.json(scaffold);
  } catch (error) {
    ChatLogger.setContext('ScaffoldRoute');
    ChatLogger.error('SCAFFOLD_FAILED', 'Could not build the starter', {
      message: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ error: 'Could not build the starter.' });
  }
});

export default router;
