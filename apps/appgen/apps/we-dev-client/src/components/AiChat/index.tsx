import { ConfigProvider, theme } from "antd";
import { BaseChat } from "./chat";
import useChatModeStore from "@/stores/chatModeSlice";

const Independent: React.FC = () => {
  const { initOpen } = useChatModeStore();


  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
      }}
    >
      {/*
        Ce conteneur n'avait AUCUNE hauteur : le `h-full` de BaseChat se
        résolvait donc sur un parent en hauteur automatique, c'est-à-dire sur
        rien. La zone de messages grandissait alors avec son contenu au lieu de
        défiler — passé quelques messages, le chat débordait et restait figé,
        sans barre de défilement.

        `calc(100% - 0.75rem)` déduit les marges verticales (my-1.5 × 2) : avec
        un simple `h-full`, la carte dépasserait son panneau de ces 12 px et
        rognerait la zone de saisie.

        La largeur vient du panneau redimensionnable (WorkspaceShell) : pas de
        `w-full`, qui ajouterait la marge gauche et déborderait de 6 px. Le
        400 px en dur d'avant empêchait le chat de suivre la poignée.
      */}
      <div
        data-tour="appgen-chat"
        className={`bg-[rgba(255,255,255)] dark:bg-surface-1 h-[calc(100%-0.75rem)] min-h-0 min-w-0 overflow-hidden flex flex-col rounded-lg p-4 ml-1.5 my-1.5 ${
          initOpen ? 'items-center justify-center' : ''
        }`}
      >
        <BaseChat />
      </div>
    </ConfigProvider>
  );
};
export default Independent;
