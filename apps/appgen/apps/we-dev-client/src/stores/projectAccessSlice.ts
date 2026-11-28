/**
 * Les droits de la personne connectée sur le projet ouvert dans iCode.
 *
 * Un projet peut être celui d'un autre : son propriétaire a invité cette
 * personne dans l'équipe et lui a ouvert l'espace « Site internet » en
 * lecture (voir) ou en écriture (modifier). En lecture, on montre le site
 * sans la saisie du chat ; sans accès du tout, on n'ouvre rien.
 *
 *   unknown   pas encore vérifié, ou pas un projet IDEM (brouillon) ;
 *   edit      propriétaire, ou membre qui modifie le site ;
 *   readOnly  membre qui voit le site sans le modifier.
 */
import { create } from 'zustand';

export type ProjectAccessStatus = 'unknown' | 'edit' | 'readOnly';

interface ProjectAccessState {
  status: ProjectAccessStatus;
  setStatus: (status: ProjectAccessStatus) => void;
}

const useProjectAccessStore = create<ProjectAccessState>((set) => ({
  status: 'unknown',
  setStatus: (status) => set({ status }),
}));

export default useProjectAccessStore;
