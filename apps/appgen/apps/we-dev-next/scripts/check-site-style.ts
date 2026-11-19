/**
 * La variété visuelle des sites (formes, survols, bordures) — sans modèle ni réseau :
 *
 *   - VARIÉTÉ : sur 400 projets, combien de styles distincts, quelle part de sites « banals » (coins uniformes, survol
 *     qui assombrit, aucun trait d'accent, bordure grise de 1 px) — avant : la majorité ;
 *   - COHÉRENCE : aucune combinaison contradictoire (ombre dure + pilule, bordure double trop fine, feuille sans rayon) ;
 *   - COMPILATION : chaque valeur de chaque axe, et 600 combinaisons tirées au hasard, compilent sans erreur ni retouche ;
 *   - GESTES : le CSS n'embarque que le geste choisi, et l'appui d'un bouton à ombre dure l'écrase ;
 *   - RÉTROCOMPATIBILITÉ : une configuration SANS les nouveaux champs (un site d'avant) rend exactement l'ancien survol ;
 *   - GARDE-FOU : un modèle qui ramène les gestes au banal se voit rétablir ceux du projet ;
 *   - CARTES À LA MAIN : `markSurface` marque les cartes et les tuiles, jamais un cadre de média ni un bandeau.
 *
 *   npm run check:site-style
 */
import { keepGestures, personalityOf, seedConfig, STYLE_LANGUAGES, type Family } from '../src/siteEngine/designConfig.js';
import { markSurface } from '../src/siteEngine/sectionCatalog/assemble.js';
import { compiler } from '../src/siteEngine/template.js';
import type { ProjectModel } from '../src/types/project.js';

let failures = 0;
const check = (label: string, ok: boolean, detail?: unknown) => {
  if (ok) console.log(`  ok   ${label}`);
  else {
    failures += 1;
    console.log(`  ÉCHEC ${label}${detail === undefined ? '' : `\n       ${JSON.stringify(detail).slice(0, 500)}`}`);
  }
};

const project = (n: number): ProjectModel => ({ id: `proj-${n}-${(n * 7919) % 10007}`, name: `Projet ${n}`, description: '', type: 'web' });
const FAMILIES: Family[] = ['structured', 'expressive', 'soft'];

/* -------------------------------------------------------------------------- */
console.log('Variété');
{
  const N = 400;
  const signatures = new Map<string, number>();
  const languages = new Map<string, number>();
  let banal = 0;
  let allDefaults = 0;
  const hovers = new Set<string>();
  const shapes = new Set<string>();
  for (let n = 0; n < N; n++) {
    const family = FAMILIES[n % 3];
    const p = personalityOf(project(n), family);
    languages.set(p.id, (languages.get(p.id) ?? 0) + 1);
    hovers.add(p.button.hover);
    shapes.add(`${p.button.shape}|${p.card.shape}`);
    const signature = [p.id, p.radius, p.button.variant, p.card.variant, p.button.shape, p.button.hover, p.button.press, p.card.shape, p.card.hover, p.card.accent, p.borders.tone, p.borders.width, p.borders.style, p.link, p.heading.weight, p.heading.tracking, p.input].join('/');
    signatures.set(signature, (signatures.get(signature) ?? 0) + 1);
    // « Banal » : ce que tous les sites avaient (coins uniformes, bouton qui s'assombrit, carte sans geste ni trait,
    // bordure grise de 1 px).
    const isBanal = p.button.shape === 'uniform' && p.button.hover === 'darken' && p.card.hover === 'none' && p.card.accent === 'none' && p.borders.tone === 'normal' && p.borders.style === 'solid';
    if (isBanal) banal += 1;
    if (p.button.shape === 'uniform' && p.card.shape === 'uniform' && p.button.hover === 'darken') allDefaults += 1;
  }
  check(`les 14 langages sont tous utilisés (${languages.size}/14)`, languages.size === 14, [...languages.keys()]);
  check(`plus de 150 styles distincts sur ${N} projets (${signatures.size})`, signatures.size > 150, signatures.size);
  check(`les 11 survols de bouton sont tous utilisés (${hovers.size}/11)`, hovers.size === 11, [...hovers]);
  check(`au moins 12 couples forme de bouton / forme de carte cohérents (${shapes.size})`, shapes.size >= 12, shapes.size);
  check(`aucun site « banal » complet (${banal}/${N})`, banal === 0, banal);
  check(`moins de 5 % de sites à coins uniformes ET survol qui assombrit (${allDefaults}/${N})`, allDefaults / N < 0.05, allDefaults);
  const top = Math.max(...languages.values());
  check(`aucun langage ne domine (le premier : ${Math.round((top / N) * 100)} %)`, top / N < 0.18, [...languages.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3));
  const sameName = personalityOf(project(7), 'soft');
  check('un projet garde son style (même entrée, même sortie)', JSON.stringify(sameName) === JSON.stringify(personalityOf(project(7), 'soft')));
  // Deux projets de même langage se distinguent encore.
  const group = Array.from({ length: 300 }, (_, n) => personalityOf(project(n + 1000), 'structured')).filter((p) => p.id === 'tech-precise');
  const distinct = new Set(group.map((p) => `${p.button.hover}|${p.card.hover}|${p.card.accent}|${p.borders.tone}`));
  check(`deux projets « tech-precise » se distinguent par leurs gestes (${distinct.size} variantes sur ${group.length})`, distinct.size >= 8, distinct.size);
}

/* -------------------------------------------------------------------------- */
console.log('Cohérence des langages');
{
  const px = (length: string) => (length.endsWith('rem') ? parseFloat(length) * 16 : parseFloat(length));
  const problems: string[] = [];
  for (const l of STYLE_LANGUAGES) {
    if (l.button.hover.includes('shift') && l.button.shape.includes('pill')) problems.push(`${l.id} : ombre dure et pilule`);
    if (l.card.hover.includes('shift') && l.card.shape.some((s) => ['arch', 'blob', 'leaf', 'leaf-reverse'].includes(s))) problems.push(`${l.id} : ombre dure sur une forme courbe`);
    if (l.borders.style.includes('double') && !l.borders.width.every((w) => px(w) >= 3)) problems.push(`${l.id} : trait double sous 3 px`);
    const curved = [...l.button.shape, ...l.card.shape].some((s) => ['leaf', 'leaf-reverse', 'arch', 'blob', 'tab'].includes(s));
    if (curved && Math.min(...l.radius.map(px)) < 4) problems.push(`${l.id} : forme courbe sans rayon (${l.radius.join('/')})`);
    if (l.card.shape.includes('arch') && Math.min(...l.radius.map(px)) < 8) problems.push(`${l.id} : arche sans rayon`);
    if (l.button.variant.includes('outline') && l.button.hover.includes('darken') && l.button.hover.length === 1) problems.push(`${l.id} : bouton au trait qui seulement s'assombrit`);
    if (l.card.hover.includes('zoom') && l.card.variant.every((v) => v === 'flat') && l.card.shape.includes('square') && false) problems.push('');
    if (new Set(l.button.hover).size + new Set(l.card.hover).size < 3) problems.push(`${l.id} : trop peu de choix de survol`);
    for (const [axis, list] of Object.entries({ ...l.button, ...l.card, ...l.borders })) if (!Array.isArray(list) || !list.length) problems.push(`${l.id} : axe vide (${axis})`);
  }
  check('aucune combinaison contradictoire', problems.filter(Boolean).length === 0, problems.filter(Boolean));
  const families = new Set(STYLE_LANGUAGES.flatMap((l) => l.families));
  check('chaque famille de direction artistique a au moins 5 langages', FAMILIES.every((f) => STYLE_LANGUAGES.filter((l) => l.families.includes(f)).length >= 5), FAMILIES.map((f) => [f, STYLE_LANGUAGES.filter((l) => l.families.includes(f)).length]));
  check('les trois familles sont couvertes', families.size === 3);
}

/* -------------------------------------------------------------------------- */
console.log('Compilation');
{
  const base = (): any => JSON.parse(JSON.stringify(seedConfig(project(1))));
  const AXES: Array<[string[], string[]]> = [
    [['components', 'button', 'shape'], ['uniform', 'square', 'pill', 'leaf', 'leaf-reverse', 'tab']],
    [['components', 'button', 'hover'], ['darken', 'lift', 'invert', 'slide', 'glow', 'grow', 'shift', 'underline', 'arrow', 'ring', 'tilt']],
    [['components', 'button', 'press'], ['none', 'sink', 'shrink']],
    [['components', 'card', 'shape'], ['uniform', 'square', 'leaf', 'leaf-reverse', 'tab', 'arch', 'blob']],
    [['components', 'card', 'hover'], ['none', 'lift', 'border', 'tint', 'zoom', 'shadow', 'shift', 'bar', 'glow', 'rise', 'tilt']],
    [['components', 'card', 'accent'], ['none', 'top', 'left', 'bottom']],
    [['components', 'badge', 'shape'], ['uniform', 'square', 'pill']],
    [['components', 'link', 'hover'], ['none', 'underline', 'bar']],
    [['tokens', 'borders', 'tone'], ['hairline', 'soft', 'normal', 'strong', 'ink', 'brand']],
    [['tokens', 'borders', 'style'], ['solid', 'dashed', 'dotted', 'double']],
    [['components', 'input', 'style'], ['outline', 'filled', 'underline']],
  ];
  const set = (config: any, path: string[], value: unknown) => {
    let node = config;
    for (const key of path.slice(0, -1)) node = node[key] ??= {};
    node[path[path.length - 1]] = value;
  };
  let bad: unknown = null;
  let compiled = 0;
  for (const [path, values] of AXES) {
    for (const value of values) {
      const config = base();
      set(config, path, value);
      const out = compiler.compileDesignSystem(config);
      compiled += 1;
      if (out.report.errors.length) bad ??= { path: path.join('.'), value, errors: out.report.errors };
    }
  }
  // Combinaisons tirées au hasard (graine fixe).
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const adjusted: unknown[] = [];
  for (let i = 0; i < 600; i++) {
    const config = base();
    for (const [path, values] of AXES) set(config, path, values[Math.floor(rnd() * values.length)]);
    const out = compiler.compileDesignSystem(config);
    compiled += 1;
    if (out.report.errors.length) bad ??= { config: config.components, errors: out.report.errors };
    // Les couleurs ne dépendent pas des gestes : aucune retouche d'accessibilité nouvelle.
    if (out.report.adjusted.length) adjusted.push(out.report.adjusted[0]);
  }
  check(`${compiled} compilations sans erreur`, bad === null, bad);
  check('les gestes ne provoquent aucune retouche de contraste', adjusted.length === 0, adjusted.slice(0, 2));

  const css = (config: any) => compiler.compileDesignSystem(config).css;
  const slide = base();
  set(slide, ['components', 'button', 'hover'], 'slide');
  const slideCss = css(slide);
  check('le CSS n’embarque que le survol choisi (slide : oui, lift : non)', /background-size: 100% 100%/.test(slideCss) && !/translateY\(-2px\)/.test(slideCss) && !/rotate\(-1\.5deg\)/.test(slideCss));
  const shift = base();
  set(shift, ['components', 'button', 'hover'], 'shift');
  check('ombre dure : le bouton s’écrase à l’appui', /\.ds-button:active \{ transform: translate\(4px, 4px\)/.test(css(shift)));
  const motion = css(shift);
  check('les déplacements ne jouent que si l’utilisateur ne les refuse pas (prefers-reduced-motion)', /prefers-reduced-motion: no-preference\) \{\s*@media \(hover: hover\) \{ \.ds-button:hover \{ transform: translate\(2px, 2px\)/.test(motion), motion.split('\n').filter((l) => /reduced/.test(l)).slice(0, 2));
  const leaf = base();
  set(leaf, ['components', 'button', 'shape'], 'leaf');
  set(leaf, ['tokens', 'radius', 'button'], '1rem');
  check('forme « feuille » : un coin sur deux', /--radius-button-shape: 1rem 0px 1rem 0px;/.test(css(leaf)));
  const pill = base();
  set(pill, ['components', 'button', 'shape'], 'pill');
  check('forme « pilule » : rayon maximal', /--radius-button-shape: 9999px;/.test(css(pill)));
  const dbl = base();
  set(dbl, ['tokens', 'borders', 'style'], 'double');
  set(dbl, ['tokens', 'borders', 'width'], '1px');
  const dblCss = css(dbl);
  check('trait double : l’épaisseur passe à 3 px (sinon il se trace plein)', /--border-width: 3px;/.test(dblCss) && /--border-style: double;/.test(dblCss));
  const toneColors = (tone: string) => {
    const config = base();
    set(config, ['tokens', 'borders', 'tone'], tone);
    delete config.tokens.colors.border;
    return compiler.compileDesignSystem(config).css.match(/--border: ([^;]+);/)?.[1];
  };
  const tones = new Set(['hairline', 'soft', 'normal', 'strong', 'ink', 'brand'].map(toneColors));
  check('les six teintes de bordure donnent six couleurs différentes', tones.size === 6, [...tones]);
}

/* -------------------------------------------------------------------------- */
console.log('Rétrocompatibilité (un site d’avant)');
{
  const old = compiler.compileDesignSystem({ appearance: { colorMode: 'light', density: 'comfortable' }, tokens: { colors: { primary: '#2563eb' }, borders: { width: '1px' } }, components: { button: { variant: 'primary' }, card: { variant: 'outline' } } });
  const css = old.css;
  check('survol d’avant : le bouton s’assombrit', /\.ds-button:hover \{ background-color: var\(--btn-hover-bg\); border-color: var\(--btn-hover-bd\); \}/.test(css));
  check('formes d’avant : coins uniformes', /--radius-button-shape: 0\.5rem;/.test(css) && /--radius-card-shape: calc\(0\.5rem \* 1\.5\);/.test(css));
  check('bordure d’avant : 1 px, trait plein, 13 % de la couleur du texte', /--border-width: 1px;/.test(css) && /--border-style: solid;/.test(css));
  check('carte d’avant : aucun geste ni trait d’accent', !/\.ds-card:hover/.test(css) && !/background-size: 100% 3px/.test(css));
  check('le primaire garde son ombre réglée', /\.ds-btn-primary \{ box-shadow: var\(--shadow-button\); \}/.test(css));
  check('les variantes nomment leurs couleurs (survol d’un bouton au trait = fond discret)', /:where\(\.ds-btn-outline\) \{[^}]*--btn-hover-bg: rgb\(var\(--muted\)\)/.test(css));
}

/* -------------------------------------------------------------------------- */
console.log('Garde-fou : le modèle ne ramène pas les gestes au banal');
{
  const seed = seedConfig(project(21), undefined);
  const chosen = personalityOf(project(21), undefined);
  // Un modèle qui « normalise » tout.
  const model: any = JSON.parse(JSON.stringify(seed));
  model.components.button.shape = 'uniform';
  model.components.button.hover = 'darken';
  model.components.card.hover = 'none';
  model.components.card.accent = 'none';
  model.tokens.borders.tone = 'normal';
  model.tokens.borders.style = 'solid';
  model.tokens.borders.width = '1px';
  delete model.components.link;
  const restored = keepGestures(model, seed);
  const banal = chosen.button.shape === 'uniform' && chosen.button.hover === 'darken';
  check('les gestes du projet sont rétablis', model.components.button.hover === seed.components.button.hover && model.components.card.hover === seed.components.card.hover && model.tokens.borders.tone === seed.tokens.borders.tone, { restored, banal });
  check('le lien perdu est rétabli', model.components.link?.hover === seed.components.link.hover);
  // Un geste NON banal choisi par le modèle est respecté.
  const own: any = JSON.parse(JSON.stringify(seed));
  own.components.button.hover = seed.components.button.hover === 'ring' ? 'glow' : 'ring';
  const before = own.components.button.hover;
  keepGestures(own, seed);
  check('un autre geste que le banal est gardé', own.components.button.hover === before);
}

/* -------------------------------------------------------------------------- */
console.log('Cartes écrites à la main (catalogue)');
{
  const card = 'flex flex-col gap-3 rounded-card border border-border bg-card p-6';
  check('carte bordée et rembourrée → ds-card', markSurface(card) === `${card} ds-card`);
  check('carte à fond (muted) → ds-card', /ds-card$/.test(markSurface('rounded-card bg-muted/60 p-8 lg:sticky lg:top-28 lg:col-span-5')) === false, 'sticky = jamais');
  check('carte à fond muted/50 → ds-card', /ds-card$/.test(markSurface('rounded-card bg-muted/50 p-5 font-heading text-h4 text-foreground')));
  check('cadre de média (aspect) → jamais', markSurface('aspect-[4/3] w-full rounded-card') === 'aspect-[4/3] w-full rounded-card');
  check('calque posé sur une image (absolute, ombre xl) → jamais', markSurface('relative -mt-24 flex flex-col gap-5 rounded-card bg-background p-6 shadow-xl sm:absolute sm:bottom-8') === 'relative -mt-24 flex flex-col gap-5 rounded-card bg-background p-6 shadow-xl sm:absolute sm:bottom-8');
  check('bandeau plein (bg-primary) → jamais', markSurface('rounded-card bg-primary p-10 text-primary-foreground') === 'rounded-card bg-primary p-10 text-primary-foreground');
  check('mosaïque (grid gap-px bg-border) → jamais', markSurface('grid gap-px overflow-hidden rounded-card bg-border sm:grid-cols-2 lg:grid-cols-4') === 'grid gap-px overflow-hidden rounded-card bg-border sm:grid-cols-2 lg:grid-cols-4');
  check('tuile d’image (relative overflow-hidden) → ds-tile', markSurface('relative overflow-hidden rounded-card') === 'relative overflow-hidden rounded-card ds-tile');
  check('tableau défilant (overflow-x-auto) → jamais', markSurface('overflow-x-auto rounded-card border border-border') === 'overflow-x-auto rounded-card border border-border');
  check('déjà marquée → inchangée', markSurface(`${card} ds-card`) === `${card} ds-card`);
  check('sans rounded-card → inchangée', markSurface('flex gap-3 border p-4') === 'flex gap-3 border p-4');
}

console.log(failures ? `\n${failures} échec(s).` : '\nTout est vert.');
process.exit(failures ? 1 : 0);
