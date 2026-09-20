/**
 * CONTRÔLE MESURÉ D'UN VISUEL RENDU — vérifier, puis réparer, sans modèle.
 *
 * ── POURQUOI CE MODULE EXISTE ───────────────────────────────────────────────
 *
 * Trois filets protégeaient déjà les visuels, et aucun ne voit une composition :
 *
 *  - le PROMPT demande une grille, une hiérarchie, des contrastes. Une consigne
 *    de prompt est suivie la plupart du temps — à l'échelle d'un module qui
 *    produit des dizaines de visuels par projet, « la plupart du temps » veut
 *    dire qu'il en reste ;
 *  - `slopLint` lit la CHAÎNE HTML. Il attrape une couleur hors charte ou une
 *    police écrite en dur. Il ne peut pas voir qu'un texte tombe hors cadre :
 *    `left-[62%]` n'est un défaut qu'une fois rendu, et pour un seul des cinq
 *    formats ;
 *  - le rendu mesurait déjà le LOGO (taille, contraste sur les pixels réels).
 *    C'est exactement la bonne méthode — elle ne s'appliquait qu'à lui.
 *
 * Ce module étend cette méthode à la composition entière. Tout ce qu'il affirme
 * est MESURÉ sur la page rendue : des rectangles, des tailles de police
 * calculées, des pixels. Rien n'est déduit du balisage, rien n'est demandé à un
 * modèle.
 *
 * ── CE QU'IL MESURE, ET CE QU'IL RÉPARE ─────────────────────────────────────
 *
 *  1. ZONE DE SÉCURITÉ — un texte à 12 px du bord est mangé par le recadrage
 *     d'un réseau ou le massicot de l'imprimeur. Réparé : on le ramène dans la
 *     marge.
 *  2. TEXTE ROGNÉ — la dernière ligne coupée par un conteneur trop bas, un
 *     titre qui sort du cadre. Réparé : la taille descend jusqu'à ce que le
 *     texte tienne.
 *  3. ALIGNEMENT — quatre blocs commençant à 137, 140, 144 et 136 px. Personne
 *     ne sait nommer ce défaut, tout le monde le voit. Réparé : recalage sur la
 *     colonne de la grille.
 *  4. HIÉRARCHIE — si tout a la même taille, l'œil ne sait pas où se poser, et
 *     c'est le tell d'amateur le plus immédiat. Mesuré sur les tailles rendues,
 *     réparé quand un sous-titre dispute sa place au titre.
 *  5. CONTRASTE RÉEL DU TEXTE — non pas la couleur du texte contre celle que le
 *     modèle croit avoir mise derrière, mais contre les PIXELS effectivement
 *     rendus dessous. Réparé : voile dégradé calculé pour atteindre le seuil,
 *     puis re-mesuré.
 *  6. FOND PERDU — le liseré blanc au bord, la faute d'impression classique.
 *  7. REMPLISSAGE ET DOSAGE — part de vide, nombre de blocs de texte, part de
 *     la couleur d'accent. Constatés et journalisés : les corriger
 *     demanderait de recomposer, ce qu'aucune règle déterministe ne sait faire
 *     sans abîmer le travail accepté.
 *
 * ── LA RÈGLE QUE CE MODULE S'IMPOSE ─────────────────────────────────────────
 *
 * Une réparation n'est appliquée que lorsqu'elle a UNE bonne réponse et que son
 * amplitude est bornée (12 px de recalage, 28 % de réduction de corps au plus).
 * Tout le reste est constaté. La graine prescrit des compositions délibérément
 * cassées — un titre qui déborde de 15 %, un élément tourné — et un contrôle
 * zélé les « corrigerait » vers la moyenne, c'est-à-dire exactement le rendu
 * générique que tout le dispositif cherche à éviter.
 */

import sharp from 'sharp';
import type { Page } from 'puppeteer';

import logger from '../../config/logger';
import { CompositionGrid, minDisplaySize, PHI } from './compositionGrid';

// ─────────────────────────────────────────────────────────────────────────────
// Seuils. Tous exprimés en part ou en pixels du cadre : aucun n'est arbitraire,
// chacun porte la raison pour laquelle il vaut ce qu'il vaut.
// ─────────────────────────────────────────────────────────────────────────────

/** Contraste WCAG AA du texte courant. */
const AA_NORMAL = 4.5;

/** Contraste AA du grand texte (≥ 24 px, ou 18,7 px gras). */
const AA_LARGE = 3;

/** Au-delà de cette taille, un texte est « grand » au sens WCAG. */
const LARGE_TEXT_PX = 24;

/**
 * Part des pixels de fond pouvant manquer le seuil sans que le texte cesse
 * d'être lisible. Un titre posé sur une photo touche presque toujours quelques
 * pixels défavorables ; c'est une plage continue qui le rend illisible.
 */
const CONTRAST_TOLERANCE = 0.1;

/** Amplitude maximale d'un recalage d'alignement, en px. */
const SNAP_LIMIT = 14;

/** Écart en deçà duquel deux bords appartiennent au même alignement voulu. */
const CLUSTER_TOLERANCE = 16;

/** Réduction maximale du corps d'un texte rogné. */
const MIN_SHRINK = 0.72;

/** Rapport minimal entre les deux plus grands niveaux typographiques. */
const MIN_HIERARCHY_RATIO = 1.4;

/** Part maximale du cadre couverte par du texte avant encombrement. */
const MAX_TEXT_COVERAGE = 0.55;

/** Nombre de blocs de texte au-delà duquel un visuel devient un document. */
const MAX_TEXT_BLOCKS = 16;

/** Part maximale de la couleur d'accent (cible 10 %, mesure grossière). */
const MAX_ACCENT_SHARE = 0.28;

/** Part de la surface visible qu'un texte d'affichage peut perdre hors cadre. */
const DISPLAY_BLEED_ALLOWANCE = 0.15;

/** Opacité en dessous de laquelle un texte est un ornement, pas un message. */
const DECORATIVE_OPACITY = 0.5;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type VisualSeverity = 'error' | 'warning' | 'info';

export interface VisualFinding {
  rule: string;
  severity: VisualSeverity;
  /** Constat, en français, destiné aux journaux et à l'explication produit. */
  message: string;
  count: number;
  /** Vrai quand le code a corrigé le défaut plutôt que de le signaler. */
  repaired: boolean;
}

export interface VisualAuditReport {
  findings: VisualFinding[];
  /** Règles effectivement corrigées. */
  repaired: string[];
  /** 0–100. 100 = aucun défaut mesuré. */
  score: number;
  /**
   * Vrai s'il subsiste un défaut qu'aucune règle déterministe ne sait corriger
   * et qui compromet le visuel (texte illisible, aucune hiérarchie, contenu
   * rogné). L'appelant décide alors : recomposer, alerter, ou livrer.
   */
  blocking: boolean;
}

export interface VisualAuditOptions {
  grid: CompositionGrid;
  /** Contexte pour les journaux (« visuel/square »). */
  label?: string;
  /** Couleurs de la charte, pour le dosage et la réparation du fond perdu. */
  palette?: { primary?: string; secondary?: string; accent?: string; background?: string; text?: string };
}

/** Un élément de texte, tel que MESURÉ dans la page rendue. */
interface MeasuredText {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  weight: number;
  opacity: number;
  /** Couleur calculée du texte, en sRGB. */
  color: [number, number, number];
  /** Nombre de caractères — sert à distinguer un titre d'une mention. */
  chars: number;
  /** L'élément porte une rotation : on ne le recale pas. */
  rotated: boolean;
  /** Fusion de calques ou remplissage transparent : le contraste n'y est pas mesurable. */
  unmeasurable: boolean;
  /** Hauteur du contenu vs hauteur de la boîte : au-delà, une ligne est coupée. */
  scrollHeight: number;
  clientHeight: number;
  scrollWidth: number;
  clientWidth: number;
  /**
   * L'élément coupe-t-il son propre contenu ?
   *
   * Sans cette distinction, tout titre à interlignage serré (`line-height: 1`,
   * que la graine PRESCRIT sous le nom CONDENSED_TOWER) est déclaré rogné : les
   * jambages de la dernière ligne dépassent la boîte de ligne d'une dizaine de
   * pixels, et `scrollHeight` les compte. Ce débordement-là ne coupe rien — il
   * déborde en peinture, ce qui est exactement l'effet recherché. Seul un
   * élément dont le débordement est masqué perd vraiment du texte.
   */
  clipsX: boolean;
  clipsY: boolean;
  isLogo: boolean;
}

interface MeasuredInventory {
  texts: MeasuredText[];
  /** Boîtes des images, pour le calcul de remplissage. */
  images: Array<{ x: number; y: number; width: number; height: number }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Colorimétrie. Dupliquée depuis `color.ts` parce qu'une partie tourne DANS le
// navigateur, où aucun module n'est chargé.
// ─────────────────────────────────────────────────────────────────────────────

function channelToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminance(r: number, g: number, b: number): number {
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b);
}

function contrast(a: number, b: number): number {
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  return (hi + 0.05) / (lo + 0.05);
}

function hexToRgbTuple(hex?: string): [number, number, number] | null {
  if (!hex) return null;
  const clean = hex.trim().replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  if (full.length !== 6 || !/^[0-9a-f]{6}$/i.test(full)) return null;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const part = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`;
}

/**
 * Opacité du voile nécessaire pour qu'un fond atteigne le contraste visé.
 *
 * On raisonne sur `u = L^(1/2,4)`, c'est-à-dire approximativement la valeur de
 * canal sRGB : la composition alpha est LINÉAIRE dans cet espace, tandis qu'elle
 * ne l'est pas du tout en luminance. Sans ce passage, un voile calculé « en
 * luminance » se retrouve deux fois trop clair ou trop opaque selon le côté.
 *
 * @returns l'opacité dans [0,1], ou null si le seuil est déjà atteint.
 */
function veilAlphaFor(textLum: number, backgroundLum: number, target: number, dark: boolean): number | null {
  if (contrast(textLum, backgroundLum) >= target) return null;
  // Luminance que le fond doit atteindre pour que le rapport passe.
  const wanted = dark
    ? (textLum + 0.05) / target - 0.05
    : (textLum + 0.05) * target - 0.05;
  if (!Number.isFinite(wanted) || wanted < 0 || wanted > 1) return 0.85;
  const u = Math.pow(Math.max(backgroundLum, 0), 1 / 2.4);
  const uTarget = Math.pow(Math.max(wanted, 0), 1 / 2.4);
  const alpha = dark ? (u <= 0 ? 0 : 1 - uTarget / u) : (1 - u <= 0 ? 1 : (uTarget - u) / (1 - u));
  if (!Number.isFinite(alpha)) return 0.85;
  // Marge : la mesure porte sur le pixel le plus défavorable, pas sur la moyenne.
  return Math.max(0.22, Math.min(0.85, alpha + 0.08));
}

/** Seuil de contraste applicable à ce texte (AA grand texte ou AA courant). */
function contrastTargetFor(text: MeasuredText): number {
  const large = text.fontSize >= LARGE_TEXT_PX * 1.34 || (text.fontSize >= LARGE_TEXT_PX && text.weight >= 700);
  return large ? AA_LARGE : AA_NORMAL;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mesures DANS la page.
//
// Toutes les fonctions injectées sont NON `async` et n'utilisent ni décomposition
// d'objet ni `for…of` sur autre chose qu'un tableau : compilées pour ES2016,
// elles référenceraient sinon des helpers (`__awaiter`, `__assign`) absents du
// contexte du navigateur, et l'évaluation échouerait en silence.
// ─────────────────────────────────────────────────────────────────────────────

/** Relève tous les textes rendus et leurs mesures. */
function collectInventory(): MeasuredInventory {
  const parseColor = (value: string): [number, number, number, number] => {
    const nums = (value || '').match(/[\d.]+/g);
    if (!nums || nums.length < 3) return [0, 0, 0, 1];
    return [
      parseFloat(nums[0]),
      parseFloat(nums[1]),
      parseFloat(nums[2]),
      nums.length > 3 ? parseFloat(nums[3]) : 1,
    ];
  };

  const texts: any[] = [];
  const images: any[] = [];
  const all = document.querySelectorAll('*');
  let id = 0;

  for (let i = 0; i < all.length; i++) {
    const el = all[i] as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (tag === 'img') {
      const r = el.getBoundingClientRect();
      if (r.width > 2 && r.height > 2) {
        images.push({ x: r.left, y: r.top, width: r.width, height: r.height });
      }
      continue;
    }
    if (tag === 'script' || tag === 'style' || tag === 'link') continue;

    // Seuls les éléments portant DIRECTEMENT du texte sont mesurés : sinon un
    // conteneur et son titre seraient comptés deux fois, et la boîte du
    // conteneur (souvent tout le cadre) fausserait chaque mesure.
    let own = '';
    for (let n = 0; n < el.childNodes.length; n++) {
      const node = el.childNodes[n];
      if (node.nodeType === 3) own += node.nodeValue || '';
    }
    if (!own.trim()) continue;

    const rect = el.getBoundingClientRect();
    if (rect.width < 3 || rect.height < 3) continue;

    const style = window.getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none') continue;

    const rgba = parseColor(style.color);
    const transform = style.transform || 'none';
    // matrix(a,b,c,d,e,f) : b ou c non nuls ⇒ rotation ou cisaillement.
    let rotated = false;
    if (transform !== 'none') {
      const m = transform.match(/matrix\(([^)]+)\)/);
      if (m) {
        const parts = m[1].split(',').map((p) => parseFloat(p));
        rotated = Math.abs(parts[1]) > 0.01 || Math.abs(parts[2]) > 0.01;
      } else if (/rotate|skew/.test(transform)) {
        rotated = true;
      }
    }

    const fill = (style as any).webkitTextFillColor || '';
    const unmeasurable =
      rgba[3] < 0.1 ||
      /transparent|rgba\(0, 0, 0, 0\)/.test(fill) ||
      (style.mixBlendMode && style.mixBlendMode !== 'normal') ||
      style.backgroundClip === 'text' ||
      (style as any).webkitBackgroundClip === 'text';

    el.setAttribute('data-idem-audit', String(id));
    texts.push({
      id,
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
      fontSize: parseFloat(style.fontSize) || 0,
      weight: parseInt(style.fontWeight, 10) || 400,
      opacity: parseFloat(style.opacity || '1'),
      color: [rgba[0], rgba[1], rgba[2]],
      chars: own.trim().length,
      rotated,
      unmeasurable: !!unmeasurable,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      clipsX: style.overflowX !== 'visible',
      clipsY: style.overflowY !== 'visible',
      isLogo: el.hasAttribute('data-idem-logo'),
    });
    id++;
  }

  return { texts: texts as MeasuredText[], images };
}

/** Déplace et/ou réduit des éléments déjà relevés. */
function applyTransforms(ops: Array<{ id: number; dx: number; dy: number; scale: number }>): number {
  let applied = 0;
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    const el = document.querySelector('[data-idem-audit="' + op.id + '"]') as HTMLElement | null;
    if (!el) continue;
    if (op.dx !== 0 || op.dy !== 0) {
      const current = el.style.transform || '';
      // Le translate est placé EN TÊTE : la boîte englobante se déplace alors
      // de (dx, dy) quelles que soient les transformations déjà présentes.
      el.style.transform = 'translate(' + op.dx + 'px,' + op.dy + 'px) ' + current;
    }
    if (op.scale !== 1) {
      const style = window.getComputedStyle(el);
      const size = parseFloat(style.fontSize) || 0;
      const lh = parseFloat(style.lineHeight);
      if (size > 0) {
        // L'interligne est reporté en valeur RELATIVE : exprimé en pixels par
        // Tailwind, il ne suivrait pas la réduction et le texte se chevaucherait.
        if (!isNaN(lh) && lh > 0) el.style.lineHeight = String(lh / size);
        el.style.fontSize = Math.round(size * op.scale) + 'px';
      }
    }
    applied++;
  }
  return applied;
}

/** Masque (ou réaffiche) les textes pour photographier le fond seul. */
function toggleTextVisibility(ids: number[], hidden: boolean): void {
  for (let i = 0; i < ids.length; i++) {
    const el = document.querySelector('[data-idem-audit="' + ids[i] + '"]') as HTMLElement | null;
    // Rétabli en RETIRANT la surcharge : forcer `visible` laisserait un style
    // en ligne dans le HTML persisté, et écraserait un masquage voulu.
    if (el) el.style.visibility = hidden ? 'hidden' : '';
  }
}

/**
 * Pose un voile derrière un texte.
 *
 * Inséré comme FRÈRE PRÉCÉDENT de l'élément : il partage son conteneur de
 * positionnement, et l'ordre du document le fait peindre dessous — sans qu'il
 * faille inventer un z-index, qui se battrait avec ceux de la composition.
 *
 * Dégradé radial et non aplat : un rectangle opaque derrière un titre est le
 * défaut qu'on essaie d'éviter, un halo doux est ce que fait un graphiste.
 */
function insertVeils(specs: Array<{ id: number; alpha: number; dark: boolean; pad: number }>): number {
  let count = 0;
  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i];
    const el = document.querySelector('[data-idem-audit="' + spec.id + '"]') as HTMLElement | null;
    if (!el || !el.parentElement) continue;

    const existing = el.previousElementSibling as HTMLElement | null;
    const reuse = existing && existing.getAttribute('data-idem-veil') === String(spec.id);
    const veil = reuse ? (existing as HTMLElement) : document.createElement('div');

    const rect = el.getBoundingClientRect();
    const host = (el.offsetParent as HTMLElement) || document.body;
    const hostRect = host.getBoundingClientRect();
    const pad = spec.pad;
    const rgb = spec.dark ? '0,0,0' : '255,255,255';

    veil.setAttribute('data-idem-veil', String(spec.id));
    veil.setAttribute('aria-hidden', 'true');
    veil.style.position = 'absolute';
    veil.style.left = Math.round(rect.left - hostRect.left - pad) + 'px';
    veil.style.top = Math.round(rect.top - hostRect.top - pad) + 'px';
    veil.style.width = Math.round(rect.width + pad * 2) + 'px';
    veil.style.height = Math.round(rect.height + pad * 2) + 'px';
    veil.style.pointerEvents = 'none';
    // Rectangle PLEIN, adouci par un flou, et non dégradé radial : une ellipse
    // inscrite dans la boîte du texte laisse ses quatre COINS à découvert, et
    // c'est exactement là que la mesure relevait encore du texte illisible. Le
    // flou donne le même fondu de bord tout en couvrant la boîte entière à
    // l'opacité calculée — c'est d'ailleurs le geste du graphiste : une plaque
    // douce sous le texte, pas une pastille.
    veil.style.background = 'rgba(' + rgb + ',' + spec.alpha + ')';
    veil.style.filter = 'blur(' + Math.round(spec.pad * 0.6) + 'px)';
    veil.style.borderRadius = Math.round(spec.pad * 0.5) + 'px';

    const z = window.getComputedStyle(el).zIndex;
    if (z && z !== 'auto') veil.style.zIndex = z;
    if (!reuse) el.parentElement.insertBefore(veil, el);
    count++;
  }
  return count;
}

/** Ferme un liseré blanc au bord du cadre. */
function closeBleed(hex: string): boolean {
  const root = document.body.firstElementChild as HTMLElement | null;
  if (!root) return false;
  // On ne touche ni au padding ni au raccourci `background` : le premier
  // déplacerait tous les enfants positionnés en absolu, le second effacerait
  // une image de fond. Fermer le liseré demande seulement une couleur dessous.
  root.style.borderRadius = '0';
  root.style.backgroundColor = hex;
  return true;
}

/** Retire les marqueurs de mesure et rend le balisage corrigé. */
function extractRepairedHtml(): string {
  const marked = document.querySelectorAll('[data-idem-audit]');
  for (let i = 0; i < marked.length; i++) marked[i].removeAttribute('data-idem-audit');
  const logos = document.querySelectorAll('[data-idem-logo]');
  for (let i = 0; i < logos.length; i++) logos[i].removeAttribute('data-idem-logo');
  return document.body.innerHTML;
}

// ─────────────────────────────────────────────────────────────────────────────
// Le contrôle
// ─────────────────────────────────────────────────────────────────────────────

class AuditRun {
  private readonly findings = new Map<string, VisualFinding>();

  constructor(
    private readonly page: Page,
    private readonly grid: CompositionGrid,
    private readonly palette: NonNullable<VisualAuditOptions['palette']> = {}
  ) {}

  private note(
    rule: string,
    severity: VisualSeverity,
    message: string,
    repaired: boolean,
    count = 1
  ): void {
    const existing = this.findings.get(rule);
    if (!existing) {
      this.findings.set(rule, { rule, severity, message, count, repaired });
      return;
    }
    existing.count += count;
    // Une même règle peut réparer un élément et échouer sur le suivant. C'est
    // alors l'ÉCHEC qui doit être rapporté : sinon un défaut bloquant
    // disparaîtrait derrière la correction réussie qui l'a précédé.
    const rank: Record<VisualSeverity, number> = { info: 0, warning: 1, error: 2 };
    const worse = rank[severity] > rank[existing.severity];
    if (worse || (existing.repaired && !repaired)) {
      existing.severity = worse ? severity : existing.severity;
      existing.message = message;
    }
    existing.repaired = existing.repaired && repaired;
  }

  /** Photographie le cadre entier et le rend en RGB brut. */
  private async grab(): Promise<{ data: Buffer; width: number; height: number; scale: number }> {
    const shot = (await this.page.screenshot({
      type: 'png',
      clip: { x: 0, y: 0, width: this.grid.width, height: this.grid.height },
    })) as Buffer;
    const raw = await sharp(shot).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    return {
      data: raw.data as Buffer,
      width: raw.info.width,
      height: raw.info.height,
      scale: raw.info.width / this.grid.width,
    };
  }

  // ── 1. Zone de sécurité et rognage ────────────────────────────────────────

  /**
   * Ramène dans la marge ce qui doit être LU, constate le reste.
   *
   * Un texte d'affichage qui déborde n'est pas traité comme une faute : la
   * graine prescrit explicitement `TEXT_ESCAPES_BOUNDS` (« le titre déborde de
   * 5 à 15 % »). On lui applique donc la tolérance correspondante au lieu de
   * le recadrer et de détruire le parti pris.
   */
  private planSafeArea(texts: MeasuredText[]): Array<{ id: number; dx: number; dy: number; scale: number }> {
    const { safe, width, height, type } = this.grid;
    const limit = safe * 1.5;
    const ops: Array<{ id: number; dx: number; dy: number; scale: number }> = [];

    for (const text of texts) {
      const isDisplay = text.fontSize >= type.display * 0.78;
      const visible =
        (Math.min(text.x + text.width, width) - Math.max(text.x, 0)) *
        (Math.min(text.y + text.height, height) - Math.max(text.y, 0));
      const area = text.width * text.height;
      const visibleRatio = area > 0 ? Math.max(0, visible) / area : 1;

      if (isDisplay) {
        if (visibleRatio < 1 - DISPLAY_BLEED_ALLOWANCE) {
          this.note(
            'texte-hors-cadre',
            'error',
            `Un titre perd ${Math.round((1 - visibleRatio) * 100)} % de sa surface hors du cadre — au-delà du débordement délibéré de 15 %.`,
            false
          );
        }
        continue;
      }

      let dx = 0;
      let dy = 0;
      if (text.x < safe) dx = safe - text.x;
      else if (text.x + text.width > width - safe) dx = width - safe - (text.x + text.width);
      if (text.y < safe) dy = safe - text.y;
      else if (text.y + text.height > height - safe) dy = height - safe - (text.y + text.height);

      if (dx === 0 && dy === 0) continue;
      if (Math.abs(dx) > limit || Math.abs(dy) > limit) {
        this.note(
          'zone-de-securite',
          'error',
          `Un texte déborde de la zone de sécurité de plus de ${Math.round(limit)} px : le déplacer casserait la composition.`,
          false
        );
        continue;
      }
      ops.push({ id: text.id, dx: Math.round(dx), dy: Math.round(dy), scale: 1 });
      this.note(
        'zone-de-securite',
        'warning',
        `Texte trop près du bord ramené dans la marge de sécurité de ${safe} px.`,
        true
      );
    }
    return ops;
  }

  /**
   * Réduit le corps d'un texte dont la boîte coupe une ligne.
   *
   * La réduction visée est la RACINE du rapport de hauteur : réduire le corps
   * d'un facteur k raccourcit chaque ligne de k ET fait tenir 1/k caractères de
   * plus par ligne, donc la hauteur totale varie comme k². Mais le retour à la
   * ligne est DISCRET — on ne gagne jamais une demi-ligne —, si bien qu'une
   * seule application tombe presque toujours à côté. D'où l'itération, bornée
   * par `cumulative` : la réduction totale d'un texte ne descend jamais sous
   * `MIN_SHRINK`, au-delà duquel il faut raccourcir le texte, pas le rapetisser.
   */
  private planClipping(
    texts: MeasuredText[],
    cumulative: Map<number, number>
  ): Array<{ id: number; dx: number; dy: number; scale: number }> {
    const ops: Array<{ id: number; dx: number; dy: number; scale: number }> = [];
    for (const text of texts) {
      const overflowY = text.clipsY && text.clientHeight > 0 && text.scrollHeight > text.clientHeight + 4;
      const overflowX = text.clipsX && text.clientWidth > 0 && text.scrollWidth > text.clientWidth + 4;
      if (!overflowY && !overflowX) continue;

      const ratioY = overflowY ? text.clientHeight / text.scrollHeight : 1;
      const ratioX = overflowX ? text.clientWidth / text.scrollWidth : 1;
      const wanted = Math.min(Math.sqrt(ratioY), ratioX);
      if (wanted >= 0.995) continue;

      const already = cumulative.get(text.id) ?? 1;
      const total = Math.max(already * wanted, MIN_SHRINK);
      const step = total / already;
      if (step >= 0.995) continue;

      cumulative.set(text.id, total);
      ops.push({ id: text.id, dx: 0, dy: 0, scale: step });
    }
    return ops;
  }

  // ── 2. Alignement ─────────────────────────────────────────────────────────

  /**
   * Recale les bords presque alignés.
   *
   * Le critère est l'amplitude : un élément à 6 px d'un autre n'a pas été
   * décalé exprès, il a été posé à vue. Un élément franchement décalé, lui,
   * est un parti pris — et n'entre dans aucun groupe, donc n'est pas touché.
   */
  private planAlignment(texts: MeasuredText[]): Array<{ id: number; dx: number; dy: number; scale: number }> {
    const candidates = texts.filter((t) => !t.rotated && !t.isLogo);
    const ops = new Map<number, number>();

    const snapEdges = (edgeOf: (t: MeasuredText) => number) => {
      const sorted = candidates.slice().sort((a, b) => edgeOf(a) - edgeOf(b));
      let cluster: MeasuredText[] = [];

      const flush = () => {
        if (cluster.length < 2) return;
        const edges = cluster.map(edgeOf).sort((a, b) => a - b);
        const spread = edges[edges.length - 1] - edges[0];
        if (spread < 0.6) return;
        let target = edges[Math.floor(edges.length / 2)];
        // Tant qu'à recaler, autant recaler SUR la grille : une colonne proche
        // vaut mieux qu'une médiane arbitraire.
        const line = this.grid.columns.lines.reduce(
          (best, l) => (Math.abs(l - target) < Math.abs(best - target) ? l : best),
          this.grid.columns.lines[0]
        );
        if (Math.abs(line - target) <= 10) target = line;

        for (const member of cluster) {
          const dx = Math.round(target - edgeOf(member));
          if (dx === 0 || Math.abs(dx) > SNAP_LIMIT) continue;
          if (!ops.has(member.id)) ops.set(member.id, dx);
        }
      };

      for (const text of sorted) {
        if (!cluster.length || edgeOf(text) - edgeOf(cluster[cluster.length - 1]) <= CLUSTER_TOLERANCE) {
          cluster.push(text);
        } else {
          flush();
          cluster = [text];
        }
      }
      flush();
    };

    snapEdges((t) => t.x);
    const leftMoved = new Set(ops.keys());
    // Les blocs fers à droite n'ont pas de bord gauche commun : on rattrape
    // leur alignement sur le bord droit, sans défaire le recalage précédent.
    snapEdges((t) => (leftMoved.has(t.id) ? Number.NEGATIVE_INFINITY : t.x + t.width));

    const result: Array<{ id: number; dx: number; dy: number; scale: number }> = [];
    ops.forEach((dx, id) => {
      if (dx !== 0) result.push({ id, dx, dy: 0, scale: 1 });
    });
    if (result.length) {
      this.note(
        'alignement',
        'warning',
        `${result.length} bloc(s) presque alignés recalés sur la grille (≤ ${SNAP_LIMIT} px).`,
        true,
        result.length
      );
    }
    return result;
  }

  // ── 3. Hiérarchie ─────────────────────────────────────────────────────────

  /**
   * Vérifie qu'un regard sait où se poser.
   *
   * Trois niveaux au minimum, et un écart franc entre les deux premiers. Le
   * seul cas réparable est celui du sous-titre qui dispute sa place au titre :
   * il est court, il est presque aussi gros, et le ramener à `titre / φ` rend
   * la hiérarchie sans toucher à la mise en page.
   */
  private planHierarchy(texts: MeasuredText[]): Array<{ id: number; dx: number; dy: number; scale: number }> {
    const visible = texts.filter((t) => t.opacity >= DECORATIVE_OPACITY && t.chars > 1);
    if (visible.length < 2) return [];

    const sorted = visible.slice().sort((a, b) => b.fontSize - a.fontSize);
    const levels: number[] = [];
    for (const text of sorted) {
      if (!levels.length || text.fontSize < levels[levels.length - 1] * 0.96) levels.push(text.fontSize);
    }

    const biggest = sorted[0];
    const floor = minDisplaySize(this.grid);
    if (biggest.fontSize < floor * 0.75) {
      this.note(
        'hierarchie-plate',
        'error',
        `Le plus grand texte mesure ${Math.round(biggest.fontSize)} px là où ce format en appelle ${floor} : rien ne se lit à deux mètres.`,
        false
      );
    } else if (biggest.fontSize < floor) {
      this.note(
        'hierarchie-faible',
        'warning',
        `Le titre (${Math.round(biggest.fontSize)} px) reste sous la taille d'affichage attendue (${floor} px).`,
        false
      );
    }

    if (levels.length < 3 && visible.length >= 3) {
      this.note(
        'niveaux-insuffisants',
        'warning',
        `Seulement ${levels.length} niveau(x) typographique(s) pour ${visible.length} blocs de texte : l'œil n'est pas guidé.`,
        false
      );
    }

    // Le SECOND niveau, c'est le cran d'en dessous — ou, quand il n'y en a
    // aucun, la taille du titre lui-même : deux textes de même corps n'ont pas
    // « un rapport de 1 », ils n'ont pas de hiérarchie du tout. Sans ce repli,
    // le cas le plus flagrant (tout à la même taille) était le seul à passer
    // au travers, puisqu'il ne produit qu'un seul niveau.
    const second = levels.length >= 2 ? levels[1] : levels[0];
    const ratio = biggest.fontSize / second;
    if (ratio >= MIN_HIERARCHY_RATIO) return [];

    // Réparable seulement si le second niveau est clairement subordonné : un
    // texte aussi long que le titre est un second titre, et le réduire serait
    // un choix de composition, pas une correction.
    const rivals = sorted.filter(
      (t) => t.id !== biggest.id && t.fontSize >= second * 0.96 && t.chars < biggest.chars * 0.55
    );
    if (!rivals.length) {
      this.note(
        'hierarchie-plate',
        'warning',
        `Les deux plus grands textes ne diffèrent que de ${Math.round((ratio - 1) * 100)} % : ils se disputent le regard.`,
        false
      );
      return [];
    }

    const target = biggest.fontSize / PHI;
    const ops = rivals.map((t) => ({ id: t.id, dx: 0, dy: 0, scale: target / t.fontSize }));
    this.note(
      'hierarchie-plate',
      'warning',
      `${rivals.length} texte(s) au corps du titre ramenés à titre/φ pour rétablir la hiérarchie.`,
      true,
      rivals.length
    );
    return ops;
  }

  // ── 4. Contraste réel du texte ────────────────────────────────────────────

  /**
   * Mesure la lisibilité de chaque texte sur les pixels RÉELLEMENT rendus
   * dessous, puis pose un voile là où le seuil n'est pas atteint.
   *
   * La méthode est celle qui sert déjà au logo : photographier le fond SANS le
   * texte. C'est la seule façon d'avoir la vraie luminance — une photo, un
   * dégradé et un aplat produisent sous un même titre trois fonds différents,
   * et le modèle n'en connaît aucun au moment où il écrit sa couleur.
   *
   * On compte une FRACTION de pixels défaillants, pas une moyenne : sur une
   * photo contrastée, une moyenne flatteuse cache une moitié de titre effacée.
   */
  private async enforceTextContrast(texts: MeasuredText[]): Promise<void> {
    const measurable = texts.filter(
      (t) => !t.unmeasurable && !t.isLogo && t.opacity >= DECORATIVE_OPACITY && t.width > 8 && t.height > 6
    );
    if (!measurable.length) return;

    const ids = measurable.map((t) => t.id);
    let pending = measurable;

    // Deux passes au plus : la première pose le voile calculé, la seconde
    // rattrape les fonds trop chargés pour la formule (photo à fort écart-type).
    for (let pass = 0; pass < 2 && pending.length; pass++) {
      await this.page.evaluate(toggleTextVisibility, ids, true);
      const plate = await this.grab();
      await this.page.evaluate(toggleTextVisibility, ids, false);

      const failing: Array<{ text: MeasuredText; ratio: number; worst: number; dark: boolean }> = [];
      for (const text of pending) {
        const stats = this.sampleBackground(plate, text);
        if (!stats) continue;
        const textLum = luminance(text.color[0], text.color[1], text.color[2]);
        if (stats.failRatio <= CONTRAST_TOLERANCE) continue;
        failing.push({ text, ratio: stats.failRatio, worst: stats.worst, dark: textLum > 0.5 });
      }
      if (!failing.length) return;

      const veils: Array<{ id: number; alpha: number; dark: boolean; pad: number }> = [];
      for (const entry of failing) {
        const textLum = luminance(entry.text.color[0], entry.text.color[1], entry.text.color[2]);
        const target = contrastTargetFor(entry.text);
        const alpha = veilAlphaFor(textLum, entry.worst, target, entry.dark);
        if (alpha === null) continue;
        veils.push({
          id: entry.text.id,
          // Seconde passe : la formule a sous-estimé, on ferme davantage.
          alpha: Math.min(0.9, pass === 0 ? alpha : alpha + 0.18),
          dark: entry.dark,
          // Le flou vaut 0,6 × pad : ce rembourrage garantit que la boîte du
          // texte reste dans la zone d'opacité PLEINE du voile.
          pad: Math.max(10, Math.round(entry.text.fontSize * 0.7)),
        });
      }
      if (!veils.length) return;

      await this.page.evaluate(insertVeils, veils);
      this.note(
        'contraste-texte',
        'warning',
        `${veils.length} texte(s) illisibles sur le fond rendu : voile calculé pour atteindre le contraste AA.`,
        true,
        veils.length
      );
      pending = failing.map((f) => f.text);
    }

    // Ce qui résiste à deux voiles est un fond que rien de déterministe ne
    // sauvera : c'est un constat, et il est bloquant.
    if (pending.length) {
      this.note(
        'contraste-texte',
        'error',
        `${pending.length} texte(s) restent sous le seuil de lisibilité après voile.`,
        false,
        pending.length
      );
    }
  }

  /** Statistiques du fond sous un texte, sur la photographie du fond seul. */
  private sampleBackground(
    plate: { data: Buffer; width: number; height: number; scale: number },
    text: MeasuredText
  ): { failRatio: number; worst: number } | null {
    const target = contrastTargetFor(text);
    const textLum = luminance(text.color[0], text.color[1], text.color[2]);
    const s = plate.scale;
    const x0 = Math.max(0, Math.floor(text.x * s));
    const y0 = Math.max(0, Math.floor(text.y * s));
    const x1 = Math.min(plate.width, Math.ceil((text.x + text.width) * s));
    const y1 = Math.min(plate.height, Math.ceil((text.y + text.height) * s));
    if (x1 - x0 < 2 || y1 - y0 < 2) return null;

    // Un pas de deux pixels : la mesure porte sur des aplats et des photos, pas
    // sur du détail fin, et diviser par quatre le nombre d'échantillons rend le
    // contrôle gratuit à l'échelle d'un visuel 1080².
    const step = 2;
    let samples = 0;
    let fails = 0;
    let worst = textLum;
    let worstContrast = Infinity;

    for (let y = y0; y < y1; y += step) {
      for (let x = x0; x < x1; x += step) {
        const i = (y * plate.width + x) * 3;
        const lum = luminance(plate.data[i], plate.data[i + 1], plate.data[i + 2]);
        const ratio = contrast(textLum, lum);
        samples++;
        if (ratio < target) fails++;
        if (ratio < worstContrast) {
          worstContrast = ratio;
          worst = lum;
        }
      }
    }
    if (!samples) return null;
    return { failRatio: fails / samples, worst };
  }

  // ── 5. Fond perdu ─────────────────────────────────────────────────────────

  /**
   * Détecte le liseré blanc au bord.
   *
   * C'est la faute d'impression que les amateurs commettent systématiquement :
   * le fond s'arrête au bord du cadre au lieu de le dépasser, et il reste une
   * bordure blanche. On ne la corrige que si l'INTÉRIEUR n'est pas blanc
   * lui-même — un visuel à fond blanc assumé n'a pas de liseré, il a un fond.
   */
  private async enforceBleed(plate: { data: Buffer; width: number; height: number; scale: number }): Promise<boolean> {
    const ring = Math.max(2, Math.round(4 * plate.scale));
    const inset = Math.round(Math.min(plate.width, plate.height) * 0.06);

    const whiteShare = (x0: number, y0: number, x1: number, y1: number) => {
      let white = 0;
      let total = 0;
      for (let y = y0; y < y1; y += 2) {
        for (let x = x0; x < x1; x += 2) {
          const i = (y * plate.width + x) * 3;
          total++;
          if (plate.data[i] >= 250 && plate.data[i + 1] >= 250 && plate.data[i + 2] >= 250) white++;
        }
      }
      return total ? white / total : 0;
    };

    const edges =
      (whiteShare(0, 0, plate.width, ring) +
        whiteShare(0, plate.height - ring, plate.width, plate.height) +
        whiteShare(0, 0, ring, plate.height) +
        whiteShare(plate.width - ring, 0, plate.width, plate.height)) /
      4;
    const interior = whiteShare(inset, inset, plate.width - inset, plate.height - inset);
    if (edges < 0.9 || interior > 0.5) return false;

    // Couleur qui ferme le liseré : la dominante mesurée juste à l'intérieur,
    // et non la couleur de charte — c'est elle qui rend la bordure invisible.
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    const band = inset * 2;
    for (let y = inset; y < Math.min(plate.height - inset, inset + band); y += 2) {
      for (let x = inset; x < plate.width - inset; x += 2) {
        const i = (y * plate.width + x) * 3;
        r += plate.data[i];
        g += plate.data[i + 1];
        b += plate.data[i + 2];
        n++;
      }
    }
    const hex = n ? rgbToHex(r / n, g / n, b / n) : this.palette.background || '#ffffff';
    await this.page.evaluate(closeBleed, hex);
    this.note(
      'fond-perdu',
      'warning',
      `Liseré blanc au bord du visuel : fond étendu jusqu'aux bords (${hex}).`,
      true
    );
    return true;
  }

  // ── 6. Remplissage, densité et dosage des couleurs ────────────────────────

  /**
   * Constate ce qui relève de la composition, sans y toucher.
   *
   * Supprimer un bloc de texte ou redistribuer une couleur est une décision de
   * conception : une règle déterministe qui s'y risquerait abîmerait le visuel
   * plus sûrement que le défaut qu'elle corrige.
   */
  private reportDensity(inventory: MeasuredInventory): void {
    const { width, height } = this.grid;
    const cols = 64;
    const rows = 64;
    const cells = new Uint8Array(cols * rows);
    const mark = (box: { x: number; y: number; width: number; height: number }) => {
      const cx0 = Math.max(0, Math.floor((box.x / width) * cols));
      const cy0 = Math.max(0, Math.floor((box.y / height) * rows));
      const cx1 = Math.min(cols - 1, Math.ceil(((box.x + box.width) / width) * cols) - 1);
      const cy1 = Math.min(rows - 1, Math.ceil(((box.y + box.height) / height) * rows) - 1);
      for (let y = cy0; y <= cy1; y++) for (let x = cx0; x <= cx1; x++) cells[y * cols + x] = 1;
    };
    inventory.texts.forEach(mark);

    let filled = 0;
    for (let i = 0; i < cells.length; i++) filled += cells[i];
    const coverage = filled / cells.length;

    if (coverage > MAX_TEXT_COVERAGE) {
      this.note(
        'encombrement',
        'warning',
        `Le texte couvre ${Math.round(coverage * 100)} % du cadre : au-delà de ${Math.round(
          MAX_TEXT_COVERAGE * 100
        )} %, le visuel ne respire plus.`,
        false
      );
    }
    if (inventory.texts.length > MAX_TEXT_BLOCKS) {
      this.note(
        'trop-de-blocs',
        'warning',
        `${inventory.texts.length} blocs de texte : un visuel porte une idée, pas une page.`,
        false
      );
    }
    if (inventory.texts.length === 0) {
      this.note('visuel-muet', 'error', `Aucun texte rendu dans le visuel.`, false);
    }

    // Point focal : le plus grand texte doit tomber près d'une intersection des
    // tiers, pas au centre géométrique ni dans un coin perdu.
    const biggest = inventory.texts.slice().sort((a, b) => b.fontSize - a.fontSize)[0];
    if (biggest) {
      const cx = biggest.x + biggest.width / 2;
      const cy = biggest.y + biggest.height / 2;
      const diagonal = Math.sqrt(width * width + height * height);
      const nearest = this.grid.powerPoints.reduce(
        (best, p) => Math.min(best, Math.hypot(p.x - cx, p.y - cy)),
        Infinity
      );
      if (nearest / diagonal > 0.25) {
        this.note(
          'point-focal',
          'info',
          `Le titre tombe à ${Math.round((nearest / diagonal) * 100)} % de diagonale de toute intersection des tiers.`,
          false
        );
      }
    }
  }

  /** Part de la couleur d'accent dans l'image finale. */
  private async reportColorBudget(): Promise<void> {
    const accent = hexToRgbTuple(this.palette.accent);
    if (!accent) return;
    const allowed: Array<[number, number, number]> = [];
    const push = (hex?: string) => {
      const rgb = hexToRgbTuple(hex);
      if (rgb) allowed.push(rgb);
    };
    push(this.palette.primary);
    push(this.palette.secondary);
    push(this.palette.background);
    push(this.palette.text);
    allowed.push([0, 0, 0]);
    allowed.push([255, 255, 255]);
    const accentIndex = allowed.push(accent) - 1;

    const shot = (await this.page.screenshot({
      type: 'png',
      clip: { x: 0, y: 0, width: this.grid.width, height: this.grid.height },
    })) as Buffer;
    const small = await sharp(shot).resize(48, 48, { fit: 'fill' }).removeAlpha().raw().toBuffer();

    let accentPixels = 0;
    const total = small.length / 3;
    for (let i = 0; i < small.length; i += 3) {
      let best = 0;
      let bestDistance = Infinity;
      for (let c = 0; c < allowed.length; c++) {
        const d =
          Math.pow(small[i] - allowed[c][0], 2) +
          Math.pow(small[i + 1] - allowed[c][1], 2) +
          Math.pow(small[i + 2] - allowed[c][2], 2);
        if (d < bestDistance) {
          bestDistance = d;
          best = c;
        }
      }
      if (best === accentIndex) accentPixels++;
    }
    const share = total ? accentPixels / total : 0;
    if (share > MAX_ACCENT_SHARE) {
      this.note(
        'dosage-60-30-10',
        'info',
        `La couleur d'accent couvre ${Math.round(share * 100)} % du visuel (cible 10 %) : elle cesse d'être un point d'entrée.`,
        false
      );
    }
  }

  // ── Orchestration ─────────────────────────────────────────────────────────

  async run(): Promise<VisualAuditReport> {
    let inventory = (await this.page.evaluate(collectInventory)) as MeasuredInventory;

    // Ordre imposé par les dépendances : réduire un texte change sa boîte, donc
    // la marge de sécurité ; déplacer un bloc change son alignement. On mesure
    // donc à nouveau entre les deux familles de corrections.
    const shrunk = new Map<number, number>();
    let shrinkPasses = 0;
    for (let pass = 0; pass < 3; pass++) {
      const clipping = this.planClipping(inventory.texts, shrunk);
      if (!clipping.length) break;
      await this.page.evaluate(applyTransforms, clipping);
      inventory = (await this.page.evaluate(collectInventory)) as MeasuredInventory;
      shrinkPasses++;
    }
    if (shrunk.size) {
      // Le constat porte sur l'état FINAL : ce qui déborde encore après trois
      // passes n'est pas un corps trop grand, c'est un texte trop long.
      const stillClipped = inventory.texts.filter(
        (t) =>
          (t.clipsY && t.clientHeight > 0 && t.scrollHeight > t.clientHeight + 4) ||
          (t.clipsX && t.clientWidth > 0 && t.scrollWidth > t.clientWidth + 4)
      );
      if (stillClipped.length) {
        this.note(
          'texte-rogne',
          'error',
          `${stillClipped.length} texte(s) débordent encore de leur boîte après réduction : il faut les raccourcir, pas les rapetisser.`,
          false,
          stillClipped.length
        );
      } else {
        this.note(
          'texte-rogne',
          'warning',
          `${shrunk.size} texte(s) coupés par leur boîte : corps réduit en ${shrinkPasses} passe(s).`,
          true,
          shrunk.size
        );
      }
    }

    const second = inventory;
    const safeOps = this.planSafeArea(second.texts);
    const alignOps = this.planAlignment(second.texts);
    // Le recalage d'alignement ne doit pas défaire la mise en sécurité : quand
    // les deux visent le même bloc, la marge l'emporte.
    const safeIds = new Set(safeOps.map((op) => op.id));
    const merged = safeOps.concat(alignOps.filter((op) => !safeIds.has(op.id)));
    if (merged.length) await this.page.evaluate(applyTransforms, merged);

    const third = merged.length
      ? ((await this.page.evaluate(collectInventory)) as MeasuredInventory)
      : second;
    const hierarchyOps = this.planHierarchy(third.texts);
    if (hierarchyOps.length) await this.page.evaluate(applyTransforms, hierarchyOps);

    const final = hierarchyOps.length
      ? ((await this.page.evaluate(collectInventory)) as MeasuredInventory)
      : third;

    await this.enforceTextContrast(final.texts);
    await this.enforceBleed(await this.grab());
    this.reportDensity(final);
    await this.reportColorBudget();

    const findings = Array.from(this.findings.values());
    const weight: Record<VisualSeverity, number> = { error: 14, warning: 5, info: 2 };
    const score = Math.max(
      0,
      100 -
        findings.reduce(
          (sum, f) => sum + (f.repaired ? Math.round(weight[f.severity] / 3) : weight[f.severity]),
          0
        )
    );

    return {
      findings,
      repaired: findings.filter((f) => f.repaired).map((f) => f.rule),
      score,
      blocking: findings.some((f) => f.severity === 'error' && !f.repaired),
    };
  }
}

/**
 * Contrôle et répare un visuel RENDU, puis rend le balisage corrigé.
 *
 * À appeler sur la page montée, après les passes de logo et AVANT la
 * photographie finale : toutes les corrections sont appliquées au DOM, donc
 * présentes dans le PNG livré.
 *
 * @returns le rapport et le HTML corrigé — ce dernier a vocation à remplacer
 *          celui qu'on a persisté, faute de quoi l'éditeur WYSIWYG montrerait
 *          une version que l'utilisateur n'a jamais vue.
 */
export async function auditAndRepairVisual(
  page: Page,
  options: VisualAuditOptions
): Promise<{ report: VisualAuditReport; html: string | null }> {
  try {
    const run = new AuditRun(page, options.grid, options.palette);
    const report = await run.run();
    const html = (await page.evaluate(extractRepairedHtml)) as string;

    const label = options.label || 'visuel';
    if (report.findings.length) {
      const detail = report.findings.map((f) => `${f.rule}${f.repaired ? '✔' : '✗'}×${f.count}`);
      const log = report.blocking ? logger.warn : logger.info;
      log(`[VisualAudit] ${label}: score ${report.score}/100`, {
        repaired: report.repaired,
        findings: detail,
      });
      for (const finding of report.findings.filter((f) => !f.repaired && f.severity === 'error')) {
        logger.warn(`[VisualAudit] ${label}: ${finding.message}`);
      }
    } else {
      logger.info(`[VisualAudit] ${label}: composition conforme (100/100)`);
    }
    return { report, html: html && html.trim().length > 0 ? html : null };
  } catch (err: any) {
    // Un contrôle raté ne doit jamais emporter le visuel : on livre ce qui a
    // été composé, exactement comme pour les passes de logo.
    logger.warn('[VisualAudit] contrôle impossible', { error: err?.message });
    return {
      report: { findings: [], repaired: [], score: 100, blocking: false },
      html: null,
    };
  }
}
