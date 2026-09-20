/**
 * Scan de sécurité du code généré.
 *
 * Même logique que le linter de design : des règles déterministes, aucune
 * inférence de modèle, donc gratuit et reproductible. Il ne remplace pas un
 * audit — il attrape ce qu'un générateur produit à répétition et que personne
 * ne relit avant de publier : une clé d'API en dur parce que le modèle a voulu
 * un exemple qui marche, un `dangerouslySetInnerHTML` sur une donnée
 * utilisateur, un CORS ouvert à tout.
 *
 * Ne sont retenues ici que les règles à faible taux de faux positifs. Une règle
 * qui crie à chaque génération finit ignorée, ce qui est pire que son absence.
 */

export type SecuritySeverity = 'critical' | 'high' | 'medium';

export interface SecurityFinding {
  rule: string;
  severity: SecuritySeverity;
  file: string;
  line: number;
  excerpt: string;
  message: string;
  fix: string;
}

interface SecurityRule {
  id: string;
  severity: SecuritySeverity;
  message: string;
  fix: string;
  extensions: string[];
  test: (line: string, path: string) => boolean;
}

const CODE = ['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs'];
const ALL = [...CODE, 'json', 'env', 'yml', 'yaml', 'html'];

/** Un secret n'est un secret que s'il a une valeur : `apiKey: process.env.X`
 *  et `apiKey: ""` sont corrects et ne doivent pas déclencher la règle. */
const ASSIGNED_LITERAL = /[:=]\s*['"`][^'"`\s]{12,}['"`]/;

const SECRET_NAMES =
  /\b(api[_-]?key|secret[_-]?key|access[_-]?token|auth[_-]?token|private[_-]?key|client[_-]?secret|password|passwd)\b/i;

/** Préfixes de clés reconnaissables : quasiment aucun faux positif. */
const KNOWN_KEY_SHAPES = [
  /\bsk-[A-Za-z0-9]{20,}/,           // OpenAI et compatibles
  /\bsk_live_[A-Za-z0-9]{16,}/,      // Stripe production
  /\bAIza[0-9A-Za-z_-]{30,}/,        // Google
  /\bghp_[A-Za-z0-9]{30,}/,          // GitHub personal access token
  /\bxox[baprs]-[A-Za-z0-9-]{10,}/,  // Slack
  /\bAKIA[0-9A-Z]{16}\b/,            // AWS access key id
  /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];

const RULES: SecurityRule[] = [
  {
    id: 'hardcoded-secret-shape',
    severity: 'critical',
    message: "Clé d'API ou secret écrit en clair dans le code.",
    fix: "Déplacer la valeur dans une variable d'environnement et la lire côté serveur. Une clé publiée dans un dépôt doit être révoquée, pas seulement retirée.",
    extensions: ALL,
    test: (line) => KNOWN_KEY_SHAPES.some((shape) => shape.test(line)),
  },
  {
    id: 'hardcoded-credential',
    severity: 'critical',
    message: 'Identifiant affecté à une valeur littérale.',
    fix: "Lire la valeur depuis l'environnement. Si le code tourne dans le navigateur, la clé y est visible : le secret doit rester côté serveur.",
    extensions: CODE,
    test: (line, path) => {
      if (/\.(test|spec)\./.test(path)) return false;
      if (!SECRET_NAMES.test(line)) return false;
      if (/process\.env|import\.meta\.env|getenv|Deno\.env/.test(line)) return false;
      // Les exemples et gabarits sont explicitement neutres.
      if (/(your|my|example|placeholder|changeme|xxx+|<[^>]+>)/i.test(line)) return false;
      return ASSIGNED_LITERAL.test(line);
    },
  },
  {
    id: 'client-exposed-secret',
    severity: 'high',
    message: "Secret exposé au navigateur via une variable d'environnement publique.",
    fix: "Un préfixe public (VITE_, NEXT_PUBLIC_, REACT_APP_) est inclus dans le bundle et lisible par tous. Déplacer l'appel derrière une route serveur.",
    extensions: CODE,
    test: (line) =>
      /(VITE_|NEXT_PUBLIC_|REACT_APP_)[A-Z0-9_]*(KEY|SECRET|TOKEN|PASSWORD)/.test(line),
  },
  {
    id: 'dangerous-html',
    severity: 'high',
    message: 'Injection de HTML brut dans le DOM.',
    fix: "Rendre le contenu comme du texte. Si le HTML est indispensable, l'assainir avec DOMPurify avant l'insertion.",
    extensions: CODE,
    test: (line) =>
      /dangerouslySetInnerHTML/.test(line) ||
      /\.innerHTML\s*=/.test(line) ||
      /document\.write\s*\(/.test(line),
  },
  {
    id: 'eval-usage',
    severity: 'high',
    message: 'Exécution de code construit à la volée.',
    fix: "Remplacer par une structure explicite (table de correspondance, JSON.parse). `eval` et `new Function` exécutent tout ce qu'on leur donne.",
    extensions: CODE,
    test: (line) => /\beval\s*\(/.test(line) || /new\s+Function\s*\(/.test(line),
  },
  {
    id: 'open-cors',
    severity: 'medium',
    message: 'CORS ouvert à toutes les origines.',
    fix: "Restreindre `origin` à la liste des domaines de l'application. `*` autorise n'importe quel site à appeler l'API au nom de l'utilisateur.",
    extensions: CODE,
    test: (line) =>
      /origin\s*:\s*['"`]\*['"`]/.test(line) ||
      /Access-Control-Allow-Origin['"`]\s*[,:]\s*['"`]\*/.test(line),
  },
  {
    id: 'sql-string-concat',
    severity: 'high',
    message: 'Requête SQL assemblée par concaténation.',
    fix: 'Utiliser des requêtes paramétrées. Une valeur interpolée dans du SQL est une injection en puissance.',
    extensions: CODE,
    test: (line) =>
      /(SELECT|INSERT|UPDATE|DELETE)\s+[^;'"`]*\$\{/i.test(line) ||
      /(SELECT|INSERT|UPDATE|DELETE)\s+[^;'"`]*['"`]\s*\+\s*\w/i.test(line),
  },
  {
    id: 'insecure-transport',
    severity: 'medium',
    message: 'Appel réseau en HTTP non chiffré.',
    fix: "Passer en HTTPS. En clair, la requête et sa réponse sont lisibles sur le réseau.",
    extensions: CODE,
    test: (line) =>
      /['"`]http:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0)/.test(line),
  },
  {
    id: 'disabled-tls-verification',
    severity: 'critical',
    message: 'Vérification du certificat TLS désactivée.',
    fix: "Réactiver la vérification. Sans elle, HTTPS ne protège plus de rien : n'importe quel intermédiaire peut se faire passer pour le serveur.",
    extensions: CODE,
    test: (line) =>
      /rejectUnauthorized\s*:\s*false/.test(line) ||
      /NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"`]?0/.test(line),
  },
];

export interface SecurityReport {
  findings: SecurityFinding[];
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  filesScanned: number;
  /** Faux dès qu'une faille critique ou haute est présente. */
  safeToPublish: boolean;
}

const extensionOf = (path: string) => path.split('.').pop()?.toLowerCase() ?? '';

export function scanGeneratedFiles(files: Record<string, string>): SecurityReport {
  const findings: SecurityFinding[] = [];
  let filesScanned = 0;

  for (const [path, content] of Object.entries(files)) {
    if (typeof content !== 'string') continue;
    // Le code de dépendances n'est pas le nôtre : le signaler noierait le
    // rapport sous des alertes qu'on ne peut pas corriger ici.
    if (/(^|\/)(node_modules|dist|build|\.next)\//.test(path)) continue;

    const extension = extensionOf(path);
    const lines = content.split('\n');
    filesScanned += 1;

    for (const rule of RULES) {
      if (!rule.extensions.includes(extension)) continue;

      lines.forEach((line, index) => {
        // Une ligne commentée décrit souvent le problème plutôt qu'elle ne le
        // crée ; on ne la retient que pour les formes de clés reconnaissables,
        // où un secret commenté reste un secret publié.
        const isComment = /^\s*(\/\/|\*|#)/.test(line);
        if (isComment && rule.id !== 'hardcoded-secret-shape') return;

        if (!rule.test(line, path)) return;

        findings.push({
          rule: rule.id,
          severity: rule.severity,
          file: path,
          line: index + 1,
          excerpt: line.trim().slice(0, 160),
          message: rule.message,
          fix: rule.fix,
        });
      });
    }
  }

  const criticalCount = findings.filter((f) => f.severity === 'critical').length;
  const highCount = findings.filter((f) => f.severity === 'high').length;
  const mediumCount = findings.filter((f) => f.severity === 'medium').length;

  return {
    findings,
    criticalCount,
    highCount,
    mediumCount,
    filesScanned,
    safeToPublish: criticalCount === 0 && highCount === 0,
  };
}

/** Consigne de correction à envoyer au modèle, ou null si rien à corriger. */
export function buildSecurityRepairPrompt(report: SecurityReport): string | null {
  const actionable = report.findings.filter((finding) => finding.severity !== 'medium');
  if (!actionable.length) return null;

  const lines = actionable
    .slice(0, 25)
    .map(
      (finding) =>
        `- ${finding.file}:${finding.line} — ${finding.message}\n  Correction : ${finding.fix}\n  Ligne : ${finding.excerpt}`
    );

  return [
    'Corrige les problèmes de sécurité suivants dans le projet, sans rien changer',
    "d'autre. Ne réécris pas les fichiers entiers : applique uniquement ces",
    'corrections ciblées.',
    '',
    ...lines,
  ].join('\n');
}
