/**
 * LE FORMAT D'ÉCHANGE DU DIRECTEUR ET DU PLANIFICATEUR — des blocs `clé: valeur`, pas du JSON.
 *
 * Un petit modèle oublie une virgule et tout un JSON est perdu ; ici, une ligne ratée ne coûte que
 * cette ligne. Le lecteur tolère puces, gras, majuscules, accents, numérotation et préambule.
 *
 *   TITLE: …
 *   CONCEPT: …
 *   BIBLE: … (peut tenir sur plusieurs lignes)
 *   SCENE 1 | 3.5
 *   purpose: …
 *   visual: …
 *   motion: …
 *   transition: …
 *   text.headline: …
 *   media: m1, m3
 *   new image: <ce qu'on voit, en anglais> | <requête 2-4 mots>
 *   new clip: <ce qu'on voit, en anglais> | <requête>
 *   voice: …
 */

export interface PlannedScene {
  /** Le numéro écrit par le modèle (« SCENE 6 ») : il sert à retrouver la scène d'un scénario quand une scène est sautée. */
  number?: number;
  duration?: number;
  purpose: string;
  visual: string;
  motion: string;
  transition?: string;
  texts: Record<string, string>;
  media: string[];
  needs: { kind: 'image' | 'video'; shot: string; query: string }[];
  voice?: string;
  /** Le rôle dans le récit (accroche, problème…) et l'énergie (1 → 5), écrits par le planificateur. */
  role?: string;
  energy?: number;
}

export interface PlannedFilm {
  title: string;
  concept: string;
  bible: string;
  scenes: PlannedScene[];
}

const clean = (v: string) =>
  v
    .trim()
    .replace(/^\*+|\*+$/g, '')
    .replace(/^["“«]\s*|\s*["”»]$/g, '')
    .trim();

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Une ligne de tête de scène : « SCENE 2 | 3.5 », « **Scène 2 — 3,5 s** », « ## Scene 2 (4s) ». */
const SCENE_HEAD = /^[\s#>*_-]*(?:scene|scène|shot|plan)\s*(\d{1,2})\b[^\d\n]*?(?:[|(—–:-]\s*)?(\d+(?:[.,]\d+)?)?\s*(?:s|sec|secondes?|seconds?)?\)?[\s*_]*$/i;
const FIELD = /^[\s>*_-]*(?:\d+[.)]\s*)?\**\s*([a-zA-Zéèàç][\w.éèàç -]{0,30}?)\s*\**\s*[:=]\s*(.*)$/;

export function parseFilmPlan(raw: string): PlannedFilm {
  const text = String(raw || '')
    .replace(/```[a-z]*\n?/gi, '')
    .replace(/\r\n?/g, '\n');
  const film: PlannedFilm = { title: '', concept: '', bible: '', scenes: [] };
  let current: PlannedScene | null = null;
  let open: 'concept' | 'bible' | null = null;
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const head = line.match(SCENE_HEAD);
    if (head) {
      current = { number: Number(head[1]), purpose: '', visual: '', motion: '', texts: {}, media: [], needs: [], ...(head[2] ? { duration: Number(head[2].replace(',', '.')) } : {}) };
      film.scenes.push(current);
      open = null;
      continue;
    }
    const field = line.match(FIELD);
    if (!field) {
      // Suite d'un paragraphe ouvert (concept, bible) sur plusieurs lignes.
      if (open && !current) film[open] = `${film[open]} ${clean(line)}`.trim();
      continue;
    }
    const key = fold(field[1]).replace(/\s+/g, ' ').trim();
    const value = clean(field[2]);
    if (!current) {
      if (key === 'title' || key === 'titre') film.title = value;
      else if (key === 'concept') (film.concept = value), (open = 'concept');
      else if (key === 'bible' || key === 'visual bible' || key === 'style') (film.bible = value), (open = 'bible');
      else if (open) film[open] = `${film[open]} ${key}: ${value}`.trim();
      continue;
    }
    open = null;
    if (key === 'purpose' || key === 'intention') current.purpose = value;
    else if (key === 'visual' || key === 'visuel' || key === 'image') current.visual = value;
    else if (key === 'motion' || key === 'mouvement' || key === 'animation') current.motion = value;
    else if (key === 'transition' || key === 'entrance' || key === 'entree') current.transition = value;
    else if (key === 'role' || key === 'beat' || key === 'temps') current.role = value.toLowerCase().slice(0, 30);
    else if (key === 'energy' || key === 'energie') {
      const n = Number(value.match(/\d/)?.[0]);
      if (n >= 1 && n <= 5) current.energy = n;
    }
    else if (key === 'duration' || key === 'duree') {
      const n = Number(value.replace(',', '.').match(/\d+(?:\.\d+)?/)?.[0]);
      if (n > 0) current.duration = n;
    } else if (key === 'voice' || key === 'voix' || key === 'voiceover' || key === 'voice-over') {
      if (value && !/^(none|aucune?|-|n\/a)$/i.test(value)) current.voice = value;
    } else if (key === 'media' || key === 'medias' || key === 'médias') {
      current.media = value
        .split(/[,\s]+/)
        .map((m) => m.trim().toLowerCase())
        .filter((m) => /^m\d{1,2}$/.test(m));
    } else if (/^new (image|photo|clip|video)$/.test(key)) {
      const [shot, query] = value.split('|').map((x) => x.trim());
      if (shot) current.needs.push({ kind: /clip|video/.test(key) ? 'video' : 'image', shot: shot.slice(0, 400), query: (query || shot.split(/\s+/).slice(0, 4).join(' ')).slice(0, 60) });
    } else if (key.startsWith('text.') || key.startsWith('texte.') || key.startsWith('text ')) {
      const name = key.replace(/^(text|texte)[. ]/, '').replace(/[^a-z0-9_]/g, '').slice(0, 24);
      if (name && value) current.texts[name] = value;
    }
  }
  return film;
}

/** Les clés de texte d'une scène, lisibles dans un prompt : « headline = "…" ». */
export function textsLine(texts: Record<string, string>): string {
  const entries = Object.entries(texts);
  return entries.length ? entries.map(([k, v]) => `${k} = ${JSON.stringify(v)}`).join(' · ') : '(no text on screen)';
}
