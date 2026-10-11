/**
 * MODULE B (2/2) — SYMBOLES FIGURATIFS : feuilles, gouttes, flammes, boucliers, maisons, livres,
 * ampoules, baobabs… Des objets reconnaissables, construits par la géométrie (jamais tracés à
 * main levée) et réglables : angle, nombre d'éléments, motif intérieur découpé.
 *
 * Les découpes (`knockout`) sont de vraies soustractions : le logo reste transparent là où le
 * dessin est creusé, sur n'importe quel fond.
 */
import type { GeometryKernel } from '../../kernel/geometry';
import { arcBandPath, circlePath, ellipsePath, linePath, polar, polyPath, rectPath, regularPolygonPoints, starPoints } from '../../kernel/primitives';
import type { Pt } from '../../kernel/primitives';
import { combineD, moved, rotated, scaled } from './abstract';
import { bool, GenPart, num, opt, register, Tone } from './registry';

const part = (d: string, tone: Tone = 'a'): GenPart => ({ d, tone });
const cut = (d: string): GenPart => ({ d, tone: 'knockout' });

/** Place un dessin autour de l'origine : échelle, rotation, translation. */
function placed(k: GeometryKernel, d: string, x: number, y: number, rot = 0, scale = 1): string {
  let out = d;
  if (scale !== 1) out = scaled(k, out, scale, 0, 0);
  if (rot) out = rotated(k, out, rot, 0, 0);
  return moved(k, out, x, y);
}

/** Une feuille de 40 de haut, base à l'origine, pointe en (0, -40). */
const LEAF_LOCAL = 'M0 0C-12 -9 -14 -27 0 -40C14 -27 12 -9 0 0Z';
const LEAF_PATH = 'M50 95C10 70 12 28 50 5C88 28 90 70 50 95Z';

register({
  id: 'leaf',
  label: 'Feuille',
  family: 'pictorial',
  tags: ['feuille', 'leaf', 'nature', 'écologie', 'ecology', 'bio', 'organic', 'vert', 'green', 'durable', 'sustainable', 'agriculture', 'santé', 'health', 'bien-être', 'wellness', 'thé', 'tea', 'plante', 'plant', 'cosmétique', 'naturel'],
  tones: 1,
  params: { angle: num(-60, 60, 28), veins: num(0, 3, 1, true), width: num(0.6, 1.15, 1) },
  build: (p, { kernel: k }) => {
    const parts: GenPart[] = [];
    const w = p.width as number;
    let leaf = LEAF_PATH;
    if (w !== 1) leaf = scaled(k, leaf, 1, 50, 50);
    const body = w !== 1 ? `M50 95C${50 - 40 * w} 70 ${50 - 38 * w} 28 50 5C${50 + 38 * w} 28 ${50 + 40 * w} 70 50 95Z` : leaf;
    parts.push(part(rotated(k, body, p.angle as number)));
    const veins: string[] = [linePath(50, 90, 50, 24, 3.4, true)];
    for (let i = 0; i < (p.veins as number); i++) {
      const y = 70 - i * 18;
      veins.push(linePath(50, y, 50 - 17, y - 14, 2.8, true), linePath(50, y, 50 + 17, y - 14, 2.8, true));
    }
    for (const v of veins) parts.push(cut(rotated(k, v, p.angle as number)));
    return parts;
  },
});

register({
  id: 'sprout',
  label: 'Pousse',
  family: 'pictorial',
  tags: ['pousse', 'sprout', 'croissance', 'growth', 'agriculture', 'agri', 'semence', 'seed', 'jardin', 'garden', 'éducation', 'jeune', 'startup', 'impact', 'environnement', 'planter', 'bio', 'écologie'],
  tones: 2,
  params: { leaf: num(0.7, 1.4, 1), spread: num(30, 70, 48), ground: bool(true) },
  build: (p, { kernel: k }) => {
    const s = p.leaf as number;
    const parts: GenPart[] = [part(linePath(50, 92, 50, 44, 7, true))];
    parts.push(part(placed(k, LEAF_LOCAL, 50, 64, -(p.spread as number), 1.0 * s), 'b'));
    parts.push(part(placed(k, LEAF_LOCAL, 50, 52, p.spread as number, 1.25 * s), 'a'));
    if (p.ground) parts.push(part(ellipsePath(50, 94, 36, 4.5), 'c'));
    return parts;
  },
});

register({
  id: 'drop',
  label: 'Goutte',
  family: 'pictorial',
  tags: ['goutte', 'drop', 'eau', 'water', 'pur', 'pure', 'liquide', 'huile', 'oil', 'santé', 'don', 'blood', 'sang', 'pluie', 'rain', 'nettoyage', 'cleaning', 'cosmétique', 'hygiène'],
  tones: 2,
  params: { shine: bool(true), ripple: bool(false) },
  build: (p) => {
    const parts: GenPart[] = [part('M50 4C50 4 17 42 17 64A33 33 0 0 0 83 64C83 42 50 4 50 4Z')];
    if (p.shine) parts.push(cut(arcBandPath(50, 64, 24, 5, 205, 265, true)));
    if (p.ripple) parts.push(part(ellipsePath(50, 96, 30, 3.5), 'c'));
    return parts;
  },
});

register({
  id: 'flame',
  label: 'Flamme',
  family: 'pictorial',
  tags: ['flamme', 'flame', 'feu', 'fire', 'énergie', 'energy', 'passion', 'chaud', 'hot', 'grill', 'cuisine', 'restaurant', 'gaz', 'gas', 'moteur', 'courage', 'force', 'sport', 'fitness', 'barbecue'],
  tones: 2,
  params: { inner: bool(true), lean: num(-15, 15, 0) },
  build: (p, { kernel: k }) => {
    const parts: GenPart[] = [part(rotated(k, 'M50 4C54 22 80 34 80 62C80 82 67 96 50 96C33 96 20 82 20 62C20 48 29 40 35 30C37 38 41 42 46 42C44 30 45 16 50 4Z', p.lean as number))];
    if (p.inner) parts.push(part(rotated(k, 'M50 54C56 64 65 70 65 79C65 88 59 94 50 94C41 94 35 88 35 79C35 68 45 64 50 54Z', p.lean as number), 'c'));
    return parts;
  },
});

register({
  id: 'bolt',
  label: 'Éclair',
  family: 'pictorial',
  tags: ['éclair', 'bolt', 'électricité', 'electric', 'énergie', 'energy', 'vitesse', 'speed', 'rapide', 'fast', 'puissance', 'power', 'batterie', 'recharge', 'tech', 'foudre', 'mobile money', 'paiement'],
  tones: 1,
  params: { round: num(0, 8, 2), slant: num(-10, 10, 0) },
  build: (p, { kernel: k }) => [part(rotated(k, polyPath([[60, 3], [20, 56], [45, 56], [37, 97], [80, 40], [54, 40]], p.round as number), p.slant as number))],
});

register({
  id: 'shield',
  label: 'Bouclier',
  family: 'pictorial',
  tags: ['bouclier', 'shield', 'sécurité', 'security', 'protection', 'assurance', 'insurance', 'confiance', 'trust', 'banque', 'bank', 'défense', 'juridique', 'legal', 'cyber', 'santé', 'garantie', 'fiabilité', 'mutuelle'],
  tones: 2,
  params: { inner: opt(['check', 'star', 'split', 'none', 'keyhole']) },
  build: (p, { kernel: k }) => {
    const body = 'M50 4L86 17V48C86 72 70 87 50 96C30 87 14 72 14 48V17Z';
    const parts: GenPart[] = [part(body)];
    if (p.inner === 'check') parts.push(cut(linePath(34, 51, 46, 63, 8, true)), cut(linePath(46, 63, 68, 37, 8, true)));
    if (p.inner === 'star') parts.push(cut(polyPath(starPoints(50, 52, 22, 9, 5, 0), 1.5)));
    if (p.inner === 'split') parts[0] = part(combineD(k, 'intersect', body, rectPath(0, 0, 50, 100)), 'a'), parts.push(part(combineD(k, 'intersect', body, rectPath(50, 0, 50, 100)), 'b'));
    if (p.inner === 'keyhole') parts.push(cut(circlePath(50, 46, 9)), cut(polyPath([[45, 52], [55, 52], [58, 74], [42, 74]])));
    return parts;
  },
});

register({
  id: 'pin',
  label: 'Repère',
  family: 'pictorial',
  tags: ['repère', 'pin', 'localisation', 'location', 'carte', 'map', 'lieu', 'place', 'voyage', 'travel', 'livraison', 'delivery', 'immobilier', 'proximité', 'local', 'tourisme', 'tourism', 'transport', 'gps', 'adresse'],
  tones: 2,
  params: { hole: opt(['ring', 'dot', 'star']), tilt: num(-20, 20, 0) },
  build: (p, { kernel: k }) => {
    const parts: GenPart[] = [part(rotated(k, 'M50 97C50 97 16 60 16 38A34 34 0 0 1 84 38C84 60 50 97 50 97Z', p.tilt as number))];
    const c = (d: string) => rotated(k, d, p.tilt as number);
    if (p.hole === 'ring') parts.push(cut(c(circlePath(50, 38, 13))));
    if (p.hole === 'dot') parts.push(part(c(circlePath(50, 38, 12)), 'c'));
    if (p.hole === 'star') parts.push(cut(c(polyPath(starPoints(50, 38, 15, 6.5, 5, 0), 1))));
    return parts;
  },
});

register({
  id: 'bubble',
  label: 'Bulle',
  family: 'pictorial',
  tags: ['bulle', 'bubble', 'message', 'chat', 'discussion', 'conversation', 'support', 'communication', 'avis', 'conseil', 'coaching', 'média', 'social', 'parole', 'voice', 'forum', 'service client'],
  tones: 2,
  params: { inner: opt(['dots', 'lines', 'none', 'heart']), tail: opt(['left', 'right']), round: num(10, 32, 22) },
  build: (p, { kernel: k }) => {
    const left = p.tail === 'left';
    const tail = left ? polyPath([[22, 68], [18, 95], [50, 72]]) : polyPath([[78, 68], [82, 95], [50, 72]]);
    const body = combineD(k, 'union', rectPath(6, 6, 88, 66, p.round as number), tail);
    const parts: GenPart[] = [part(body)];
    if (p.inner === 'dots') for (const x of [30, 50, 70]) parts.push(cut(circlePath(x, 39, 6)));
    if (p.inner === 'lines') parts.push(cut(linePath(24, 30, 76, 30, 6, true)), cut(linePath(24, 48, 58, 48, 6, true)));
    if (p.inner === 'heart') parts.push(cut(scaled(k, 'M50 58C34 46 30 38 36 30C41 24 48 26 50 32C52 26 59 24 64 30C70 38 66 46 50 58Z', 1)));
    return parts;
  },
});

register({
  id: 'book',
  label: 'Livre ouvert',
  family: 'pictorial',
  tags: ['livre', 'book', 'éducation', 'education', 'école', 'school', 'savoir', 'knowledge', 'formation', 'training', 'lecture', 'reading', 'bibliothèque', 'library', 'édition', 'publishing', 'université', 'apprentissage', 'culture', 'blog'],
  tones: 2,
  params: { gap: num(2, 7, 4), curve: num(0, 14, 8) },
  build: (p) => {
    const g = p.gap as number;
    const c = p.curve as number;
    const half = (mirror: boolean) => {
      const x = (v: number) => (mirror ? 100 - v : v);
      return `M${x(6)} 22C${x(20)} ${14 + c / 2} ${x(36)} ${16 + c} ${x(50 - g / 2)} ${28 + c}V90C${x(36)} ${78} ${x(20)} ${76} ${x(6)} 84Z`;
    };
    return [part(half(false), 'a'), part(half(true), 'b')];
  },
});

register({
  id: 'house',
  label: 'Maison',
  family: 'pictorial',
  tags: ['maison', 'house', 'home', 'immobilier', 'real estate', 'habitat', 'logement', 'foyer', 'famille', 'family', 'construction', 'bâtiment', 'agence', 'location', 'rent', 'architecture', 'décoration'],
  tones: 2,
  params: { door: opt(['arch', 'rect', 'none']), roof: num(30, 60, 42) },
  build: (p) => {
    const roofY = p.roof as number;
    const parts: GenPart[] = [part(rectPath(18, roofY - 2, 64, 96 - roofY, 3), 'a'), part(polyPath([[50, 5], [97, roofY + 2], [3, roofY + 2]], 3), 'b')];
    if (p.door === 'arch') parts.push(cut('M41 94V72A9 9 0 0 1 59 72V94Z'));
    if (p.door === 'rect') parts.push(cut(rectPath(41, 66, 18, 28, 2)));
    return parts;
  },
});

register({
  id: 'sunrise',
  label: 'Lever de soleil',
  family: 'pictorial',
  tags: ['lever', 'sunrise', 'soleil', 'sun', 'aube', 'dawn', 'espoir', 'hope', 'afrique', 'africa', 'énergie solaire', 'solar', 'nouveau', 'début', 'start', 'horizon', 'voyage', 'matin', 'morning', 'éducation'],
  tones: 2,
  params: { rays: num(0, 9, 5, true), lines: num(1, 3, 2, true) },
  build: (p) => {
    const parts: GenPart[] = [part('M16 64A34 34 0 0 1 84 64Z', 'c')];
    const n = p.rays as number;
    for (let i = 0; i < n; i++) {
      const a = -70 + (140 / Math.max(1, n - 1)) * i;
      const [x1, y1] = polar(50, 64, 42, a);
      const [x2, y2] = polar(50, 64, 54, a);
      if (n > 1) parts.push(part(linePath(x1, y1, x2, y2, 5, true), 'a'));
    }
    for (let i = 0; i < (p.lines as number); i++) parts.push(part(rectPath(8 + i * 12, 72 + i * 11, 84 - i * 24, 6.5, 3.25), 'a'));
    return parts;
  },
});

register({
  id: 'mountain',
  label: 'Montagne',
  family: 'pictorial',
  tags: ['montagne', 'mountain', 'sommet', 'peak', 'aventure', 'adventure', 'randonnée', 'hiking', 'outdoor', 'nature', 'voyage', 'travel', 'ambition', 'défi', 'challenge', 'altitude', 'kilimandjaro', 'expédition', 'assurance'],
  tones: 3,
  params: { sun: bool(true), snow: bool(true) },
  build: (p) => {
    const parts: GenPart[] = [part(polyPath([[2, 94], [36, 24], [72, 94]], 2), 'a'), part(polyPath([[46, 94], [72, 46], [98, 94]], 2), 'b')];
    if (p.snow) parts.push(cut(polyPath([[36, 30], [26, 46], [32, 43], [37, 49], [43, 43], [48, 46]], 0.6)));
    if (p.sun) parts.push(part(circlePath(80, 24, 9), 'c'));
    return parts;
  },
});

register({
  id: 'heart',
  label: 'Cœur',
  family: 'pictorial',
  tags: ['cœur', 'heart', 'amour', 'love', 'santé', 'health', 'soin', 'care', 'don', 'solidarité', 'ong', 'charity', 'famille', 'family', 'rencontre', 'dating', 'mariage', 'wedding', 'bienveillance', 'communauté', 'sankofa', 'hôpital'],
  tones: 2,
  params: { inner: opt(['none', 'plus', 'pulse', 'cut']), tilt: num(-15, 15, 0) },
  build: (p, { kernel: k }) => {
    const tilt = p.tilt as number;
    const parts: GenPart[] = [part(rotated(k, 'M50 92C12 64 4 40 17 24C28 11 44 14 50 29C56 14 72 11 83 24C96 40 88 64 50 92Z', tilt))];
    if (p.inner === 'plus') parts.push(cut(rotated(k, rectPath(44, 30, 12, 34, 2), tilt)), cut(rotated(k, rectPath(33, 41, 34, 12, 2), tilt)));
    if (p.inner === 'pulse') parts.push(cut(rotated(k, 'M20 52H38L44 38L54 66L61 48H80V54H65L55 74L44 46L40 58H20Z', tilt)));
    if (p.inner === 'cut') parts.push(cut(rotated(k, linePath(24, 78, 84, 14, 3.4, false), tilt)));
    return parts;
  },
});

register({
  id: 'crown',
  label: 'Couronne',
  family: 'pictorial',
  tags: ['couronne', 'crown', 'roi', 'king', 'reine', 'queen', 'luxe', 'luxury', 'premium', 'royal', 'prestige', 'excellence', 'champion', 'leader', 'hôtel', 'hotel', 'beauté', 'mode', 'victoire'],
  tones: 3,
  params: { points: num(3, 5, 3, true), jewels: bool(true) },
  build: (p) => {
    const n = p.points as number;
    const top: Pt[] = [];
    for (let i = 0; i < n; i++) {
      const x = 12 + (76 * i) / (n - 1);
      top.push([x, i % 2 === 0 || n === 3 ? (i === Math.floor((n - 1) / 2) ? 14 : 28) : 34]);
    }
    const pts: Pt[] = [[8, 80]];
    top.forEach((tp, i) => {
      if (i) pts.push([(top[i - 1][0] + tp[0]) / 2, 54]);
      pts.push(tp);
    });
    pts.push([92, 80]);
    const parts: GenPart[] = [part(polyPath(pts, 2), 'a'), part(rectPath(8, 84, 84, 10, 3), 'b')];
    if (p.jewels) top.forEach((tp) => parts.push(part(circlePath(tp[0], tp[1] - 3, 5.5), 'c')));
    return parts;
  },
});

register({
  id: 'cup',
  label: 'Tasse',
  family: 'pictorial',
  tags: ['tasse', 'cup', 'café', 'coffee', 'thé', 'tea', 'boisson', 'drink', 'restaurant', 'bar', 'pause', 'break', 'cafétéria', 'boulangerie', 'pâtisserie', 'chaud', 'accueil', 'brunch'],
  tones: 2,
  params: { steam: opt(['two', 'one', 'none']), handle: bool(true) },
  build: (p) => {
    const parts: GenPart[] = [part('M12 40H72V62C72 80 60 92 42 92C24 92 12 80 12 62Z')];
    if (p.handle) parts.push(part(arcBandPath(70, 58, 17, 8, 5, 175, true), 'a'));
    const steam = (x: number) => `M${x} 34C${x - 8} 26 ${x + 8} 20 ${x} 10C${x + 3} 20 ${x + 6} 22 ${x + 3} 28C${x + 1} 32 ${x + 2} 34 ${x} 34Z`;
    if (p.steam === 'two') parts.push(part(steam(30), 'c'), part(steam(50), 'c'));
    if (p.steam === 'one') parts.push(part(steam(42), 'c'));
    return parts;
  },
});

register({
  id: 'gear',
  label: 'Engrenage',
  family: 'pictorial',
  tags: ['engrenage', 'gear', 'industrie', 'industry', 'mécanique', 'mechanic', 'ingénierie', 'engineering', 'réglage', 'settings', 'atelier', 'maintenance', 'usine', 'factory', 'outil', 'automatisation', 'process', 'btp', 'garage'],
  tones: 1,
  params: { teeth: num(6, 12, 8, true), hole: num(8, 20, 13), tooth: num(9, 15, 12) },
  build: (p, { kernel: k }) => {
    const n = p.teeth as number;
    let body = circlePath(50, 50, 33);
    for (let i = 0; i < n; i++) {
      const tooth = rotated(k, rectPath(50 - (p.tooth as number) / 2, 8, p.tooth as number, 22, 2.5), (360 / n) * i);
      body = combineD(k, 'union', body, tooth);
    }
    return [part(body), cut(circlePath(50, 50, p.hole as number))];
  },
});

register({
  id: 'baobab',
  label: 'Baobab',
  family: 'pictorial',
  tags: ['baobab', 'arbre', 'tree', 'afrique', 'africa', 'racines', 'roots', 'héritage', 'heritage', 'sagesse', 'wisdom', 'tradition', 'vie', 'life', 'communauté', 'durable', 'longévité', 'patrimoine', 'sénégal', 'madagascar', 'culture'],
  tones: 3,
  params: { sun: bool(false), canopy: num(0.8, 1.2, 1) },
  build: (p, { kernel: k }) => {
    const trunk = 'M36 95C41 82 37 68 40 54C40 46 35 40 30 33L40 34C43 39 46 41 50 41C54 41 57 39 60 34L70 33C65 40 60 46 60 54C63 68 59 82 64 95Z';
    const centers: [number, number, number, number][] = [[24, 27, 17, 10], [42, 17, 19, 11], [62, 18, 19, 11], [78, 28, 17, 10], [51, 29, 20, 10]];
    let canopy = ellipsePath(...centers[0]);
    for (const [cx, cy, rx, ry] of centers.slice(1)) canopy = combineD(k, 'union', canopy, ellipsePath(cx, cy, rx, ry));
    canopy = p.canopy === 1 ? canopy : scaled(k, canopy, p.canopy as number, 50, 30);
    const parts: GenPart[] = [];
    if (p.sun) parts.push(part(circlePath(50, 22, 22), 'c'));
    parts.push(part(trunk, 'a'), part(canopy, 'b'));
    return parts;
  },
});

register({
  id: 'globe',
  label: 'Globe',
  family: 'pictorial',
  tags: ['globe', 'monde', 'world', 'international', 'global', 'terre', 'earth', 'planète', 'planet', 'voyage', 'travel', 'export', 'import', 'web', 'internet', 'réseau', 'diaspora', 'afrique', 'transfert', 'transport'],
  tones: 1,
  params: { meridians: num(1, 2, 1, true), tilt: num(-30, 30, 0) },
  build: (p, { kernel: k }) => {
    const parts: GenPart[] = [part(circlePath(50, 50, 45))];
    const tilt = p.tilt as number;
    const ringEllipse = (rx: number) => combineD(k, 'subtract', ellipsePath(50, 50, rx, 45), ellipsePath(50, 50, Math.max(1, rx - 3.4), 45));
    for (let i = 0; i < (p.meridians as number); i++) parts.push(cut(rotated(k, ringEllipse(i === 0 ? 20 : 34), tilt)));
    parts.push(cut(rotated(k, rectPath(4, 48.3, 92, 3.4), tilt)));
    parts.push(cut(rotated(k, 'M12 30Q50 22 88 30V33Q50 25 12 33Z', tilt)), cut(rotated(k, 'M12 70Q50 78 88 70V67Q50 75 12 67Z', tilt)));
    return parts;
  },
});

register({
  id: 'cross',
  label: 'Croix',
  family: 'pictorial',
  tags: ['croix', 'cross', 'plus', 'médical', 'medical', 'santé', 'health', 'pharmacie', 'pharmacy', 'clinique', 'clinic', 'hôpital', 'urgence', 'soin', 'care', 'secours', 'docteur', 'mutuelle'],
  tones: 2,
  params: { arm: num(22, 36, 28), round: num(0, 14, 8), ring: bool(false) },
  build: (p) => {
    const a = p.arm as number;
    const parts: GenPart[] = [];
    parts.push(part(combineJoin(a, p.round as number), 'a'));
    if (p.ring) parts.push(part('M50 2A48 48 0 1 0 50.01 2Z', 'b'));
    return p.ring ? [part(combineRing(), 'b'), part(scaledCross(a, p.round as number), 'a')] : parts;
  },
});

const combineJoin = (arm: number, r: number) => `${rectPath(50 - arm / 2, 8, arm, 84, r)}${rectPath(8, 50 - arm / 2, 84, arm, r)}`;
const scaledCross = (arm: number, r: number) => `${rectPath(50 - arm / 3, 24, (arm * 2) / 3, 52, r / 2)}${rectPath(24, 50 - arm / 3, 52, (arm * 2) / 3, r / 2)}`;
const combineRing = () => `${circlePath(50, 50, 47, true)}${circlePath(50, 50, 41, false)}`;

register({
  id: 'arrow',
  label: 'Flèche',
  family: 'pictorial',
  tags: ['flèche', 'arrow', 'croissance', 'growth', 'direction', 'objectif', 'goal', 'cible', 'transport', 'livraison', 'delivery', 'envoi', 'progrès', 'vitesse', 'performance', 'investissement', 'marketing', 'ventes', 'sales', 'forward'],
  tones: 2,
  params: { angle: num(-180, 180, -40), style: opt(['solid', 'notch', 'double']), head: num(24, 40, 32), thick: num(12, 24, 18) },
  build: (p, { kernel: k }) => {
    const h = p.head as number;
    const t = p.thick as number;
    const style = p.style as string;
    const head = polyPath([[96 - h, 50 - h * 0.95], [98, 50], [96 - h, 50 + h * 0.95]], 2);
    const shaft = style === 'notch' ? polyPath([[6, 50 - t / 2], [100 - h, 50 - t / 2], [100 - h, 50 + t / 2], [6, 50 + t / 2], [18, 50]], 1.5) : rectPath(6, 50 - t / 2, 94 - h, t, t * 0.2);
    const parts: GenPart[] =
      style === 'double'
        ? [part(rotated(k, polyPath([[8, 24], [50, 50], [8, 76], [8, 62], [30, 50], [8, 38]], 1.5), p.angle as number), 'b'), part(rotated(k, polyPath([[44, 24], [92, 50], [44, 76], [44, 62], [66, 50], [44, 38]], 1.5), p.angle as number), 'a')]
        : [part(rotated(k, shaft, p.angle as number), 'a'), part(rotated(k, head, p.angle as number), 'a')];
    return parts;
  },
});

register({
  id: 'lock',
  label: 'Cadenas',
  family: 'pictorial',
  tags: ['cadenas', 'lock', 'sécurité', 'security', 'privé', 'private', 'protection', 'cyber', 'coffre', 'vault', 'finance', 'banque', 'données', 'data', 'confidentialité', 'mot de passe', 'fintech', 'accès'],
  tones: 2,
  params: { keyhole: bool(true), round: num(4, 16, 10) },
  build: (p) => {
    const parts: GenPart[] = [part(rectPath(16, 44, 68, 50, p.round as number), 'a'), part('M30 48V34A20 20 0 0 1 70 34V48H61V34A11 11 0 0 0 39 34V48Z', 'b')];
    if (p.keyhole) parts.push(cut(circlePath(50, 64, 7)), cut(polyPath([[46, 66], [54, 66], [56, 82], [44, 82]])));
    return parts;
  },
});

register({
  id: 'bulb',
  label: 'Ampoule',
  family: 'pictorial',
  tags: ['ampoule', 'bulb', 'idée', 'idea', 'innovation', 'créativité', 'creative', 'conseil', 'consulting', 'éducation', 'recherche', 'research', 'startup', 'lumière', 'light', 'électricité', 'solution', 'astuce', 'brainstorm'],
  tones: 2,
  params: { rays: bool(true), filament: bool(true) },
  build: (p) => {
    const head = combineJoin2();
    const parts: GenPart[] = [part(head, 'a'), part(rectPath(38, 80, 24, 6, 3), 'b'), part(rectPath(42, 88, 16, 6, 3), 'b')];
    if (p.filament) parts.push(cut('M42 70V50A8 8 0 0 1 50 42A8 8 0 0 1 58 50V70H54V50A4 4 0 0 0 50 46A4 4 0 0 0 46 50V70Z'));
    if (p.rays) for (const a of [-70, -35, 0, 35, 70]) {
      const [x1, y1] = polar(50, 40, 36, a);
      const [x2, y2] = polar(50, 40, 44, a);
      if (a !== 0) parts.push(part(linePath(x1, y1, x2, y2, 4.5, true), 'c'));
    }
    return parts.map((q) => (p.rays ? { ...q, d: q.tone === 'c' ? q.d : q.d } : q));
  },
});

const combineJoin2 = () => 'M50 14C32 14 20 28 20 44C20 56 27 63 33 70C36 74 37 77 37 80H63C63 77 64 74 67 70C73 63 80 56 80 44C80 28 68 14 50 14Z';

register({
  id: 'phone',
  label: 'Téléphone',
  family: 'pictorial',
  tags: ['téléphone', 'phone', 'mobile', 'application', 'app', 'smartphone', 'tech', 'digital', 'sms', 'paiement', 'mobile money', 'télécom', 'telecom', 'saas', 'e-commerce', 'service', 'startup'],
  tones: 2,
  params: { screen: opt(['plain', 'dot', 'bars']), tilt: num(-20, 20, 0) },
  build: (p, { kernel: k }) => {
    const tilt = p.tilt as number;
    const parts: GenPart[] = [part(rotated(k, rectPath(26, 4, 48, 92, 11), tilt)), cut(rotated(k, rectPath(33, 16, 34, 62, 3), tilt)), cut(rotated(k, circlePath(50, 86, 3.4), tilt))];
    if (p.screen === 'dot') parts.push(part(rotated(k, circlePath(50, 47, 10), tilt), 'c'));
    if (p.screen === 'bars') parts.push(part(rotated(k, rectPath(38, 56, 6, 16, 2), tilt), 'c'), part(rotated(k, rectPath(47, 44, 6, 28, 2), tilt), 'c'), part(rotated(k, rectPath(56, 30, 6, 42, 2), tilt), 'c'));
    return parts;
  },
});

register({
  id: 'eye',
  label: 'Œil',
  family: 'pictorial',
  tags: ['œil', 'eye', 'vision', 'optique', 'optical', 'regard', 'surveillance', 'security', 'sécurité', 'clarté', 'insight', 'analyse', 'média', 'photo', 'studio', 'prévoyance', 'lunettes', 'observer'],
  tones: 3,
  params: { iris: num(12, 22, 17) },
  build: (p) => [part('M3 50C22 18 78 18 97 50C78 82 22 82 3 50Z'), cut(circlePath(50, 50, p.iris as number)), part(circlePath(50, 50, (p.iris as number) * 0.55), 'c')],
});

register({
  id: 'people',
  label: 'Personnes',
  family: 'pictorial',
  tags: ['personnes', 'people', 'équipe', 'team', 'communauté', 'community', 'rh', 'hr', 'recrutement', 'jobs', 'emploi', 'association', 'ong', 'social', 'famille', 'groupe', 'tontine', 'coopérative', 'réseau', 'citoyen', 'client'],
  tones: 2,
  params: { count: num(1, 3, 3, true) },
  build: (p) => {
    const person = (cx: number, top: number, s: number, t: Tone): GenPart[] => [
      part(circlePath(cx, top + 11 * s, 11 * s), t),
      part(`M${cx - 20 * s} ${top + 64 * s}C${cx - 20 * s} ${top + 34 * s} ${cx + 20 * s} ${top + 34 * s} ${cx + 20 * s} ${top + 64 * s}Z`, t),
    ];
    if (p.count === 1) return person(50, 18, 1.3, 'a');
    if (p.count === 2) return [...person(34, 22, 1.1, 'a'), ...person(66, 22, 1.1, 'b')];
    return [...person(22, 34, 0.85, 'b'), ...person(78, 34, 0.85, 'b'), ...person(50, 14, 1.15, 'a')];
  },
});

register({
  id: 'cap',
  label: 'Toque de diplômé',
  family: 'pictorial',
  tags: ['diplôme', 'graduation', 'université', 'university', 'école', 'school', 'éducation', 'education', 'formation', 'training', 'étudiant', 'student', 'académie', 'académie', 'bourse', 'scholarship', 'mentorat', 'coaching', 'cours'],
  tones: 2,
  params: { tassel: bool(true) },
  build: (p) => {
    const parts: GenPart[] = [part(polyPath([[50, 14], [97, 38], [50, 62], [3, 38]], 2), 'a'), part('M22 54V72C22 82 78 82 78 72V54L50 68Z', 'b')];
    if (p.tassel) parts.push(part(linePath(90, 42, 90, 72, 4, true), 'c'), part(circlePath(90, 76, 5.5), 'c'));
    return parts;
  },
});

register({
  id: 'camera',
  label: 'Appareil photo',
  family: 'pictorial',
  tags: ['photo', 'camera', 'appareil', 'image', 'vidéo', 'video', 'studio', 'média', 'media', 'souvenir', 'reportage', 'mariage', 'événement', 'event', 'cinéma', 'film', 'créatif', 'agence', 'visuel'],
  tones: 3,
  params: { flash: bool(true) },
  build: (p) => {
    const parts: GenPart[] = [part(rectPath(5, 26, 90, 64, 13), 'a'), part(rectPath(33, 16, 34, 16, 5), 'a'), cut(circlePath(50, 58, 23)), part(circlePath(50, 58, 14), 'c')];
    if (p.flash) parts.push(cut(circlePath(82, 40, 3.8)));
    return parts;
  },
});

register({
  id: 'bean',
  label: 'Grain',
  family: 'pictorial',
  tags: ['grain', 'bean', 'café', 'coffee', 'cacao', 'cocoa', 'chocolat', 'torréfaction', 'roasting', 'agriculture', 'agri', 'récolte', 'harvest', 'ferme', 'farm', 'semence', 'artisanal', 'épicerie'],
  tones: 1,
  params: { angle: num(-60, 60, 30) },
  build: (p, { kernel: k }) => [
    part(rotated(k, ellipsePath(50, 50, 30, 44), p.angle as number)),
    cut(rotated(k, 'M44 10C34 30 62 44 52 62C48 72 52 80 56 90L51 92C46 82 42 72 46 62C54 44 28 32 40 8Z', p.angle as number)),
  ],
});

register({
  id: 'paw',
  label: 'Patte',
  family: 'pictorial',
  tags: ['patte', 'paw', 'animal', 'animaux', 'pets', 'chien', 'dog', 'chat', 'cat', 'vétérinaire', 'vet', 'nature', 'faune', 'wildlife', 'safari', 'refuge', 'adoption'],
  tones: 1,
  params: { toes: num(3, 5, 4, true) },
  build: (p, { kernel: k }) => {
    const n = p.toes as number;
    const parts: GenPart[] = [part('M50 50C32 50 20 68 22 78C24 88 36 88 50 84C64 88 76 88 78 78C80 68 68 50 50 50Z')];
    for (let i = 0; i < n; i++) {
      const a = -52 + (104 / Math.max(1, n - 1)) * i;
      const [x, y] = polar(50, 66, 38, a);
      parts.push(part(rotated(k, ellipsePath(x, y, 8.5, 12), a, x, y)));
    }
    return parts;
  },
});

register({
  id: 'fish',
  label: 'Poisson',
  family: 'pictorial',
  tags: ['poisson', 'fish', 'pêche', 'fishing', 'mer', 'sea', 'océan', 'marin', 'seafood', 'aquaculture', 'restaurant', 'port', 'fruits de mer', 'plage', 'pêcheur'],
  tones: 2,
  params: { eye: bool(true), tilt: num(-25, 25, 0) },
  build: (p, { kernel: k }) => {
    const parts: GenPart[] = [part(rotated(k, 'M6 50C22 22 52 20 70 42L94 22V78L70 58C52 80 22 78 6 50Z', p.tilt as number), 'a')];
    if (p.eye) parts.push(cut(rotated(k, circlePath(26, 46, 4.5), p.tilt as number)));
    return parts;
  },
});

register({
  id: 'star',
  label: 'Étoile',
  family: 'pictorial',
  tags: ['étoile', 'star', 'excellence', 'qualité', 'quality', 'avis', 'rating', 'récompense', 'award', 'célébrité', 'talent', 'espoir', 'guide', 'nuit', 'night', 'étoilé', 'premium', 'leader'],
  tones: 2,
  params: { points: num(4, 8, 5, true), depth: num(0.35, 0.7, 0.45), round: num(0, 8, 3), ring: bool(false) },
  build: (p) => {
    const R = p.ring ? 36 : 46;
    const parts: GenPart[] = [part(polyPath(starPoints(50, 52, R, R * (p.depth as number), p.points as number, 0), p.round as number), 'a')];
    if (p.ring) parts.push(part(`${circlePath(50, 50, 48, true)}${circlePath(50, 50, 43, false)}`, 'b'));
    return parts;
  },
});

register({
  id: 'bag',
  label: 'Sac',
  family: 'pictorial',
  tags: ['sac', 'bag', 'shopping', 'boutique', 'shop', 'commerce', 'e-commerce', 'vente', 'retail', 'mode', 'fashion', 'marché', 'market', 'courses', 'cadeau', 'gift', 'achat', 'épicerie', 'stock'],
  tones: 2,
  params: { handle: opt(['arch', 'loop']), smile: bool(true) },
  build: (p) => {
    const parts: GenPart[] = [part('M14 30H86L92 92H8Z', 'a')];
    parts.push(part(p.handle === 'loop' ? arcBandPath(50, 36, 22, 7, -90, 90) : 'M32 34V26A18 18 0 0 1 68 26V34H61V26A11 11 0 0 0 39 26V34Z', 'b'));
    if (p.smile) parts.push(cut(arcBandPath(50, 54, 15, 5, 120, 240, true)));
    return parts;
  },
});

register({
  id: 'pill',
  label: 'Gélule',
  family: 'pictorial',
  tags: ['gélule', 'pill', 'médicament', 'medicine', 'pharmacie', 'pharmacy', 'santé', 'health', 'laboratoire', 'lab', 'traitement', 'treatment', 'vitamine', 'clinique', 'soin', 'biotech', 'science'],
  tones: 3,
  params: { angle: num(-60, 60, -40), seam: num(0, 6, 3) },
  build: (p, { kernel: k }) => {
    const capsule = rectPath(4, 30, 92, 40, 20);
    const gap = p.seam as number;
    const left = combineD(k, 'intersect', capsule, rectPath(0, 0, 50 - gap / 2, 100));
    const right = combineD(k, 'intersect', capsule, rectPath(50 + gap / 2, 0, 50, 100));
    return [part(rotated(k, left, p.angle as number), 'a'), part(rotated(k, right, p.angle as number), 'c')];
  },
});

register({
  id: 'coin',
  label: 'Pièce',
  family: 'pictorial',
  tags: ['pièce', 'coin', 'argent', 'money', 'finance', 'banque', 'bank', 'épargne', 'savings', 'monnaie', 'currency', 'crypto', 'paiement', 'payment', 'investissement', 'micro-crédit', 'tontine', 'cfa', 'trésorerie'],
  tones: 2,
  params: { inner: opt(['star', 'bars', 'leaf', 'ring']) },
  build: (p, { kernel: k }) => {
    const parts: GenPart[] = [part(`${circlePath(50, 50, 47, true)}${circlePath(50, 50, 38, false)}`, 'a')];
    if (p.inner === 'star') parts.push(part(polyPath(starPoints(50, 52, 24, 10.5, 5, 0), 1.5), 'c'));
    if (p.inner === 'bars') parts.push(part(rectPath(30, 52, 10, 18, 2), 'c'), part(rectPath(45, 40, 10, 30, 2), 'c'), part(rectPath(60, 28, 10, 42, 2), 'c'));
    if (p.inner === 'leaf') parts.push(part(placed(k, 'M0 0C-12 -9 -14 -27 0 -40C14 -27 12 -9 0 0Z', 50, 68, 0, 1.1), 'c'));
    if (p.inner === 'ring') parts.push(part(`${circlePath(50, 50, 22, true)}${circlePath(50, 50, 14, false)}`, 'c'));
    return parts;
  },
});

export const _unused = { regularPolygonPoints };
