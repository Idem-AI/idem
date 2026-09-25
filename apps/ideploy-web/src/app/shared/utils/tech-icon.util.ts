/**
 * Best-effort "what stack is this" icon for an application card — there is no
 * stored language-detection result to read (the pipeline's own detection step
 * is per-run, not persisted on the application), so this infers from what is:
 * the build pack an operator chose, and the repository's own name, the same
 * signal a human skimming a project list would use.
 *
 * The icon comes from the design system's set (PrimeIcons, shipped inside
 * Vilevile), which carries no brand marks — so the icon says what ROLE the
 * stack plays (a screen, a runtime, a container) and the brand colour, kept
 * verbatim, is what identifies it.
 */
export interface TechIcon {
  icon: string;
  color: string;
}

const GENERIC: TechIcon = { icon: 'pi pi-box', color: '#60a5fa' };

const NAME_PATTERNS: [RegExp, TechIcon][] = [
  [/angular/i, { icon: 'pi pi-desktop', color: '#e23237' }],
  [/(next|react)/i, { icon: 'pi pi-desktop', color: '#61dafb' }],
  [/vue/i, { icon: 'pi pi-desktop', color: '#42b883' }],
  [/svelte/i, { icon: 'pi pi-desktop', color: '#ff3e00' }],
  [/(django|flask|python)/i, { icon: 'pi pi-code', color: '#3776ab' }],
  [/(laravel|php)/i, { icon: 'pi pi-code', color: '#777bb4' }],
  [/(spring|java)/i, { icon: 'pi pi-code', color: '#e76f00' }],
  [/rust/i, { icon: 'pi pi-code', color: '#dea584' }],
  [/\bgo(lang)?\b/i, { icon: 'pi pi-code', color: '#00add8' }],
  [/rails|ruby/i, { icon: 'pi pi-code', color: '#cc342d' }],
  [/node/i, { icon: 'pi pi-code', color: '#5fa04e' }],
  [/wordpress/i, { icon: 'pi pi-globe', color: '#21759b' }],
];

export function techIcon(app: { name?: string; git_repository?: string | null; build_pack?: string | null }): TechIcon {
  if (app.build_pack === 'dockercompose' || app.build_pack === 'dockerfile') {
    return { icon: 'pi pi-box', color: '#2496ed' };
  }
  if (app.build_pack === 'static') {
    return { icon: 'pi pi-file', color: '#f59e0b' };
  }

  const haystack = `${app.name ?? ''} ${app.git_repository ?? ''}`;
  for (const [pattern, icon] of NAME_PATTERNS) {
    if (pattern.test(haystack)) return icon;
  }
  return GENERIC;
}
