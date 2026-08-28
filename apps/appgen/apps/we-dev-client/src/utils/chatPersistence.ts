import type { Message } from 'ai/react';

/**
 * Conversations are stored in the database while the generated code lives in
 * the bucket. Keeping the raw `<boltArtifact>` blocks in the messages would
 * duplicate every file in the database and blow past the per-document size
 * limit, so artifacts are replaced by a short summary line before saving.
 *
 * Removing the tags entirely (rather than emptying them) is deliberate: the
 * loader derives workspace files from message content, and an artifact with an
 * empty body would overwrite real files with blank ones.
 */
const ARTIFACT_REGEX = /<boltArtifact[^>]*>[\s\S]*?<\/boltArtifact>/g;
const ARTIFACT_TITLE_REGEX = /title="([^"]*)"/;
const ACTION_PATH_REGEX = /<boltAction\s+type="file"\s+filePath="([^"]+)"/g;

/** Marker prefix that lets us recognise our own summaries on reload. */
export const ARTIFACT_SUMMARY_PREFIX = '📄';

function summarizeArtifact(block: string): string {
  const title = block.match(ARTIFACT_TITLE_REGEX)?.[1]?.trim();

  const paths: string[] = [];
  let match: RegExpExecArray | null;
  ACTION_PATH_REGEX.lastIndex = 0;
  while ((match = ACTION_PATH_REGEX.exec(block)) !== null) {
    paths.push(match[1]);
  }

  if (paths.length === 0) {
    return title ? `${ARTIFACT_SUMMARY_PREFIX} ${title}` : '';
  }

  const shown = paths.slice(0, 12).map((path) => `\`${path}\``);
  const remainder = paths.length - shown.length;
  const suffix = remainder > 0 ? ` _(+${remainder})_` : '';

  return `${ARTIFACT_SUMMARY_PREFIX} **${title || 'Fichiers générés'}** (${paths.length}) : ${shown.join(', ')}${suffix}`;
}

/**
 * Replaces every artifact block of a message with a one-line summary.
 */
export function compactMessageContent(content: string): string {
  if (!content || !content.includes('<boltArtifact')) return content;

  return content
    .replace(ARTIFACT_REGEX, (block) => summarizeArtifact(block))
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Synthetic context messages the chat injects to hand the current workspace to
 * the model. They are rebuilt from the files on every load, so storing them
 * would only bloat the record and duplicate the code.
 */
function isSyntheticContextMessage(message: Pick<Message, 'id' | 'content'>): boolean {
  const content = message.content || '';
  return (
    content.includes('<boltArtifact id="hello-js"') ||
    content.includes('<boltArtifact id="existing-code"')
  );
}

/**
 * Size budget for the stored conversation, well under the 1 MiB Firestore
 * document limit. Beyond it the oldest messages are dropped, newest kept.
 */
const MAX_STORED_CHARS = 600_000;

/**
 * Prepares the conversation for storage: artifacts summarized, and only the
 * fields needed to render the thread again are kept.
 */
export function compactMessagesForStorage(
  messages: Array<Pick<Message, 'id' | 'role' | 'content'>>
): Array<{ id: string; role: string; content: string }> {
  const compacted = messages
    .filter((message) => !isSyntheticContextMessage(message))
    .map((message) => ({
      id: message.id,
      role: message.role as string,
      content: compactMessageContent(message.content || ''),
    }))
    .filter((message) => message.content.length > 0);

  let budget = MAX_STORED_CHARS;
  const kept: typeof compacted = [];

  for (let i = compacted.length - 1; i >= 0; i--) {
    budget -= compacted[i].content.length;
    if (budget < 0) break;
    kept.unshift(compacted[i]);
  }

  if (kept.length < compacted.length) {
    console.warn(
      `Chat history truncated for storage: kept ${kept.length}/${compacted.length} messages`
    );
  }

  return kept;
}

/**
 * Derives a readable title from the first genuine user message.
 */
export function deriveSessionTitle(
  messages: Array<Pick<Message, 'role' | 'content'>>,
  fallback: string
): string {
  const firstUserMessage = messages.find(
    (message) =>
      message.role === 'user' &&
      message.content &&
      !message.content.includes('<boltArtifact') &&
      !message.content.startsWith(ARTIFACT_SUMMARY_PREFIX)
  );

  return firstUserMessage?.content?.slice(0, 60) || fallback;
}
