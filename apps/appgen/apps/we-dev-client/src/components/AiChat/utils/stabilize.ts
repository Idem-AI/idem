import { useFileStore } from '@/components/WeIde/stores/fileStore';
import { composePage } from '@/utils/pageComposer';
import { planStabilization } from '@/utils/compileGate';

/**
 * Entre la fin de la génération et le démarrage de l'aperçu.
 *
 * Deux passes, dans cet ordre, toutes deux sans modèle :
 *
 * 1. le compositeur — s'il y a un plan, la page est assemblée par le code, donc
 *    ses imports sont justes par construction ;
 * 2. le portail de compilation — ce que le modèle a écrit lui-même est rendu
 *    exécutable : fichiers manquants bouchés, paquets installés, icônes
 *    sécurisées, `@apply` nettoyé.
 *
 * L'ordre compte : le portail doit voir la page composée, sinon il bouche des
 * imports que le compositeur allait écrire.
 */
export interface StabilizeReport {
  commands: string[];
  composed: boolean;
  issues: string[];
}

export async function stabilizeWorkspace(): Promise<StabilizeReport> {
  const { files, updateContent, addFile, deleteFile } = useFileStore.getState();

  const commands: string[] = [];
  const issues: string[] = [];
  let working = { ...files };
  let composed = false;

  const apply = async (writes: Record<string, string>, deletes: string[] = []) => {
    for (const path of deletes) {
      if (working[path] !== undefined) {
        await deleteFile(path);
        delete working[path];
      }
    }

    for (const [path, content] of Object.entries(writes)) {
      // `closeUpdateChatLog` : ces écritures sont les nôtres, elles n'ont rien à
      // faire dans le contexte renvoyé au modèle au tour suivant.
      if (working[path] === undefined) await addFile(path, content, true);
      else await updateContent(path, content, true, true);
      working[path] = content;
    }
  };

  try {
    const composition = composePage(working);
    if (composition) {
      composed = Object.keys(composition.writes).length > 0;
      await apply(composition.writes);
      commands.push(...composition.commands);
      issues.push(...composition.issues);
    }
  } catch (error) {
    console.warn('[stabilize] composition impossible', error);
  }

  try {
    const plan = planStabilization(working);
    await apply(plan.writes, plan.deletes);
    commands.push(...plan.installs);
    issues.push(...plan.issues.map((issue) => `${issue.kind} · ${issue.file} — ${issue.detail}`));
  } catch (error) {
    console.warn('[stabilize] portail de compilation en échec', error);
  }

  if (issues.length) {
    console.warn(`[stabilize] ${issues.length} réparation(s) :\n- ${issues.join('\n- ')}`);
  }

  return { commands, composed, issues };
}
