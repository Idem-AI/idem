/**
 * `npm run check:brief` — GRATUIT (agent SIMULÉ) : le directeur de création et la narration à ton constant.
 *
 *   brief       une demande courte (« une annonce pour le lancement de ma marque ») devient un brief de production :
 *               déroulé, ce qu'on montre, ton de la narration, musique ; lu par `parseRequest` comme un BRIEF (jamais un
 *               scénario imposé mot pour mot), sans texte exigé que le client n'a pas écrit ;
 *   faits       un chiffre inventé par l'agent est retiré avec sa phrase ; un texte du client entre guillemets reste ;
 *   voix        le choix de l'utilisateur fait autorité (pas de voix off : ni ton, ni répliques dans le brief) ;
 *   repli       une réponse illisible donne l'amélioration par gabarit ; un scénario écrit reste tel quel ;
 *   narration   une seule balise de jeu dans tout le film, en tête ; les balises qui font crier disparaissent ;
 *               au plus un point d'exclamation ; les respirations restent.
 */
import { enhanceRequest, formatCreativeBrief, parseCreativeBrief, safeBrief } from '../src/video/request/enhance';
import { parseRequest } from '../src/video/request/request';
import { plainSpoken, steadyNarration } from '../src/video/audio/voice';

let failed = 0;
const ok = (label: string, cond: boolean, detail = '') => {
  if (!cond) failed++;
  console.log(`${cond ? '✓' : '✗'} ${label}${!cond && detail ? ` — ${detail}` : ''}`);
};

const ctx = { brandName: 'Kora Café', businessType: 'torréfacteur artisanal', tone: 'chaleureux', valueProposition: 'Un café torréfié chaque matin à Dakar, livré en 30 minutes', language: 'fr' };

/** La réponse que donnerait un bon modèle (avec un piège : un chiffre inventé, des guillemets, un nom de temps « Accroche »). */
const ANSWER = JSON.stringify({
  objective: 'Annoncer le lancement de Kora Café',
  audience: 'Les actifs de Dakar qui veulent un bon café sans attendre',
  keyMessage: 'Un café torréfié le matin même, livré chez vous en 30 minutes',
  story: 'Du grain qui torréfie à l’aube à la tasse sur le bureau, la journée commence mieux.',
  voiceover: true,
  voiceTone: 'chaleureux et posé',
  persona: 'warm',
  pacing: 'Lent au début puis plus vif, chaque plan prolonge le précédent',
  look: 'Lumière du matin, tons bruns et crème',
  show: ['grains de café qui torréfient', 'un livreur à moto dans les rues de Dakar', 'une cliente qui sourit avec sa tasse'],
  beats: [
    { name: 'Accroche', see: 'des grains qui craquent dans le torréfacteur à l’aube', text: 'Votre café est torréfié ce matin', voice: 'Il est six heures, et votre café est déjà en train de naître.', flow: 'la fumée devient la rue' },
    { name: 'Le trajet', see: 'un livreur à moto traverse Dakar', text: '«Livré en 30 minutes»', voice: 'Trente minutes plus tard, il arrive chez vous.', flow: 'la moto s’arrête devant un bureau' },
    { name: 'La preuve', see: 'une cliente goûte et sourit', text: 'Déjà 5 000 clients conquis', voice: 'Rejoignez les 5 000 clients qui ne s’en passent plus.', flow: 'la tasse se pose à côté du logo' },
    { name: 'La fin', see: 'le logo Kora Café sur fond crème', text: 'Commandez votre premier café' },
  ],
  ending: 'Le logo et l’appel à commander',
  music: 'afro',
});

(async () => {
  console.log('Directeur de création — brief de production (agent simulé)\n');
  const r = await enhanceRequest({ text: 'je veux faire une annonce pour le lancement de ma marque', ctx, media: { images: 0, videos: 0, models: 0, lotties: 0 }, durationSec: 60, voice: true }, async () => ANSWER);
  ok('réponse de l’agent lue (source llm)', r.source === 'llm' && !!r.brief, r.source);
  ok('le brief détaille le déroulé', (r.prompt.match(/^- /gm) || []).length >= 3, r.prompt);
  ok('le brief dit ce qu’on montre', /À montrer :/.test(r.prompt) && /livreur/.test(r.prompt));
  ok('un seul ton de narration, sans cri', /Ton de la narration :.*chaleureux et posé.*sans cri/.test(r.prompt));
  ok('lu comme un BRIEF, jamais un scénario', parseRequest(r.prompt).mode === 'brief');
  ok('aucun texte exigé à la lettre ajouté', parseRequest(r.prompt).texts.length === 0, JSON.stringify(parseRequest(r.prompt).texts));
  ok('chiffre inventé retiré (5 000 clients)', !/5\s?000/.test(r.prompt), r.prompt);
  ok('chiffre de la marque gardé (30 minutes)', /30 minutes/.test(r.prompt));
  ok('pas de guillemets', !/[«»"“”]/.test(r.prompt));
  ok('un temps nommé « Accroche » n’est pas lu comme une étiquette', !/^- Accroche :/m.test(r.prompt) && /^- Accroche ·/m.test(r.prompt));
  ok('musique et personnage proposés', r.brief?.music === 'afro' && r.brief?.persona === 'warm');

  const silent = parseCreativeBrief(ANSWER, 'lancement 30 minutes', false);
  ok('sans voix off choisie : ni ton, ni personnage, ni répliques', !!silent && !silent.voiceover && !silent.voiceTone && !silent.persona && silent.beats.every((b) => !b.voice));
  ok('le brief sans voix le dit', /pas de voix off/.test(formatCreativeBrief(silent!, 'fr')));
  ok('brief anglais : étiquettes anglaises, lu comme un brief', parseRequest(formatCreativeBrief(silent!, 'en')).mode === 'brief' && /Voice tone:/.test(formatCreativeBrief(silent!, 'en')));

  const quoted = await enhanceRequest({ text: 'Une vidéo de lancement avec le slogan « Le café qui réveille Dakar »', ctx, media: { images: 0, videos: 0, models: 0, lotties: 0 }, durationSec: 60 }, async () => ANSWER);
  ok('le texte exigé par le client reste (entre guillemets, en tête)', /« Le café qui réveille Dakar »/.test(quoted.prompt) && safeBrief(quoted.prompt, 'Une vidéo de lancement avec le slogan « Le café qui réveille Dakar »'));

  const bad = await enhanceRequest({ text: 'une vidéo pour mon café', ctx, media: { images: 1, videos: 0, models: 0, lotties: 0 }, voice: true }, async () => 'je ne sais pas');
  ok('réponse illisible : amélioration par gabarit', bad.source === 'template' && /pas une suite de diapositives/.test(bad.prompt) && /sans cri/.test(bad.prompt));
  ok('le gabarit reste un brief', parseRequest(bad.prompt).mode === 'brief');

  console.log('\nNarration à ton constant\n');
  const s = steadyNarration(['[excited] Il est six heures!!! Votre café arrive!', '[softly] Trente minutes plus tard… [short pause] il est là!', '[shouting] Commandez maintenant!'], 'warm');
  const all = s.lines.join(' ');
  ok('une seule balise de jeu, en tête', (all.match(/\[(?!short pause|pause|long pause)[a-z ]+\]/g) || []).length === 1 && s.lines[0].startsWith('[softly]'), JSON.stringify(s.lines));
  ok('les balises qui font crier disparaissent', !/excited|shouting/.test(all));
  ok('la respiration reste', /\[short pause\]/.test(all));
  ok('au plus un point d’exclamation', (all.match(/!/g) || []).length <= 1, all);
  ok('le texte dit est intact', plainSpoken(s.lines[1]).startsWith('Trente minutes plus tard'));
  const p = steadyNarration(['Votre café arrive.', 'Commandez.'], 'confident');
  ok('sans balise écrite : celle du personnage', p.lines[0].startsWith('[confident]') && p.tag === '[confident]');
  const none = steadyNarration(['', 'Bonjour à tous.'], 'warm');
  ok('la balise va sur la première ligne parlée', none.lines[0] === '' && none.lines[1].startsWith('[warmly]'));

  console.log(failed ? `\n${failed} échec(s)` : '\nTout passe.');
  process.exit(failed ? 1 : 0);
})();
