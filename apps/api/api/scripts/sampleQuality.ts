/**
 * LE BANC DU PLAN QUALITÉ CRÉATIVE — VRAIS MODÈLES, donc PAYANT. À lancer seulement sur demande de l'utilisateur,
 * une fois par phase au plus (phase 0 : ligne de base).
 *
 *   npm run sample:quality -- <dossier de sortie> [filtre] [--no-export] [--level=medium]
 *     filtre : ids séparés par des virgules (BP1,CH2,V3…), ou « graphic », « video ». Par défaut : les 17.
 *
 * Graphique : 12 échantillons (business plan, charte, pitch deck : 3 pages ; carte de visite : 2 faces), PNG gardés.
 * Vidéo : 5 films (voix coupée, aucune génération d'image : seul le moteur est mesuré), vignettes et MP4 gardés.
 * À la fin, un RAPPORT DE NOUVEAUTÉ calculé en local (CLIP, `@idem/design-tools`) : la distance moyenne entre les rendus
 * de marques différentes, par livrable — la mesure à faire monter (cible du plan : +30 %). Rien n'est jugé d'autre :
 * les rendus sont à REGARDER.
 */
import { loadSecrets } from '../config/secrets';
import fs from 'fs';
import path from 'path';
import '../services/graphic/engine.host';
import { brandFromIdem, cardFaces, coverContent, createDocument, renderSingle, SectionContent } from '@idem/graphic-engine';
import { cosine, imageEmbedding } from '@idem/design-tools';
import { GRAPHIC_SAMPLES, GraphicSample, sampleLogo, SampleBrand, VIDEO_SAMPLES, VideoSample } from './quality/samples';

const OUT = process.argv[2];
const args = process.argv.slice(3);
const filter = (args.find((a) => !a.startsWith('--')) ?? '').split(',').filter(Boolean);
const noExport = args.includes('--no-export');
const level = (args.find((a) => a.startsWith('--level='))?.split('=')[1] ?? 'medium') as 'low' | 'medium' | 'high' | 'ultra';
const wanted = (id: string, kind: 'graphic' | 'video') => !filter.length || filter.includes(id) || filter.includes(kind);

const T = {
  fr: { problem: 'Le problème', market: 'Le marché', finance: 'Plan financier', palette: 'Palette de couleurs', logo: 'Usage du logo', guidelines: 'Charte graphique', deck: 'Présentation investisseurs', bp: 'Business plan', indicator: 'Indicateur', revenue: 'Chiffre d’affaires', margin: 'Marge brute', net: 'Résultat net' },
  en: { problem: 'The problem', market: 'The market', finance: 'Financial plan', palette: 'Colour palette', logo: 'Logo usage', guidelines: 'Brand guidelines', deck: 'Investor deck', bp: 'Business plan', indicator: 'Indicator', revenue: 'Revenue', margin: 'Gross margin', net: 'Net result' },
  pt: { problem: 'O problema', market: 'O mercado', finance: 'Plano financeiro', palette: 'Paleta de cores', logo: 'Uso do logótipo', guidelines: 'Manual de marca', deck: 'Apresentação a investidores', bp: 'Plano de negócios', indicator: 'Indicador', revenue: 'Receita', margin: 'Margem bruta', net: 'Resultado líquido' },
};

function engineBrand(brand: SampleBrand) {
  const branding = { colors: { colors: brand.palette }, typography: { primaryFont: brand.fonts.display, secondaryFont: brand.fonts.body } };
  const light = sampleLogo(brand, 'light');
  const dark = sampleLogo(brand, 'dark');
  return brandFromIdem({ name: brand.name, branding: branding as never, logos: { primary: light, withTextLight: light, withTextDark: dark, withTextMono: light, icon: light } });
}

export function pages(s: GraphicSample): { sections: SectionContent[]; label: string } {
  const t = T[s.brand.locale];
  const cover = coverContent({ id: 'cover', brandName: s.brand.name, documentLabel: s.deliverable === 'pitch-deck' ? t.deck : s.deliverable === 'brand-charter' ? t.guidelines : t.bp, promise: s.subject, detail: s.brand.sector, dateLabel: '2026' });
  if (s.deliverable === 'brand-charter') {
    const p = s.brand.palette;
    return {
      label: t.guidelines,
      sections: [
        cover,
        { id: 'palette', role: 'specimen', title: t.palette, blocks: [{ id: 'sys-1', kind: 'swatches', origin: 'system', items: [{ hex: p.primary, name: 'Primary', role: '—' }, { hex: p.secondary, name: 'Secondary', role: '—' }, { hex: p.accent, name: 'Accent', role: '—' }, { hex: p.background, name: 'Ground', role: '—' }, { hex: p.text, name: 'Ink', role: '—' }] }] } as SectionContent,
        { id: 'logo', role: 'specimen', title: t.logo, blocks: [{ id: 'sys-1', kind: 'logoDisplay', origin: 'system', variants: [{ url: sampleLogo(s.brand, 'light'), label: 'Light', background: 'light' }, { url: sampleLogo(s.brand, 'dark'), label: 'Dark', background: 'dark' }] }] } as SectionContent,
      ],
    };
  }
  const prose = (id: string, title: string, text: string[]): SectionContent => ({ id, title, blocks: [{ id: 'p1', kind: 'prose', paragraphs: text }] }) as SectionContent;
  const table: SectionContent = { id: 'finance', title: t.finance, blocks: [{ id: 't1', kind: 'table', headers: [t.indicator, '2026', '2027', '2028'], rows: [[t.revenue, '18 000 000', '46 000 000', '92 000 000'], [t.margin, '41 %', '47 %', '52 %'], [t.net, '-9 500 000', '3 200 000', '17 800 000']] }] } as SectionContent;
  return {
    label: s.deliverable === 'pitch-deck' ? t.deck : t.bp,
    sections: [cover, prose('problem', t.problem, [`${s.subject}.`, s.brand.brief || s.brand.sector]), s.deliverable === 'business-plan' ? table : prose('market', t.market, [s.brand.sector, s.subject])],
  };
}

async function graphic(s: GraphicSample, dir: string): Promise<string[]> {
  const { brand, direction } = engineBrand(s.brand);
  const shots: string[] = [];
  const save = (name: string, png?: Buffer) => {
    if (!png) return;
    const file = path.join(dir, `${s.id}-${name}.png`);
    fs.writeFileSync(file, png);
    shots.push(file);
  };
  if (s.deliverable === 'business-card') {
    const faces = cardFaces({ binding: 'values', fields: { fullName: s.subject.split(/ à | in | em /)[0], jobTitle: s.brand.sector, companyName: s.brand.name, email: 'contact@example.com', phone: '+000 00 00 00 00', website: 'example.com' } });
    for (const face of [faces.front, faces.back]) {
      const out = await renderSingle({ documentType: 'business-card', format: 'card-landscape', brand, direction, creativity: level, seed: `quality-${s.id}-${face.id}`, content: face, png: true, locale: s.brand.locale === 'pt' ? 'pt' : s.brand.locale, country: s.brand.country, brief: s.subject });
      save(face.id, out.png);
    }
    return shots;
  }
  const { sections, label } = pages(s);
  const format = s.deliverable === 'business-plan' ? 'a4-portrait' : 'slide-16x9';
  const doc = await createDocument({ documentType: s.deliverable, format, brand, direction, creativity: level, seed: `quality-${s.id}`, png: true, locale: s.brand.locale, country: s.brand.country, brief: `${s.subject}. ${s.brand.sector}.`, documentLabel: label, sections: sections.map((x) => ({ id: x.id, role: x.role, purpose: x.title })) });
  for (const [i, sec] of sections.entries()) {
    const out = await doc.composeSection(sec, { index: i + 1, total: sections.length });
    save(sec.id, out.png);
    console.log(`  ${s.id}/${sec.id}`, JSON.stringify(out.result.usage), out.result.repairs.map((r) => r.code).join(','));
  }
  console.log(`  ${s.id} : axe ${doc.axis?.id ?? '—'} · idée ${doc.plan?.idea?.slice(0, 120) ?? '—'}`);
  return shots;
}

async function video(s: VideoSample, dir: string): Promise<string[]> {
  // Le cœur vidéo branché sur IDEM (modèles réels), avec un stockage et une mémoire LOCAUX.
  await import('../services/ivision/host');
  const { configureCore } = await import('../../../ivision/core/src/runtime/host');
  const { MotionVideoService, drainRenderQueue } = await import('../../../ivision/core/src/video/motionVideo.service');
  const { runtimeCall } = await import('../services/creativity/orchestrator');
  const storage = path.join(dir, 'storage');
  configureCore({
    storage: {
      uploadFile: async (content: Buffer, fileName: string, folder: string) => {
        const d = path.join(storage, folder);
        fs.mkdirSync(d, { recursive: true });
        fs.writeFileSync(path.join(d, fileName), content);
        return { downloadURL: `file://${path.join(d, fileName)}` };
      },
    },
  });
  process.env.VIDEO_ALLOW_FILE_URLS = '1';
  const videos = new Map<string, any>();
  const store = {
    loadBrand: async () => ({ brandName: s.brand.name, country: s.brand.country, branding: { colors: { colors: s.brand.palette }, typography: { primaryFont: s.brand.fonts.display, secondaryFont: s.brand.fonts.body }, logo: sampleLogo(s.brand) } as never, voice: { tone: 'professionnel', businessType: s.brand.sector, language: s.brand.locale }, visuals: [], videos: [...videos.values()] }),
    listVideos: async () => [...videos.values()],
    saveVideo: async (_u: string, _p: string, v: any) => void videos.set(v.id, v),
    mutateVideo: async (_u: string, _p: string, id: string, fn: (v: any) => any) => {
      const v = videos.get(id);
      if (!v) return null;
      const next = fn(v);
      videos.set(id, next);
      return next;
    },
    removeVideo: async (_u: string, _p: string, id: string) => videos.delete(id),
  };
  const service = new MotionVideoService(store as never, runtimeCall({ element: 'video', language: s.brand.locale }));
  const made = await service.createVideo('quality', `quality-${s.id}`, { brief: { message: s.request, request: s.request, musicMood: 'none', sfx: false, voice: false, allowGenerate: false, allowStock: false } as never, language: s.brand.locale, scope: { durationSec: s.durationSec, formats: [s.format], quality: 'standard' }, creativity: level } as never, 0);
  console.log(`  ${s.id} : moteur ${made.film?.engine} · axe ${made.film?.axis ?? '—'} · piste ${made.film?.explored?.chosen ?? '—'} · scènes en erreur ${made.film?.scenes.filter((x: any) => x.status === 'error').length}`);
  const shots = (made.film?.scenes ?? []).map((x: any) => x.thumbnail?.replace('file://', '')).filter((f: string | undefined): f is string => !!f && fs.existsSync(f));
  shots.forEach((f: string, i: number) => fs.copyFileSync(f, path.join(dir, `${s.id}-s${i + 1}.jpg`)));
  if (!noExport && made.film?.scenes.every((x: any) => x.status === 'ready')) {
    await service.startExport('quality', `quality-${s.id}`, made.id, made.scope);
    await drainRenderQueue();
    const mp4 = videos.get(made.id)?.renders?.find((r: any) => r.status === 'done')?.url?.replace('file://', '');
    if (mp4) fs.copyFileSync(mp4, path.join(dir, `${s.id}.mp4`));
  }
  return shots.map((_: string, i: number) => path.join(dir, `${s.id}-s${i + 1}.jpg`));
}

/** La nouveauté entre marques : 1 − la ressemblance moyenne (CLIP) des rendus de deux marques différentes, par groupe. */
async function noveltyReport(groups: Record<string, Record<string, string[]>>): Promise<Record<string, { brands: number; meanDistance: number }>> {
  const report: Record<string, { brands: number; meanDistance: number }> = {};
  for (const [group, bySample] of Object.entries(groups)) {
    const vectors: Record<string, Float32Array[]> = {};
    for (const [id, files] of Object.entries(bySample)) vectors[id] = (await Promise.all(files.map(async (f) => imageEmbedding(fs.readFileSync(f))))).filter((v): v is Float32Array => !!v);
    const ids = Object.keys(vectors).filter((id) => vectors[id].length);
    const distances: number[] = [];
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) for (const a of vectors[ids[i]]) for (const b of vectors[ids[j]]) distances.push(1 - cosine(a, b));
    report[group] = { brands: ids.length, meanDistance: distances.length ? Math.round((distances.reduce((x, y) => x + y, 0) / distances.length) * 1000) / 1000 : 0 };
  }
  return report;
}

if (process.argv.includes('--validate')) {
  // Validation hors ligne du contenu des échantillons (aucun modèle) : `--validate`.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { validateSectionContent } = require('../../../../packages/graphic-engine/src/contracts/validate');
  let bad = 0;
  for (const s of GRAPHIC_SAMPLES) {
    const list = s.deliverable === 'business-card' ? Object.values(cardFaces({ binding: 'values', fields: { fullName: 'X', jobTitle: s.brand.sector, companyName: s.brand.name, email: 'contact@example.com', phone: '+000 00 00 00 00', website: 'example.com' } })) : pages(s).sections;
    for (const sec of list) {
      const r = validateSectionContent(sec);
      if (!r.ok) {
        bad++;
        console.log(`✗ ${s.id}/${sec.id} : ${r.issues.map((i: { message: string }) => i.message).join(' · ')}`);
      }
    }
  }
  console.log(bad ? `${bad} page(s) invalide(s)` : '✓ contenu des 12 échantillons graphiques valide');
  process.exit(bad ? 1 : 0);
}

(async () => {
  if (!OUT) throw new Error('usage : npm run sample:quality -- <dossier> [filtre] [--no-export] [--level=medium]');
  await loadSecrets();
  fs.mkdirSync(OUT, { recursive: true });
  const groups: Record<string, Record<string, string[]>> = {};
  for (const s of GRAPHIC_SAMPLES.filter((x) => wanted(x.id, 'graphic'))) {
    console.log(`\n== ${s.id} (${s.deliverable}, ${s.brand.country}, ${s.brand.locale})`);
    try {
      (groups[s.deliverable] ??= {})[s.id] = await graphic(s, OUT);
    } catch (error) {
      console.log(`  ÉCHEC ${s.id} : ${(error as Error).message}`);
    }
  }
  for (const s of VIDEO_SAMPLES.filter((x) => wanted(x.id, 'video'))) {
    console.log(`\n== ${s.id} (vidéo ${s.durationSec} s, ${s.brand.country}, ${s.brand.locale})`);
    try {
      (groups.video ??= {})[s.id] = await video(s, OUT);
    } catch (error) {
      console.log(`  ÉCHEC ${s.id} : ${(error as Error).message}`);
    }
  }
  // Les vignettes vidéo sont relues dans le dossier (ce qui a vraiment été écrit), pas dans les listes rendues.
  for (const id of Object.keys(groups.video ?? {})) groups.video[id] = fs.readdirSync(OUT).filter((f) => f.startsWith(`${id}-s`) && f.endsWith('.jpg')).map((f) => path.join(OUT, f));
  const report = await noveltyReport(groups);
  fs.writeFileSync(path.join(OUT, 'novelty.json'), JSON.stringify({ at: new Date().toISOString(), level, report }, null, 2));
  console.log('\nNouveauté entre marques (distance CLIP moyenne, plus haut = plus différent) :');
  for (const [g, r] of Object.entries(report)) console.log(`  ${g} : ${r.meanDistance} (${r.brands} marques)`);
  process.exit(0);
})().catch((e) => {
  console.error('ÉCHEC', e?.message ?? e);
  process.exit(1);
});
