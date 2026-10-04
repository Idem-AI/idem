/**
 * PICTOGRAMMES — quatre bibliothèques installées, aucune embarquée dans la page.
 *
 *   Lucide (lucide-static, ~2 100)       trait régulier, net : précision
 *   Tabler (@tabler/icons, ~5 100)       trait géométrique : suisse
 *   Phosphor (@phosphor-icons/core, ~1 500 × 6 graisses) : thin, light, bold, fill, duotone
 *   Heroicons (heroicons, ~320)          plein, dense : trempé
 *
 * Le modèle ne voit JAMAIS ces milliers de noms : il choisit dans un petit
 * vocabulaire de CONCEPTS (livraison, prix, sécurité…), une cinquantaine de
 * mots. Le serveur traduit le concept vers l'icône de la bibliothèque que la
 * direction impose, lit le SVG dans node_modules, le normalise (couleur
 * `currentColor`, épaisseur de la direction) et l'injecte dans les données de la
 * vidéo. Sans modèle, un repli par mots-clés (FR/EN) choisit le concept.
 */
import fs from 'fs';
import path from 'path';

export type IconSetId = 'lucide' | 'tabler' | 'phosphor-thin' | 'phosphor-light' | 'phosphor-bold' | 'phosphor-fill' | 'phosphor-duotone' | 'heroicons-solid';

/** Concept → [lucide, tabler, phosphor, heroicons] (null : la bibliothèque n'a pas d'équivalent). */
export const ICON_CONCEPTS: Record<string, { names: [string, string, string, string | null]; keywords: RegExp }> = {
  delivery: { names: ['truck', 'truck-delivery', 'truck', 'truck'], keywords: /livr|deliver|exp[ée]di|shipping|colis|domicile/i },
  fast: { names: ['zap', 'bolt', 'lightning', 'bolt'], keywords: /rapide|vite|instant|express|fast|quick|imm[ée]diat|minutes?\b/i },
  time: { names: ['clock', 'clock', 'clock', 'clock'], keywords: /heure|horaire|\b24 ?h|7j|7\/7|hours?|time|ouvert|open/i },
  calendar: { names: ['calendar', 'calendar', 'calendar-blank', 'calendar'], keywords: /date|calendrier|calendar|jour|day|rendez|booking|r[ée]serv/i },
  place: { names: ['map-pin', 'map-pin', 'map-pin', 'map-pin'], keywords: /adresse|lieu|quartier|ville|address|location|place|local\b|près|proche/i },
  secure: { names: ['shield-check', 'shield-check', 'shield-check', 'shield-check'], keywords: /s[ée]cur|secure|safe|prot[eé]g|garanti|warrant|fiable|trust/i },
  quality: { names: ['badge-check', 'rosette-discount-check', 'seal-check', 'check-badge'], keywords: /qualit|premium|certifi|label|haut de gamme|quality|best/i },
  price: { names: ['tag', 'tag', 'tag', 'tag'], keywords: /prix|tarif|price|co[uû]t|abordable|affordable|cheap|pas cher/i },
  discount: { names: ['percent', 'percentage', 'percent', 'receipt-percent'], keywords: /promo|r[ée]duc|remise|solde|discount|sale|offre|-?\d+ ?%/i },
  money: { names: ['wallet', 'wallet', 'wallet', 'wallet'], keywords: /argent|money|[ée]conom|save|budget|gagn|earn|revenu/i },
  payment: { names: ['credit-card', 'credit-card', 'credit-card', 'credit-card'], keywords: /paie|payment|pay\b|carte|card|mobile money|momo|orange money|wave/i },
  mobile: { names: ['smartphone', 'device-mobile', 'device-mobile', 'device-phone-mobile'], keywords: /mobile|t[ée]l[ée]phone|smartphone|appli|app\b|whatsapp/i },
  support: { names: ['headset', 'headset', 'headset', 'lifebuoy'], keywords: /support|assistance|service client|aide|help|sav\b|conseil/i },
  chat: { names: ['message-circle', 'message-circle', 'chat-circle', 'chat-bubble-left-right'], keywords: /chat|message|discut|contact|écrire|write/i },
  community: { names: ['users', 'users', 'users-three', 'user-group'], keywords: /communaut|[ée]quipe|team|community|clients?\b|famille|ensemble|together/i },
  person: { names: ['user', 'user', 'user', 'user'], keywords: /personnel|perso|profil|profile|sur mesure|custom/i },
  star: { names: ['star', 'star', 'star', 'star'], keywords: /[ée]toile|avis|note|rating|review|star|meilleur/i },
  heart: { names: ['heart', 'heart', 'heart', 'heart'], keywords: /amour|love|passion|c[oœ]ur|heart|soin|care/i },
  natural: { names: ['leaf', 'leaf', 'leaf', null], keywords: /naturel|natural|bio\b|organic|vert|green|plante|herb/i },
  food: { names: ['utensils', 'tools-kitchen-2', 'fork-knife', null], keywords: /repas|cuisine|plat|food|meal|restaurant|manger|eat|recette|saveur|go[uû]t/i },
  drink: { names: ['coffee', 'coffee', 'coffee', null], keywords: /caf[ée]|coffee|boisson|drink|jus|juice|th[ée]\b|bissap/i },
  shopping: { names: ['shopping-bag', 'shopping-bag', 'shopping-bag', 'shopping-bag'], keywords: /boutique|achat|acheter|shop|buy|commande|order|collection/i },
  gift: { names: ['gift', 'gift', 'gift', 'gift'], keywords: /cadeau|gift|offert|free|gratuit|bonus/i },
  home: { names: ['house', 'home', 'house', 'home'], keywords: /maison|home|logement|immobilier|appartement|house/i },
  business: { names: ['building-2', 'building', 'buildings', 'building-office'], keywords: /entreprise|business|soci[ée]t[ée]|pme|b2b|bureau|office|corporate/i },
  store: { names: ['store', 'building-store', 'storefront', 'building-storefront'], keywords: /magasin|store|march[ée]|market|point de vente/i },
  growth: { names: ['trending-up', 'trending-up', 'trend-up', 'arrow-trending-up'], keywords: /croissance|growth|cro[iî]tre|grow|augment|boost|progress|performance|rentab/i },
  chart: { names: ['chart-column', 'chart-bar', 'chart-bar', 'chart-bar'], keywords: /statisti|donn[ée]es|data|analy|rapport|report|chiffre/i },
  rocket: { names: ['rocket', 'rocket', 'rocket-launch', 'rocket-launch'], keywords: /lanc|launch|d[ée]marr|start|nouveau|new|innov/i },
  idea: { names: ['lightbulb', 'bulb', 'lightbulb', 'light-bulb'], keywords: /id[ée]e|idea|cr[ée]ati|creative|inspir|astuce|tip/i },
  education: { names: ['graduation-cap', 'school', 'graduation-cap', 'academic-cap'], keywords: /formation|cours|[ée]cole|school|learn|apprend|[ée]tudi|training|dipl[oô]m/i },
  book: { names: ['book-open', 'book', 'book-open', 'book-open'], keywords: /livre|book|guide|lecture|read|ebook/i },
  health: { names: ['heart-pulse', 'heartbeat', 'heartbeat', null], keywords: /sant[ée]|health|bien-[eê]tre|wellness|m[ée]dic|soin/i },
  fitness: { names: ['dumbbell', 'barbell', 'barbell', null], keywords: /sport|fitness|gym|muscl|entra[iî]n|workout/i },
  beauty: { names: ['sparkles', 'sparkles', 'sparkle', 'sparkles'], keywords: /beaut[ée]|beauty|cosm[ée]ti|maquill|[ée]clat|glow|brill/i },
  fashion: { names: ['shirt', 'shirt', 't-shirt', null], keywords: /mode|fashion|v[eê]tement|wax|pagne|tissu|couture|style|tenue/i },
  camera: { names: ['camera', 'camera', 'camera', 'camera'], keywords: /photo|camera|shooting|image/i },
  music: { names: ['music', 'music', 'music-notes', 'musical-note'], keywords: /musique|music|son\b|concert|chanson|song|dj/i },
  world: { names: ['globe', 'world', 'globe-hemisphere-east', 'globe-europe-africa'], keywords: /monde|world|international|global|afrique|africa|pays|export/i },
  language: { names: ['languages', 'language', 'translate', 'language'], keywords: /langue|language|traduc|translat|fran[cç]ais|english/i },
  internet: { names: ['wifi', 'wifi', 'wifi-high', 'wifi'], keywords: /internet|wifi|connexion|connect|en ligne|online/i },
  cloud: { names: ['cloud', 'cloud', 'cloud', 'cloud'], keywords: /cloud|nuage|sauvegard|backup|stockage|storage/i },
  code: { names: ['code', 'code', 'code', 'code-bracket'], keywords: /code|logiciel|software|d[ée]velopp|developer|digital|num[ée]rique|tech/i },
  tools: { names: ['wrench', 'tool', 'wrench', 'wrench-screwdriver'], keywords: /r[ée]par|repair|outil|tool|install|maintenance|d[ée]pann/i },
  check: { names: ['check', 'check', 'check', 'check'], keywords: /simple|facile|easy|ok\b|valid|inclus|included/i },
  lock: { names: ['lock', 'lock', 'lock', 'lock-closed'], keywords: /priv[ée]|privacy|confidential|verrou|lock|mot de passe/i },
  eco: { names: ['recycle', 'recycle', 'recycle', 'arrow-path'], keywords: /recycl|[ée]colo|eco\b|durable|sustain|environnement|z[ée]ro d[ée]chet/i },
  energy: { names: ['sun', 'sun', 'sun', 'sun'], keywords: /[ée]nergie|energy|solaire|solar|soleil|sun|[ée]lectri/i },
  water: { names: ['droplet', 'droplet', 'drop', null], keywords: /\beau\b|water|hydrat|pluie|frais|fresh/i },
  car: { names: ['car', 'car', 'car', null], keywords: /voiture|car\b|auto|taxi|v[ée]hicule|transport|chauffeur/i },
  travel: { names: ['plane', 'plane', 'airplane', 'paper-airplane'], keywords: /voyage|travel|vol\b|flight|avion|tourisme|trip/i },
  partner: { names: ['handshake', 'heart-handshake', 'handshake', null], keywords: /partenaire|partner|accord|deal|collabor|confiance/i },
  award: { names: ['trophy', 'trophy', 'trophy', 'trophy'], keywords: /prix d|award|troph|champion|gagnant|winner|r[ée]compens/i },
  document: { names: ['file-text', 'file-text', 'file-text', 'document-text'], keywords: /document|contrat|contract|devis|facture|invoice|dossier/i },
  mail: { names: ['mail', 'mail', 'envelope', 'envelope'], keywords: /e-?mail|courriel|newsletter|mail/i },
  phone: { names: ['phone', 'phone', 'phone', 'phone'], keywords: /appel|call|appelez|t[ée]l\b|num[ée]ro|hotline/i },
  agriculture: { names: ['sprout', 'plant', 'plant', null], keywords: /agri|ferme|farm|r[ée]colte|harvest|culture|champ|cacao|caf[ée]ier/i },
  family: { names: ['baby', 'baby-carriage', 'baby', null], keywords: /b[ée]b[ée]|baby|enfant|kid|child|maman|mother/i },
  design: { names: ['palette', 'palette', 'palette', 'paint-brush'], keywords: /design|couleur|color|graphi|art\b|peinture|d[ée]co/i },
  video: { names: ['video', 'video', 'video-camera', 'video-camera'], keywords: /vid[ée]o|film|tournage|stream/i },
  smile: { names: ['smile', 'mood-smile', 'smiley', 'face-smile'], keywords: /sourire|smile|heureux|happy|satisf|joie|fun/i },
  bank: { names: ['landmark', 'building-bank', 'bank', 'building-library'], keywords: /banque|bank|cr[ée]dit|pr[eê]t|loan|financ|assurance|insurance/i },
};

export const ICON_CONCEPT_IDS = Object.keys(ICON_CONCEPTS);

const ROOT = (() => {
  // node_modules du monorepo (hoisté) ou de l'application.
  try {
    return path.resolve(path.dirname(require.resolve('lucide-static/package.json')), '..');
  } catch {
    return path.resolve(process.cwd(), 'node_modules');
  }
})();

/** Fichier SVG d'un concept dans une bibliothèque (null si absent). */
export function iconFile(set: IconSetId, concept: string): string | null {
  const def = ICON_CONCEPTS[concept];
  if (!def) return null;
  const [lucide, tabler, phosphor, hero] = def.names;
  let file: string;
  if (set === 'lucide') file = path.join(ROOT, 'lucide-static/icons', `${lucide}.svg`);
  else if (set === 'tabler') file = path.join(ROOT, '@tabler/icons/icons/outline', `${tabler}.svg`);
  else if (set === 'heroicons-solid') {
    if (!hero) return null;
    file = path.join(ROOT, 'heroicons/24/solid', `${hero}.svg`);
  } else {
    const weight = set.slice('phosphor-'.length);
    file = path.join(ROOT, '@phosphor-icons/core/assets', weight, `${phosphor}-${weight}.svg`);
  }
  return fs.existsSync(file) ? file : null;
}

/** Épaisseur de trait par bibliothèque à trait (lucide, tabler). */
const STROKE: Partial<Record<IconSetId, number>> = { lucide: 1.6, tabler: 1.75 };

/** Repli quand la bibliothèque n'a pas le concept : une bibliothèque de même graisse. */
const FALLBACK: Record<IconSetId, IconSetId> = {
  lucide: 'tabler',
  tabler: 'lucide',
  'phosphor-thin': 'lucide',
  'phosphor-light': 'lucide',
  'phosphor-bold': 'tabler',
  'phosphor-fill': 'heroicons-solid',
  'phosphor-duotone': 'phosphor-fill',
  'heroicons-solid': 'phosphor-fill',
};

const memo = new Map<string, string | null>();

/** Le SVG normalisé d'un concept : couleur héritée, sans dimensions, sans classes ni commentaires. */
export function iconSvg(set: IconSetId, concept: string): string | null {
  const key = `${set}:${concept}`;
  if (memo.has(key)) return memo.get(key)!;
  let file = iconFile(set, concept);
  let used = set;
  if (!file) {
    used = FALLBACK[set];
    file = iconFile(used, concept);
  }
  let out: string | null = null;
  if (file) {
    let svg = fs.readFileSync(file, 'utf8').replace(/<!--[\s\S]*?-->/g, '').trim();
    svg = svg.replace(/<svg\b([^>]*)>/, (_m, attrs: string) => {
      const kept = attrs
        .replace(/\s(width|height|class)="[^"]*"/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      return `<svg ${kept} aria-hidden="true">`;
    });
    const sw = STROKE[used];
    if (sw) svg = svg.replace(/stroke-width="[^"]*"/, `stroke-width="${sw}"`);
    // Heroicons solides : la couleur vient du texte.
    if (used === 'heroicons-solid' && !/fill=/.test(svg.slice(0, svg.indexOf('>')))) svg = svg.replace('<svg ', '<svg fill="currentColor" ');
    out = svg.replace(/\n\s*/g, '');
  }
  memo.set(key, out);
  return out;
}

/**
 * Concept d'un texte par mots-clés (repli sans modèle) : le mot-clé qui apparaît
 * le plus tôt l'emporte (« Qualité garantie » → qualité, pas sécurité).
 */
export function conceptFor(text: string, exclude: string[] = []): string | null {
  let best: { id: string; at: number } | null = null;
  for (const [id, def] of Object.entries(ICON_CONCEPTS)) {
    if (exclude.includes(id)) continue;
    const m = def.keywords.exec(text);
    if (m && (!best || m.index < best.at)) best = { id, at: m.index };
  }
  return best?.id ?? null;
}

/** Concept validé : celui proposé par le modèle s'il existe, sinon le repli par mots-clés, sinon `check`. */
export function resolveConcept(proposed: string | undefined, text: string, used: string[]): string {
  const p = (proposed || '').toLowerCase().trim();
  if (p && ICON_CONCEPTS[p] && !used.includes(p)) return p;
  return conceptFor(text, used) || (used.includes('check') ? 'star' : 'check');
}
