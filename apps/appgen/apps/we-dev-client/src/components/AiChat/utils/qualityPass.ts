import { ChatRequestOptions, CreateMessage, Message } from 'ai';
import { TFunction } from 'i18next';
import { parseMessage } from '@/utils/messagepParseJson';
import { useFileStore } from '@/components/WeIde/stores/fileStore';
import { LINT_RELEVANT_SCAFFOLD_PATHS, lockedScaffoldPaths } from '@/utils/scaffoldLock';
import { internalMessage } from '@/utils/stepLabels';

/**
 * Post-generation quality pass.
 *
 * The generated files are sent to the backend's design linter, which is pure
 * regex work and costs no tokens. Only when it finds something does this spend
 * a model call, and then it sends back just the offending files plus the exact
 * fixes rather than asking for the whole project again.
 *
 * Capped at one repair per conversation: a second pass rarely finds anything
 * the first one did not, and an uncapped loop is a good way to burn a token
 * budget on diminishing returns.
 */

type AppendFn = (
  message: Message | CreateMessage,
  chatRequestOptions?: ChatRequestOptions
) => Promise<string | null | undefined>;

interface LintViolation {
  rule: string;
  severity: 'error' | 'warning';
  file: string;
  line: number;
  message: string;
}

interface LintResponse {
  violations: LintViolation[];
  errorCount: number;
  warningCount: number;
  /** Issues the repair pass will actually address; the number worth showing. */
  repairCount: number;
  shouldRepair: boolean;
  repairPrompt: string | null;
}

const repairedChats = new Set<string>();

/**
 * Tout ce que l'assistant a écrit, dernière version gagnante, plus les deux
 * fichiers du socle dont le linter a besoin pour juger.
 *
 * `tailwind.config.js` lui dit que la palette est forgée (plusieurs règles en
 * dépendent) et `index.html` porte le script d'amorçage. Depuis que le socle
 * les écrit, ils ne sont plus dans les messages : sans ce rattrapage, le linter
 * croirait à un projet sans charte et signalerait une page blanche inexistante.
 */
function collectGeneratedFiles(messages: Message[]): Record<string, string> {
  const files: Record<string, string> = {};

  for (const message of messages) {
    if (message.role !== 'assistant' || !message.content) {
      continue;
    }

    Object.assign(files, parseMessage(message.content).files ?? {});
  }

  return files;
}

/** Ajoute au lot les fichiers du socle dont les règles ont besoin. */
function withLintContext(files: Record<string, string>): Record<string, string> {
  const workspace = useFileStore.getState().files;
  const complete = { ...files };

  for (const path of LINT_RELEVANT_SCAFFOLD_PATHS) {
    if (!complete[path] && typeof workspace[path] === 'string') {
      complete[path] = workspace[path];
    }
  }

  return complete;
}

/** The logo the generated site is supposed to show, if the project has one. */
/**
 * Every rendition the generated code could legitimately reference. The linter
 * passes when it finds any one of them, so choosing the dark variant over the
 * light one is not reported as a missing logo.
 */
function expectedLogoOf(projectData?: { analysisResultModel?: any } | null): string[] {
  const logo = projectData?.analysisResultModel?.branding?.logo;

  if (!logo) {
    return [];
  }

  const candidates: unknown[] = [
    logo.assetUrls?.withText?.lightBackground,
    logo.assetUrls?.primary,
    logo.assetUrls?.icon,
    logo.assetUrls?.withText?.darkBackground,
    logo.assetUrls?.iconOnly?.lightBackground,
    logo.variations?.withText?.lightBackground,
    logo.variations?.lightBackground,
    logo.svg,
    logo.iconSvg,
  ];

  return Array.from(
    new Set(
      candidates
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}

export async function runQualityPass(
  chatId: string,
  messages: Message[],
  append: AppendFn,
  t?: TFunction,
  projectData?: { analysisResultModel?: any } | null
): Promise<LintResponse | null> {
  if (repairedChats.has(chatId)) {
    return null;
  }

  const generated = collectGeneratedFiles(messages);

  if (!Object.keys(generated).length) {
    return null;
  }

  const files = withLintContext(generated);

  const apiBase = process.env.REACT_APP_BASE_URL || '';

  let report: LintResponse;

  try {
    const response = await fetch(`${apiBase}/api/quality/lint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        files,
        expectedLogo: expectedLogoOf(projectData),
        // Le socle est jugé mais jamais réparé : c'est le code qui l'écrit, et
        // une réécriture par le modèle ne peut que l'abîmer.
        locked: lockedScaffoldPaths(),
      }),
    });

    if (!response.ok) {
      console.warn('[quality] lint request failed:', response.status);
      return null;
    }

    report = await response.json();
  } catch (error) {
    // The quality pass is an enhancement, never a blocker: a backend that is
    // down must not stop the user from seeing what was just generated.
    console.warn('[quality] lint unavailable:', error);
    return null;
  }

  console.log(
    `[quality] ${report.errorCount} errors, ${report.warningCount} warnings across ${Object.keys(files).length} files`,
    report.violations
  );

  if (!report.shouldRepair || !report.repairPrompt) {
    return report;
  }

  repairedChats.add(chatId);

  const count = report.repairCount || report.violations.length;

  // The transcript gets one short line saying what is happening. The checklist
  // and the file payload travel out of band in the request body, so the user is
  // never shown a wall of machine instructions.
  const visible = t?.('chat.quality_pass', { count }) ?? `Applying ${count} design fixes.`;

  await append(
    { role: 'user', content: internalMessage(visible) },
    { body: { qualityRepair: report.repairPrompt } }
  );

  return report;
}

/** Lets a new conversation run its own quality pass. */
export const resetQualityPass = (chatId: string): void => {
  repairedChats.delete(chatId);
};
