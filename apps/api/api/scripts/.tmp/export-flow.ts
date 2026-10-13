import fs from 'fs';
import path from 'path';
import { configureCore } from '../../../../ivision/core/src/runtime/host';
import { MotionVideoService, drainRenderQueue, isRenderFresh } from '../../../../ivision/core/src/video/motionVideo.service';
import { buildStoryboard } from '../../../../ivision/core/src/video/video.storyboard';
import { closeRenderBrowser } from '../../../../ivision/core/src/video/video.renderer';
import { brandById } from '../fixtures/motion-video/brands';

const OUT = process.env.OUT!;
const storage = { async uploadFile(content: Buffer, fileName: string, folder: string) { const dir = path.join(OUT, 'storage', folder.replace(/[^a-zA-Z0-9/_-]/g, '_')); fs.mkdirSync(dir, { recursive: true }); const file = path.join(dir, fileName); fs.writeFileSync(file, content); return { fileName, filePath: file, downloadURL: `file://${file}` }; } };
configureCore({ storage } as any);
const brand = brandById('wax');
let video: any = {
  id: 'v-test', title: 'Test', brief: { message: 'Lancement', musicMood: 'none', objective: 'promotion', style: 'premium' }, scope: { durationSec: 6, formats: ['story'], quality: 'standard' },
  storyboard: buildStoryboard({ sceneIds: ['statement', 'statement', 'logo'], slots: [{ title: 'Une idée' }, { title: 'Une entreprise' }, {}], durationSec: 6, style: 'premium', seed: 4, images: [], direction: 'precision' }),
  renders: [], status: 'draft', paidCredits: 120, exportCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
};
const store: any = {
  loadBrand: async () => ({ brandName: brand.name, branding: brand.branding, voice: { language: 'fr' }, visuals: [], videos: [] }),
  listVideos: async () => [video],
  saveVideo: async (_u: string, _p: string, v: any) => { video = v; },
  mutateVideo: async (_u: string, _p: string, _id: string, fn: (v: any) => any) => { video = fn(video); return video; },
  removeVideo: async () => true,
};
const service = new MotionVideoService(store);
(service as any).storage = storage;
const plan = (f: string) => JSON.stringify(service.downloadPlan(video, f as any));
const show = () => video.renders.map((r: any) => `${r.format}:${r.status}${r.prerender ? '(avance)' : ''}${r.status === 'done' ? (isRenderFresh(video, r) ? ' à jour' : ' périmé') : ''}`).join(', ');
(async () => {
  console.log('avant :', plan('story'));
  let t = Date.now();
  await service.prerender('u', 'p', 'v-test');
  console.log('pendant le rendu d’avance :', plan('story'), plan('square'));
  await drainRenderQueue();
  console.log(`rendu d'avance story : ${((Date.now() - t) / 1000).toFixed(1)} s →`, show(), '| exportCount', video.exportCount);
  console.log('plan story :', plan('story'), '| menu :', JSON.stringify(service.downloadOptions(video)));
  console.log('réclamé :', await service.claimRender('u', 'p', 'v-test', 'story' as any), '| encore :', await service.claimRender('u', 'p', 'v-test', 'story' as any), '| exportCount', video.exportCount);
  console.log('plan story :', plan('story'), '| plan square :', plan('square'));
  const sq = service.downloadPlan(video, 'square' as any) as any;
  t = Date.now();
  await service.startExport('u', 'p', 'v-test', sq.scope, undefined, { only: ['square'] as any });
  await drainRenderQueue();
  console.log(`export square seul : ${((Date.now() - t) / 1000).toFixed(1)} s →`, show(), '| formats', video.scope.formats, '| exportCount', video.exportCount);
  await service.updateVideo('u', 'p', 'v-test', { slots: { [video.storyboard.scenes[0].key]: { title: 'Une autre idée' } } });
  console.log('après retouche :', show(), '| plan story :', plan('story'));
  await closeRenderBrowser();
  process.exit(0);
})().catch(async (e) => { console.error(e); await closeRenderBrowser(); process.exit(1); });
