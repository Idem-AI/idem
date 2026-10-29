import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { CommandSpec } from '@/utils/commands';

interface SlashMenuProps {
  id: string;
  commands: CommandSpec[];
  activeIndex: number;
  onPick: (command: CommandSpec) => void;
  onHover: (index: number) => void;
}

/**
 * Le menu des commandes, ouvert dès qu'on tape « / » : chaque commande avec ce qu'elle fait, ce qu'elle attend
 * après son nom, et les touches pour s'y déplacer. Posé au-dessus de la saisie, comme dans les assistants.
 */
export function SlashMenu({ id, commands, activeIndex, onPick, onHover }: SlashMenuProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.startsWith('en') ? 'en' : 'fr';
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  return (
    <div className="absolute bottom-full left-0 right-0 z-50 mb-2 overflow-hidden rounded-lg border border-[var(--glass-border)] bg-surface-1 shadow-lg">
      <p className="border-b border-[var(--glass-border)]/50 px-3 py-1.5 text-xs font-medium text-text-tertiary">{t('chat.commands.menuLabel')}</p>
      {commands.length ? (
        <ul ref={listRef} id={id} role="listbox" aria-label={t('chat.commands.menuLabel')} className="max-h-72 overflow-y-auto py-1">
          {commands.map((command, index) => (
            <li
              key={command.name}
              id={`${id}-${command.name}`}
              role="option"
              aria-selected={index === activeIndex}
              onMouseEnter={() => onHover(index)}
              // Le clic ne doit pas retirer le focus de la saisie avant d'avoir choisi.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onPick(command)}
              className={`flex cursor-pointer items-baseline gap-3 px-3 py-2 ${index === activeIndex ? 'bg-[var(--glass-bg-subtle)]' : ''}`}
            >
              <span className="w-28 flex-none font-mono text-sm text-text-primary">/{command.name}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-text-primary">
                  {command.label[lang]}
                  {command.args && <span className="ml-2 text-xs font-normal text-text-tertiary">{t('chat.commands.args', { args: command.args[lang] })}</span>}
                </span>
                <span className="block text-xs leading-relaxed text-text-secondary">{command.description[lang]}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-3 py-3 text-sm text-text-secondary">{t('chat.commands.empty')}</p>
      )}
      <p className="border-t border-[var(--glass-border)]/50 px-3 py-1.5 text-[11px] text-text-tertiary">{t('chat.commands.hint')}</p>
    </div>
  );
}
