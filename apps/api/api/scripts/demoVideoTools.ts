/**
 * `npm run demo:video-tools` — des vidéos de démonstration de TOUS les outils du moteur vidéo.
 *
 * Chaque scène montre UN outil en situation, avec une étiquette (en haut à droite) qui le nomme et dit
 * à quoi il sert : c'est ce que le graphe de capacités propose au modèle avant qu'il invente quoi que ce
 * soit. Les films sont rendus par le vrai moteur (Puppeteer + ffmpeg), pas simulés.
 *
 *   01 typographie            24 techniques d'entrée du texte, compteur à rouleaux, 5 annotations, mots qui changent
 *   02 fonds                  les 24 fonds du graphe (particules, shaders, réseau, dégradé, trame, croquis…)
 *   03 matière & verre        particules (6 modes), shaders plein cadre, verre liquide, dégradés, réseau, morphose
 *   04 icônes & données       icônes SVG animées (4 bibliothèques), logos de marques, graphiques, dessin à la main
 *   05 photos                 9 effets PixiJS, 9 mises en scène de plans, galerie
 *   06 3D, Lottie & logo      scènes 3D et leurs effets, 6 Lottie intégrées, les 8 animations de logo
 *   07 mises en page          les 18 archétypes de composition
 *   08 transitions            les transitions du catalogue
 *   09 caméra & grands moments  6 caméras, 9 familles d'entrée, 5 grands moments
 *
 * Options :  --only=01,03   (sous-ensemble)   --quality=standard|hd|premium   --format=landscape|story|square
 * Sortie : tmp/tools-demo/*.mp4, index.html (lecteur + chapitres), manifest.json.
 *
 * Les photos sont des images de test dessinées en SVG (aucun droit à vérifier) ; les chiffres des
 * graphiques sont des données d'exemple écrites ici, jamais déduites d'un brief.
 */
import fs from 'fs';
import path from 'path';
import { VideoKit, VideoSceneInstance, VideoStoryboard } from '../models/motionVideo.model';
import { buildStoryboard } from '../../../ivision/core/src/video/video.storyboard';
import { composeVideoHtml, inlineAssets } from '../../../ivision/core/src/video/video.composer';
import { buildVideoTheme } from '../../../ivision/core/src/video/video.theme';
import { cleanupRender, closeRenderBrowser, renderVideo } from '../../../ivision/core/src/video/video.renderer';
import { CAPABILITIES } from '../../../ivision/core/src/video/video.capabilities';
import { DirectionId, TRANSITION_CATALOGUE, TRANSITION_IDS } from '../../../ivision/core/src/video/video.direction';
import { BUILTIN_LOTTIES } from '../../../ivision/core/src/video/video.lottie';
import { IconSetId } from '../../../ivision/core/src/video/video.icons';
import { brandById } from './fixtures/motion-video/brands';
import { makePhotos } from './fixtures/motion-video/media';

process.env.VIDEO_ALLOW_FILE_URLS = '1';

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const ONLY = (arg('only') || '').split(',').filter(Boolean);
const QUALITY = (arg('quality') || 'standard') as 'standard' | 'hd' | 'premium';
const FORMAT = (arg('format') || 'landscape') as 'landscape' | 'story' | 'square';
const OUT = path.resolve(process.cwd(), 'tmp/tools-demo');
fs.mkdirSync(OUT, { recursive: true });

// ─── Description des scènes ─────────────────────────────────────────────────

interface DemoScene {
  sceneId: string;
  slots: Record<string, string>;
  /** Durée en secondes (2,8 par défaut). */
  dur?: number;
  /** Ce que montre la scène : le nom de l'outil, puis à quoi il sert. */
  label: string;
  note?: string;
  /** Une photo de test (index) ou plusieurs pour la scène. */
  photo?: number;
  photos?: number[];
  /** Scène écrite en code, avec les briques de @idem/kit. */
  tsx?: string;
  /** Fond, annotation, jeu d'icônes, effets 3D, choix du kit propres à la scène. */
  backdrop?: string;
  annotate?: string;
  icons?: { concepts: string[]; set: IconSetId };
  postfx?: string[];
  kit?: NonNullable<VideoSceneInstance['demo']>['kit'];
  treatment?: string;
  lottie?: string;
  /** Retouche libre de la scène après sa construction. */
  apply?: (sc: VideoSceneInstance, index: number) => void;
}

interface Film {
  id: string;
  title: string;
  about: string;
  brand: string;
  direction: DirectionId;
  seed?: number;
  scenes: DemoScene[];
}

const note = (id: string) => CAPABILITIES.find((n) => n.id === id)?.summary;

// ─── Scènes écrites en code ─────────────────────────────────────────────────

const head = (names: string) => `import { useScene, useEngine, useLocalTime, Kinetic${names ? `, ${names}` : ''} } from '@idem/kit';\n`;
const TITLE_BOTTOM = `<div className="safe" style={{ justifyContent: 'flex-end' }}><div style={{ width: horizontal ? '60%' : '86%' }}><Kinetic text={s.slots.title || ''} technique="maskUp" at={0.1} role="headline" fit={[horizontal ? 9 : 9, 4, 2]} /></div></div>`;
const TITLE_CENTER = `<div className="safe" style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}><div style={{ width: horizontal ? '56%' : '84%' }}><Kinetic text={s.slots.title || ''} technique="maskUp" at={0.15} role="headline" fit={[horizontal ? 10 : 12, 5, 2]} /></div></div>`;
const TITLE_PHOTO = `<div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '42%', background: 'linear-gradient(transparent, rgba(0,0,0,0.62))' }} /><div className="safe" style={{ justifyContent: 'flex-end' }}><div style={{ width: horizontal ? '60%' : '86%', color: '#ffffff' }}><Kinetic text={s.slots.title || ''} technique="maskUp" at={0.1} role="headline" fit={[horizontal ? 7 : 9, 4, 2]} style={{ color: '#ffffff' }} /></div></div>`;

/** Une scène codée : `body` est posé AVANT le titre (le titre reste lisible), `title` choisit où il va. */
const code = (names: string, body: string, title = TITLE_BOTTOM) =>
  `${head(names)}export default function Scene() {\n  const s = useScene();\n  const { u, horizontal } = useEngine();\n  const lt = useLocalTime();\n  return (<>${body}${title}</>);\n}\n`;

const box = (l: string, t: string, r: string, b: string, inner: string) => `<div style={{ position: 'absolute', left: '${l}', top: '${t}', right: '${r}', bottom: '${b}' }}>${inner}</div>`;

// ─── Film 01 : typographie ──────────────────────────────────────────────────

const TECHNIQUES: [string, string][] = [
  ['maskUp', 'les mots montent derrière un masque : la référence sobre, éditoriale'],
  ['charCascade', 'les lettres tombent en cascade, avec un léger rebond'],
  ['trackIn', 'l’espacement des lettres se resserre en fondu : calme, premium'],
  ['scaleBlur', 'le bloc arrive en gros plan flou et se pose'],
  ['typewriter', 'machine à écrire avec curseur : la question qui s’écrit'],
  ['lineWipe', 'un balayage horizontal découvre chaque mot'],
  ['blurWords', 'les mots émergent du flou, un à un'],
  ['flipChars', 'chaque lettre bascule vers le spectateur'],
  ['scramble', 'les lettres se brouillent puis se résolvent : tech, données'],
  ['boxReveal', 'un bloc de couleur passe et révèle le texte : affirmé, brutaliste'],
  ['stackPush', 'les mots s’empilent en poussant la ligne précédente'],
  ['slideAlternate', 'les mots entrent alternativement de gauche et de droite'],
  ['springUp', 'ressort physique : la lettre dépasse sa place puis se pose'],
  ['wave', 'une vague traverse le mot et s’amortit'],
  ['stretch', 'chaque lettre s’étire depuis la ligne de base'],
  ['rotateX', 'les mots basculent depuis leur ligne de base (3D)'],
  ['zoomWords', 'les mots arrivent en zoom depuis l’avant'],
  ['skewIn', 'les mots arrivent penchés puis se redressent'],
  ['scatter', 'les mots arrivent dans un ordre dispersé (graine fixe)'],
  ['outlineFill', 'le contour se trace, puis le remplissage monte'],
  ['shine', 'un reflet de la couleur de la marque traverse les lettres en boucle'],
  ['glitch', 'canaux décalés par rafales : urgence, tech (le contraste reste garanti)'],
  ['shuffle', 'chaque lettre est une fente de machine à sous'],
  ['gradientFlow', 'un dégradé de l’encre vers la couleur de la marque coule dans le texte'],
];

const typography: Film = {
  id: '01-typographie',
  title: 'Typographie en mouvement',
  about: '24 techniques d’entrée du texte (Kinetic), le compteur à rouleaux, les 5 annotations du mot clé, les mots qui changent.',
  brand: 'wax',
  direction: 'editorial',
  scenes: [
    ...TECHNIQUES.map(([tech, what]): DemoScene => ({
      sceneId: 'statement',
      slots: { title: 'Le goût du vrai, tissé à la main', sub: `technique « ${tech} »` },
      dur: 2.8,
      label: `Kinetic · technique="${tech}"`,
      note: what,
      apply: (sc) => {
        sc.motion = { ...sc.motion!, headline: tech };
      },
    })),
    { sceneId: 'stat', slots: { value: '12 000', label: 'commandes livrées cette année' }, dur: 3.2, label: 'Odometer', note: 'compteur à rouleaux : les chiffres viennent du texte, jamais inventés' },
    ...(['marker', 'underline', 'circle', 'sketch-circle', 'brush'] as const).map((a): DemoScene => ({
      sceneId: 'statement',
      slots: { title: 'Le wax qui vous ressemble vraiment', sub: '' },
      dur: 3.2,
      label: `Em · annotate="${a}"`,
      note: note(`annotate:${a}`),
      annotate: a,
    })),
    { sceneId: 'kinetic', slots: { l1: 'Plus', l2: 'vite', l3: 'plus', l4: 'fort' }, dur: 3.4, label: 'Scène « kinetic »', note: 'quatre lignes brèves, l’une après l’autre, calées sur le tempo' },
    { sceneId: 'wordswap', slots: { lead: 'Livré', w1: 'demain', w2: 'ce soir', w3: 'maintenant' }, dur: 3.4, label: 'Scène « wordswap »', note: 'une phrase dont le dernier mot change' },
  ],
};

// ─── Film 02 : fonds ────────────────────────────────────────────────────────

const BACKGROUNDS = CAPABILITIES.filter((n) => n.kind === 'background' && n.id !== 'bg:none').map((n) => n.id.slice(3));

const backgrounds: Film = {
  id: '02-fonds',
  title: 'Les 24 fonds du graphe',
  about: 'Chaque fond que le graphe peut poser derrière une scène de texte : trames, formes, particules, shaders, réseau, dégradé, croquis.',
  brand: 'bissap',
  direction: 'kinetic',
  scenes: BACKGROUNDS.map(
    (bg): DemoScene => ({
      sceneId: 'statement',
      slots: { title: 'Le goût du vrai', sub: `fond « ${bg} »` },
      dur: 3,
      label: `Backdrop · bg:${bg}`,
      note: note(`bg:${bg}`),
      backdrop: bg,
    })
  ),
};

// ─── Film 03 : matière, particules, verre ───────────────────────────────────

const PARTICLE_MODES: [string, string, string][] = [
  ['drift', '<Particles mode="drift" count={64} size={[0.8, 2.4]} life={7} />', 'poussière lumineuse qui flotte : l’air d’une scène, le luxe, le calme'],
  ['rise', '<Particles mode="rise" count={52} area={[0, 62, 100, 106]} shapes={["dot", "spark"]} reach={58} life={4.5} size={[0.8, 2.2]} />', 'braises qui montent : énergie, chaleur, restauration'],
  ['fall', '<Particles mode="fall" count={54} area={[0, -10, 100, 14]} shapes={["square", "dot", "ring"]} reach={86} life={5} size={[1.4, 3.2]} />', 'confettis qui tombent : fête, ouverture, offre'],
  ['burst', '<Particles mode="burst" origin={[50, 46]} at={0.5} dur={1.7} count={84} reach={46} />', 'éclat depuis un point : le moment fort, posé SOUS le texte'],
  ['converge', '<Particles mode="converge" origin={[50, 46]} at={0.2} dur={1.5} count={80} reach={46} />', 'les particules se rassemblent là où le titre se pose'],
  ['dissolve', '<Particles mode="dissolve" area={[22, 40, 78, 56]} at={1.4} dur={1.5} count={110} reach={30} size={[0.8, 2.6]} />', 'le titre se désintègre de gauche à droite en poussière'],
];

const matter: Film = {
  id: '03-matiere-et-verre',
  title: 'Particules, shaders, verre, dégradés, réseau, morphose',
  about: 'Les briques de « matière » du kit : particules à graine (6 modes), shaders OGL plein cadre, verre liquide réfractif, dégradé animé, réseau de points, formes qui se transforment.',
  brand: 'bissap',
  direction: 'kinetic',
  scenes: [
    ...PARTICLE_MODES.map(([mode, jsx, what]): DemoScene => {
      const dissolve = mode === 'dissolve';
      return {
        sceneId: 'statement',
        slots: { title: dissolve ? 'Ce qui s’efface' : 'Le goût du vrai', sub: '' },
        dur: dissolve ? 4 : 3.4,
        label: `Particles · mode="${mode}"`,
        note: what,
        tsx: dissolve
          ? code('Particles', jsx, `<div className="safe" style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center', opacity: 1 - Math.min(1, Math.max(0, (lt - 1.4) / 1.0)) }}><div style={{ width: '56%' }}><Kinetic text={s.slots.title || ''} technique="maskUp" at={0.15} role="headline" fit={[10, 5, 2]} /></div></div>`)
          : code('Particles', jsx, TITLE_CENTER),
      };
    }),
    ...(['fluid', 'aurora', 'silk', 'blobs'] as const).map((e): DemoScene => ({
      sceneId: 'statement',
      slots: { title: 'La matière en mouvement', sub: '' },
      dur: 3.2,
      label: `Shader · effect="${e}" (plein cadre) + LiquidGlass`,
      note: `${note(`bg:${e}`) || ''} ici à pleine force, le titre dans un verre réfractif.`,
      tsx: code('Shader, LiquidGlass', `<Shader effect="${e}" strength={1} /><LiquidGlass x={50} y={52} w={horizontal ? 64 : 84} h={horizontal ? 26 : 22} radius={9} p={Math.min(1, lt / 0.6)}><div style={{ width: '100%', padding: '0 6%' }}><Kinetic text={s.slots.title || ''} technique="blurWords" at={0.3} role="headline" fit={[horizontal ? 8 : 9, 4.5, 2]} /></div></LiquidGlass>`, ''),
    })),
    {
      sceneId: 'product',
      slots: { name: 'Une lentille sur la photo', tagline: '' },
      photo: 5,
      dur: 4,
      label: 'LiquidGlass · sur une photo',
      note: 'un verre qui déforme ce qui passe derrière lui : la photo se plie au bord de la lentille',
      tsx: code('LiquidGlass', `<img src={s.image} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} /><LiquidGlass x={30 + 40 * (0.5 + 0.5 * Math.sin(lt * 0.9))} y={46} w={horizontal ? 34 : 60} h={horizontal ? 34 : 40} radius={20} refraction={1.4} tint={0.08} />`, TITLE_PHOTO.replace('s.slots.title', 's.slots.name')),
    },
    { sceneId: 'statement', slots: { title: 'Un dégradé qui glisse', sub: '' }, dur: 3.2, label: 'Gradient · kind="linear"', note: 'un dégradé qui passe d’un état de couleurs de la charte à l’autre, en CSS pur', tsx: code('Gradient', '<Gradient kind="linear" />', TITLE_CENTER) },
    { sceneId: 'statement', slots: { title: 'Une lumière qui respire', sub: '' }, dur: 3.2, label: 'Gradient · kind="radial"', note: 'le même, en dégradé radial : le point de lumière dérive', tsx: code('Gradient', '<Gradient kind="radial" />', TITLE_CENTER) },
    { sceneId: 'statement', slots: { title: 'Un réseau qui se tisse', sub: '' }, dur: 3.4, label: 'Network', note: 'points qui dérivent et se relient quand ils se rapprochent : technologie, communauté', tsx: code('Network, Gradient', '<Gradient opacity={0.6} angle={160} /><Network count={52} reach={22} />', TITLE_CENTER) },
    { sceneId: 'statement', slots: { title: 'La forme qui devient autre', sub: '' }, dur: 4, label: 'Morph · shapes=[…]', note: 'cercle, étoile, cœur, goutte, hexagone, éclair : une forme se transforme en la suivante (flubber)', tsx: code('Morph', `<div style={{ position: 'absolute', left: '50%', top: '40%', width: 34 * u, height: 34 * u, transform: 'translate(-50%, -50%)' }}><Morph shapes={['circle', 'star', 'heart', 'drop', 'hexagon', 'bolt']} hold={0.35} fade={0.55} fill="var(--hl)" style={{ width: '100%', height: '100%' }} /></div>`) },
    { sceneId: 'statement', slots: { title: 'Validé', sub: '' }, dur: 3, label: 'Morph · from="circle" to="check"', note: 'un rond qui devient une coche : la confirmation, la réussite', tsx: code('Morph', `<div style={{ position: 'absolute', left: '50%', top: '40%', width: 34 * u, height: 34 * u, transform: 'translate(-50%, -50%)' }}><Morph from="circle" to="check" at={0.5} dur={1.2} fill="var(--hl)" style={{ width: '100%', height: '100%' }} /></div>`) },
    { sceneId: 'statement', slots: { title: 'Au trait, sans remplissage', sub: '' }, dur: 3.6, label: 'Morph · stroke seul', note: 'la forme au trait seulement : carré, rond, triangle', tsx: code('Morph', `<div style={{ position: 'absolute', left: '50%', top: '40%', width: 34 * u, height: 34 * u, transform: 'translate(-50%, -50%)' }}><Morph shapes={['square', 'circle', 'triangle']} hold={0.5} fade={0.8} fill="" stroke="var(--hl)" weight={2.4} style={{ width: '100%', height: '100%' }} /></div>`) },
  ],
};

// ─── Film 04 : icônes, marques, données, dessin ─────────────────────────────

const ICON_ROW = (mode: string, extra = '') =>
  `<div style={{ position: 'absolute', left: 0, right: 0, top: '22%', display: 'flex', justifyContent: 'center', gap: 9 * u }}>{[0, 1, 2].map((i) => (<IconMotion key={i} svg={s.icons?.[i]} mode="${mode}" at={0.2 + i * 0.35} dur={1} style={{ width: 17 * u, height: 17 * u, color: 'var(--hl-text)' }} ${extra} />))}</div>`;

const ICON_DEMOS: [IconSetId, string, string, string][] = [
  ['lucide', 'draw', 'Lucide · draw', 'icônes au trait : les tracés se dessinent l’un après l’autre'],
  ['tabler', 'draw', 'Tabler · draw', 'le trait géométrique de Tabler, dessiné de la même façon'],
  ['phosphor-fill', 'draw', 'Phosphor fill · draw', 'une icône pleine : le contour se dessine, puis le remplissage monte'],
  ['phosphor-duotone', 'stagger', 'Phosphor duotone · stagger', 'les formes d’une icône apparaissent une à une, en grossissant'],
  ['heroicons-solid', 'pop', 'Heroicons solid · pop', 'chaque pictogramme jaillit en dépassant sa taille'],
  ['lucide', 'pulse', 'Lucide · pulse', 'un battement continu : l’icône qui attire l’œil'],
  ['phosphor-bold', 'wiggle', 'Phosphor bold · wiggle', 'un balancement qui s’amortit : notification, attention'],
];

const CHART_DEMOS: [string, string, string, Record<string, string>, string][] = [
  ['Chart.js · type="bar"', 'barres qui montent : l’évolution, la comparaison', `<ChartJs type="bar" values data={{ labels: ['T1', 'T2', 'T3', 'T4', 'T5'], datasets: [{ data: numbersIn(s.slots.sub) }] }} />`, { title: 'Nos ventes progressent', sub: '12, 18, 27, 41 et 63' }, 'ChartJs, numbersIn'],
  ['Chart.js · type="line"', 'courbe qui se révèle de gauche à droite', `<ChartJs type="line" grow="reveal" data={{ labels: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai'], datasets: [{ data: numbersIn(s.slots.sub) }] }} />`, { title: 'Une courbe qui monte', sub: '10, 14, 22, 35 et 52' }, 'ChartJs, numbersIn'],
  ['Chart.js · type="doughnut"', 'un anneau divisé : la répartition', `<ChartJs type="doughnut" data={{ labels: ['Web', 'Boutique', 'Mobile'], datasets: [{ data: numbersIn(s.slots.sub) }] }} />`, { title: 'D’où viennent les ventes', sub: '45, 35 et 20 %' }, 'ChartJs, numbersIn'],
  ['Chart.js · type="radar"', 'un profil sur plusieurs axes', `<ChartJs type="radar" data={{ labels: ['Prix', 'Délai', 'Qualité', 'Service', 'Choix'], datasets: [{ data: numbersIn(s.slots.sub) }] }} />`, { title: 'Notre profil', sub: '8, 9, 7, 9 et 6' }, 'ChartJs, numbersIn'],
  ['Chart.js · type="treemap"', 'des rectangles proportionnels : la part de chacun', `<ChartJs type="treemap" data={{ datasets: [{ tree: numbersIn(s.slots.sub), labels: { display: false } }] }} />`, { title: 'Ventes par rayon', sub: '45, 25, 18 et 12 %' }, 'ChartJs, numbersIn'],
  ['Chart.js · type="sankey"', 'des flux entre sources et résultat', `<ChartJs type="sankey" data={{ datasets: [{ data: [{ from: 'Web', to: 'Ventes', flow: numbersIn(s.slots.sub)[0] }, { from: 'Boutique', to: 'Ventes', flow: numbersIn(s.slots.sub)[1] }] }] }} />`, { title: 'Les canaux de vente', sub: '60 et 40' }, 'ChartJs, numbersIn'],
];

const iconsAndData: Film = {
  id: '04-icones-donnees-dessin',
  title: 'Icônes SVG animées, logos de marques, graphiques, dessin à la main',
  about: 'Les icônes des bibliothèques sont lues comme des SVG : leurs formes s’animent. Logos de marques nommées, graphiques Chart.js et visx, cartes, croquis, pinceau, bruit, 3D plate.',
  brand: 'kofi',
  direction: 'precision',
  scenes: [
    ...ICON_DEMOS.map(([set, mode, label, what]): DemoScene => ({
      sceneId: 'statement',
      slots: { title: 'Livraison, paiement, support', sub: '' },
      dur: 3.4,
      label: `IconMotion · ${label}`,
      note: what,
      icons: { concepts: ['delivery', 'payment', 'support'], set },
      tsx: code('IconMotion', ICON_ROW(mode)),
    })),
    {
      sceneId: 'statement',
      slots: { title: 'Une icône devient une autre', sub: '' },
      dur: 4,
      label: 'IconMotion · mode="morph"',
      note: 'une icône se transforme en une autre (flubber) : livraison → paiement → support',
      icons: { concepts: ['delivery', 'payment', 'support'], set: 'lucide' },
      tsx: code('IconMotion', `<div style={{ position: 'absolute', left: 0, right: 0, top: '22%', display: 'flex', justifyContent: 'center', gap: 12 * u }}><IconMotion svg={s.icons?.[0]} to={s.icons?.[1]} mode="morph" at={0.4} dur={1.4} style={{ width: 22 * u, height: 22 * u, color: 'var(--hl-text)' }} /><IconMotion svg={s.icons?.[1]} to={s.icons?.[2]} mode="morph" at={1.4} dur={1.4} style={{ width: 22 * u, height: 22 * u, color: 'var(--hl-text)' }} /></div>`),
    },
    { sceneId: 'benefits', slots: { title: 'Pourquoi nous choisir', b1: 'Livraison en 24 h', b2: 'Paiement mobile', b3: 'Support 7j/7' }, dur: 4.2, label: 'Icon · kit.iconMotion="draw"', note: 'les pictogrammes d’une scène « avantages » se dessinent quand le graphe retient « icônes tracées »', icons: { concepts: ['delivery', 'payment', 'support'], set: 'lucide' }, kit: { iconMotion: 'draw' } },
    { sceneId: 'benefits', slots: { title: 'Pourquoi nous choisir', b1: 'Livraison en 24 h', b2: 'Paiement mobile', b3: 'Support 7j/7' }, dur: 4.2, label: 'Icon · kit.iconMotion="pop"', note: 'les mêmes, qui jaillissent (directions cinétiques)', icons: { concepts: ['delivery', 'payment', 'support'], set: 'phosphor-fill' }, kit: { iconMotion: 'pop' } },
    { sceneId: 'cta', slots: { title: 'Commandez votre pack', action: 'Écrivez-nous', contact: 'WhatsApp, Instagram ou Orange Money' }, dur: 4, label: 'Logos de marques · Simple Icons', note: 'une marque NOMMÉE dans le texte donne son logo en SVG, tracé sous l’appel à l’action' },
    ...CHART_DEMOS.map(([label, what, jsx, slots, names]): DemoScene => ({
      sceneId: 'statement',
      slots: slots,
      dur: 4,
      label,
      note: `${what} — chiffres lus dans le texte de la scène`,
      tsx: code(names, box('10%', '12%', '10%', '28%', jsx)),
    })),
    { sceneId: 'statement', slots: { title: 'Clients satisfaits', sub: '92 %' }, dur: 3.6, label: 'DataArc (visx)', note: 'une jauge à 270° qui se remplit jusqu’au pourcentage du texte', tsx: code('DataArc, percentIn', box('28%', '10%', '28%', '26%', '<DataArc value={percentIn(s.slots.sub) || 0} />')) },
    { sceneId: 'statement', slots: { title: 'Une courbe qui monte', sub: '10, 14, 22, 35 et 52' }, dur: 3.8, label: 'GrowArea (visx)', note: 'une aire qui se dessine vers le haut : la croissance', tsx: code('GrowArea, numbersIn', box('8%', '14%', '8%', '28%', '<GrowArea values={numbersIn(s.slots.sub)} />')) },
    { sceneId: 'statement', slots: { title: 'Livrés dans 3 pays', sub: 'Togo, Bénin et Côte d’Ivoire' }, dur: 4, label: 'AfricaMap (d3-geo)', note: 'la carte de l’Afrique : seuls les pays NOMMÉS dans le texte s’allument', tsx: code('AfricaMap', box('28%', '8%', '28%', '24%', '<AfricaMap highlightIn={s.slots.sub} />')) },
    { sceneId: 'statement', slots: { title: 'Dessiné à la main', sub: '' }, dur: 3.6, label: 'Sketch (rough.js)', note: 'formes tracées « au crayon » : cadre, cercle, flèche, arc — graine fixe, même trait à chaque image', tsx: code('Sketch, progress', `<Sketch draw={{ shape: 'ellipse', cx: 50, cy: 42, w: 56, h: 40 }} p={progress(lt, 0.3, 1)} weight={0.6} /><Sketch draw={{ shape: 'rectangle', x: 14, y: 16, w: 22, h: 18 }} p={progress(lt, 0.9, 0.9)} weight={0.45} color="var(--c-primary)" fill="var(--hl-soft)" /><Sketch draw={{ shape: 'line', x1: 64, y1: 72, x2: 86, y2: 56 }} p={progress(lt, 1.5, 0.7)} weight={0.5} color="var(--c-accent)" />`) },
    { sceneId: 'statement', slots: { title: 'Un coup de pinceau', sub: '' }, dur: 3.2, label: 'Brush (perfect-freehand)', note: 'un trait de pinceau à pression variable qui avance', tsx: code('Brush, progress', `<Brush points={[[8, 62], [28, 50], [52, 60], [76, 44], [94, 52]]} p={progress(lt, 0.2, 1.4)} size={7} />`) },
    { sceneId: 'statement', slots: { title: 'Un champ vivant', sub: '' }, dur: 3.2, label: 'FlowField (simplex-noise)', note: 'lignes qui ondulent dans un champ de bruit, aux couleurs de la marque', tsx: code('FlowField', '<FlowField seed={4} opacity={0.7} lines={46} />', TITLE_CENTER) },
    { sceneId: 'statement', slots: { title: 'Des objets plats en 3D', sub: '' }, dur: 3.6, label: 'Flat3D (Zdog)', note: 'pseudo-3D plate rendue en SVG, sans WebGL : boîte, anneau, sphère…', tsx: code('Flat3D', `<div style={{ position: 'absolute', left: '30%', right: '30%', top: '6%', bottom: '30%' }}><Flat3D rotate={{ x: -0.4, y: lt * 0.9 }} items={[{ kind: 'box', width: 30, height: 30, depth: 30, color: 'var(--hl)', shade: 'var(--c-primary)' }, { kind: 'ring', diameter: 56, stroke: 3, color: 'var(--c-accent)', rotate: { x: Math.PI / 2.4 } }, { kind: 'sphere', diameter: 14, color: 'var(--c-secondary)', x: 30, y: 24 }]} /></div>`) },
    { sceneId: 'statement', slots: { title: 'Une mosaïque', sub: '' }, dur: 3.2, label: 'VoronoiField (d3-delaunay)', note: 'cellules de Voronoï aux couleurs de la charte qui dérivent lentement', tsx: code('VoronoiField', '<VoronoiField cells={30} seed={3} opacity={0.55} />', TITLE_CENTER) },
  ],
};

// ─── Film 05 : photos ───────────────────────────────────────────────────────

const FX = (['rgbSplit', 'shockwave', 'bulge', 'twist', 'zoomBlur', 'pixelate', 'glitch', 'wavy', 'crt'] as const).map((e) => ({ e, what: note(`imagefx:${e}`) || '' }));
const TREATMENTS: [string, DirectionId][] = [['split', 'swiss'], ['window', 'editorial'], ['blinds', 'brutal'], ['magazine', 'editorial'], ['knockout', 'kinetic'], ['inline', 'collage'], ['duotone', 'drenched'], ['broadcast', 'precision'], ['cinema', 'cinematic']];

const photos: Film = {
  id: '05-photos',
  title: 'Effets sur les photos, mises en scène, galerie',
  about: '9 effets PixiJS sur la photo d’un produit, les 9 mises en scène d’un plan photo, la galerie, la photo cadrée.',
  brand: 'wax',
  direction: 'kinetic',
  scenes: [
    ...FX.map(({ e, what }, i): DemoScene => ({
      sceneId: 'product',
      slots: { name: 'Pagne Héritage', tagline: '' },
      photo: i % 6,
      dur: 3.2,
      label: `ImageFx · effect="${e}"`,
      note: what,
      tsx: code('ImageFx', `<ImageFx src={s.image} effect="${e}" />`, TITLE_PHOTO.replace('s.slots.title', 's.slots.name')),
    })),
    { sceneId: 'product', slots: { name: 'La photo dans son cadre', tagline: 'Tissé à la main à Lomé', price: '15 000 F' }, photo: 1, dur: 3.6, label: 'Photo cadrée + kit.imageFx="wavy"', note: 'la photo d’une scène produit (composition cadrée) reçoit l’effet que le graphe a retenu', kit: { imageFx: 'wavy' } },
    ...TREATMENTS.map(([kind, dir], i): DemoScene => ({
      sceneId: 'footage',
      slots: { kicker: 'Mise en scène', title: 'Pressé chaque matin à Dakar', sub: 'Bissap, gingembre, baobab' },
      photo: (i + 2) % 6,
      dur: 3.4,
      label: `Treatment · "${kind}"`,
      note: `${note(`treatment:${kind}`) || ''} (direction ${dir})`,
      treatment: kind,
    })),
    { sceneId: 'gallery', slots: { caption: 'Trois pagnes, trois histoires' }, photos: [0, 1, 2], dur: 4, label: 'Scène « gallery »', note: 'trois photos qui se succèdent avec une légende' },
  ],
};

// ─── Film 06 : 3D, Lottie, logo ─────────────────────────────────────────────

const LOGO_VARIANTS = ['classic', 'draw', 'trace', 'morph', 'assemble', 'wipe', 'split', 'extrude'];

const threeD: Film = {
  id: '06-3d-lottie-logo',
  title: '3D, animations Lottie, animations de logo',
  about: 'Scènes 3D (formes, cartes de photos) et leurs effets de post-traitement, les 6 Lottie intégrées, les 8 animations de logo.',
  brand: 'wax',
  direction: 'cinematic',
  scenes: [
    { sceneId: 'showcase3d', slots: { title: 'Le produit en 3D', sub: 'Formes de la marque' }, dur: 4.4, label: '3D · shapes + bloom + aberration chromatique', note: 'R3F + postprocessing : halo sur les reflets, franges de couleur sur les bords (premium)', postfx: ['smaa', 'bloom', 'chromatic'] },
    { sceneId: 'showcase3d', slots: { title: 'Net au centre', sub: 'Profondeur de champ' }, dur: 4.4, label: '3D · shapes + profondeur de champ', note: 'le sujet est net, le fond se défait en flou de bokeh', postfx: ['smaa', 'dof'] },
    { sceneId: 'showcase3d', slots: { title: 'Comme au cinéma', sub: 'Vignettage' }, dur: 4.4, label: '3D · shapes + vignettage', note: 'les bords s’assombrissent : l’œil va au centre', postfx: ['smaa', 'vignette', 'bloom'] },
    { sceneId: 'showcase3d', slots: { title: 'Vos photos en cartes', sub: 'Un arc de cartes 3D' }, photos: [0, 1, 2], dur: 4.4, label: '3D · cartes de photos', note: 'les photos du client posées en arc, la caméra tourne (R3F + drei RoundedBox)', postfx: ['smaa'] },
    ...BUILTIN_LOTTIES.map((name): DemoScene => ({
      sceneId: 'lottie',
      slots: { title: 'Une animation Lottie', sub: `« ${name} », aux couleurs de la marque` },
      dur: 3,
      label: `Lottie · builtin:${name}`,
      note: 'animation vectorielle intégrée, recolorée avec la charte (lottie-web, sans moteur d’expressions)',
      lottie: `builtin:${name}`,
    })),
    ...LOGO_VARIANTS.map((v): DemoScene => ({
      sceneId: 'logo',
      slots: { tagline: 'Fait main à Abidjan' },
      dur: 3.6,
      label: `Logo · "${v}"`,
      note: note(`logo:${v}`),
      kit: { logo: v },
      postfx: v === 'extrude' ? ['smaa', 'vignette'] : undefined,
    })),
  ],
};

// ─── Film 07 : mises en page ────────────────────────────────────────────────

const LAYOUT_DEMOS: [string, string, Record<string, string>][] = [
  ['wordStack', 'hook', { title: 'Le wax qui vous ressemble vraiment' }],
  ['marqueeBack', 'statement', { title: 'Tissé à la main à Lomé', sub: 'Depuis 2019' }],
  ['bigNumber', 'stat', { value: '87 %', label: 'de clientes fidèles' }],
  ['diagonalBand', 'cta', { title: 'Venez essayer en boutique', action: 'Réserver', contact: 'wax-lome.tg' }],
  ['circleStage', 'statement', { title: 'Le wax authentique, livré chez vous', sub: 'Tissé à la main à Lomé' }],
  ['chartRing', 'stat', { value: '87 %', label: 'de clientes reviennent dans l’année' }],
  ['dataArc', 'stat', { value: '72 %', label: 'des commandes livrées en 24 h' }],
  ['barCompare', 'offer', { price: '15 000 F', oldPrice: '20 000 F', badge: '-25 %', note: 'Jusqu’à dimanche seulement' }],
  ['splitBlock', 'benefits', { title: 'Pourquoi nous choisir', b1: 'Coton certifié', b2: 'Teintures fixes', b3: 'Retouches offertes' }],
  ['layeredCards', 'event', { title: 'Défilé de lancement', date: 'Samedi 14 juin', time: '19 h', place: 'Lomé, quartier Bè' }],
  ['gridCards', 'benefits', { title: 'Le wax premium', b1: 'Coton certifié', b2: 'Teintures fixes', b3: 'Retouches offertes' }],
  ['checklist', 'benefits', { title: 'Ce qui change tout', b1: 'Coton certifié', b2: 'Teintures fixes', b3: 'Retouches offertes' }],
  ['quoteBig', 'quote', { quote: 'Le plus beau wax que j’ai porté, et il tient au lavage.', author: 'Afi, Lomé' }],
  ['priceBurst', 'offer', { price: '15 000 F', oldPrice: '20 000 F', badge: '-25 %', note: 'Jusqu’à dimanche' }],
  ['ticker', 'cta', { title: 'La collection arrive samedi', action: 'Réserver', contact: 'wax-lome.tg' }],
  ['spotlightWord', 'statement', { title: 'Chaque motif raconte une histoire', sub: 'Collection Héritage' }],
  ['frameOverlap', 'hook', { title: 'Un tissu, mille histoires' }],
  ['glassPanel', 'statement', { title: 'Le verre qui plie la lumière', sub: 'Une réfraction en direct' }],
];

const layouts: Film = {
  id: '07-mises-en-page',
  title: 'Les 18 mises en page',
  about: 'Les archétypes de composition que l’agent directeur artistique attribue scène par scène.',
  brand: 'wax',
  direction: 'swiss',
  scenes: LAYOUT_DEMOS.map(
    ([layout, sceneId, slots]): DemoScene => ({
      sceneId,
      slots,
      dur: 3.6,
      label: `Layout · "${layout}"`,
      note: `${note(`layout:${layout}`) || ''} — scène « ${sceneId} »`,
      apply: (sc) => {
        sc.layout = layout;
      },
    })
  ),
};

// ─── Film 08 : transitions ──────────────────────────────────────────────────

const transitions: Film = {
  id: '08-transitions',
  title: 'Les transitions du catalogue',
  about: 'Chaque coupe que l’agent animateur peut choisir, entre deux scènes de surfaces différentes.',
  brand: 'bissap',
  direction: 'kinetic',
  scenes: [
    { sceneId: 'statement', slots: { title: 'Les transitions', sub: 'une par scène' }, dur: 2.4, label: 'Transition · (départ)', note: 'la première scène n’a pas de transition d’entrée' },
    ...TRANSITION_IDS.map(
      (t, i): DemoScene => ({
        sceneId: 'statement',
        slots: { title: t, sub: TRANSITION_CATALOGUE[t].summary },
        dur: 2.4,
        label: `Transition · "${t}"`,
        note: `${TRANSITION_CATALOGUE[t].feel} — ${TRANSITION_CATALOGUE[t].summary}`,
        apply: (sc) => {
          sc.motion = { ...sc.motion!, transition: t as any };
          sc.surface = i % 2 ? 'light' : 'primary';
        },
      })
    ),
  ],
};

// ─── Film 09 : caméra, entrées, grands moments ──────────────────────────────

const motion: Film = {
  id: '09-camera-entrees-moments',
  title: 'Caméras, familles d’entrée, grands moments',
  about: '6 mouvements de caméra, 9 familles d’entrée des éléments, 5 grands moments.',
  brand: 'kofi',
  direction: 'precision',
  scenes: [
    ...(['still', 'push', 'pull', 'drift', 'rise', 'tilt'] as const).map((c): DemoScene => ({
      sceneId: 'statement',
      slots: { title: 'Le code propre, livré', sub: `caméra « ${c} »` },
      dur: 3.4,
      label: `Camera · "${c}"`,
      note: note(`camera:${c}`),
      kit: { camera: c },
    })),
    ...(['rise', 'spring', 'flip', 'unfold', 'skew', 'iris', 'drop', 'pop', 'slideLeft'] as const).map((e): DemoScene => ({
      sceneId: 'benefits',
      slots: { title: `Entrée « ${e} »`, b1: 'Livraison en 24 h', b2: 'Paiement mobile', b3: 'Support 7j/7' },
      dur: 3.6,
      label: `Entrance · "${e}"`,
      note: note(`entrance:${e}`),
      kit: { entrance: e },
    })),
    ...(['punch', 'giant', 'hold', 'flip', 'burst'] as const).map((a): DemoScene => ({
      sceneId: 'statement',
      slots: { title: 'Le grand moment de la vidéo', sub: `effet « ${a} »` },
      dur: 3.4,
      label: `Accent · "${a}"`,
      note: note(`accent:${a}`),
      apply: (sc) => {
        sc.accent = a;
      },
    })),
  ],
};

const FILMS: Film[] = [typography, backgrounds, matter, iconsAndData, photos, threeD, layouts, transitions, motion];

// ─── Construction et rendu ──────────────────────────────────────────────────

const baseKit = (over: Partial<VideoKit> = {}): VideoKit => ({ background: 'none', backdropScenes: [], annotate: 'none', logo: 'classic', iconSet: 'lucide', icons: {}, postfx: [], addons: [], trace: [], treatments: {}, ...over });
const round = (n: number) => Math.round(n * 1000) / 1000;

async function buildFilm(film: Film, photoFiles: string[]): Promise<VideoStoryboard> {
  const durs = film.scenes.map((s) => s.dur ?? 2.8);
  const total = round(durs.reduce((a, b) => a + b, 0));
  const media: Record<number, { image?: string; images?: string[] }> = {};
  film.scenes.forEach((s, i) => {
    if (s.photos) media[i] = { images: s.photos.map((p) => photoFiles[p % photoFiles.length]) };
    else if (s.photo != null) media[i] = { image: photoFiles[s.photo % photoFiles.length] };
  });
  const sb = buildStoryboard({
    sceneIds: film.scenes.map((s) => s.sceneId),
    slots: film.scenes.map((s) => s.slots),
    durationSec: total,
    style: 'premium',
    seed: film.seed ?? 7,
    images: [],
    direction: film.direction,
    sceneMedia: media,
    objective: 'promotion',
  });
  sb.kit = baseKit();
  let t = 0;
  sb.scenes.forEach((sc, i) => {
    const d = film.scenes[i];
    sc.start = round(t);
    sc.duration = durs[i];
    t += durs[i];
    sc.demo = { label: d.label, note: d.note, backdrop: d.backdrop, annotate: d.annotate, iconSet: d.icons?.set, postfx: d.postfx, kit: d.kit };
    if (d.tsx) sc.code = { tsx: d.tsx, agent: 'demo' };
    if (d.lottie) sc.lottie = d.lottie;
    if (d.icons) sb.kit!.icons[sc.key] = d.icons.concepts;
    if (d.treatment) {
      sb.kit!.treatments![sc.key] = d.treatment;
      if (d.treatment === 'knockout' && !['light', 'tint', 'deep'].includes(sc.surface)) sc.surface = 'light';
    }
    d.apply?.(sc, i);
  });
  sb.durationSec = round(t);
  return sb;
}

interface Chapter {
  at: number;
  label: string;
  note?: string;
}

async function renderFilm(film: Film, photoFiles: string[]): Promise<{ file: string; chapters: Chapter[]; seconds: number; took: number }> {
  const started = Date.now();
  const brand = brandById(film.brand);
  const theme = buildVideoTheme(brand.branding, brand.name);
  const sb = await buildFilm(film, photoFiles);
  const assets = await inlineAssets(sb, theme, 'render');
  const { html, spec } = await composeVideoHtml({ ...assets, format: FORMAT, quality: QUALITY, mode: 'render' });
  let last = -1;
  const out = await renderVideo({
    html,
    width: spec.width,
    height: spec.height,
    fps: spec.fps,
    durationSec: sb.durationSec,
    quality: QUALITY,
    posterAt: 1,
    strict: sb.scenes.some((s) => !!s.code?.tsx),
    onProgress: (r) => {
      const pct = Math.floor(r * 10);
      if (pct !== last) {
        last = pct;
        process.stdout.write(`\r  ${film.id} ${pct * 10} %   `);
      }
    },
  });
  const file = path.join(OUT, `${film.id}.mp4`);
  fs.copyFileSync(out.file, file);
  fs.copyFileSync(out.poster, path.join(OUT, `${film.id}.jpg`));
  cleanupRender(out);
  process.stdout.write('\r');
  return { file, chapters: sb.scenes.map((s) => ({ at: s.start, label: s.demo?.label || s.sceneId, note: s.demo?.note })), seconds: sb.durationSec, took: Math.round((Date.now() - started) / 1000) };
}

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function writeIndex(done: { film: Film; chapters: Chapter[]; seconds: number }[]) {
  const blocks = done
    .map(
      ({ film, chapters, seconds }, n) => `<section id="${film.id}">
  <h2>${esc(film.title)} <small>${clock(seconds)} · ${chapters.length} scènes</small></h2>
  <p>${esc(film.about)}</p>
  <div class="row">
    <video id="v${n}" src="${film.id}.mp4" poster="${film.id}.jpg" controls preload="metadata"></video>
    <ol>${chapters.map((c) => `<li><button onclick="const v=document.getElementById('v${n}');v.currentTime=${c.at};v.play()"><b>${esc(c.label)}</b><span>${clock(c.at)}${c.note ? ` — ${esc(c.note)}` : ''}</span></button></li>`).join('')}</ol>
  </div>
</section>`
    )
    .join('\n');
  fs.writeFileSync(
    path.join(OUT, 'index.html'),
    `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Outils du moteur vidéo</title><style>
:root{color-scheme:light}body{margin:0;background:#fff;color:#111418;font:15px/1.5 system-ui,sans-serif}
main{max-width:1280px;margin:0 auto;padding:32px 20px 80px}h1{font-size:28px;margin:0 0 6px}h2{font-size:20px;margin:40px 0 4px}h2 small{font-weight:400;color:#5b6370;font-size:14px;margin-left:8px}
p{margin:0 0 12px;color:#3d4450}.row{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:20px;align-items:start}
video{width:100%;background:#eef0f3;border-radius:8px}ol{list-style:none;margin:0;padding:0;max-height:480px;overflow:auto;border:1px solid #dfe3e8;border-radius:8px}
li button{all:unset;display:block;width:100%;box-sizing:border-box;padding:8px 12px;cursor:pointer;border-bottom:1px solid #eef0f3}li button:hover,li button:focus-visible{background:#f4f6f8}
li b{display:block;font:600 13px ui-monospace,Menlo,monospace}li span{display:block;font-size:12.5px;color:#5b6370}
@media(max-width:860px){.row{grid-template-columns:1fr}}</style></head><body><main>
<h1>Les outils du moteur vidéo, en situation</h1>
<p>Chaque scène montre un outil, nommé en haut à droite. Cliquez une ligne pour y aller.</p>
${blocks}
</main></body></html>`
  );
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(done.map(({ film, chapters, seconds }) => ({ id: film.id, title: film.title, seconds, chapters })), null, 2));
}

(async () => {
  const chosen = FILMS.filter((f) => !ONLY.length || ONLY.some((o) => f.id.startsWith(o)));
  if (!chosen.length) throw new Error(`aucun film : --only=${ONLY.join(',')}`);
  console.log(`Démonstration des outils : ${chosen.length} film(s), ${FORMAT}, ${QUALITY}\n`);
  const photoFiles = Object.values(await makePhotos(path.join(OUT, '_photos'))).map((f) => `file://${f}`);
  const done: { film: Film; chapters: Chapter[]; seconds: number }[] = [];
  const manifestPath = path.join(OUT, 'manifest.json');
  // Un rendu partiel garde les films déjà produits dans l'index.
  const previous: { id: string; title: string; seconds: number; chapters: Chapter[] }[] = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : [];
  for (const film of FILMS) {
    if (!chosen.includes(film)) {
      const old = previous.find((p) => p.id === film.id);
      if (old && fs.existsSync(path.join(OUT, `${film.id}.mp4`))) done.push({ film, chapters: old.chapters, seconds: old.seconds });
      continue;
    }
    console.log(`▶ ${film.id} — ${film.title} (${film.scenes.length} scènes)`);
    try {
      const r = await renderFilm(film, photoFiles);
      console.log(`  ✓ ${path.relative(process.cwd(), r.file)} — ${clock(r.seconds)} rendues en ${r.took} s`);
      done.push({ film, chapters: r.chapters, seconds: r.seconds });
    } catch (error: any) {
      console.log(`  ✗ ${film.id} : ${error.message}`);
      process.exitCode = 1;
    }
    writeIndex(done);
  }
  writeIndex(done);
  await closeRenderBrowser();
  console.log(`\nIndex : ${path.relative(process.cwd(), path.join(OUT, 'index.html'))}`);
})();
