/**
 * Le moteur créatif partagé par l'API IDEM et l'API iVision — ce qu'un hôte utilise.
 *
 * Les hôtes importent aussi les modules par leur chemin (`src/video/…`, `src/visual/…`) ; ce
 * fichier liste l'essentiel : brancher le moteur (`configureCore`), les vidéos, les visuels, le
 * scan de site et la reproduction d'un modèle.
 */
export { configureCore, coreHost, requirePort, type CoreHost, type CoreStorage, type ImageOptions, type VisionOptions } from './runtime/host';
export { setCoreLogger } from './runtime/logger';

export type { BrandKit, BrandVoice, BrandPalette } from './brand/brand-kit';

export { MotionVideoService, VideoInputError, type CreateVideoInput, type VideoProgressEvent, type VideoPatch } from './video/motionVideo.service';
export type { VideoStore, VideoBrandContext } from './video/contracts/store';
export { normalizeScope, videoCost, exportCost, setVideoPricingBase } from './video/pricing';
export { videoOptions } from './video/options';
export { closeFilmBrowser } from './video/rendering/runner';

export { composeVisual, type VisualPorts } from './visual/visual.composer';
export { visualBrandingFromKit, visualContextFromBrand } from './visual/visual.context';
export type { VisualBrandContext, VisualContent, FlyerFormat } from './visual/visual.model';

export { scanWebsite, brandKitFromScan, normalizeSiteUrl, SiteScanError, type SiteScanResult } from './site/site-scanner';

export { analyzeReferenceVideo, analyzeReferenceImage, type ReferenceBlueprint, type ReferenceImage } from './reference/reference.analyzer';
export { blueprintForDirector } from './reference/reference.plan';

export { safeFetch, SafeFetchError } from './render/safe-fetch';
