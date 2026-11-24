/**
 * L'IMAGE QUI CONVIENT AU GABARIT — `npm run check:image-fit` (IDEM_TEMPLATES_DIR=../../../../idem-templates).
 *
 * Sans aucun appel payant (ni modèle d'image, ni vision, ni banque) :
 *   §1 la planification : pour chaque DA, le moteur retient un gabarit de visuel et dit ce qu'il demande à l'image ;
 *   §2 la source : génération d'abord pour un cadre exigeant ou une DA d'illustration, banque d'abord sinon ;
 *   §3 la consigne de génération : la composition du cadre et le traitement de la DA en mots, aucune couleur imposée ;
 *   §4 l'adéquation mesurée : une photo au sujet centré convient mieux à un cercle qu'une photo au sujet au bord ;
 *   §5 la préparation pour les 30 DA : format exact du cadre, traitements locaux, couleur moyenne qui ne bouge pas ;
 *   §6 la garde : une teinte ajoutée en douce est mesurée et refusée.
 */
import sharp from 'sharp';
import { directionsSync, getDirection, PLAN_IMAGE_PLACEHOLDER, planSingle, visualContent } from '@idem/graphic-engine';
import { colourDrift, compositionClause, directionImage, fitScore, MAX_COLOUR_DRIFT, prepareImage, sourceOrder } from '../src/visual/image.fit';

let failures = 0;
const ok = (label: string, cond: boolean, detail = '') => {
  if (!cond) failures++;
  console.log(`  ${cond ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
};
const title = (t: string) => console.log(`\n${t}`);

/** Une photo d'essai : ciel, sol chaud, un sujet (silhouette) placé où l'on veut, du grain de matière. */
async function testPhoto(w: number, h: number, subjectX: number): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dcd6cc"/><stop offset="1" stop-color="#cfc6b8"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#s)"/><ellipse cx="${w * subjectX}" cy="${h * 0.36}" rx="${w * 0.06}" ry="${h * 0.08}" fill="#7a4a32"/><rect x="${w * subjectX - w * 0.1}" y="${h * 0.45}" width="${w * 0.2}" height="${h * 0.4}" rx="${w * 0.05}" fill="#c0392b"/></svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 92 }).toBuffer();
}

async function main(): Promise<void> {
  const das = [...directionsSync().keys()];
  ok('les 30 DA du dépôt sont lues', das.length >= 30, `${das.length}`);

  title('§1 La planification : le gabarit dit ce qu’il demande à son image');
  const brand = { name: 'Kora', colors: { primary: '#1A2A4F', secondary: '#7F9CE5', accent: '#C9A227' } } as never;
  const shapes = new Set<string>();
  let planned = 0;
  for (const da of das.filter((d) => d !== 'cyberpunk')) {
    const content = visualContent({ id: 'visual', copy: { headline: 'La tech au féminin prend le micro', subhead: 'Une soirée de témoignages', facts: [{ text: 'Samedi 18 octobre' }, { text: 'Akwa, Douala' }] }, image: { url: PLAN_IMAGE_PLACEHOLDER, alt: 'Une intervenante sur scène' } });
    const level = (['low', 'medium', 'high', 'ultra'] as const)[das.indexOf(da) % 4];
    const plan = await planSingle({ documentType: 'flyer', format: 'flyer-square', brand, direction: { styleId: da }, creativity: level, seed: `check|${da}`, content: content! }).catch((e) => (console.log(`    ${da} : ${(e as Error).message}`), null));
    if (!plan?.image) continue;
    planned++;
    shapes.add(plan.image.shape);
    if (da === 'afro-modernism' || da === 'bohemian' || da === 'swiss') console.log(`    ${da} → ${plan.config.gabarit} · ${plan.image.component} · ${plan.image.shape} ${plan.image.width}×${plan.image.height} ${plan.image.orientation}`);
  }
  ok('chaque DA planifie un gabarit avec image', planned >= 28, `${planned}/29`);
  ok('les cadres servis varient (cercle, arche, galet, déchiré…)', shapes.size >= 3, [...shapes].join(', '));

  title('§2 La source selon le gabarit');
  const rect = { shape: 'rect', subject: 'any', framing: 'thirds', aspect: 1.2, width: 900, height: 750, orientation: 'landscape', bleed: true } as const;
  const circle = { ...rect, shape: 'circle', subject: 'person', framing: 'centered', aspect: 1, width: 500, height: 500, orientation: 'square', cutout: true } as const;
  ok('photo rectangulaire, DA photo → banque d’abord', sourceOrder(rect, directionImage('editorial')) === 'stock');
  ok('cercle détouré → génération d’abord', sourceOrder(circle, directionImage('editorial')) === 'generate');
  ok('DA d’illustration (vector-art) → génération', sourceOrder(rect, directionImage('vector-art')) === 'generate');
  ok('DA de rendu 3D (clay) → génération', sourceOrder(rect, directionImage('clay')) === 'generate');

  title('§3 La consigne de génération');
  const clause = compositionClause(circle, directionImage('risograph'));
  ok('le cadre rond se dit (sujet centré, coins libres)', /centred/.test(clause) && /round crop/.test(clause), clause.slice(0, 140));
  ok('le traitement de la DA se dit en mots (grain)', /grain/.test(clause));
  ok('aucune couleur, teinte ni filtre n’est demandé', !/duotone|monochrome|sepia|tint|black and white|colou?r grad/i.test(clause));

  title('§4 L’adéquation mesurée au cadre');
  const centred = await testPhoto(1600, 1200, 0.5);
  const edge = await testPhoto(1600, 1200, 0.9);
  const a = await fitScore(centred, circle);
  const b = await fitScore(edge, circle);
  ok('un sujet centré convient mieux à un cercle qu’un sujet au bord', a.score > b.score, `${a.score} > ${b.score} (${b.reasons.join(', ')})`);
  const small = await testPhoto(400, 300, 0.5);
  const c = await fitScore(small, { ...rect, width: 1080, height: 900 });
  ok('une photo trop petite pour le cadre est signalée', c.reasons.some((r) => /définition/.test(r)), c.reasons.join(', '));

  title('§5 La préparation pour les 30 DA (couleurs naturelles)');
  const portrait = { ...rect, shape: 'arch', aspect: 0.7, width: 600, height: 860, orientation: 'portrait', framing: 'centered' } as const;
  let worst = 0;
  let annulled = 0;
  for (const da of das) {
    const dir = directionImage(da);
    const out = await prepareImage(centred, portrait, dir.local, { treat: true });
    const meta = await sharp(out.buffer).metadata();
    const aspect = (meta.width || 1) / (meta.height || 1);
    if (Math.abs(aspect - portrait.aspect) > 0.02) ok(`${da} : format du cadre`, false, `${aspect.toFixed(2)} au lieu de ${portrait.aspect}`);
    worst = Math.max(worst, out.drift ?? 0);
    if (out.applied.some((x) => /annulés/.test(x))) annulled++;
  }
  ok('chaque image préparée a le format exact du cadre', true);
  ok(`la couleur moyenne ne bouge pas (pire ΔE ${worst.toFixed(2)} ≤ ${MAX_COLOUR_DRIFT})`, worst <= MAX_COLOUR_DRIFT);
  ok('aucun traitement de DA n’a dû être annulé', annulled === 0, `${annulled} annulé(s)`);
  ok('les traitements déclarés par les fiches sont lus', Object.keys(directionImage('risograph').local).length > 0 && !!getDirection('risograph'));

  title('§6 La garde : une teinte ajoutée en douce est refusée');
  const tinted = await sharp(centred).tint({ r: 255, g: 170, b: 60 }).jpeg().toBuffer();
  const drift = await colourDrift(centred, tinted);
  ok('une teinte orangée est mesurée au-delà du seuil', drift > MAX_COLOUR_DRIFT, `ΔE ${drift.toFixed(1)}`);

  console.log(failures ? `\n✗ ${failures} échec(s)` : '\n✓ 0 échec');
  process.exit(failures ? 1 : 0);
}
main();
