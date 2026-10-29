/**
 * LE DÉPARTAGE VISUEL — optionnel (cran Ultra, `VIDEO_VLM_TIEBREAK=off` pour le couper), jamais seul juge.
 *
 * Deux finalistes dont les scores calculés sont à moins de 0,03 l'un de l'autre : leurs vignettes sont posées côte à
 * côte et un modèle de vision répond à des questions FERMÉES (« A » ou « B »). Les juges généralistes ont un biais de
 * position (banc Code2Video de HeyGen : 75 % d'accord avec les humains) : chaque question est posée DEUX fois, l'ordre
 * des images inversé ; une voix ne compte que si elle survit à l'inversion. Sans avis net, le score calculé décide.
 */
import sharp from 'sharp';
import { coreHost } from '../../runtime/host';
import type { Candidate } from './sampler';

const QUESTIONS = [
  'Which panel has the clearer visual hierarchy (one obvious main element, then the rest)?',
  'In which panel is the text easier to read at a glance on a phone?',
  'Which panel looks more like a professionally designed brand film frame (deliberate composition, balance, white space)?',
];

async function sideBySide(left: Buffer, right: Buffer): Promise<Buffer> {
  const h = 540;
  const [l, r] = await Promise.all([left, right].map((b) => sharp(b).resize({ height: h }).jpeg({ quality: 82 }).toBuffer({ resolveWithObject: true })));
  const gap = 24;
  const label = (x: number, text: string) => ({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="90" height="60"><rect width="90" height="60" rx="10" fill="#111"/><text x="45" y="42" font-size="36" font-family="Arial" font-weight="700" fill="#fff" text-anchor="middle">${text}</text></svg>`), left: x + 12, top: 12 });
  return sharp({ create: { width: l.info.width + r.info.width + gap, height: h, channels: 3, background: '#ffffff' } })
    .composite([{ input: l.data, left: 0, top: 0 }, { input: r.data, left: l.info.width + gap, top: 0 }, label(0, 'A'), label(l.info.width + gap, 'B')])
    .jpeg({ quality: 85 })
    .toBuffer();
}

const answer = (raw: string): 'A' | 'B' | null => {
  const m = String(raw || '').trim().toUpperCase().match(/\b(A|B)\b/);
  return m ? (m[1] as 'A' | 'B') : null;
};

/** « a », « b » ou null : la préférence nette d'un modèle de vision, à l'épreuve de l'ordre. */
export async function vlmTieBreak(a: Candidate, b: Candidate): Promise<'a' | 'b' | null> {
  const analyze = coreHost().analyzeImage;
  if (!analyze || !a.thumbnail || !b.thumbnail || (process.env.VIDEO_VLM_TIEBREAK ?? 'on') === 'off') return null;
  const ab = (await sideBySide(a.thumbnail, b.thumbnail)).toString('base64');
  const ba = (await sideBySide(b.thumbnail, a.thumbnail)).toString('base64');
  let votes = 0;
  for (const q of QUESTIONS) {
    const instruction = `${q} Answer with exactly one letter: A or B.`;
    const [first, second] = await Promise.all([
      analyze(ab, 'image/jpeg', instruction, { purpose: 'video-tiebreak', temperature: 0, maxOutputTokens: 5 }).catch(() => ''),
      analyze(ba, 'image/jpeg', instruction, { purpose: 'video-tiebreak', temperature: 0, maxOutputTokens: 5 }).catch(() => ''),
    ]);
    const x = answer(first);
    const y = answer(second);
    // Dans le second tirage, l'image de `a` est à droite (B) : une préférence cohérente donne A puis B (ou B puis A).
    if (x === 'A' && y === 'B') votes++;
    else if (x === 'B' && y === 'A') votes--;
  }
  return votes >= 2 ? 'a' : votes <= -2 ? 'b' : null;
}
