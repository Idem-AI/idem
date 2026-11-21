/**
 * LES STYLES D'EN-TÊTE ET DE PIED DE PAGE (21/11/2026) — une même disposition, plusieurs compositions.
 *
 * Un gabarit d'en-tête ou de pied de page (idem-templates, `catalog/icode/shared/shell/`) fixe la DISPOSITION : où
 * sont la marque, le menu, l'action, les colonnes. Ce qui se voit au survol, la façon de marquer la page active, le
 * menu mobile ou la disposition des liens du pied sur téléphone sont des STYLES interchangeables
 * (`catalog/icode/shared/shell/styles/<emplacement>/istyle.*`). Le gabarit délimite chaque emplacement par deux
 * commentaires, avec un style par défaut entre eux — il reste donc un composant valide tel quel (un moteur plus
 * ancien le sert sans rien remplacer) :
 *
 *   /* @slot nav *\/            const navLink = (active: boolean) => cn(…);
 *   /* @slot menu lg *\/        function MobileMenu({ current }: { current: string }) { … }     (md, lg… : le point de bascule ; all : toujours)
 *   /* @slot flink *\/          const footLink = '…';
 *   /* @slot fnav *\/           function FooterNav({ className }: { className?: string }) { … }
 *   /* @end *\/
 *
 * Le code choisit un style par emplacement (graine du projet, DA, gamme) et le pose à la place du défaut. Un style
 * apporte ses imports en tête de son fichier : ils sont fusionnés avec ceux du gabarit, et les noms que plus rien
 * n'emploie sont retirés. `BP:` dans un style devient le point de bascule du gabarit (`md:`, `lg:`…) ; avec `all`,
 * les classes `BP:` tombent.
 */

export const SHELL_SLOTS = ['nav', 'menu', 'flink', 'fnav'] as const;
export type ShellSlot = (typeof SHELL_SLOTS)[number];

/** Ce que chaque emplacement doit définir : le gabarit l'appelle par ce nom. */
export const SLOT_EXPORTS: Record<ShellSlot, RegExp> = {
  nav: /const navLink = \(active: boolean\)/,
  menu: /function MobileMenu\(\{ current \}: \{ current: string \}\)/,
  flink: /const footLink = /,
  fnav: /function FooterNav\(\{ className \}: \{ className\?: string \}\)/,
};

const SLOT_RE = /\/\*\s*@slot\s+([a-z]+)(?:\s+(sm|md|lg|xl|all))?\s*\*\/\n?([\s\S]*?)\/\*\s*@end\s*\*\/\n?/g;

/** Les emplacements d'un gabarit, avec leur point de bascule. */
export function slotsOf(tpl: string): Array<{ slot: ShellSlot; bp: string }> {
  return [...tpl.matchAll(SLOT_RE)].filter((m) => (SHELL_SLOTS as readonly string[]).includes(m[1])).map((m) => ({ slot: m[1] as ShellSlot, bp: m[2] ?? 'md' }));
}

interface ImportSpec {
  module: string;
  default?: string;
  named: string[];
}

const IMPORT_RE = /^import\s+(?:(\w+)\s*,?\s*)?(?:\{([^}]*)\})?\s*from\s+['"]([^'"]+)['"];?[ \t]*\n?/gm;

function splitImports(code: string): { imports: ImportSpec[]; body: string } {
  const imports: ImportSpec[] = [];
  const body = code.replace(IMPORT_RE, (_all, def: string | undefined, named: string | undefined, module: string) => {
    imports.push({ module, default: def, named: (named ?? '').split(',').map((s) => s.trim()).filter(Boolean) });
    return '';
  });
  return { imports, body };
}

function mergeImports(specs: ImportSpec[], body: string): string {
  const used = (name: string) => new RegExp(`(?<![\\w.$])${name.replace(/\$/g, '\\$')}(?![\\w$])`).test(body);
  const byModule = new Map<string, { default?: string; named: Set<string> }>();
  for (const s of specs) {
    const entry = byModule.get(s.module) ?? { named: new Set<string>() };
    if (s.default) entry.default = s.default;
    for (const n of s.named) entry.named.add(n);
    byModule.set(s.module, entry);
  }
  const lines: string[] = [];
  for (const [module, entry] of byModule) {
    const def = entry.default && used(entry.default) ? entry.default : '';
    const named = [...entry.named].filter((n) => used(n.split(/\s+as\s+/).pop()!));
    if (!def && !named.length) continue;
    lines.push(`import ${[def, named.length ? `{ ${named.join(', ')} }` : ''].filter(Boolean).join(', ')} from '${module}';`);
  }
  return lines.join('\n');
}

/**
 * `BP:hidden` cache le déclencheur au-delà du point de bascule ; avec `all` (le menu sert à toutes les tailles),
 * les classes `BP:` tombent.
 */
function resolveBreakpoint(code: string, point: string): string {
  if (point !== 'all') return code.replace(/\bBP:/g, `${point}:`);
  return code.replace(/ ?\bBP:[\w\-/.[\]]+/g, '').replace(/className=" /g, 'className="');
}

/**
 * Le gabarit avec les styles choisis (`picks` : emplacement → code du style). Un emplacement sans choix garde son
 * style par défaut. Les commentaires d'emplacement disparaissent ; les imports sont fusionnés.
 */
export function applyShellStyles(tpl: string, picks: Partial<Record<ShellSlot, string>> = {}): string {
  const extra: ImportSpec[] = [];
  const filled = tpl.replace(SLOT_RE, (_all, slot: string, bp: string | undefined, fallback: string) => {
    const chosen = picks[slot as ShellSlot];
    // Le défaut du gabarit suit la même règle que le style choisi : son `BP:` devient le point de bascule.
    const code = resolveBreakpoint(chosen ?? fallback, bp ?? 'md');
    if (!chosen) return code;
    const { imports, body } = splitImports(code);
    extra.push(...imports);
    return `${body.trim()}\n\n`;
  });
  const { imports, body } = splitImports(filled);
  const head = mergeImports([...imports, ...extra], body);
  return `${head}\n\n${body.replace(/^\n+/, '').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}
