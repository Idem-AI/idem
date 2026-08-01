/**
 * Slop linter.
 *
 * A deterministic pass over generated files looking for the markers that make
 * an interface read as machine-made. It costs nothing (regex over text, no
 * model call), and it turns "the output sometimes looks generic" into a list of
 * concrete lines to fix.
 *
 * Only what can be detected reliably is a rule here. Taste is the skills' job;
 * this catches the mechanical tells and the two or three outright bugs that
 * ship silently (a blank page, an image with no alt text).
 */

export type Severity = 'error' | 'warning';

export interface Violation {
  rule: string;
  severity: Severity;
  file: string;
  line: number;
  excerpt: string;
  message: string;
  fix: string;
}

interface Rule {
  id: string;
  severity: Severity;
  message: string;
  fix: string;
  /** File extensions the rule applies to. */
  extensions: string[];
  /** Line-level detector. */
  test?: (line: string, context: FileContext) => boolean;
  /** File-level detector, for rules that need to count across lines. */
  testFile?: (content: string, context: FileContext) => number[] | null;
}

interface FileContext {
  path: string;
  /** True when the project defines forged tokens, so stock palettes are off-system. */
  hasForgedTokens: boolean;
}

const CODE_EXTENSIONS = ['jsx', 'tsx', 'js', 'ts'];
const MARKUP_EXTENSIONS = [...CODE_EXTENSIONS, 'html', 'css'];

const BUZZWORDS = [
  'elevate your',
  'unlock the',
  'empower',
  'supercharge',
  'seamless',
  'streamline',
  'leverage',
  'unleash',
  'revolutioniz',
  'revolutionis',
  'transform your',
  'game-chang',
  'cutting-edge',
  'next-generation',
  'world-class',
  'take it to the next level',
  "in today's fast-paced",
  'harness the power',
];

/** Emoji ranges commonly pasted into headings and feature lists. */
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u;

const isComment = (line: string) => /^\s*(\/\/|\/\*|\*|<!--)/.test(line);

export const RULES: Rule[] = [
  {
    id: 'missing-bootstrap-script',
    severity: 'error',
    message: 'index.html has no <script type="module"> — the page renders blank with no console error.',
    fix: 'Add <script type="module" src="/src/main.jsx"></script> inside <body>, right after <div id="root"></div>.',
    extensions: ['html'],
    testFile: (content, context) => {
      if (!/index\.html$/i.test(context.path)) return null;
      return /<script[^>]+type=["']module["']/i.test(content) ? null : [1];
    },
  },
  {
    id: 'package-scripts-missing',
    severity: 'error',
    message:
      'package.json has no "dev" script — the preview never starts and the user sees `npm error Missing script: "dev"`.',
    fix: 'Add "scripts": { "dev": "vite", "build": "vite build", "preview": "vite preview" } to package.json.',
    extensions: ['json'],
    testFile: (content, context) => {
      if (!/(^|\/)package\.json$/.test(context.path)) return null;

      try {
        const manifest = JSON.parse(content);
        return typeof manifest?.scripts?.dev === 'string' && manifest.scripts.dev.trim()
          ? null
          : [1];
      } catch {
        // Unparseable manifest breaks the install outright; worth flagging too.
        return [1];
      }
    },
  },
  {
    id: 'purple-gradient',
    severity: 'error',
    message: 'Purple or violet gradient: the single most recognisable generated-site marker.',
    fix: 'Remove the gradient. Use a solid colour from the forged palette (bg-brand-600, bg-surface, bg-accent).',
    extensions: MARKUP_EXTENSIONS,
    test: (line) =>
      /(from|via|to)-(purple|violet|indigo|fuchsia)-\d{2,3}/.test(line) ||
      /linear-gradient\([^)]*(#7c3aed|#8b5cf6|#6366f1|#a855f7)/i.test(line),
  },
  {
    id: 'gradient-text',
    severity: 'error',
    message: 'Gradient text (bg-clip-text over a gradient) is decoration without meaning.',
    fix: 'Use one solid colour. Create emphasis with weight or size instead.',
    extensions: MARKUP_EXTENSIONS,
    test: (line) => /bg-clip-text/.test(line) || /background-clip:\s*text/.test(line),
  },
  {
    id: 'inter-default',
    severity: 'error',
    message: 'Inter is the default typeface of generated sites.',
    fix: 'Use the display and body families from the forged design system.',
    extensions: [...MARKUP_EXTENSIONS],
    test: (line) => /["'`]Inter["'`]|family=Inter|font-\[?['"]?Inter/.test(line),
  },
  {
    id: 'side-stripe-border',
    severity: 'warning',
    message: 'Coloured side-stripe border. Never a deliberate choice.',
    fix: 'Use a full border, a background tint, or no separator at all.',
    extensions: MARKUP_EXTENSIONS,
    test: (line) => /border-[lr]-(2|4|8)\b/.test(line) && /border-(brand|accent|blue|green|red|yellow|purple|indigo)/.test(line),
  },
  {
    id: 'uppercase-eyebrow',
    severity: 'warning',
    message: 'Tiny uppercase tracked eyebrow above sections: generated grammar when it repeats.',
    fix: 'Keep at most one, as a deliberate brand element. Remove the rest and let the headings carry the sections.',
    extensions: CODE_EXTENSIONS,
    testFile: (content) => {
      const lines = content.split('\n');
      const hits = lines
        .map((line, index) => ({ line, index }))
        .filter(
          ({ line }) =>
            /\buppercase\b/.test(line) &&
            /tracking-(wide|wider|widest)/.test(line) &&
            /text-(xs|sm)\b/.test(line)
        )
        .map(({ index }) => index + 1);

      // One is a choice; two or more is a template.
      return hits.length >= 2 ? hits : null;
    },
  },
  {
    id: 'glassmorphism',
    severity: 'warning',
    message: 'Decorative glassmorphism (backdrop blur over a translucent white surface).',
    fix: 'Use an opaque surface from the palette. Keep blur for genuinely floating layers only.',
    extensions: MARKUP_EXTENSIONS,
    test: (line) => /backdrop-blur/.test(line) && /bg-(white|black|slate|gray)\/\d{1,2}\b/.test(line),
  },
  {
    id: 'light-gray-body',
    severity: 'warning',
    message: 'Light grey body text fails WCAG AA and is off-palette.',
    fix: 'Use text-ink for body copy and text-ink-muted for secondary text; both are contrast-verified.',
    extensions: MARKUP_EXTENSIONS,
    test: (line) => /text-(gray|slate|zinc|neutral|stone)-(300|400|500)\b/.test(line),
  },
  {
    id: 'stock-palette',
    severity: 'warning',
    message: "Tailwind's stock colours sit beside the forged palette and look pasted in.",
    fix: 'Use brand / accent / surface / ink tokens instead.',
    extensions: MARKUP_EXTENSIONS,
    test: (line, context) =>
      context.hasForgedTokens &&
      /\b(bg|text|border)-(blue|indigo|purple|violet|emerald|teal|rose|amber)-(400|500|600|700)\b/.test(line),
  },
  {
    id: 'buzzwords',
    severity: 'warning',
    message: 'Marketing filler with no referent.',
    fix: 'Replace with a concrete noun and a verb describing what the product literally does.',
    extensions: CODE_EXTENSIONS,
    test: (line) => {
      if (isComment(line)) return false;
      const lower = line.toLowerCase();
      return BUZZWORDS.some((word) => lower.includes(word));
    },
  },
  {
    id: 'em-dash',
    severity: 'warning',
    message: 'Em dash in copy.',
    fix: 'Use a comma, colon, semicolon, period or parentheses.',
    extensions: CODE_EXTENSIONS,
    test: (line) => !isComment(line) && /—/.test(line),
  },
  {
    id: 'emoji-in-ui',
    severity: 'warning',
    message: 'Emoji used as a section icon or bullet.',
    fix: 'Use an SVG icon, or nothing.',
    extensions: CODE_EXTENSIONS,
    test: (line) => !isComment(line) && EMOJI.test(line),
  },
  {
    id: 'placeholder-content',
    severity: 'error',
    message: 'Placeholder content left in the output.',
    fix: 'Write real content for this product.',
    extensions: MARKUP_EXTENSIONS,
    test: (line) =>
      /lorem ipsum/i.test(line) ||
      /\b(Feature|Card|Item|Section)\s?(One|Two|Three|1|2|3)\b/.test(line) ||
      /Your (Company|Brand|Product) (Name|Here)/i.test(line),
  },
  {
    id: 'dead-link',
    severity: 'warning',
    message: 'Placeholder href on a link.',
    fix: 'Point it at a real route, or make it a <button> when it triggers an action.',
    extensions: MARKUP_EXTENSIONS,
    test: (line) => /href=["']#["']/.test(line),
  },
  {
    id: 'img-without-alt',
    severity: 'error',
    message: 'Image without alt text.',
    fix: 'Add a descriptive alt, or alt="" when the image is purely decorative.',
    extensions: MARKUP_EXTENSIONS,
    test: (line) => /<img\b/.test(line) && !/\balt=/.test(line),
  },
  {
    id: 'identical-card-grid',
    severity: 'warning',
    message: 'Row of identical cards in a three-column grid.',
    fix: 'Express the real difference between the items: vary size, weight or span, or drop the cards entirely.',
    extensions: CODE_EXTENSIONS,
    testFile: (content) => {
      if (!/grid-cols-3\b/.test(content)) return null;

      const lines = content.split('\n');
      const counts = new Map<string, number[]>();

      lines.forEach((line, index) => {
        const match = line.match(/className=["']([^"']{25,})["']/);
        if (!match) return;
        const key = match[1].trim();
        counts.set(key, [...(counts.get(key) ?? []), index + 1]);
      });

      for (const [, hits] of counts) {
        if (hits.length >= 3) {
          return hits;
        }
      }

      return null;
    },
  },
];

const extensionOf = (path: string) => path.split('.').pop()?.toLowerCase() ?? '';

/** True when the project carries a forged palette, which changes some rules. */
function detectForgedTokens(files: Record<string, string>): boolean {
  const config = files['tailwind.config.js'] || files['tailwind.config.cjs'] || '';
  return /\bink\b/.test(config) && /\bsurface\b/.test(config);
}

export interface LintReport {
  violations: Violation[];
  errorCount: number;
  warningCount: number;
  filesScanned: number;
  /** Issues covered by the repair prompt; the count worth showing a user. */
  repairCount: number;
}

export interface LintOptions {
  /**
   * The project's logo, hosted URL or inline SVG. When given, the linter checks
   * that the generated code actually references it — the deterministic way to
   * catch a logo the model silently dropped.
   */
  expectedLogo?: string;
}

/** Enough of the asset to identify it without matching on whitespace. */
function logoFingerprint(logo: string): string | null {
  const trimmed = logo.trim();

  if (!trimmed) {
    return null;
  }

  if (!trimmed.startsWith('<')) {
    // Hosted URL: the filename is stable and survives query-string edits.
    const withoutQuery = trimmed.split('?')[0];
    const filename = withoutQuery.split('/').filter(Boolean).pop();
    return filename && filename.length > 3 ? filename : withoutQuery;
  }

  // Inline SVG: a path's `d` attribute is the most distinctive fragment.
  const path = trimmed.match(/\sd="([^"]{24,})"/);
  return path ? path[1].slice(0, 24) : null;
}

function checkLogoPresence(
  files: Record<string, string>,
  expectedLogo: string
): Violation | null {
  const fingerprint = logoFingerprint(expectedLogo);

  if (!fingerprint) {
    return null;
  }

  const referenced = Object.values(files).some(
    (content) => typeof content === 'string' && content.includes(fingerprint)
  );

  if (referenced) {
    return null;
  }

  const header =
    Object.keys(files).find((path) => /header|navbar|nav\b/i.test(path)) ||
    Object.keys(files).find((path) => /App\.(jsx|tsx)$/.test(path)) ||
    Object.keys(files)[0];

  return {
    rule: 'logo-missing',
    severity: 'error',
    file: header ?? 'src/App.jsx',
    line: 1,
    excerpt: '',
    message: 'The project logo was supplied but does not appear anywhere in the generated code.',
    fix: expectedLogo.trim().startsWith('<')
      ? 'Paste the brand logo SVG markup into the header (and the footer when there is one), converted to JSX. Never inside an <img>.'
      : `Render the logo in the header (and footer when there is one): <img src="${expectedLogo.trim()}" alt="logo" className="h-10 w-auto" />`,
  };
}

export function lintGeneratedFiles(
  files: Record<string, string>,
  options: LintOptions = {}
): LintReport {
  const hasForgedTokens = detectForgedTokens(files);
  const violations: Violation[] = [];
  let filesScanned = 0;

  if (options.expectedLogo) {
    const missing = checkLogoPresence(files, options.expectedLogo);
    if (missing) {
      violations.push(missing);
    }
  }

  for (const [path, content] of Object.entries(files)) {
    const extension = extensionOf(path);
    const applicable = RULES.filter((rule) => rule.extensions.includes(extension));

    if (!applicable.length || typeof content !== 'string') {
      continue;
    }

    filesScanned++;
    const context: FileContext = { path, hasForgedTokens };
    const lines = content.split('\n');

    for (const rule of applicable) {
      if (rule.testFile) {
        const hits = rule.testFile(content, context);

        for (const line of hits ?? []) {
          violations.push({
            rule: rule.id,
            severity: rule.severity,
            file: path,
            line,
            excerpt: (lines[line - 1] ?? '').trim().slice(0, 160),
            message: rule.message,
            fix: rule.fix,
          });
        }
      }

      if (!rule.test) {
        continue;
      }

      lines.forEach((line, index) => {
        if (rule.test!(line, context)) {
          violations.push({
            rule: rule.id,
            severity: rule.severity,
            file: path,
            line: index + 1,
            excerpt: line.trim().slice(0, 160),
            message: rule.message,
            fix: rule.fix,
          });
        }
      });
    }
  }

  const targets = selectRepairTargets(violations);

  return {
    violations,
    errorCount: violations.filter((violation) => violation.severity === 'error').length,
    warningCount: violations.filter((violation) => violation.severity === 'warning').length,
    filesScanned,
    repairCount: violations.filter((violation) => targets.includes(violation.file)).length,
  };
}

/** Files sent back for repair; beyond this the repair costs more than it saves. */
const MAX_REPAIR_FILES = 4;
const MAX_REPAIR_FILE_CHARS = 12000;

/**
 * Never hand the manifest or a lockfile to the repair pass.
 *
 * The client patches package.json deterministically before running `npm install`
 * (see the client's ensureRunnable), and letting the model rewrite it while the
 * install is in flight is a good way to break a project that was about to work.
 */
const NEVER_REPAIR = /(^|\/)(package(-lock)?\.json|pnpm-lock\.yaml|yarn\.lock)$/;

/** Worst files first: errors weigh more than warnings. */
function selectRepairTargets(violations: Violation[]): string[] {
  const weightByFile = new Map<string, number>();

  for (const violation of violations) {
    if (NEVER_REPAIR.test(violation.file)) {
      continue;
    }

    const weight = violation.severity === 'error' ? 3 : 1;
    weightByFile.set(violation.file, (weightByFile.get(violation.file) ?? 0) + weight);
  }

  return [...weightByFile.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, MAX_REPAIR_FILES)
    .map(([path]) => path);
}

/**
 * Builds a repair request carrying only the offending files and the exact fixes.
 *
 * Regenerating the whole project to remove a gradient is the expensive way to
 * do this. Sending four files and a checklist is roughly 2k tokens and lands
 * more reliably, because the instruction is specific.
 */
export function buildRepairPrompt(
  report: LintReport,
  files: Record<string, string>
): string | null {
  if (!report.violations.length) {
    return null;
  }

  const targets = selectRepairTargets(report.violations);

  const checklist = report.violations
    .filter((violation) => targets.includes(violation.file))
    .map(
      (violation) =>
        `- ${violation.file}:${violation.line} [${violation.rule}] ${violation.message}\n  Fix: ${violation.fix}\n  Line: ${violation.excerpt}`
    )
    .join('\n');

  const payload = targets
    .map((path) => {
      const content = files[path] ?? '';
      const truncated =
        content.length > MAX_REPAIR_FILE_CHARS
          ? `${content.slice(0, MAX_REPAIR_FILE_CHARS)}\n/* … truncated … */`
          : content;
      return `<boltAction type="file" filePath="${path}">\n${truncated}\n</boltAction>`;
    })
    .join('\n');

  return `QUALITY PASS — the generated output tripped the design linter. Fix exactly these issues, change nothing else.

${checklist}

Rewrite only the files below, in full, with the fixes applied. Keep every other file untouched. Keep the design system tokens, the art direction and the existing copy where it is not the problem.

Current contents:
${payload}

Reply with a <boltArtifact> containing only the corrected files. No explanation.`;
}
