import { useTranslation } from 'react-i18next';
import { Compass, Hammer } from 'lucide-react';
import useChatModeStore from '@/stores/chatModeSlice';
import { ChatMode } from '@/types/chat';

/**
 * Bascule Plan / Build.
 *
 * Deux façons de travailler, pas deux produits. **Plan** lit le projet et
 * répond — il inspecte les fichiers et les journaux mais n'écrit jamais, donc
 * on peut lui demander « pourquoi ça plante » sans risquer une réécriture.
 * **Build** modifie le code.
 *
 * Le choix vit dans l'en-tête plutôt que dans la zone de saisie : c'est un
 * état de la session, visible en permanence, pas une option de message.
 */
export function ModeToggle() {
  const { t } = useTranslation();
  const { mode, setMode } = useChatModeStore();

  const options = [
    {
      value: ChatMode.Chat,
      label: t('header.modePlan'),
      hint: t('header.modePlanHint'),
      icon: <Compass className="w-3.5 h-3.5" />,
    },
    {
      value: ChatMode.Builder,
      label: t('header.modeBuild'),
      hint: t('header.modeBuildHint'),
      icon: <Hammer className="w-3.5 h-3.5" />,
    },
  ];

  return (
    <div
      role="radiogroup"
      aria-label={t('header.modeLabel')}
      className="flex items-center gap-0.5 p-0.5 rounded-lg bg-surface-2 border border-[var(--glass-border)]"
    >
      {options.map((option) => {
        const active = mode === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={option.hint}
            onClick={() => setMode(option.value)}
            className={`h-7 px-2.5 flex items-center gap-1.5 rounded-md text-xs font-medium transition-colors ${
              active
                ? 'bg-surface-1 text-text-primary shadow-[var(--glass-shadow-sm)]'
                : 'text-text-tertiary hover:text-text-secondary'
            }`}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export default ModeToggle;
