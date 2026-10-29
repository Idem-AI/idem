/**
 * Les commandes « / » d'iCode, telles que le serveur les définit (`we-dev-next/src/commands/registry.ts`) :
 * lues une fois, gardées en mémoire. Le menu de la barre de saisie s'en sert, et l'atelier y reconnaît les
 * commandes qu'il règle lui-même (mise en ligne, nom de domaine, communication, corriger, aide).
 */

export interface CommandSpec {
  name: string;
  aliases: string[];
  run: 'server' | 'client';
  needs?: 'project';
  label: { fr: string; en: string };
  description: { fr: string; en: string };
  args?: { fr: string; en: string };
}

let cache: Promise<CommandSpec[]> | null = null;

export function loadCommands(): Promise<CommandSpec[]> {
  if (!cache) {
    cache = fetch(`${process.env.REACT_APP_BASE_URL}/api/commands`)
      .then((response) => (response.ok ? response.json() : { commands: [] }))
      .then((data: { commands?: CommandSpec[] }) => (Array.isArray(data.commands) ? data.commands : []))
      .catch(() => {
        // Réessayé à la prochaine ouverture du menu.
        cache = null;
        return [];
      });
  }
  return cache;
}

const fold = (value: string) => value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** `/publier` → la commande et ce qui la suit ; `null` si ce n'en est pas une connue. */
export function parseCommand(text: string, commands: CommandSpec[]): { command: CommandSpec; args: string } | null {
  const match = String(text || '').trim().match(/^\/([a-zA-ZÀ-ſ-]+)(?:\s+([\s\S]*))?$/);
  if (!match) return null;
  const word = fold(match[1]);
  const command = commands.find((c) => c.name === word || c.aliases.includes(word));
  return command ? { command, args: (match[2] ?? '').trim() } : null;
}

/** Les commandes qui commencent par ce qui est tapé (nom, alias ou libellé). */
export function filterCommands(query: string, commands: CommandSpec[], lang: 'fr' | 'en'): CommandSpec[] {
  const q = fold(query.replace(/^\//, ''));
  if (!q) return commands;
  return commands.filter((c) => c.name.startsWith(q) || c.aliases.some((a) => a.startsWith(q)) || fold(c.label[lang]).includes(q));
}
