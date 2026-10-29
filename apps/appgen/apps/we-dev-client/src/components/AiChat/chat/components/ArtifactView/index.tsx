import { openFile } from '../../../../WeIde/emit';
import React, { useEffect, useMemo, useState } from 'react';
import { conversationalProse, describeCommand, describeFile } from '@/utils/stepLabels';
import ReactMarkdown from 'react-markdown';
import { useFileStore } from '../../../../WeIde/stores/fileStore';
import { isThinkContent, processThinkContent } from '../MessageItem';
import { Message } from 'ai';
import { IdemLoader } from '@idem/shared-loader/react';
import { Wand2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { eventEmitter } from '../../../utils/EventEmitter';
import { withoutMarkers } from '@/utils/chatMarkers';

/**
 * La marque posée par le moteur de sites quand il reste quelque chose à
 * corriger : la liste des fichiers concernés (voir `siteEngine/repair.ts`).
 */
const REPAIR_MARK = /<!--\s*idem:repair\s+(\[[\s\S]*?\])\s*-->/;

function repairPaths(text: string): string[] {
  try {
    const paths = JSON.parse(text.match(REPAIR_MARK)?.[1] ?? '[]');
    return Array.isArray(paths) ? paths.filter((path): path is string => typeof path === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Une réponse du modèle qui modifie le projet, racontée comme un travail.
 *
 * La vue montrait des chemins (`src/content/hero.js`), des commandes npm et des
 * boutons « Restore » : la trace d'un outil. Elle montre maintenant une phrase
 * par étape, dans l'ordre où elles arrivent (« J'écris l'accroche de
 * l'accueil », « J'installe les dépendances », « Je démarre l'aperçu »). Le
 * chemin reste au survol, et un clic ouvre toujours le fichier.
 */

interface Step {
  key: string;
  label: string;
  filePath?: string;
}

// Extract file content from streaming boltArtifact content (for real-time editor updates).
// La DERNIÈRE écriture du fichier : le moteur de sites réécrit certains fichiers au fil des étapes (le plan coché à
// chacune, le pied de page qui reçoit le choix de la langue, les pages traduites). La première recopiait une version
// périmée dans l'éditeur — et dans ce qui s'enregistre pendant la génération.
const extractStreamingFileContent = (filePath: string, content: string): string | null => {
  const escapedPath = filePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const openTagRegex = new RegExp(`<boltAction[^>]*filePath="${escapedPath}"[^>]*>`, 'g');
  const openMatch = Array.from(content.matchAll(openTagRegex)).pop();

  if (!openMatch || openMatch.index === undefined) return null;

  const startIndex = openMatch.index + openMatch[0].length;
  const closeTag = '</boltAction>';
  const closeIndex = content.indexOf(closeTag, startIndex);

  if (closeIndex !== -1) {
    return content.substring(startIndex, closeIndex).trim();
  }
  // Still streaming - return partial content
  return content.substring(startIndex).trim();
};

/** Les étapes d'un artefact, fichiers et commandes mêlés, dans l'ordre du flux. */
function stepsOf(content: string): Step[] {
  const steps: Step[] = [];
  const pattern = /<boltAction\s+([^>]*)>([\s\S]*?)(?:<\/boltAction>|$)/g;

  for (const match of Array.from(content.matchAll(pattern))) {
    const attributes = match[1];
    const type = attributes.match(/type="([^"]+)"/)?.[1];

    if (type === 'file') {
      const filePath = attributes.match(/filePath="([^"]+)"/)?.[1];
      if (filePath) steps.push({ key: `file:${filePath}`, label: describeFile(filePath), filePath });
    } else if (type === 'shell' || type === 'start') {
      const command = match[2].trim();
      if (command) steps.push({ key: `command:${steps.length}`, label: describeCommand(command) });
    } else if (type === 'note') {
      // Une ligne d'état écrite par le serveur, déjà en français courant.
      const note = match[2].replace(/<[^>]*>/g, '').trim().slice(0, 140);
      if (note) steps.push({ key: `note:${steps.length}`, label: note });
    }
  }

  // Un fichier réécrit (le plan, coché à chaque étape) reste une seule étape, à sa première place ; et deux étapes
  // de suite qui se disent pareil (deux fichiers d'un même composant) n'en font qu'une à l'écran.
  const seen = new Set<string>();
  return steps
    .filter((step) => !seen.has(step.key) && !!seen.add(step.key))
    .filter((step, index, kept) => index === 0 || step.label !== kept[index - 1].label);
}

interface ArtifactViewProps {
  isUser: boolean;
  title: string;
  message: Message;
  isComplete?: boolean;
  /** Dernier message, génération terminée : le bouton de correction peut servir. */
  canRepair?: boolean;
}

const Prose = ({ text }: { text: string }) => (
  <div className="text-text-primary leading-relaxed prose dark:prose-invert prose-sm max-w-none">
    <ReactMarkdown
      components={{
        p({ children }) {
          return <p className="mb-2 last:mb-0">{children}</p>;
        },
        a({ children, href }) {
          return (
            <a href={href} className="text-purple-600 hover:underline" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          );
        },
      }}
    >
      {text}
    </ReactMarkdown>
  </div>
);

export const ArtifactView: React.FC<ArtifactViewProps> = ({ title, isComplete, message, canRepair = false }) => {
  const { t } = useTranslation();
  const [repairSent, setRepairSent] = useState(false);
  const content = message.content;
  const { updateContent } = useFileStore();
  const [isExpanded, setIsExpanded] = useState(true);

  // Ce que le modèle dit avant et après son travail : montré seulement si
  // c'est une phrase, jamais un document technique (voir conversationalProse).
  const preArtifactContent = useMemo(() => {
    const artifactIndex = content.indexOf('<boltArtifact');
    const pre = artifactIndex > 0 ? content.substring(0, artifactIndex) : '';
    return conversationalProse(isThinkContent(pre) ? '' : pre);
  }, [content]);

  const postArtifactContent = useMemo(() => {
    const artifactEndIndex = content.lastIndexOf('</boltArtifact>');
    const post = artifactEndIndex !== -1 ? content.substring(artifactEndIndex + '</boltArtifact>'.length) : '';
    // La marque de correction n'est pas du texte : retirée avant le filtre de
    // prose, qui écarterait tout le message à cause des chemins qu'elle porte.
    const text = withoutMarkers(post.replace(REPAIR_MARK, ''));
    return conversationalProse(isThinkContent(text) ? processThinkContent(text) : text);
  }, [content]);

  const toRepair = useMemo(() => {
    const artifactEndIndex = content.lastIndexOf('</boltArtifact>');
    return artifactEndIndex === -1 ? [] : repairPaths(content.substring(artifactEndIndex));
  }, [content]);

  const steps = useMemo(() => stepsOf(content), [content]);

  const filePaths = useMemo(
    () => steps.map((step) => step.filePath).filter((path): path is string => !!path),
    [steps]
  );

  // Le fichier en cours d'écriture s'ouvre dans l'éditeur.
  useEffect(() => {
    if (filePaths.length > 0 && !isComplete) {
      openFile(filePaths[filePaths.length - 1]);
    }
  }, [filePaths.length]);

  // Update file content in the Editor in real-time during streaming
  useEffect(() => {
    if (isComplete) return; // onFinish handles the final update
    filePaths.forEach((filePath) => {
      const fileContent = extractStreamingFileContent(filePath, content);
      if (fileContent) {
        updateContent(filePath, fileContent, false, true);
      }
    });
  }, [content, filePaths, isComplete]);

  return (
    <div className="space-y-3">
      {preArtifactContent && <Prose text={preArtifactContent} />}

      <div className="bg-surface-1 rounded-lg overflow-hidden border border-[var(--glass-border)]/50">
        <button
          type="button"
          className="w-full border-b border-[var(--glass-border)]/50 px-3 py-2 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-surface-1 transition-colors text-left"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
        >
          <h3 className="text-text-secondary font-medium text-sm truncate">{title}</h3>
          {!isComplete && (
            <span className="w-4 h-4 flex-shrink-0">
              <IdemLoader size="xs" />
            </span>
          )}
        </button>

        {isExpanded && (
          <ol className="py-1 space-y-0.5">
            {steps.map((step, index) => {
              const running = !isComplete && index === steps.length - 1;
              return (
                <li key={step.key} className="flex items-center gap-2 px-2 py-1.5">
                  <span className="flex-shrink-0 w-4 h-4 grid place-items-center">
                    {running ? (
                      <IdemLoader size="xs" />
                    ) : (
                      <span className="text-green-500 dark:text-green-400 text-sm" aria-hidden="true">
                        ✓
                      </span>
                    )}
                  </span>
                  {step.filePath ? (
                    <button
                      type="button"
                      title={step.filePath}
                      onClick={() => openFile(step.filePath!)}
                      className={`text-sm text-left truncate hover:underline ${
                        running ? 'text-text-tertiary' : 'text-text-secondary'
                      }`}
                    >
                      {step.label}
                    </button>
                  ) : (
                    <span className={`text-sm truncate ${running ? 'text-text-tertiary' : 'text-text-secondary'}`}>
                      {step.label}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {postArtifactContent && <Prose text={postArtifactContent} />}

      {isComplete && canRepair && toRepair.length > 0 && (
        <button
          type="button"
          disabled={repairSent}
          onClick={() => {
            setRepairSent(true);
            eventEmitter.emit('chat:siteRepair', toRepair);
          }}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          <Wand2 size={14} aria-hidden="true" />
          {repairSent ? t('chat.siteRepair.running') : t('chat.siteRepair.cta')}
        </button>
      )}
    </div>
  );
};
