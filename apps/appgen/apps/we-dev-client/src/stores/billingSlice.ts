import { create } from "zustand"
import { BillingMe, fetchBillingMe, fetchProjectAccess } from "@/api/billing"

/**
 * Droits de facturation, partagés par l'atelier.
 *
 * Deux informations seulement, mais consultées partout : **combien de crédits
 * iCode il reste** (compteur de l'en-tête) et **si le projet courant est
 * débloqué** (téléchargement, GitHub, déploiement).
 *
 * L'accès projet est mémorisé par identifiant : la réponse ne change pas d'une
 * seconde à l'autre, et interroger l'API à chaque survol de bouton serait du
 * bruit. Un paiement qui aboutit vide ce cache en rechargeant les droits.
 */

interface BillingState {
  me: BillingMe | null
  isLoading: boolean
  /** Accès connus, par identifiant de projet. */
  projectAccess: Record<string, boolean>
  loadMe: () => Promise<BillingMe | null>
  /** Vrai si le projet est débloqué ; `null` quand la réponse est inconnue. */
  checkProjectAccess: (projectId: string) => Promise<boolean | null>
  /** Après un paiement : tout est relu. */
  refresh: () => Promise<void>
}

const useBillingStore = create<BillingState>()((set, get) => ({
  me: null,
  isLoading: false,
  projectAccess: {},

  loadMe: async () => {
    set(() => ({ isLoading: true }))
    const me = await fetchBillingMe()
    set(() => ({ me, isLoading: false }))
    return me
  },

  checkProjectAccess: async (projectId: string) => {
    const known = get().projectAccess[projectId]
    if (known !== undefined) return known

    const unlocked = await fetchProjectAccess(projectId)

    // Une réponse inconnue (API indisponible) n'est pas mise en cache : on
    // retentera au prochain geste plutôt que de figer un refus qui n'en est
    // peut-être pas un.
    if (unlocked !== null) {
      set((state) => ({ projectAccess: { ...state.projectAccess, [projectId]: unlocked } }))
    }

    return unlocked
  },

  refresh: async () => {
    set(() => ({ projectAccess: {} }))
    await get().loadMe()
  },
}))

export default useBillingStore
