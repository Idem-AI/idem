import { useFileStore } from '@/components/WeIde/stores/fileStore';
import { planStabilization } from '@/utils/compileGate';
import { isEngineSite } from '@/utils/siteEngine';

/**
 * Entre la fin de la génération et le démarrage de l'aperçu, sans modèle : le
 * portail de compilation rend exécutable ce que le modèle a écrit (fichiers
 * manquants bouchés, paquets installés, icônes sécurisées, `@apply` nettoyé).
 *
 * Un site vitrine du moteur de design system n'en garde que la résolution des
 * dépendances : ses fichiers ont été vérifiés à la génération et ne sont jamais
 * réécrits après coup. Une erreur s'affiche ; la correction se demande.
 */
export interface StabilizeReport {
  commands: string[];
  issues: string[];
}

export async function stabilizeWorkspace(): Promise<StabilizeReport> {
  const { files, updateContent, addFile, deleteFile } = useFileStore.getState();

  const commands: string[] = [];
  const issues: string[] = [];
  let working = { ...files };

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
    const plan = planStabilization(working);
    if (!isEngineSite(working)) await apply(plan.writes, plan.deletes);
    commands.push(...plan.installs);
    issues.push(...plan.issues.map((issue) => `${issue.kind} · ${issue.file} — ${issue.detail}`));
  } catch (error) {
    console.warn('[stabilize] portail de compilation en échec', error);
  }

  if (issues.length) {
    console.warn(`[stabilize] ${issues.length} réparation(s) :\n- ${issues.join('\n- ')}`);
  }

  return { commands, issues };
}
