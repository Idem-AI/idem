/**
 * LE JEU DE DEMANDES DU BANC D'ESSAI — quatre vidéos qui sollicitent des forces différentes :
 *
 *   typo      une vidéo entièrement typographique (story) ;
 *   data      des chiffres et des graphiques animés (carré) ;
 *   demo      une démonstration produit avec de VRAIES captures d'application (paysage) ;
 *   story     un récit en cinq scènes écrites par le client, avec une photo du produit (portrait, 30 s).
 *
 * Les mêmes demandes, les mêmes marques et les mêmes médias passent par les deux logiques.
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import type {
  VideoFormat,
  VideoDuration,
} from '../../../apps/ivision/core/src/video/contracts/model';

export interface BenchBrand {
  name: string;
  colors: { primary: string; secondary: string; accent: string; background: string; text: string };
  fonts: { display: string; body: string };
  logoSvg: string;
  voice: { businessType: string; tone: string; valueProposition: string; language: string };
}

export interface BenchBrief {
  id: string;
  label: string;
  /** Ce que la demande met à l'épreuve. */
  focus: string;
  format: VideoFormat;
  durationSec: VideoDuration;
  objective: 'promotion' | 'product' | 'announce';
  request: string;
  brand: BenchBrand;
  /** Captures et photos de la marque (avec leur description, comme les garde l'hôte). */
  brandMedia: {
    file: string;
    kind: 'screen' | 'photo';
    note: string;
    width: number;
    height: number;
  }[];
  /** Photos importées par le client. */
  uploads: { file: string; name: string; width: number; height: number }[];
}

const logo = (mark: string, word: string, color: string, ink: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="100" viewBox="0 0 360 100">${mark.replace(/COLOR/g, color)}<text x="104" y="66" font-family="Arial, Helvetica, sans-serif" font-size="44" font-weight="700" fill="${ink}">${word}</text></svg>`;

export async function benchBriefs(dir: string): Promise<BenchBrief[]> {
  fs.mkdirSync(dir, { recursive: true });
  const png = async (name: string, svg: string) => {
    const file = path.join(dir, name);
    if (!fs.existsSync(file)) await sharp(Buffer.from(svg)).png().toFile(file);
    return file;
  };
  const jpg = async (name: string, svg: string) => {
    const file = path.join(dir, name);
    if (!fs.existsSync(file)) await sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toFile(file);
    return file;
  };

  // ── Verda : trois captures de l'application (tableau de bord, carte, alertes) ──
  const frame = (
    title: string,
    body: string
  ) => `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="900" font-family="Arial, Helvetica, sans-serif">
<rect width="1440" height="900" fill="#f5f9f4"/><rect width="250" height="900" fill="#12372a"/>
<circle cx="56" cy="60" r="18" fill="#7bc67e"/><text x="86" y="68" font-size="26" font-weight="700" fill="#ffffff">Verda</text>
${['Tableau de bord', 'Parcelles', 'Météo', 'Récoltes', 'Réglages'].map((l, i) => `<rect x="20" y="${130 + i * 58}" width="210" height="44" rx="10" fill="${l === title ? '#2e7d32' : 'none'}"/><text x="40" y="${159 + i * 58}" font-size="18" fill="#dfeedd">${l}</text>`).join('')}
<text x="300" y="80" font-size="34" font-weight="700" fill="#12372a">${title}</text>${body}</svg>`;
  const dashboard = await png(
    'verda-dashboard.png',
    frame(
      'Tableau de bord',
      `
<rect x="300" y="120" width="330" height="150" rx="18" fill="#ffffff"/><text x="330" y="170" font-size="18" fill="#5b7a66">Récolte de la saison</text><text x="330" y="235" font-size="48" font-weight="700" fill="#2e7d32">8,4 t</text>
<rect x="660" y="120" width="330" height="150" rx="18" fill="#ffffff"/><text x="690" y="170" font-size="18" fill="#5b7a66">Parcelles suivies</text><text x="690" y="235" font-size="48" font-weight="700" fill="#12372a">12</text>
<rect x="1020" y="120" width="360" height="150" rx="18" fill="#fff6dc"/><text x="1050" y="170" font-size="18" fill="#8a6a00">Prochaine pluie</text><text x="1050" y="235" font-size="40" font-weight="700" fill="#8a6a00">Jeudi</text>
<rect x="300" y="300" width="1080" height="540" rx="18" fill="#ffffff"/><text x="330" y="350" font-size="20" font-weight="700" fill="#12372a">Rendement par mois</text>
${[0.35, 0.5, 0.42, 0.68, 0.8, 0.62, 0.9, 0.74].map((v, i) => `<rect x="${360 + i * 125}" y="${800 - v * 400}" width="70" height="${v * 400}" rx="10" fill="${i === 6 ? '#f9a825' : '#2e7d32'}"/>`).join('')}`
    )
  );
  const map = await png(
    'verda-map.png',
    frame(
      'Parcelles',
      `
<rect x="300" y="120" width="760" height="720" rx="18" fill="#dcebd6"/>
<path d="M340 200 L620 160 L700 380 L420 430 Z" fill="#7bc67e" stroke="#2e7d32" stroke-width="4"/><path d="M720 170 L1010 210 L980 470 L730 390 Z" fill="#a5d6a7" stroke="#2e7d32" stroke-width="4"/>
<path d="M360 470 L700 420 L760 760 L400 790 Z" fill="#f9d77e" stroke="#c49000" stroke-width="4"/><path d="M780 430 L1000 500 L1020 790 L800 770 Z" fill="#7bc67e" stroke="#2e7d32" stroke-width="4"/>
<circle cx="560" cy="610" r="16" fill="#e65100"/><text x="590" y="618" font-size="20" font-weight="700" fill="#5d2a00">Parcelle 3 : irrigation</text>
<rect x="1090" y="120" width="290" height="720" rx="18" fill="#ffffff"/>${['Parcelle 1 — Maïs', 'Parcelle 2 — Sorgho', 'Parcelle 3 — Arachide', 'Parcelle 4 — Mil'].map((l, i) => `<text x="1115" y="${180 + i * 70}" font-size="19" fill="#12372a">${l}</text><rect x="1115" y="${195 + i * 70}" width="${220 - i * 30}" height="10" rx="5" fill="#7bc67e"/>`).join('')}`
    )
  );
  const weather = await png(
    'verda-weather.png',
    frame(
      'Météo',
      `
${[
  [
    'Orage prévu jeudi',
    'Rentrez la récolte de la parcelle 2 avant mercredi soir.',
    '#fdecea',
    '#b71c1c',
  ],
  ['Pluie utile samedi', 'Idéal pour semer la parcelle 4.', '#e8f5e9', '#1b5e20'],
  ['Forte chaleur lundi', 'Arrosez tôt le matin.', '#fff8e1', '#8a6a00'],
]
  .map(
    ([t, d, bg, ink], i) =>
      `<rect x="300" y="${130 + i * 170}" width="1080" height="140" rx="18" fill="${bg}"/><circle cx="360" cy="${200 + i * 170}" r="28" fill="${ink}"/><text x="410" y="${190 + i * 170}" font-size="28" font-weight="700" fill="${ink}">${t}</text><text x="410" y="${228 + i * 170}" font-size="20" fill="#33463b">${d}</text>`
  )
  .join('')}
<rect x="300" y="650" width="1080" height="190" rx="18" fill="#ffffff"/>${['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d, i) => `<text x="${350 + i * 150}" y="700" font-size="20" fill="#5b7a66">${d}</text><text x="${350 + i * 150}" y="770" font-size="34" font-weight="700" fill="#12372a">${[34, 31, 30, 26, 28, 27, 29][i]}°</text>`).join('')}`
    )
  );

  // ── Mama Bissap : la bouteille (photo du client) ──
  const bottle = await jpg(
    'mama-bissap-bottle.jpg',
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1500"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe9d6"/><stop offset="1" stop-color="#f3b48f"/></linearGradient><linearGradient id="b" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6d0a26"/><stop offset="0.5" stop-color="#b0123f"/><stop offset="1" stop-color="#5a0820"/></linearGradient></defs>
<rect width="1200" height="1500" fill="url(#g)"/><rect y="1120" width="1200" height="380" fill="#8b5a3c"/><ellipse cx="600" cy="1140" rx="300" ry="40" fill="#5c3a24" opacity="0.5"/>
<rect x="520" y="230" width="160" height="190" rx="30" fill="url(#b)"/><rect x="505" y="190" width="190" height="60" rx="16" fill="#2fa84f"/>
<path d="M520 400 C430 470 420 560 420 640 L420 1060 C420 1110 460 1140 510 1140 L690 1140 C740 1140 780 1110 780 1060 L780 640 C780 560 770 470 680 400 Z" fill="url(#b)"/>
<rect x="440" y="700" width="320" height="260" rx="20" fill="#fff4ee"/><circle cx="600" cy="780" r="46" fill="#b0123f"/><rect x="490" y="850" width="220" height="22" rx="11" fill="#3b0a1e"/><rect x="520" y="890" width="160" height="16" rx="8" fill="#2fa84f"/>
${[
  [470, 560],
  [720, 610],
  [500, 1010],
  [740, 980],
  [600, 640],
]
  .map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="9" ry="14" fill="#ffffff" opacity="0.55"/>`)
  .join('')}
<circle cx="250" cy="1180" r="70" fill="#c2185b"/><circle cx="215" cy="1150" r="42" fill="#e91e63"/><circle cx="960" cy="1200" r="60" fill="#c2185b"/></svg>`
  );

  return [
    {
      id: 'typo',
      label: 'Typographique',
      focus: 'composition de texte, rythme, découpe en mots',
      format: 'story',
      durationSec: 15,
      objective: 'announce',
      request:
        'Vidéo 100 % typographique, sans photo, pour annoncer notre nouvelle collection de pagnes wax « Héritage ». Rythme dynamique, les mots doivent danser à l’écran. Textes à l’écran : « Héritage », « La nouvelle collection wax », « Des motifs qui racontent notre histoire », « Disponible dès le 12 novembre », « pagneroyal.ci ».',
      brand: {
        name: 'Pagne Royal',
        colors: {
          primary: '#7a1f3d',
          secondary: '#1d2a44',
          accent: '#e8a33d',
          background: '#fbf6ef',
          text: '#1b1b1b',
        },
        fonts: { display: 'Playfair Display', body: 'Inter' },
        logoSvg: logo(
          '<path d="M50 10 L90 50 L50 90 L10 50 Z" fill="COLOR"/><path d="M50 30 L70 50 L50 70 L30 50 Z" fill="#e8a33d"/>',
          'Pagne Royal',
          '#7a1f3d',
          '#1d2a44'
        ),
        voice: {
          businessType: 'boutique de pagnes wax à Abidjan',
          tone: 'élégant, fier, chaleureux',
          valueProposition: 'Des pagnes wax authentiques, choisis motif par motif.',
          language: 'fr',
        },
      },
      brandMedia: [],
      uploads: [],
    },
    {
      id: 'data',
      label: 'Données animées',
      focus: 'compteurs, graphiques, lisibilité des chiffres',
      format: 'square',
      durationSec: 15,
      objective: 'promotion',
      request:
        'Vidéo de chiffres animés pour présenter le bilan 2025 de Makam Finance. Chiffres à montrer : 12 000 clients accompagnés, 85 % de taux de remboursement, 3,2 milliards FCFA de crédits accordés, 40 agences au Togo et au Ghana. Des graphiques simples et lisibles, des compteurs qui défilent. Finir sur le slogan « Grandir ensemble ».',
      brand: {
        name: 'Makam Finance',
        colors: {
          primary: '#0f5c4d',
          secondary: '#0b2239',
          accent: '#f4b400',
          background: '#ffffff',
          text: '#0b2239',
        },
        fonts: { display: 'Space Grotesk', body: 'Inter' },
        logoSvg: logo(
          '<circle cx="50" cy="50" r="40" fill="COLOR"/><path d="M30 62 L45 45 L56 55 L72 34" stroke="#f4b400" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
          'Makam Finance',
          '#0f5c4d',
          '#0b2239'
        ),
        voice: {
          businessType: 'microfinance au Togo et au Ghana',
          tone: 'sérieux, optimiste, proche',
          valueProposition: 'Le crédit qui fait grandir les petits commerces.',
          language: 'fr',
        },
      },
      brandMedia: [],
      uploads: [],
    },
    {
      id: 'demo',
      label: 'Démo produit (captures réelles)',
      focus: 'mise en scène de vraies captures d’écran, mouvements de caméra',
      format: 'landscape',
      durationSec: 15,
      objective: 'product',
      request:
        'Démo de notre application Verda qui aide les agriculteurs à suivre leurs récoltes. Montrer le tableau de bord des récoltes, la carte des parcelles et les alertes météo, avec les vraies captures de l’application. Ton clair et rassurant. Terminer par « Téléchargez Verda » et « verda.app ».',
      brand: {
        name: 'Verda',
        colors: {
          primary: '#2e7d32',
          secondary: '#12372a',
          accent: '#f9a825',
          background: '#f5f9f4',
          text: '#12372a',
        },
        fonts: { display: 'Poppins', body: 'Inter' },
        logoSvg: logo(
          '<path d="M50 88 C20 70 14 40 30 14 C60 18 84 40 72 76 Z" fill="COLOR"/><path d="M50 88 C48 60 44 40 34 22" stroke="#f5f9f4" stroke-width="5" fill="none"/>',
          'Verda',
          '#2e7d32',
          '#12372a'
        ),
        voice: {
          businessType: 'application de suivi des récoltes pour agriculteurs',
          tone: 'clair, rassurant, concret',
          valueProposition: 'Vos récoltes, vos parcelles et la météo dans une seule application.',
          language: 'fr',
        },
      },
      brandMedia: [
        {
          file: dashboard,
          kind: 'screen',
          note: 'screenshot: Verda app dashboard — harvest of the season, tracked plots, next rain, monthly yield bar chart',
          width: 1440,
          height: 900,
        },
        {
          file: map,
          kind: 'screen',
          note: 'screenshot: Verda app plots map — four colored farm plots on a map, plot 3 flagged for irrigation, plot list on the right',
          width: 1440,
          height: 900,
        },
        {
          file: weather,
          kind: 'screen',
          note: 'screenshot: Verda app weather alerts — storm on Thursday, useful rain on Saturday, heat on Monday, 7-day forecast',
          width: 1440,
          height: 900,
        },
      ],
      uploads: [],
    },
    {
      id: 'story',
      label: 'Récit en 5 scènes',
      focus: 'scénario du client tenu, continuité, transitions, photo produit',
      format: 'portrait',
      durationSec: 30,
      objective: 'promotion',
      request: [
        'Vidéo de marque pour Mama Bissap, notre jus de bissap artisanal de Dakar.',
        'Scène 1 : Au lever du soleil, dans les champs du Sine-Saloum, les fleurs d’hibiscus rouges s’ouvrent. Texte : « Tout commence au soleil »',
        'Scène 2 : Les mains des cueilleuses récoltent les fleurs une à une. Texte : « Cueillies à la main »',
        'Scène 3 : Les fleurs infusent, l’eau devient rouge profond. Texte : « Infusées lentement, sans sucre ajouté »',
        'Scène 4 : La bouteille Mama Bissap apparaît, fraîche, couverte de gouttes. Texte : « Mama Bissap »',
        'Scène 5 : Signature de la marque. Textes : « Le goût du vrai » et « mamabissap.sn »',
      ].join('\n'),
      brand: {
        name: 'Mama Bissap',
        colors: {
          primary: '#b0123f',
          secondary: '#3b0a1e',
          accent: '#2fa84f',
          background: '#fff4ee',
          text: '#2a0a14',
        },
        fonts: { display: 'DM Serif Display', body: 'DM Sans' },
        logoSvg: logo(
          '<circle cx="50" cy="56" r="34" fill="COLOR"/><path d="M50 22 C58 8 72 6 80 10 C72 18 62 22 50 22 Z" fill="#2fa84f"/>',
          'Mama Bissap',
          '#b0123f',
          '#3b0a1e'
        ),
        voice: {
          businessType: 'jus de bissap artisanal à Dakar',
          tone: 'chaleureux, authentique, solaire',
          valueProposition: 'Le vrai goût du bissap, sans sucre ajouté.',
          language: 'fr',
        },
      },
      brandMedia: [],
      uploads: [
        {
          file: bottle,
          name: 'bouteille de jus Mama Bissap sur une table en bois, fond pêche',
          width: 1200,
          height: 1500,
        },
      ],
    },
  ];
}
