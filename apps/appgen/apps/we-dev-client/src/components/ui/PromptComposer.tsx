import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Mic, ArrowUp, X, FileText, Image as ImageIcon, Square } from 'lucide-react';
import { toast } from 'react-toastify';

/**
 * Types acceptés.
 *
 * Images : transmises au modèle, qui les lit.
 * Markdown et texte : lus côté client et joints au contexte de la demande.
 *
 * Le PDF est volontairement absent : rien dans la chaîne ne sait aujourd'hui en
 * extraire le texte, et l'accepter donnerait un bouton qui promet plus qu'il ne
 * fait. Il faudra un analyseur (pdf.js) pour l'ouvrir.
 */
const ACCEPT = 'image/*,.md,.markdown,.txt';
const MAX_FILE_BYTES = 10 * 1024 * 1024;

export interface ComposerAttachment {
  id: string;
  file: File;
  kind: 'image' | 'document';
  /** Aperçu local, pour les images seulement. */
  preview?: string;
}

interface PromptComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  /** Textes qui défilent tant que le champ est vide. */
  placeholders: string[];
  attachments: ComposerAttachment[];
  onAttachmentsChange: (attachments: ComposerAttachment[]) => void;
  autoFocus?: boolean;
  className?: string;
}

/** Intervalle de rotation du texte d'invite. Assez long pour être lu en entier. */
const ROTATE_MS = 3600;

/**
 * Zone de saisie de la page d'accueil.
 *
 * C'est le point d'entrée du produit : tout ce qu'on demande à l'utilisateur
 * tient ici. Elle porte donc quatre affordances plutôt qu'un simple champ —
 * joindre un document, dicter, écrire, envoyer — et fait défiler des exemples
 * en filigrane, ce qui remplace avantageusement une liste d'exemples posée en
 * dessous : la suggestion arrive là où l'on regarde déjà.
 */
export function PromptComposer({
  value,
  onChange,
  onSubmit,
  placeholders,
  attachments,
  onAttachmentsChange,
  autoFocus,
  className = '',
}: PromptComposerProps) {
  const { t } = useTranslation();
  const inputId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [fading, setFading] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  /* -------- Invite qui défile -------- */
  useEffect(() => {
    // Une invite qui bouge pendant qu'on écrit est une distraction : la
    // rotation s'arrête dès la première frappe.
    if (value || placeholders.length < 2) return;

    const timer = window.setInterval(() => {
      setFading(true);
      window.setTimeout(() => {
        setPlaceholderIndex((index) => (index + 1) % placeholders.length);
        setFading(false);
      }, 260);
    }, ROTATE_MS);

    return () => window.clearInterval(timer);
  }, [value, placeholders.length]);

  /* -------- Hauteur automatique -------- */
  useEffect(() => {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${Math.min(node.scrollHeight, 200)}px`;
  }, [value]);

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus();
  }, [autoFocus]);

  /* -------- Pièces jointes -------- */
  const addFiles = useCallback(
    (files: FileList | null) => {
      if (!files?.length) return;

      const accepted: ComposerAttachment[] = [];
      for (const file of Array.from(files)) {
        if (file.size > MAX_FILE_BYTES) {
          toast.error(t('composer.tooLarge', { name: file.name }));
          continue;
        }
        const isImage = file.type.startsWith('image/');
        accepted.push({
          id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          kind: isImage ? 'image' : 'document',
          preview: isImage ? URL.createObjectURL(file) : undefined,
        });
      }

      if (accepted.length) onAttachmentsChange([...attachments, ...accepted]);
    },
    [attachments, onAttachmentsChange, t]
  );

  const removeAttachment = useCallback(
    (id: string) => {
      const target = attachments.find((item) => item.id === id);
      // L'URL d'aperçu est révoquée à la main : sans cela le blob reste en
      // mémoire tant que l'onglet est ouvert.
      if (target?.preview) URL.revokeObjectURL(target.preview);
      onAttachmentsChange(attachments.filter((item) => item.id !== id));
    },
    [attachments, onAttachmentsChange]
  );

  useEffect(
    () => () => {
      attachments.forEach((item) => item.preview && URL.revokeObjectURL(item.preview));
    },
    // Nettoyage au démontage seulement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  /* -------- Dictée -------- */
  const speechSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const toggleDictation = useCallback(() => {
    if (!speechSupported) {
      toast.info(t('composer.dictationUnsupported'));
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = document.documentElement.lang || 'fr-FR';
    recognition.interimResults = true;
    recognition.continuous = true;

    // La transcription est ajoutée à ce qui était déjà écrit : dicter ne doit
    // pas effacer une phrase commencée au clavier.
    const base = value;

    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      onChange(base ? `${base} ${transcript}`.trim() : transcript);
    };
    recognition.onerror = () => {
      setListening(false);
      toast.error(t('composer.dictationFailed'));
    };
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [listening, onChange, speechSupported, t, value]);

  useEffect(() => () => recognitionRef.current?.stop?.(), []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (value.trim()) onSubmit();
    }
  };

  const canSubmit = value.trim().length > 0;

  return (
    <div
      className={`rounded-2xl border border-[var(--glass-border-medium)] bg-surface-1 shadow-[var(--glass-shadow-lg)] transition-colors focus-within:border-primary ${className}`}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        addFiles(event.dataTransfer.files);
      }}
    >
      {attachments.length > 0 && (
        <ul className="flex flex-wrap gap-2 px-4 pt-4">
          {attachments.map((item) => (
            <li
              key={item.id}
              className="group relative flex items-center gap-2 pl-2 pr-7 py-1.5 rounded-lg border border-[var(--glass-border)] bg-surface-2 max-w-[220px]"
            >
              {item.preview ? (
                <img src={item.preview} alt="" className="w-6 h-6 rounded object-cover shrink-0" />
              ) : item.kind === 'image' ? (
                <ImageIcon className="w-4 h-4 shrink-0 text-text-tertiary" />
              ) : (
                <FileText className="w-4 h-4 shrink-0 text-text-tertiary" />
              )}
              <span className="text-xs text-text-secondary truncate">{item.file.name}</span>
              <button
                type="button"
                onClick={() => removeAttachment(item.id)}
                aria-label={t('composer.removeFile', { name: item.file.name })}
                className="absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 grid place-items-center rounded text-text-tertiary hover:text-danger hover:bg-surface-3 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="relative">
        <label htmlFor={inputId} className="sr-only">
          {t('composer.label')}
        </label>
        <textarea
          id={inputId}
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          className="w-full bg-transparent text-text-primary text-base leading-relaxed px-4 pt-4 pb-2 resize-none focus:outline-none"
        />

        {/* Invite en filigrane : un vrai `placeholder` ne peut pas s'animer,
            donc il est peint par-dessus le champ vide. */}
        {!value && placeholders.length > 0 && (
          <p
            aria-hidden
            className={`pointer-events-none absolute left-4 top-4 right-4 text-base leading-relaxed text-text-disabled transition-opacity duration-250 ${
              fading ? 'opacity-0' : 'opacity-100'
            }`}
          >
            {placeholders[placeholderIndex]}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1.5 px-3 pb-3">
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(event) => {
            addFiles(event.target.files);
            // Réinitialisé pour que re-sélectionner le même fichier déclenche
            // à nouveau l'événement.
            event.target.value = '';
          }}
        />

        <IconAction
          onClick={() => fileRef.current?.click()}
          label={t('composer.attach')}
          icon={<Plus className="w-4 h-4" />}
        />

        <div className="flex-1" />

        <IconAction
          onClick={toggleDictation}
          label={listening ? t('composer.stopDictation') : t('composer.dictate')}
          active={listening}
          icon={listening ? <Square className="w-3.5 h-3.5" /> : <Mic className="w-4 h-4" />}
        />

        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          aria-label={t('composer.submit')}
          title={t('composer.submit')}
          className="w-9 h-9 grid place-items-center rounded-full bg-primary text-white transition disabled:opacity-30 disabled:cursor-not-allowed enabled:hover:brightness-110 enabled:active:scale-95"
        >
          <ArrowUp className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function IconAction({
  onClick,
  icon,
  label,
  active,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`w-9 h-9 grid place-items-center rounded-full transition-colors ${
        active
          ? 'bg-danger/15 text-danger'
          : 'text-text-tertiary hover:text-text-primary hover:bg-surface-2'
      }`}
    >
      {icon}
    </button>
  );
}

export default PromptComposer;
