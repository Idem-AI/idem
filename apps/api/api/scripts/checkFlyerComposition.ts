/**
 * Contrôle de COMPOSITION DES VISUELS — `npm run check:flyer`.
 *
 * ── CE QUE CE HARNAIS AJOUTE AUX AUTRES ─────────────────────────────────────
 *
 * `check:design` vérifie la charte sur une chaîne HTML, `check:fit` vérifie la
 * mise en page des documents paginés. Ni l'un ni l'autre ne regarde un VISUEL —
 * une affiche carrée de 1080 px dont le texte tombe sur une photo, format par
 * format.
 *
 * Deux choses sont vérifiées ici, et il faut les distinguer :
 *
 *  1. LA GRILLE est de l'arithmétique (`design/compositionGrid.ts`). On peut
 *     l'affirmer sans navigateur : le partage vaut bien 62/38, l'échelle
 *     typographique progresse bien en puissances de φ, les colonnes tiennent
 *     dans la marge, la même graine redonne la même grille.
 *
 *  2. LE CONTRÔLE MESURÉ (`design/visualAudit.ts`) ne peut PAS se vérifier sans
 *     moteur de rendu, puisque c'est précisément ce qu'il est. On lui soumet
 *     donc des visuels DÉLIBÉRÉMENT fautifs — un texte à 8 px du bord, quatre
 *     blocs presque alignés, un gris clair sur blanc, un titre et un
 *     sous-titre de même taille, une dernière ligne coupée, un liseré blanc —
 *     et on mesure le résultat APRÈS réparation.
 *
 * C'est la seule façon d'affirmer que le contrôle répare au lieu de se
 * contenter de signaler : chaque cas ci-dessous est un défaut réel, et
 * l'assertion porte sur la page corrigée, pas sur le rapport.
 *
 * Aucun appel réseau, aucun modèle : des gabarits écrits à la main, un Chrome
 * local, des pixels.
 *
 *   npx ts-node --transpile-only api/scripts/checkFlyerComposition.ts
 */

import puppeteer, { Page } from 'puppeteer';

import {
  buildCompositionGrid,
  describeCompositionGrid,
  describeGridInvariants,
  describeImageNeed,
  minDisplaySize,
  NEUTRAL_SEED,
  PHI,
} from '../services/design/compositionGrid';
import { buildDesignSeed } from '../services/design/designSeed';
import { auditAndRepairVisual, VisualAuditReport } from '../services/design/visualAudit';

const FORMATS: Array<{ name: string; width: number; height: number; print?: boolean }> = [
  { name: 'square', width: 1080, height: 1080 },
  { name: 'story', width: 1080, height: 1920 },
  { name: 'banner', width: 1200, height: 630 },
  { name: 'post', width: 1200, height: 1500 },
  { name: 'a4', width: 1240, height: 1754, print: true },
];

const PALETTE = {
  primary: '#1F4D3A',
  secondary: '#0B1220',
  accent: '#E4572E',
  background: '#F7F5F0',
  text: '#0B1220',
};

let failures = 0;

function check(label: string, ok: boolean, detail = ''): void {
  if (ok) {
    console.log(`  ✓ ${label}`);
    return;
  }
  failures += 1;
  console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. LA GRILLE — arithmétique pure
// ─────────────────────────────────────────────────────────────────────────────

function checkGrid(): void {
  console.log('\nGrille de composition — le squelette se calcule, il ne s\'improvise pas');

  for (const format of FORMATS) {
    const seed = buildDesignSeed(null, `check:${format.name}`);
    const grid = buildCompositionGrid(format, seed, PALETTE);
    const again = buildCompositionGrid(format, buildDesignSeed(null, `check:${format.name}`), PALETTE);

    check(
      `${format.name} : la même graine redonne la même grille`,
      JSON.stringify(grid) === JSON.stringify(again)
    );

    // Nombre d'or : la césure majeure sur la mineure vaut φ.
    const axis = grid.splitAxis === 'vertical' ? grid.width : grid.height;
    const major = grid.splitAxis === 'vertical' ? grid.golden.x : grid.golden.y;
    const ratio = major / (axis - major);
    check(
      `${format.name} : la césure vaut 1:1,618 (mesuré ${ratio.toFixed(3)})`,
      Math.abs(ratio - PHI) < 0.01
    );

    // Échelle typographique : chaque cran est le précédent divisé par φ.
    const t = grid.type;
    const steps: Array<[string, number, number]> = [
      ['display→headline', t.display, t.headline],
      ['headline→subhead', t.headline, t.subhead],
      ['subhead→body', t.subhead, t.body],
      ['body→caption', t.body, t.caption],
    ];
    // Tolérance PROPORTIONNELLE : les tailles sont des entiers, et à 16 px un
    // arrondi d'un demi-pixel déplace déjà le rapport de 3 %. Une tolérance
    // fixe ferait échouer les petits crans des formats courts sans qu'aucune
    // échelle ne soit en cause.
    const offScale = steps.filter(
      ([, a, b]) => Math.abs(a / b - PHI) > PHI * (0.5 / a + 0.5 / b) + 0.01
    );
    check(
      `${format.name} : l'échelle typographique progresse en φ`,
      offScale.length === 0,
      offScale.map(([n, a, b]) => `${n} ${(a / b).toFixed(2)}`).join(', ')
    );

    check(
      `${format.name} : le niveau d'affichage (${t.display} px) se lit à deux mètres`,
      t.display >= minDisplaySize(grid)
    );
    check(`${format.name} : la mention légale reste lisible (${t.fine} px)`, t.fine >= 11);

    // Colonnes : croissantes, dans la marge, assez larges pour porter un mot.
    const lines = grid.columns.lines;
    const increasing = lines.every((l, i) => i === 0 || l > lines[i - 1]);
    const lastEdge = lines[lines.length - 1] + grid.columns.width;
    check(
      `${format.name} : ${grid.columns.count} colonnes de ${grid.columns.width} px tiennent dans la marge`,
      increasing && lines[0] >= grid.safe && lastEdge <= grid.width - grid.safe + 1 && grid.columns.width >= 44,
      `première ${lines[0]}, dernière arête ${lastEdge}, marge ${grid.safe}`
    );

    // Le champ typographique ne sort jamais de la zone de sécurité : c'est là
    // que vit le texte, et le texte est ce que le rognage ne doit pas manger.
    const f = grid.typeField;
    check(
      `${format.name} : le champ typographique reste dans la zone de sécurité`,
      f.x >= grid.safe - 1 &&
        f.y >= grid.safe - 1 &&
        f.x + f.width <= grid.width - grid.safe + 1 &&
        f.y + f.height <= grid.height - grid.safe + 1 &&
        f.width > 0 &&
        f.height > 0
    );

    check(
      `${format.name} : le fond perdu n'existe qu'à l'impression`,
      format.print ? grid.bleed > 0 : grid.bleed === 0
    );

    // Point focal : une intersection des tiers, jamais le centre géométrique.
    const centred =
      Math.abs(grid.focal.x - grid.width / 2) < 2 && Math.abs(grid.focal.y - grid.height / 2) < 2;
    check(`${format.name} : le point focal n'est pas le centre du cadre`, !centred);
  }

  // Les blocs de prompt portent les nombres, pas des principes.
  const grid = buildCompositionGrid(FORMATS[0], NEUTRAL_SEED, PALETTE);
  const block = describeCompositionGrid(grid);
  check(
    'le bloc de prompt cite la marge, la césure, le point focal et le budget couleur',
    block.includes(`${grid.safe}px`) &&
      block.includes(String(grid.golden.x)) &&
      block.includes(`(${grid.focal.x}, ${grid.focal.y})`) &&
      block.includes(PALETTE.accent)
  );
  check(
    'le bloc de retouche reste court et ne recompose rien',
    describeGridInvariants(grid).length < block.length &&
      /retouching it, not recomposing/.test(describeGridInvariants(grid))
  );
  check(
    'le brief d\'image reçoit le côté où le texte tombera',
    /(left|right) side|(upper|lower) part/.test(describeImageNeed(grid))
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. LE CONTRÔLE MESURÉ — des visuels fautifs, corrigés puis re-mesurés
// ─────────────────────────────────────────────────────────────────────────────

const CANVAS = { name: 'square', width: 1080, height: 1080 };

/**
 * Monte un visuel dans la structure EXACTE du rendu : conteneur forcé à la
 * taille du format, débordement coupé. Sans réseau — ni Tailwind, ni Google
 * Fonts : un contrôle qui dépend d'un CDN ne tourne pas en intégration.
 */
async function mount(page: Page, inner: string): Promise<void> {
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    *,*::before,*::after{box-sizing:border-box}
    html,body{margin:0;padding:0;background:#fff;font-family:Helvetica,Arial,sans-serif}
    body > *:first-child{width:${CANVAS.width}px!important;height:${CANVAS.height}px!important;overflow:hidden!important}
    img{max-width:100%;max-height:100%}
  </style></head><body>${inner}</body></html>`;
  await page.setViewport({ width: CANVAS.width, height: CANVAS.height, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
}

/** Bords gauches et tailles de police, tels que rendus. */
async function measure(page: Page, selector: string): Promise<Array<{ x: number; size: number; over: number }>> {
  return page.evaluate((sel: string) => {
    const out: Array<{ x: number; size: number; over: number }> = [];
    const nodes = document.querySelectorAll(sel);
    for (let i = 0; i < nodes.length; i++) {
      const el = nodes[i] as HTMLElement;
      const r = el.getBoundingClientRect();
      out.push({
        x: r.left,
        size: parseFloat(window.getComputedStyle(el).fontSize) || 0,
        over: el.scrollHeight - el.clientHeight,
      });
    }
    return out;
  }, selector);
}

function ran(report: VisualAuditReport, rule: string): boolean {
  return report.findings.some((f) => f.rule === rule);
}

function repaired(report: VisualAuditReport, rule: string): boolean {
  return report.findings.some((f) => f.rule === rule && f.repaired);
}

async function checkAudit(page: Page): Promise<void> {
  const grid = buildCompositionGrid(CANVAS, NEUTRAL_SEED, PALETTE);
  const audit = () => auditAndRepairVisual(page, { grid, palette: PALETTE, label: 'check' });

  // ── a. Un visuel propre ne doit RIEN déclencher ──────────────────────────
  console.log('\nContrôle mesuré — un visuel propre traverse sans correction');
  {
    const x = grid.columns.lines[1];
    await mount(
      page,
      `<div style="position:relative;background:${PALETTE.secondary}">
        <h1 class="t" style="position:absolute;left:${x}px;top:${grid.rows.lines[3]}px;width:760px;margin:0;font-size:${grid.type.display}px;line-height:1;color:#ffffff">Ouvert le samedi</h1>
        <p class="t" style="position:absolute;left:${x}px;top:${grid.rows.lines[9]}px;width:520px;margin:0;font-size:${grid.type.subhead}px;line-height:1.3;color:#ffffff">Dès 9 h, toute l'équipe vous reçoit sans rendez-vous.</p>
        <p class="t" style="position:absolute;left:${x}px;top:${grid.rows.lines[10]}px;width:420px;margin:0;font-size:${grid.type.caption}px;color:#ffffff">12 rue des Cocotiers · Douala</p>
      </div>`
    );
    const { report } = await audit();
    check(
      'aucune correction sur une composition conforme',
      report.repaired.length === 0 && !report.blocking,
      `score ${report.score}, ${report.findings.map((f) => f.rule).join(', ')}`
    );
  }

  // ── b. Zone de sécurité ─────────────────────────────────────────────────
  console.log('\nContrôle mesuré — ce qui doit être lu revient dans la marge');
  {
    await mount(
      page,
      `<div style="position:relative;background:${PALETTE.secondary}">
        <h1 class="t" style="position:absolute;left:400px;top:60px;width:600px;margin:0;font-size:${grid.type.display}px;line-height:1;color:#fff">Titre</h1>
        <p class="t" style="position:absolute;left:8px;top:940px;width:500px;margin:0;font-size:${grid.type.caption}px;color:#fff">Mention à huit pixels du bord</p>
      </div>`
    );
    const { report } = await audit();
    const after = await measure(page, '.t');
    const caption = after[1];
    check('le texte trop près du bord est ramené dans la marge', repaired(report, 'zone-de-securite'));
    check(
      `il est bien à ${grid.safe} px du bord après correction (mesuré ${Math.round(caption.x)})`,
      caption.x >= grid.safe - 1
    );
  }

  // ── c. Alignement ────────────────────────────────────────────────────────
  console.log('\nContrôle mesuré — les bords presque alignés sont recalés');
  {
    const base = grid.columns.lines[2];
    await mount(
      page,
      `<div style="position:relative;background:${PALETTE.background}">
        ${[0, 5, -4, 9]
          .map(
            (d, i) =>
              `<p class="t" style="position:absolute;left:${base + d}px;top:${300 + i * 120}px;width:500px;margin:0;font-size:${grid.type.subhead}px;color:#0B1220">Bloc ${i + 1}</p>`
          )
          .join('')}
      </div>`
    );
    const { report } = await audit();
    const edges = (await measure(page, '.t')).map((m) => m.x);
    const spread = Math.max(...edges) - Math.min(...edges);
    check('le désalignement de quelques pixels est détecté', ran(report, 'alignement'));
    check(`les quatre bords sont alignés après correction (écart ${spread.toFixed(1)} px)`, spread <= 1.5);
    check(
      'ils sont recalés sur une colonne de la grille',
      grid.columns.lines.some((l) => Math.abs(l - edges[0]) <= 1.5),
      `bord ${edges[0].toFixed(1)}`
    );
  }

  // ── d. Hiérarchie ────────────────────────────────────────────────────────
  console.log('\nContrôle mesuré — deux textes ne se disputent pas le regard');
  {
    await mount(
      page,
      `<div style="position:relative;background:${PALETTE.background}">
        <h1 class="t" style="position:absolute;left:100px;top:300px;width:800px;margin:0;font-size:150px;line-height:1;color:#0B1220">Un titre qui porte toute la nouvelle du jour</h1>
        <p class="t" style="position:absolute;left:100px;top:700px;width:600px;margin:0;font-size:146px;line-height:1;color:#0B1220">Samedi</p>
      </div>`
    );
    const { report } = await audit();
    const sizes = (await measure(page, '.t')).map((m) => m.size);
    check('la hiérarchie plate est détectée', ran(report, 'hierarchie-plate'));
    check(
      `le second niveau est redescendu d'un cran (${sizes[0]} / ${sizes[1]} = ${(sizes[0] / sizes[1]).toFixed(2)})`,
      sizes[0] / sizes[1] >= 1.4
    );
  }

  // ── e. Texte rogné par sa boîte ─────────────────────────────────────────
  console.log('\nContrôle mesuré — la dernière ligne n\'est pas coupée');
  {
    await mount(
      page,
      `<div style="position:relative;background:${PALETTE.background}">
        <p class="t" style="position:absolute;left:100px;top:300px;width:600px;height:150px;overflow:hidden;margin:0;font-size:44px;line-height:1.3;color:#0B1220">Une promesse de marque bien trop longue pour la boîte qu'on lui a donnée, et dont la fin se retrouve coupée net.</p>
      </div>`
    );
    const { report } = await audit();
    const after = await measure(page, '.t');
    check('le texte coupé par sa boîte est détecté', ran(report, 'texte-rogne'));
    check(
      `il tient dans sa boîte après réduction (débordement ${after[0].over} px)`,
      after[0].over <= 2,
      `corps ${after[0].size} px`
    );
  }

  // ── f. Contraste réel ───────────────────────────────────────────────────
  console.log('\nContrôle mesuré — un texte illisible en une seconde est rattrapé');
  {
    await mount(
      page,
      `<div style="position:relative;background:#ffffff">
        <p class="t" style="position:absolute;left:100px;top:400px;width:700px;margin:0;font-size:20px;color:#cccccc">Un gris clair posé sur du blanc : invisible, et pourtant écrit.</p>
      </div>`
    );
    const { report } = await audit();
    const veils = await page.evaluate(() => document.querySelectorAll('[data-idem-veil]').length);
    check('le texte illisible sur le fond RENDU est détecté', ran(report, 'contraste-texte'));
    check('un voile est posé derrière lui', veils === 1);
    check(
      'le seuil AA est atteint après voile (aucune erreur résiduelle)',
      repaired(report, 'contraste-texte') && !report.blocking,
      report.findings
        .filter((f) => !f.repaired)
        .map((f) => f.rule)
        .join(', ')
    );
  }

  // ── g. Fond perdu ───────────────────────────────────────────────────────
  console.log('\nContrôle mesuré — pas de liseré blanc au bord');
  {
    await mount(
      page,
      `<div style="position:relative;background:#ffffff;padding:24px">
        <div style="position:absolute;inset:24px;background:${PALETTE.secondary}"></div>
        <h1 class="t" style="position:absolute;left:120px;top:400px;width:700px;margin:0;font-size:${grid.type.display}px;line-height:1;color:#ffffff">Pleine page</h1>
      </div>`
    );
    const { report } = await audit();
    const corner = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 4, height: 4 } });
    const stillWhite = await page.evaluate(
      () => window.getComputedStyle(document.body.firstElementChild as Element).backgroundColor
    );
    check('le liseré blanc est détecté', ran(report, 'fond-perdu'));
    check(
      'le fond est étendu jusqu\'aux bords',
      repaired(report, 'fond-perdu') && stillWhite !== 'rgb(255, 255, 255)',
      `fond ${stillWhite}, ${corner.length} octets`
    );
  }

  // ── h. Le balisage corrigé est exploitable ───────────────────────────────
  console.log('\nContrôle mesuré — le balisage rendu est celui qu\'on persiste');
  {
    await mount(
      page,
      `<div style="position:relative;background:${PALETTE.secondary}">
        <p class="t" style="position:absolute;left:6px;top:500px;width:500px;margin:0;font-size:${grid.type.caption}px;color:#fff">Mention</p>
      </div>`
    );
    const { html } = await audit();
    check('le HTML corrigé est renvoyé', !!html && html.trim().startsWith('<div'));
    check('aucun marqueur de mesure ne subsiste', !!html && !/data-idem-(audit|logo)=/.test(html));
    check('la correction est bien DANS le balisage', !!html && /translate\(/.test(html));
  }
}

async function main(): Promise<void> {
  checkGrid();

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  try {
    const page = await browser.newPage();
    await checkAudit(page);
  } finally {
    await browser.close();
  }

  if (failures > 0) {
    console.error(`\nComposition des visuels : ${failures} vérification(s) en échec.`);
    process.exit(1);
  }
  console.log('\nComposition des visuels : toutes les vérifications passent.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
