/**
 * Best-effort "what stack is this" icon for an application card — there is no
 * stored language-detection result to read (the pipeline's own detection step
 * is per-run, not persisted on the application), so this infers from what is:
 * the build pack an operator chose, and the repository's own name, the same
 * signal a human skimming a project list would use.
 */
export interface TechIcon {
  icon: string;
  color: string;
}

const GENERIC: TechIcon = { icon: 'fa-solid fa-cube', color: '#60a5fa' };

const NAME_PATTERNS: [RegExp, TechIcon][] = [
  [/angular/i, { icon: 'fa-brands fa-angular', color: '#e23237' }],
  [/(next|react)/i, { icon: 'fa-brands fa-react', color: '#61dafb' }],
  [/vue/i, { icon: 'fa-brands fa-vuejs', color: '#42b883' }],
  [/svelte/i, { icon: 'fa-solid fa-fire', color: '#ff3e00' }],
  [/(django|flask|python)/i, { icon: 'fa-brands fa-python', color: '#3776ab' }],
  [/(laravel|php)/i, { icon: 'fa-brands fa-php', color: '#777bb4' }],
  [/(spring|java)/i, { icon: 'fa-brands fa-java', color: '#e76f00' }],
  [/rust/i, { icon: 'fa-brands fa-rust', color: '#dea584' }],
  [/\bgo(lang)?\b/i, { icon: 'fa-solid fa-feather-pointed', color: '#00add8' }],
  [/rails|ruby/i, { icon: 'fa-solid fa-gem', color: '#cc342d' }],
  [/node/i, { icon: 'fa-brands fa-node-js', color: '#5fa04e' }],
  [/wordpress/i, { icon: 'fa-brands fa-wordpress', color: '#21759b' }],
];

export function techIcon(app: { name?: string; git_repository?: string | null; build_pack?: string | null }): TechIcon {
  if (app.build_pack === 'dockercompose' || app.build_pack === 'dockerfile') {
    return { icon: 'fa-brands fa-docker', color: '#2496ed' };
  }
  if (app.build_pack === 'static') {
    return { icon: 'fa-solid fa-file-code', color: '#f59e0b' };
  }

  const haystack = `${app.name ?? ''} ${app.git_repository ?? ''}`;
  for (const [pattern, icon] of NAME_PATTERNS) {
    if (pattern.test(haystack)) return icon;
  }
  return GENERIC;
}
