/**
 * `npm run check:montage --workspace=@idem/ivision-core` — le montage d'une prise de parole, SANS IDEM.
 *
 *  1. Règles pures : lecture de la sortie de Whisper, coupes (blancs, hésitations, faux départ),
 *     temps de la vidéo montée, ancrage des textes du monteur (rien d'inventé), zones de l'écran.
 *  2. Chaîne réelle (Whisper local + ffmpeg + navigateur de rendu) sur une prise de parole :
 *     MONTAGE_SAMPLE=<fichier>, sinon une voix de synthèse macOS (`say`) sur une mire. La vidéo
 *     montée garde son et image de même durée ; le MP4 final a la durée attendue et du son.
 *
 * Les images clés du rendu sont écrites dans MONTAGE_OUT (défaut : dossier temporaire) pour être regardées.
 */
process.env.RENDER_ALLOWED_HOSTS = '127.0.0.1,localhost';
import { spawnSync } from 'child_process';
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import { composeMontageHtml } from '../src/montage/montage.composer';
import { cutVideo, editedDuration, keepRanges, mapTime, retimeWords } from '../src/montage/montage.cuts';
import type { MontageVideo, MontageWord } from '../src/montage/montage.model';
import { rulesPlan, validateElement, PlannerInput } from '../src/montage/montage.planner';
import { elementWindows } from '../src/montage/montage.timeline';
import { transcribe, transcriptionAvailable, wordsFromWhisperJson } from '../src/montage/montage.transcribe';
import { frameSpec } from '../src/video/video.composer';
import { closeRenderBrowser, probe, renderVideo } from '../src/video/video.renderer';
import { buildVideoTheme } from '../src/video/video.theme';

let failures = 0;
let passes = 0;
function check(label: string, ok: boolean, detail = '') {
  if (ok) passes++;
  else failures++;
  // eslint-disable-next-line no-console
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
}

const w = (text: string, start: number, end: number): MontageWord => ({ text, start, end });

function pureChecks(): void {
  // Whisper : jetons → mots, ponctuation collée, jetons spéciaux et annotations ignorés.
  const parsed = wordsFromWhisperJson({
    result: { language: 'fr' },
    transcription: [
      {
        tokens: [
          { text: '[_BEG_]', offsets: { from: 0, to: 0 } },
          { text: ' Bon', offsets: { from: 100, to: 300 }, p: 0.9 },
          { text: 'jour', offsets: { from: 300, to: 500 }, p: 0.8 },
          { text: ',', offsets: { from: 500, to: 520 } },
          { text: ' [Musique]', offsets: { from: 600, to: 900 } },
          { text: ' Awa', offsets: { from: 1000, to: 1400 }, t_dtw: 105 },
          { text: '[_TT_75]', offsets: { from: 1500, to: 1500 } },
        ],
      },
    ],
  });
  check('Whisper : « Bon|jour|, » → un mot, annotation et jetons spéciaux écartés', parsed.words.map((x) => x.text).join(' ') === 'Bonjour, Awa', parsed.words.map((x) => x.text).join(' | '));
  // Le défaut connu de whisper.cpp : quatre mots au même centième en début de segment.
  const collapsed = wordsFromWhisperJson({
    transcription: [{ offsets: { from: 16820, to: 18500 }, tokens: [' Nous', ' livrons', ' à', ' domicile', ' partout'].map((text, i) => ({ text, offsets: { from: i < 4 ? 16820 : 16990, to: i < 4 ? 16820 : 17460 } })) }],
  });
  check('Whisper sans DTW : des mots écrasés au même instant sont répartis', collapsed.words.every((x, i) => i === 0 || x.start > collapsed.words[i - 1].start + 0.02), collapsed.words.map((x) => x.start.toFixed(2)).join(' '));
  const aligned = wordsFromWhisperJson({
    transcription: [{ offsets: { from: 16820, to: 20740 }, tokens: [' Nous', ' livrons', ' à', ' domicile'].map((text, i) => ({ text, offsets: { from: 16820, to: 16820 }, t_dtw: [1698, 1722, 1748, 1768][i] })) }],
  });
  check('Whisper avec DTW : l’alignement fait foi (décalé de son avance)', Math.abs(aligned.words[1].start - 17.07) < 0.01 && aligned.words.every((x) => x.end <= x.start + 1.2), aligned.words.map((x) => `${x.start.toFixed(2)}-${x.end.toFixed(2)}`).join(' '));

  // Coupes : un faux départ (« je vais » repris), une hésitation, des blancs.
  const words = [w('Aujourd’hui', 0.5, 1.0), w('je', 1.0, 1.2), w('vais', 1.2, 1.5), w('Aujourd’hui', 3.0, 3.5), w('je', 3.5, 3.7), w('vais', 3.7, 4.0), w('présenter', 4.0, 4.6), w('euh', 6.0, 6.4), w('le', 8.0, 8.2), w('bissap.', 8.2, 8.8)];
  const { ranges, dropped } = keepRanges(words, 10, 'tight');
  check('Coupes : le faux départ (3 premiers mots) est retiré', [0, 1, 2].every((i) => dropped.has(i)) && !dropped.has(3), [...dropped].join(','));
  check('Coupes : l’hésitation « euh » est retirée', dropped.has(7));
  const d = editedDuration(ranges);
  check('Coupes : la vidéo montée est bien plus courte', d < 4, `${d.toFixed(2)} s sur 10`);
  check('Coupes : bornes sur la grille des images', ranges.every((r) => Math.abs(r.start * 30 - Math.round(r.start * 30)) < 1e-6 && Math.abs(r.at * 30 - Math.round(r.at * 30)) < 1e-6));
  const timed = retimeWords(words, ranges, dropped);
  check('Temps monté : les mots gardés se suivent sans trou de plus de 0,4 s', timed.filter(Boolean).every((t, i, all) => i === 0 || t!.start - all[i - 1]!.end < 0.4));
  check('Temps monté : un instant coupé n’existe plus', mapTime(ranges, 2.2) === null);
  const none = keepRanges(words, 10, 'none');
  check('Coupes « aucune » : la vidéo est intacte', none.ranges.length === 1 && Math.abs(editedDuration(none.ranges) - 10) < 0.05);

  // Le monteur : chaque texte affiché est ancré dans ce qui est dit.
  const input: PlannerInput = {
    words: [w('Je', 0, 0.2), w('suis', 0.2, 0.4), w('Awa', 0.4, 0.8), w('Diop.', 0.8, 1.2), w('Seulement', 2, 2.5), w('1000', 2.5, 3), w('francs', 3, 3.4), w('la', 3.4, 3.5), w('bouteille.', 3.5, 4), w('Appelez-nous', 5, 5.6), w('vite', 5.6, 6)],
    timed: [],
    durationSec: 7,
    prompt: 'Finir par notre WhatsApp 07 08 09 10',
    brandName: 'Saveurs',
    sheet: '',
    contacts: ['saveurs.ci'],
    language: 'fr',
    format: 'story',
    creativity: 'medium',
  };
  input.timed = input.words.map((x) => ({ start: x.start, end: x.end }));
  check('Monteur : un mot-clé non prononcé est refusé', validateElement({ type: 'keyword', from: 5, to: 6, text: 'GRATUIT' }, input) === null);
  check('Monteur : un mot-clé prononcé est accepté', validateElement({ type: 'keyword', from: 5, to: 6, text: '1000 francs' }, input) !== null);
  check('Monteur : un chiffre jamais dit est refusé', validateElement({ type: 'stat', from: 5, to: 6, value: '2000 F' }, input) === null);
  check('Monteur : un nom dit est accepté au bandeau', validateElement({ type: 'lowerThird', from: 2, to: 3, value: 'Awa Diop', label: 'Fondatrice' }, input) !== null);
  check('Monteur : un nom inventé est refusé', validateElement({ type: 'lowerThird', from: 2, to: 3, value: 'Fatou Sow' }, input) === null);
  const cta = validateElement({ type: 'cta', from: 9, to: 10, text: 'Appelez-nous', value: '07 08 09 10' }, input);
  check('Monteur : un contact écrit dans la demande est gardé', cta?.value === '07 08 09 10');
  const fake = validateElement({ type: 'cta', from: 9, to: 10, text: 'Appelez-nous', value: '01 02 03 04' }, input);
  check('Monteur : un contact inventé est retiré (l’appel reste)', !!fake && !fake.value);
  check('Monteur : un index hors transcription est refusé', validateElement({ type: 'zoom', from: 99 }, input) === null);

  // Zones : deux éléments du centre qui se chevauchent → un seul.
  const wins = elementWindows(
    [
      { id: 'a', type: 'keyword', from: 5, to: 6, text: '1000' },
      { id: 'b', type: 'stat', from: 6, to: 6, value: '1000' },
      { id: 'c', type: 'icon', from: 6, to: 6, icon: 'price' },
    ],
    input.timed,
    7
  );
  check('Zones : pas deux éléments au centre en même temps', wins.filter((x) => x.zone === 'center').length === 1 && wins.some((x) => x.id === 'c'), wins.map((x) => x.id).join(','));
}

/** Un serveur local qui sert les fichiers avec les requêtes partielles (la vidéo se positionne). */
function serve(dir: string): Promise<{ url: string; close: () => void }> {
  const server = http.createServer((req, res) => {
    const file = path.join(dir, path.basename(decodeURIComponent((req.url || '').split('?')[0])));
    if (!fs.existsSync(file)) {
      res.statusCode = 404;
      return res.end();
    }
    const size = fs.statSync(file).size;
    const type = file.endsWith('.webm') ? 'video/webm' : 'application/octet-stream';
    const range = /bytes=(\d*)-(\d*)/.exec(String(req.headers.range || ''));
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', type);
    if (range) {
      const start = range[1] ? Number(range[1]) : 0;
      const end = range[2] ? Math.min(size - 1, Number(range[2])) : size - 1;
      res.statusCode = 206;
      res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
      res.setHeader('Content-Length', String(end - start + 1));
      fs.createReadStream(file, { start, end }).pipe(res);
    } else {
      res.setHeader('Content-Length', String(size));
      fs.createReadStream(file).pipe(res);
    }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ url: `http://127.0.0.1:${(server.address() as any).port}`, close: () => server.close() })));
}

/** Chaque image du rendu est la bonne : une source dont la luminosité dit le numéro d'image, coupée puis rendue. */
async function frameAccuracyCheck(dir: string): Promise<void> {
  const src = path.join(dir, 'frames.mp4');
  const made = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', "nullsrc=s=1280x720:r=30:d=6,geq=lum='mod(N*8\\,256)':cb=128:cr=128", '-f', 'lavfi', '-i', 'sine=f=440:d=6', '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', src]);
  if (made.status !== 0) return void check('Rendu image par image : source de test', false, made.stderr.toString().slice(-200));
  const sub = path.join(dir, 'frames');
  const ranges = [{ start: 0, end: 2, at: 0 }, { start: 3, end: 5, at: 2 }];
  const cut = await cutVideo({ input: src, ranges, width: 1080, height: 1920, hasAudio: true, outDir: sub });
  const server = await serve(sub);
  try {
    const url = `${server.url}/${path.basename(cut.file)}`;
    const montage = { id: 'x', format: 'story', quality: 'hd', words: [], cuts: { mode: 'tight', ranges: [{ start: 0, end: 4, at: 0 }] }, captions: { style: 'none' }, elements: [], edit: { url, durationSec: 4 }, musicEnabled: false } as unknown as MontageVideo;
    const page = await composeMontageHtml({ montage, timed: [], theme: buildVideoTheme({} as any, 'X'), mode: 'render', videoUrl: url });
    const out = await renderVideo({ html: page.html, width: 1080, height: 1920, fps: 30, durationSec: 4, quality: 'hd', webgl: false });
    const lum = (file: string) => [...spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-vf', 'crop=200:200:440:860,scale=1:1,format=gray', '-f', 'rawvideo', '-']).stdout];
    // Les ruptures du motif (coupe, retour à zéro) tombent aux mêmes images partout.
    const drops = (a: number[]) => a.slice(1).map((v, i) => (v < a[i] - 2 ? i + 1 : -1)).filter((i) => i >= 0).join(',');
    const expected = [...Array(60).keys()].map((n) => (n * 8) % 256).concat([...Array(60).keys()].map((n) => ((n + 90) * 8) % 256));
    const r = drops(lum(out.file));
    const e = drops(lum(cut.file));
    check('Coupe : la vidéo montée enchaîne les bonnes images', e === drops(expected), `${e} (attendu ${drops(expected)})`);
    check('Rendu image par image : chaque image est la bonne', r === e, `${r}`);
  } finally {
    server.close();
  }
}

function sample(dir: string): string | null {
  if (process.env.MONTAGE_SAMPLE) return process.env.MONTAGE_SAMPLE;
  if (process.platform !== 'darwin') return null;
  const aiff = path.join(dir, 'speech.aiff');
  const text =
    "Bonjour, je m'appelle Awa Diop, fondatrice de Saveurs d'Abidjan. [[slnc 1500]] Aujourd'hui je vais... [[slnc 700]] Aujourd'hui je vais vous présenter notre nouveau jus de bissap. [[slnc 1200]] Il est cent pour cent naturel, sans sucre ajouté. [[slnc 1400]] Nous livrons à domicile partout à Abidjan, en moins de trente minutes. [[slnc 1300]] Trois raisons de l'adopter : le goût, la santé, et le prix, seulement 1000 francs la bouteille ! [[slnc 1000]] Commandez dès maintenant sur WhatsApp.";
  const voice = spawnSync('say', ['-v', 'Thomas', '-o', aiff, text]);
  if (voice.status !== 0) return null;
  const out = path.join(dir, 'talk.mp4');
  const ff = spawnSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=30', '-i', aiff, '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', out]);
  return ff.status === 0 ? out : null;
}

async function pipelineChecks(): Promise<void> {
  if (!transcriptionAvailable()) {
    // eslint-disable-next-line no-console
    console.log('— chaîne réelle ignorée : Whisper (WHISPER_BIN / WHISPER_MODEL) absent');
    return;
  }
  const dir = process.env.MONTAGE_OUT || fs.mkdtempSync(path.join(os.tmpdir(), 'idem-montage-check-'));
  fs.mkdirSync(dir, { recursive: true });
  const input = sample(dir);
  if (!input) {
    // eslint-disable-next-line no-console
    console.log('— chaîne réelle ignorée : pas d’échantillon (MONTAGE_SAMPLE) ni de voix de synthèse');
    return;
  }
  await frameAccuracyCheck(dir);
  const info = await probe(input);
  const t0 = Date.now();
  const { words, language } = await transcribe(input);
  const text = words.map((x) => x.text).join(' ');
  check('Transcription : des mots, dans la bonne langue', words.length > 20 && (!language || language === 'fr'), `${words.length} mots · ${language} · ${((Date.now() - t0) / 1000).toFixed(1)} s pour ${info.duration.toFixed(1)} s`);
  check('Transcription : les mots-clés sont entendus', /bissa/i.test(text) && /1000|mille/i.test(text), text.slice(0, 160));
  check('Transcription : des instants croissants', words.every((x, i) => x.end >= x.start && (i === 0 || x.start >= words[i - 1].start - 0.01)));

  const { ranges, dropped } = keepRanges(words, info.duration, 'tight');
  const expected = editedDuration(ranges);
  check('Coupes : les blancs sont retirés', info.duration - expected > 4, `${info.duration.toFixed(1)} s → ${expected.toFixed(1)} s, ${ranges.length} passages, ${dropped.size} mots retirés`);
  const spec = frameSpec('story', 'hd');
  const cut = await cutVideo({ input, ranges, width: spec.width, height: spec.height, hasAudio: true, outDir: dir });
  const edited = await probe(cut.file);
  check('Vidéo montée : durée attendue, au format story', Math.abs(edited.duration - expected) < 0.15 && edited.width === 1080 && edited.height === 1920, `${edited.duration.toFixed(2)} s (attendu ${expected.toFixed(2)}) · ${edited.width}×${edited.height}`);
  const streams = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,duration', '-of', 'json', cut.file]).stdout.toString();
  check('Vidéo montée : son présent', /"audio"/.test(streams));

  const timed = retimeWords(words, ranges, dropped);
  const theme = buildVideoTheme({ colors: { primary: '#1f6f4a', secondary: '#14324a', accent: '#f2a93b', background: '#fbfaf7', text: '#16181d' } } as any, "Saveurs d'Abidjan");
  const plan = rulesPlan({ words, timed, durationSec: expected, prompt: '', brandName: theme.brandName, sheet: '', contacts: ['saveurs-abidjan.ci'], language: 'fr', format: 'story', creativity: 'low' });
  check('Règles : le prix dit apparaît en grand', plan.elements.some((e) => e.type === 'stat' && /1000/.test(e.value || '')), plan.elements.map((e) => `${e.type}:${e.value || e.icon || ''}`).join(' '));
  check('Règles : un carton final', !!plan.outro?.text);

  const server = await serve(dir);
  try {
    const montage: MontageVideo = {
      id: 'mtg_check',
      title: plan.title,
      status: 'ready',
      stage: 'ready',
      prompt: '',
      format: 'story',
      quality: 'hd',
      creativity: 'low',
      language: 'fr',
      source: { url: '', durationSec: info.duration, width: info.width, height: info.height },
      edit: { url: `${server.url}/${path.basename(cut.file)}`, durationSec: edited.duration, width: 1080, height: 1920 },
      words,
      cuts: { mode: 'tight', ranges, removedSec: 0, dropped: [...dropped] },
      captions: { style: 'pop' },
      elements: [
        ...plan.elements,
        // Un élément de chaque famille, pour regarder le rendu.
        { id: 'lt', type: 'lowerThird', from: 3, to: 6, value: 'Awa Diop', label: "Fondatrice, Saveurs d'Abidjan" },
        { id: 'cta', type: 'cta', from: words.length - 4, to: words.length - 1, text: 'Commandez', value: 'WhatsApp' },
      ],
      // La fusion : une intro animée (motion design) avant la prise de parole.
      intro: { title: 'Le bissap de Saveurs', kicker: 'Nouveau', durationSec: 2.6 },
      outro: plan.outro,
      musicEnabled: false,
      paidCredits: 0,
      exportCount: 0,
      renders: [],
      createdAt: '',
      updatedAt: '',
    };
    const page = await composeMontageHtml({ montage, timed, theme, mode: 'render', videoUrl: montage.edit!.url });
    fs.writeFileSync(path.join(dir, 'montage.html'), page.html);
    const t1 = Date.now();
    const out = await renderVideo({ html: page.html, width: page.width, height: page.height, fps: page.fps, durationSec: page.duration, quality: 'hd', voice: [{ file: cut.file, at: 0 }], webgl: false });
    const final = await probe(out.file);
    check('Rendu : MP4 à la durée parole + carton, avec le son', Math.abs(final.duration - page.duration) < 0.2 && final.hasAudio, `${final.duration.toFixed(2)} s (attendu ${page.duration.toFixed(2)}) · ${((Date.now() - t1) / 1000).toFixed(1)} s de rendu`);
    fs.copyFileSync(out.file, path.join(dir, 'montage.mp4'));
    // L'intro : à 1 s, le fond est la couleur principale de la marque ; après, la vidéo filmée.
    const pixel = (at: number) => [...spawnSync('ffmpeg', ['-v', 'error', '-ss', String(at), '-i', out.file, '-frames:v', '1', '-vf', 'crop=40:40:900:1500,scale=1:1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']).stdout];
    const [r, g, b] = pixel(1.0);
    check('Fusion : l’intro animée ouvre la vidéo, aux couleurs de la marque', Math.abs(r - 0x1f) < 30 && Math.abs(g - 0x6f) < 30 && Math.abs(b - 0x4a) < 30, `rgb(${r}, ${g}, ${b}) à 1 s`);
    const [r2, g2, b2] = pixel(4.5);
    check('Fusion : puis la vidéo filmée prend la place', !(Math.abs(r2 - 0x1f) < 30 && Math.abs(g2 - 0x6f) < 30 && Math.abs(b2 - 0x4a) < 30), `rgb(${r2}, ${g2}, ${b2}) à 4,5 s`);
    for (const at of [0.6, 3, 8, page.duration * 0.6, page.duration - 1]) {
      spawnSync('ffmpeg', ['-y', '-v', 'error', '-ss', at.toFixed(2), '-i', out.file, '-frames:v', '1', '-q:v', '3', path.join(dir, `frame-${at.toFixed(1)}.jpg`)]);
    }
    // eslint-disable-next-line no-console
    console.log(`  → ${dir}`);
  } finally {
    server.close();
    await closeRenderBrowser();
  }
}

(async () => {
  pureChecks();
  await pipelineChecks();
  // eslint-disable-next-line no-console
  console.log(`\n${passes} contrôles passés, ${failures} en échec`);
  process.exit(failures ? 1 : 0);
})().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
