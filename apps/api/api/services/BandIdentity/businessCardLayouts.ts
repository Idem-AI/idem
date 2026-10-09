/**
 * LES MISES EN PAGE DE CARTE DE VISITE DU CODE — crans Low → Max de la jauge de créativité.
 *
 * Au cran Ultra, l'IA écrit le HTML des deux faces (pipeline historique). En dessous, le CODE
 * compose recto et verso à partir de mises en page éprouvées, aux couleurs, polices et
 * déclinaisons de logo exactes de la charte. Mêmes conventions que l'éditeur :
 *
 *  - racine `w-[Wmm] h-[Hmm] overflow-hidden relative`, cotes en millimètres ;
 *  - marge de sécurité de 4 mm, corps de texte ≥ 7 pt (lisible à l'impression) ;
 *  - champs `{{champ}}` posés dans des blocs `data-field` (retirés quand la valeur manque) ;
 *  - icônes en SVG inline à l'intérieur du bloc du champ ;
 *  - couleur de texte choisie au contraste réel (≥ 4,5:1) avec son fond.
 */
import { textOn } from '../Communication/flyerLayouts';
import { contrastRatio } from '../design/color';

export type CardStructure = 'brandFront' | 'mixed' | 'detailsFront';
export type CardFrontId = 'logoCenter' | 'patternField' | 'monogram' | 'logoCornerName' | 'bandBottom' | 'splitColor';
export type CardBackId = 'contactsList' | 'contactsColumns' | 'centered' | 'accentBar' | 'logoOnly';

export const CARD_STRUCTURES: Record<CardStructure, { summary: string; fronts: CardFrontId[]; backs: CardBackId[] }> = {
  brandFront: { summary: 'front = the brand alone (logo), back = the person and every contact', fronts: ['logoCenter', 'patternField', 'monogram'], backs: ['contactsList', 'contactsColumns', 'centered', 'accentBar'] },
  mixed: { summary: 'front = logo + name and role, back = the contacts', fronts: ['logoCornerName', 'monogram', 'bandBottom'], backs: ['contactsList', 'accentBar', 'contactsColumns'] },
  detailsFront: { summary: 'front = everything (logo, name, contacts), back = a full brand face', fronts: ['splitColor', 'bandBottom', 'logoCornerName'], backs: ['logoOnly'] },
};

export const CARD_FRONTS: Record<CardFrontId, string> = {
  logoCenter: 'the logo alone, centred on the brand colour',
  patternField: 'brand colour with a fine diagonal pattern, logo centred',
  monogram: 'a giant brand initial as watermark, name and role beside it',
  logoCornerName: 'logo in a corner, name and role set low with an accent rule',
  bandBottom: 'paper face, a brand band along the bottom edge',
  splitColor: 'the card split: brand colour with the logo, paper with name and contacts',
};
export const CARD_BACKS: Record<CardBackId, string> = {
  contactsList: 'name, role, then the contact lines with small icons',
  contactsColumns: 'two columns: identity left, contacts right, a rule between',
  centered: 'everything centred, calm',
  accentBar: 'a vertical brand bar on the edge, contacts aligned beside it',
  logoOnly: 'a full brand face: the logo on the brand colour',
};

/** Paramètres bornés (cran Max) : rôle de couleur de la face de marque, alignement, filet, taille du nom. */
export interface CardTuning {
  surface?: 'primary' | 'secondary' | 'accent';
  align?: 'left' | 'center';
  rule?: 'none' | 'thin' | 'bold';
  nameScale?: number;
}

export interface CardLayoutInput {
  width: number;
  height: number;
  brandName: string;
  palette: { primary: string; secondary: string; accent?: string; background?: string; text?: string };
  logos: { onLight?: string; onDark?: string; iconLight?: string; iconDark?: string };
  tuning?: CardTuning;
}

const HEX = /^#[0-9a-f]{6}$/i;
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const isDark = (hex: string) => contrastRatio('#ffffff', hex) > contrastRatio('#111111', hex);

const ICONS: Record<string, string> = {
  email: '<path d="M4 6h16v12H4z"/><path d="m4 7 8 6 8-6"/>',
  phone: '<path d="M6.5 3h3l1.5 4-2 1.2a11 11 0 0 0 5.8 5.8L16 12l4 1.5v3A2.5 2.5 0 0 1 17.5 19 14.5 14.5 0 0 1 4 5.5 2.5 2.5 0 0 1 6.5 3z"/>',
  mobile: '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18h2"/>',
  website: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  address: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  linkedin: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 10v7M8 7v.01M12 17v-4a2 2 0 0 1 4 0v4M12 10v7"/>',
};
const CONTACTS = ['phone', 'mobile', 'email', 'website', 'address', 'linkedin'] as const;

function brandColor(input: CardLayoutInput): string {
  const role = input.tuning?.surface || 'primary';
  const c = input.palette[role];
  return c && HEX.test(c) ? c : input.palette.primary;
}
const paperOf = (input: CardLayoutInput) => (input.palette.background && HEX.test(input.palette.background) ? input.palette.background : '#ffffff');
function accentOn(bg: string, input: CardLayoutInput): string {
  return [input.palette.accent, input.palette.primary, input.palette.secondary].find((c) => !!c && HEX.test(c) && contrastRatio(c, bg) >= 3) || textOn(bg, input.palette);
}

function logo(input: CardLayoutInput, bg: string, heightMm: number, icon = false): string {
  const dark = isDark(bg);
  const src = icon ? (dark ? input.logos.iconDark : input.logos.iconLight) || (dark ? input.logos.onDark : input.logos.onLight) : dark ? input.logos.onDark || input.logos.onLight : input.logos.onLight || input.logos.onDark;
  if (!src) {
    // Sans fichier de logo : un monogramme quand on attend un symbole, sinon le nom (borné à sa place).
    const text = icon
      ? input.brandName
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((w) => w[0].toUpperCase())
          .join('')
      : input.brandName;
    const size = icon ? heightMm * 2.4 : Math.min(heightMm * 2.2, (input.width * 0.55 * 2.83) / Math.max(4, text.length * 0.6));
    return `<p class="font-primary" style="margin:0;font-size:${size.toFixed(1)}pt;line-height:1;font-weight:800;letter-spacing:0.02em;color:${textOn(bg, input.palette)}">${esc(text)}</p>`;
  }
  return `<img src="${esc(src)}" alt="${esc(input.brandName)}" style="height:${heightMm}mm;width:auto;max-width:60%;object-fit:contain;display:block" />`;
}

function identity(input: CardLayoutInput, bg: string, align: 'left' | 'center' = input.tuning?.align || 'left'): string {
  const ink = textOn(bg, input.palette);
  const scale = Math.min(1.2, Math.max(0.9, input.tuning?.nameScale || 1));
  return [
    `<div style="text-align:${align}">`,
    `<p data-field="fullName" class="font-primary" style="margin:0;font-size:${(11.5 * scale).toFixed(1)}pt;line-height:1.1;font-weight:700;color:${ink}">{{fullName}}</p>`,
    `<p data-field="jobTitle" class="font-secondary" style="margin:0.8mm 0 0;font-size:7.5pt;line-height:1.2;letter-spacing:0.04em;color:${ink};opacity:0.85">{{jobTitle}}</p>`,
    `</div>`,
  ].join('');
}

function contacts(input: CardLayoutInput, bg: string, align: 'left' | 'center' = 'left'): string {
  const ink = textOn(bg, input.palette);
  const accent = accentOn(bg, input);
  return [
    `<div style="display:flex;flex-direction:column;gap:1.1mm;align-items:${align === 'center' ? 'center' : 'flex-start'}">`,
    ...CONTACTS.map(
      (f) =>
        `<p data-field="${f}" class="font-secondary" style="margin:0;display:flex;align-items:center;gap:1.6mm;font-size:7pt;line-height:1.25;color:${ink}"><svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="${accent}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex:none">${ICONS[f]}</svg><span>{{${f}}}</span></p>`
    ),
    `</div>`,
  ].join('');
}

function rule(input: CardLayoutInput, bg: string, widthMm = 10): string {
  const kind = input.tuning?.rule || 'thin';
  if (kind === 'none') return '';
  return `<div style="width:${widthMm}mm;height:${kind === 'bold' ? 1.2 : 0.45}mm;background:${accentOn(bg, input)};margin:2.2mm 0"></div>`;
}

const face = (input: CardLayoutInput, bg: string, body: string) =>
  `<div class="w-[${input.width}mm] h-[${input.height}mm] overflow-hidden relative" style="background:${bg};position:relative">${body}</div>`;
const SAFE = 4.5;

export function renderCardFront(id: CardFrontId, input: CardLayoutInput): string {
  const brand = brandColor(input);
  const paper = paperOf(input);
  const short = Math.min(input.width, input.height);
  switch (id) {
    case 'logoCenter':
      return face(input, brand, `<div style="position:absolute;inset:${SAFE}mm;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2mm">${logo(input, brand, short * 0.3)}<p data-field="tagline" class="font-secondary" style="margin:0;font-size:7pt;letter-spacing:0.12em;text-transform:uppercase;color:${textOn(brand, input.palette)};opacity:0.9">{{tagline}}</p></div>`);
    case 'patternField': {
      const line = isDark(brand) ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
      return face(input, brand, `<div style="position:absolute;inset:0;background:repeating-linear-gradient(135deg, ${line} 0 1.2mm, transparent 1.2mm 4mm)"></div><div style="position:absolute;inset:${SAFE}mm;display:flex;align-items:center;justify-content:center">${logo(input, brand, short * 0.28)}</div>`);
    }
    case 'monogram': {
      const initial = esc((input.brandName.trim()[0] || 'B').toUpperCase());
      return face(
        input,
        paper,
        `<div class="font-primary" aria-hidden="true" style="position:absolute;right:-${short * 0.08}mm;bottom:-${short * 0.32}mm;font-size:${(short * 2.6).toFixed(0)}pt;line-height:1;font-weight:900;color:${brand};opacity:0.14">${initial}</div>` +
          `<div style="position:absolute;left:${SAFE}mm;top:${SAFE}mm">${logo(input, paper, short * 0.16)}</div>` +
          `<div style="position:absolute;left:${SAFE}mm;bottom:${SAFE}mm;right:${input.width * 0.35}mm">${rule(input, paper)}${identity(input, paper)}</div>`
      );
    }
    case 'logoCornerName':
      return face(
        input,
        paper,
        `<div style="position:absolute;left:${SAFE}mm;top:${SAFE}mm">${logo(input, paper, short * 0.18)}</div>` +
          `<div style="position:absolute;left:${SAFE}mm;right:${SAFE}mm;bottom:${SAFE}mm">${rule(input, paper)}${identity(input, paper)}</div>`
      );
    case 'bandBottom': {
      const band = short * 0.22;
      return face(
        input,
        paper,
        // Le site vit DANS le bandeau : son contraste se lit sur la couleur qu'il recouvre.
        `<div style="position:absolute;left:0;right:0;bottom:0;height:${band}mm;background:${brand};display:flex;align-items:center;padding:0 ${SAFE}mm"><p data-field="website" class="font-secondary" style="margin:0;font-size:7pt;letter-spacing:0.06em;color:${textOn(brand, input.palette)}">{{website}}</p></div>` +
          `<div style="position:absolute;left:${SAFE}mm;top:${SAFE}mm">${logo(input, paper, short * 0.17)}</div>` +
          `<div style="position:absolute;left:${SAFE}mm;right:${SAFE}mm;bottom:${band + 3}mm">${identity(input, paper)}</div>`
      );
    }
    case 'splitColor':
    default: {
      const portrait = input.height > input.width;
      const split = portrait ? `left:0;right:0;top:0;height:36%` : `left:0;top:0;bottom:0;width:36%`;
      const textBox = portrait ? `left:${SAFE}mm;right:${SAFE}mm;top:calc(36% + 3mm);bottom:${SAFE}mm` : `left:calc(36% + 4mm);right:${SAFE}mm;top:${SAFE}mm;bottom:${SAFE}mm`;
      return face(
        input,
        paper,
        `<div style="position:absolute;${split};background:${brand};display:flex;align-items:center;justify-content:center;padding:${SAFE}mm">${logo(input, brand, short * 0.2, true)}</div>` +
          `<div style="position:absolute;${textBox};display:flex;flex-direction:column;justify-content:center;gap:2.4mm">${identity(input, paper)}${contacts(input, paper)}</div>`
      );
    }
  }
}

export function renderCardBack(id: CardBackId, input: CardLayoutInput): string {
  const brand = brandColor(input);
  const paper = paperOf(input);
  const short = Math.min(input.width, input.height);
  switch (id) {
    case 'contactsColumns': {
      const portrait = input.height > input.width;
      if (portrait) return renderCardBack('contactsList', input);
      return face(
        input,
        paper,
        `<div style="position:absolute;left:${SAFE}mm;top:${SAFE}mm;bottom:${SAFE}mm;width:42%;display:flex;flex-direction:column;justify-content:space-between">${identity(input, paper)}${logo(input, paper, short * 0.13, true)}</div>` +
          `<div style="position:absolute;left:50%;top:${SAFE + 2}mm;bottom:${SAFE + 2}mm;width:0.35mm;background:${accentOn(paper, input)}"></div>` +
          `<div style="position:absolute;left:calc(50% + 3.5mm);right:${SAFE}mm;top:${SAFE}mm;bottom:${SAFE}mm;display:flex;align-items:center">${contacts(input, paper)}</div>`
      );
    }
    case 'centered':
      return face(input, paper, `<div style="position:absolute;inset:${SAFE}mm;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2.5mm">${identity(input, paper, 'center')}${contacts(input, paper, 'center')}</div>`);
    case 'accentBar':
      return face(
        input,
        paper,
        `<div style="position:absolute;left:0;top:0;bottom:0;width:3mm;background:${brand}"></div>` +
          `<div style="position:absolute;left:${SAFE + 3}mm;right:${SAFE}mm;top:${SAFE}mm;bottom:${SAFE}mm;display:flex;flex-direction:column;justify-content:center;gap:2.4mm">${identity(input, paper)}${contacts(input, paper)}</div>`
      );
    case 'logoOnly':
      return face(input, brand, `<div style="position:absolute;inset:${SAFE}mm;display:flex;align-items:center;justify-content:center">${logo(input, brand, short * 0.3)}</div>`);
    case 'contactsList':
    default:
      return face(
        input,
        paper,
        `<div style="position:absolute;left:${SAFE}mm;right:${SAFE}mm;top:${SAFE}mm;bottom:${SAFE}mm;display:flex;flex-direction:column;justify-content:space-between">` +
          `<div>${identity(input, paper)}${rule(input, paper, 8)}</div>${contacts(input, paper)}</div>` +
          `<div style="position:absolute;right:${SAFE}mm;top:${SAFE}mm">${logo(input, paper, short * 0.12, true)}</div>`
      );
  }
}

/** Le choix du code : structure, recto et verso, variés par la graine dans la structure. */
export function pickCardLayout(seed: number, structure?: CardStructure): { structure: CardStructure; front: CardFrontId; back: CardBackId } {
  const structures = Object.keys(CARD_STRUCTURES) as CardStructure[];
  const st = structure || structures[Math.abs(seed) % structures.length];
  const def = CARD_STRUCTURES[st];
  return { structure: st, front: def.fronts[Math.abs(seed >> 3) % def.fronts.length], back: def.backs[Math.abs(seed >> 7) % def.backs.length] };
}

/** Les champs que la mise en page affiche (le modèle de carte les déclare). */
export function cardFieldsOf(html: string): string[] {
  return [...new Set([...html.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)].map((m) => m[1]))];
}
