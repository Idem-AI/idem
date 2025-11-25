import { useEffect, useState } from 'react';
import useUserStore from '@/stores/userSlice';
import { parseDataFromUrl } from '@/utils/parseDataFromUrl';
import { getProjectById } from '@/api/persistence/db';
import { useLoading } from '@/components/loading';

interface AppInitState {
  isInitialized: boolean;
  hasProject: boolean;
  projectId: string | null;
  projectData: any | null;
  error: string | null;
}

/**
 * Hook pour gérer l'initialisation complète de l'application
 * - Authentification utilisateur
 * - Récupération du projet depuis l'URL
 * - Gestion des états de chargement
 */
export const useAppInit = (): AppInitState => {
  const { fetchUser, isAuthenticated, isLoading: userLoading } = useUserStore();
  const { setLoading } = useLoading();

  const [state, setState] = useState<AppInitState>({
    isInitialized: false,
    hasProject: false,
    projectId: null,
    projectData: null,
    error: null,
  });

  useEffect(() => {
    const initializeApp = async () => {
      try {
        setLoading(true);

        // 1. Récupérer le projectId depuis l'URL
        const urlData = parseDataFromUrl();
        const projectId = urlData.projectId;

        // 2. Authentifier l'utilisateur si nécessaire
        if (!isAuthenticated) {
          await fetchUser();
        }

        // 3. Charger le projet si un projectId est présent
        let projectData = null;
        if (projectId) {
          try {
            projectData = await getProjectById(projectId);
          } catch (error) {
            console.warn('Erreur lors du chargement du projet:', error);
            // Ne pas bloquer l'initialisation si le projet n'existe pas
          }
        }

        // 4. Mettre à jour l'état final
        setState({
          isInitialized: true,
          hasProject: !!projectData,
          projectId: projectId || null,
          projectData,
          error: null,
        });
      } catch (error) {
        console.error("❌ Erreur lors de l'initialisation:", error);
        setState((prev) => ({
          ...prev,
          isInitialized: true,
          error: error instanceof Error ? error.message : "Erreur d'initialisation",
        }));
      } finally {
        setLoading(false);
      }
    };

    // Lancer l'initialisation seulement si pas encore initialisé
    if (!state.isInitialized && !userLoading) {
      initializeApp();
    }
  }, [isAuthenticated, fetchUser, setLoading, state.isInitialized, userLoading]);

  return state;
};
