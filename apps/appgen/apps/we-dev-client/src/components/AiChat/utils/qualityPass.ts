import { ChatRequestOptions, CreateMessage, Message } from 'ai';
import { TFunction } from 'i18next';
import { parseMessage } from '@/utils/messagepParseJson';

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

/** Every file the assistant has written so far, latest version winning. */
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

  const files = collectGeneratedFiles(messages);

  if (!Object.keys(files).length) {
    return null;
  }

  const apiBase = process.env.REACT_APP_BASE_URL || '';

  let report: LintResponse;

  try {
    const response = await fetch(`${apiBase}/api/quality/lint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files, expectedLogo: expectedLogoOf(projectData) }),
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
    { role: 'user', content: visible },
    { body: { qualityRepair: report.repairPrompt } }
  );

  return report;
}

/** Lets a new conversation run its own quality pass. */
export const resetQualityPass = (chatId: string): void => {
  repairedChats.delete(chatId);
};
