/**
 * `npm run check:image-quality` — la mesure de qualité des images et leur amélioration, sans IA payante.
 *
 * Trois vraies photos (jeu Kodak, `fixtures/`) sont dégradées comme le sont les images des vieux sites : réduites
 * puis réagrandies, floutées, compressées en JPEG lourd. On vérifie :
 *   - que la mesure signale CHAQUE défaut et ne signale RIEN sur les originales ni sur un aplat net ;
 *   - qu'une image n'est jugée « trop petite » que face à une place qui la dépasse ;
 *   - que le détecteur trouve le visage et seulement lui (il est téléchargé une fois, 1,2 Mo) ;
 *   - que l'amélioration rend une image plus nette qu'un simple agrandissement, aux mêmes couleurs.
 *
 * `--model` : essaie aussi le modèle local (Real-ESRGAN compact, ~4,5 Mo téléchargés une fois, aucun coût).
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { faceScore } from '../src/faces';
import { gridBlockiness, measureImageQuality, needsEnhancement, THRESHOLDS, type ImageQuality } from '../src/image-quality';
import { enhanceImage } from '../src/upscale';

let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? `  — ${detail}` : ''}`);
};
const fixture = (name: string) => fs.readFileSync(path.join(__dirname, 'fixtures', name));
const line = (q: ImageQuality | null) => (q ? `${q.width}×${q.height} mollesse ${q.softness} blocs ${q.blockiness} photo ${q.photo} [${q.issues.join(', ')}]` : 'illisible');

/** Un aplat net : logo ou schéma. */
const flatGraphic = () =>
  sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="100%" height="100%" fill="#ffffff"/><circle cx="400" cy="400" r="220" fill="#1d4ed8"/><rect x="700" y="200" width="300" height="400" rx="40" fill="#f59e0b"/><text x="80" y="760" font-size="64" font-family="sans-serif" fill="#111">Boutique Akwa</text></svg>`))
    .png()
    .toBuffer();

async function main(): Promise<void> {
  const photos = { portrait: fixture('kodak-portrait.jpg'), landscape: fixture('kodak-landscape.jpg'), parrots: fixture('kodak-parrots.jpg') };

  console.log('Détection des défauts :');
  for (const [name, original] of Object.entries(photos)) {
    const { width = 768 } = await sharp(original).metadata();
    const q = await measureImageQuality(original);
    check(`${name} : photo sans défaut`, !!q && q.photo && q.issues.length === 0, line(q));
    const upscaled = await sharp(await sharp(original).resize({ width: Math.round(width / 2) }).toBuffer()).resize({ width, kernel: 'cubic' }).jpeg({ quality: 90 }).toBuffer();
    const qu = await measureImageQuality(upscaled);
    check(`${name} : déjà agrandie ×2 → floue`, !!qu?.issues.includes('blurry'), `mollesse ${qu?.softness} > ${THRESHOLDS.soft}`);
    const blurred = await sharp(original).blur(1.5).jpeg({ quality: 90 }).toBuffer();
    const qb = await measureImageQuality(blurred);
    check(`${name} : floutée → floue`, !!qb?.issues.includes('blurry'), `mollesse ${qb?.softness}`);
    const heavy = await sharp(original).jpeg({ quality: 10 }).toBuffer();
    const qh = await measureImageQuality(heavy);
    check(`${name} : JPEG qualité 10 → blocs`, !!qh?.issues.includes('blocky'), `blocs ${qh?.blockiness} > ${THRESHOLDS.blocky}`);
    const half = await sharp(original).resize({ width: Math.round(width / 2) }).jpeg({ quality: 85 }).toBuffer();
    const qs = await measureImageQuality(half);
    check(`${name} : réduite de moitié, nette → aucun défaut propre`, !!qs && qs.issues.length === 0, line(qs));
  }
  const qf = await measureImageQuality(await flatGraphic());
  check('aplat net (logo + texte) : pas une photo, aucun défaut', !!qf && !qf.photo && qf.issues.length === 0, line(qf));

  console.log('\nÀ sa place dans le site :');
  const small = (await measureImageQuality(await sharp(photos.landscape).resize({ width: 480 }).toBuffer()))!;
  check('480 px en plein écran (1 440 px CSS) → trop petite', needsEnhancement(small, { displayWidth: 1440, displayHeight: 600 }).includes('small'));
  check('480 px dans une carte de 220 px → rien à faire', needsEnhancement(small, { displayWidth: 220, displayHeight: 160 }).length === 0);
  check('768 px dans un bloc de 380 px → rien à faire', needsEnhancement((await measureImageQuality(photos.landscape))!, { displayWidth: 380, displayHeight: 250 }).length === 0);

  console.log('\nVisages :');
  const scores = { portrait: await faceScore(photos.portrait), landscape: await faceScore(photos.landscape), parrots: await faceScore(photos.parrots) };
  if (scores.portrait === null) console.log('  (détecteur indisponible : hors ligne ?) — vérification sautée');
  else {
    check('le portrait a un visage', scores.portrait >= 0.9, `score ${scores.portrait}`);
    check('le paysage n’en a pas', (scores.landscape ?? 1) < 0.9, `score ${scores.landscape}`);
    check('les perroquets n’en ont pas', (scores.parrots ?? 1) < 0.9, `score ${scores.parrots}`);
  }

  console.log('\nAmélioration (sharp) :');
  check('une image nette à sa taille n’est pas retouchée', (await enhanceImage(photos.landscape, { targetWidth: 768, allowModel: false })) === null);
  const smallFile = await sharp(photos.parrots).resize({ width: 384 }).jpeg({ quality: 85 }).toBuffer();
  const better = await enhanceImage(smallFile, { targetWidth: 768, allowModel: false });
  check('384 → 768 px : plus nette qu’un simple agrandissement', !!better && better.method === 'sharp' && better.sharpness.enhanced > better.sharpness.plain, better ? `netteté ${better.sharpness.plain} → ${better.sharpness.enhanced}, ${better.width}×${better.height}, ${better.ms} ms` : 'aucun résultat');
  const heavy = await sharp(photos.parrots).jpeg({ quality: 10 }).toBuffer();
  const deblock = await enhanceImage(heavy, { targetWidth: 768, allowModel: false });
  check('JPEG qualité 10 : retouché', !!deblock, deblock ? `${deblock.method}, ${deblock.ms} ms` : 'aucun résultat');
  if (deblock) {
    const after = await gridBlockiness(await sharp(deblock.buffer).resize({ width: 768 }).png().toBuffer());
    check('… et ses blocs ont reculé', after < deblock.before.blockiness - 0.25, `blocs ${deblock.before.blockiness} → ${Math.round(after * 1000) / 1000}`);
  }

  if (process.argv.includes('--model')) {
    console.log('\nAmélioration (modèle local) :');
    const tiny = await sharp(photos.parrots).resize({ width: 320 }).jpeg({ quality: 85 }).toBuffer();
    const t0 = Date.now();
    const model = await enhanceImage(tiny, { targetWidth: 1280 });
    check('320 → 1 280 px par le modèle local', !!model && model.method === 'model', model ? `${model.method}, netteté ${model.sharpness.plain} → ${model.sharpness.enhanced}, ${Date.now() - t0} ms (premier appel : chargement compris)` : 'modèle indisponible ou résultat rejeté');
    const t1 = Date.now();
    const again = await enhanceImage(await sharp(photos.landscape).resize({ width: 480 }).jpeg({ quality: 85 }).toBuffer(), { targetWidth: 1600 });
    check('480 → 1 600 px, modèle déjà chargé', !!again && again.method === 'model', again ? `${again.method}, ${Date.now() - t1} ms` : 'aucun résultat');
    const heavyModel = await enhanceImage(heavy, { targetWidth: 768 });
    check('JPEG qualité 10 par le modèle : blocs effacés', !!heavyModel, heavyModel ? `${heavyModel.method}, ${heavyModel.ms} ms` : 'aucun résultat');
    if (model && process.env.IDEM_IMAGE_QUALITY_OUT) {
      fs.writeFileSync(path.join(process.env.IDEM_IMAGE_QUALITY_OUT, 'model.webp'), model.buffer);
      fs.writeFileSync(path.join(process.env.IDEM_IMAGE_QUALITY_OUT, 'plain.png'), await sharp(tiny).resize({ width: 1280, kernel: 'lanczos3' }).png().toBuffer());
    }
    const face = await enhanceImage(await sharp(photos.portrait).resize({ width: 256 }).toBuffer(), { targetWidth: 1024 });
    check('un visage ne passe jamais par le modèle', !face || face.method === 'sharp', face ? face.method : 'non retouché');
  }

  console.log(failures ? `\n${failures} échec(s)` : '\nTout est bon.');
  process.exit(failures ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
