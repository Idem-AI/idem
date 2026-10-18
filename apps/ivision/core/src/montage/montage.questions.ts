/**
 * LES QUESTIONS D'UN MONTAGE — posées avant de monter, comme le ferait un assistant : quelques choix à
 * cliquer, un à la fois, le choix RECOMMANDÉ marqué d'après la vidéo (son cadre) et la demande.
 *
 *   - une question dont la demande donne déjà la réponse (« en carré », « sans musique ») n'est pas posée ;
 *   - chaque réponse change vraiment le montage (format, coupes, sous-titres, intro et fin, musique) ;
 *   - « Choisir pour moi » prend les choix recommandés : on ne bloque jamais quelqu'un qui ne sait pas.
 *
 * Tout est lu par le code (zéro jeton).
 */
import type { VideoFormat } from '../video/contracts/model';
import type { CaptionStyle, CutMode } from './montage.model';
import { asksForIntro } from './montage.planner';

export interface ChoiceOption {
  id: string;
  label: string;
  description?: string;
  recommended?: boolean;
}

export interface ChoiceQuestion {
  id: string;
  question: string;
  options: ChoiceOption[];
}

/** Ce que les réponses (et la demande) fixent pour le montage. */
export interface MontageChoices {
  format?: VideoFormat;
  cuts?: CutMode;
  captions?: CaptionStyle;
  /** Intro animée et carton de fin (`both`), carton de fin seul (`outro`), ni l'un ni l'autre (`none`). */
  finish?: 'both' | 'outro' | 'none';
  music?: boolean;
}

export interface MontageQuestionInput {
  request: string;
  /** Cadre de la vidéo où l'on parle (la première). */
  width: number;
  height: number;
  /** La marque a un nom ou un logo : un carton de fin a quelque chose à montrer. */
  branded: boolean;
  language: string;
}

const fold = (text: string) =>
  String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, ' ');

/** Les réglages que la demande écrit déjà : ces questions-là ne se posent pas. */
export function montageChoicesInText(request: string): MontageChoices {
  const t = fold(request);
  const out: MontageChoices = {};
  if (/\b16\s*[:/x×]\s*9\b|\b(paysage|horizontal\w*|landscape|youtube)\b/.test(t)) out.format = 'landscape';
  else if (/\b9\s*[:/x×]\s*16\b|\b(vertical\w*|stor(y|ies)|reels?|tiktok|shorts|statut)\b/.test(t)) out.format = 'story';
  else if (/\b4\s*[:/x×]\s*5\b|\bportrait\b/.test(t)) out.format = 'portrait';
  else if (/\b1\s*[:/x×]\s*1\b|\b(carre|square)\b/.test(t)) out.format = 'square';

  if (/\b(sans (rien )?couper|ne coupe rien|garde tout|no cuts?|keep everything)\b/.test(t)) out.cuts = 'none';
  else if (/\b(blancs?|silences?|hesitations?|euh|dead air|pauses?)\b/.test(t)) out.cuts = 'tight';

  if (/\b(sans|pas de|no|without)\s+(sous.?titres?|subtitles?|captions?)/.test(t)) out.captions = 'none';
  else if (/karaoke/.test(t)) out.captions = 'karaoke';
  else if (/sous.?titres? (sobres?|discrets?|simples?)|(sober|subtle|simple) (subtitles?|captions?)/.test(t)) out.captions = 'minimal';
  else if (/sous.?titres? (dynamiques?|gros|grands?|percutants?)|(bold|big|punchy) (subtitles?|captions?)/.test(t)) out.captions = 'pop';

  const noIntro = /(sans|pas d e?|no|without)\s*(d e?\s*)?(intro|ouverture|generique)/.test(t);
  const noOutro = /(sans|pas de|no|without)\s+(carton|fin animee|end card|outro)/.test(t);
  if (asksForIntro(request)) out.finish = noOutro ? undefined : 'both';
  else if (noIntro && noOutro) out.finish = 'none';

  if (/\b(sans|pas de|no|without)\s+(musique|music)\b/.test(t)) out.music = false;
  else if (/\b(avec|ajoute\w*|mets?|une)\s+(une\s+|de la\s+)?(musique|music)\b|\bwith music\b/.test(t)) out.music = true;
  return out;
}

const orientationOf = (width: number, height: number): VideoFormat => (height > width * 1.1 ? 'story' : width > height * 1.1 ? 'landscape' : 'square');

/** Les questions à poser (déjà réglées par la demande : absentes), chacune avec son choix recommandé. */
export function montageQuestions(input: MontageQuestionInput): ChoiceQuestion[] {
  const fr = !input.language || input.language.startsWith('fr');
  const L = (a: string, b: string) => (fr ? a : b);
  const known = montageChoicesInText(input.request);
  const frame = orientationOf(input.width, input.height);
  const questions: ChoiceQuestion[] = [];
  const mark = (options: ChoiceOption[], best: string) => options.map((o) => (o.id === best ? { ...o, recommended: true } : o));

  if (!known.format) {
    questions.push({
      id: 'format',
      question: L('Où allez-vous publier cette vidéo ?', 'Where will you post this video?'),
      options: mark(
        [
          { id: 'story', label: L('Statut, Reels, TikTok', 'Status, Reels, TikTok'), description: L('Vidéo verticale, plein écran sur téléphone.', 'Vertical video, full screen on phones.') },
          { id: 'square', label: L('Publication Facebook ou Instagram', 'Facebook or Instagram post'), description: L('Vidéo carrée, dans le fil d’actualité.', 'Square video, in the news feed.') },
          { id: 'landscape', label: L('YouTube, LinkedIn ou site', 'YouTube, LinkedIn or website'), description: L('Vidéo horizontale, comme à la télévision.', 'Horizontal video, like on TV.') },
        ],
        frame
      ),
    });
  }

  if (!known.cuts) {
    questions.push({
      id: 'cuts',
      question: L('Que faire des silences et des hésitations ?', 'What should I do with silences and hesitations?'),
      options: mark(
        [
          { id: 'tight', label: L('Les couper', 'Cut them'), description: L('Un rythme vif : les blancs et les « euh » disparaissent.', 'A brisk pace: gaps and “ums” are removed.') },
          { id: 'natural', label: L('Couper seulement les longs silences', 'Only cut long silences'), description: L('Votre façon de parler est gardée.', 'Your way of speaking is kept.') },
          { id: 'none', label: L('Ne rien couper', 'Keep everything'), description: L('La vidéo reste entière.', 'The video stays whole.') },
        ],
        'tight'
      ),
    });
  }

  if (!known.captions) {
    const format = known.format || frame;
    questions.push({
      id: 'captions',
      question: L('Quels sous-titres voulez-vous ?', 'Which subtitles would you like?'),
      options: mark(
        [
          { id: 'pop', label: L('Gros mots animés', 'Big animated words'), description: L('Un ou deux mots à la fois, au rythme de la voix.', 'One or two words at a time, with the voice.') },
          { id: 'karaoke', label: L('La phrase entière', 'The full sentence'), description: L('Le mot prononcé s’allume dans la phrase.', 'The spoken word lights up in the sentence.') },
          { id: 'minimal', label: L('Sobres et discrets', 'Sober and discreet'), description: L('Petits, en bas de l’image.', 'Small, at the bottom of the frame.') },
          { id: 'none', label: L('Pas de sous-titres', 'No subtitles') },
        ],
        format === 'landscape' ? 'karaoke' : 'pop'
      ),
    });
  }

  if (!known.finish) {
    questions.push({
      id: 'finish',
      question: L('Comment commencer et finir la vidéo ?', 'How should the video start and end?'),
      options: mark(
        [
          { id: 'both', label: L('Une intro animée et un carton de fin', 'An animated intro and an end card'), description: L('Un titre animé avant que vous parliez, votre marque à la fin.', 'An animated title before you speak, your brand at the end.') },
          { id: 'outro', label: L('Seulement un carton de fin', 'Only an end card'), description: L('La vidéo commence directement sur vous.', 'The video starts right on you.') },
          { id: 'none', label: L('Ni l’un ni l’autre', 'Neither'), description: L('Juste votre vidéo.', 'Just your video.') },
        ],
        input.branded ? 'outro' : 'none'
      ),
    });
  }

  if (known.music === undefined) {
    questions.push({
      id: 'music',
      question: L('Ajouter une musique de fond ?', 'Add background music?'),
      options: mark(
        [
          { id: 'yes', label: L('Oui, une musique discrète', 'Yes, a soft music'), description: L('Sous votre voix, sans la couvrir.', 'Under your voice, never over it.') },
          { id: 'no', label: L('Non, juste ma voix', 'No, just my voice') },
        ],
        'yes'
      ),
    });
  }
  return questions;
}

const FORMATS: VideoFormat[] = ['story', 'square', 'portrait', 'landscape'];
const CUTS: CutMode[] = ['tight', 'natural', 'none'];
const CAPTIONS: CaptionStyle[] = ['pop', 'karaoke', 'minimal', 'none'];

/**
 * Les choix du montage : la demande d'abord, puis les réponses (seules les valeurs admises sont lues),
 * puis le choix recommandé des questions laissées sans réponse.
 */
export function montageChoices(request: string, answers: Record<string, string> = {}, questions: ChoiceQuestion[] = []): MontageChoices {
  const out: MontageChoices = { ...montageChoicesInText(request) };
  const pick = (id: string) => answers[id] || questions.find((q) => q.id === id)?.options.find((o) => o.recommended)?.id;
  const format = pick('format');
  if (!out.format && FORMATS.includes(format as VideoFormat)) out.format = format as VideoFormat;
  const cuts = pick('cuts');
  if (!out.cuts && CUTS.includes(cuts as CutMode)) out.cuts = cuts as CutMode;
  const captions = pick('captions');
  if (!out.captions && CAPTIONS.includes(captions as CaptionStyle)) out.captions = captions as CaptionStyle;
  const finish = pick('finish');
  if (!out.finish && (finish === 'both' || finish === 'outro' || finish === 'none')) out.finish = finish;
  const music = pick('music');
  if (out.music === undefined && (music === 'yes' || music === 'no')) out.music = music === 'yes';
  return out;
}
