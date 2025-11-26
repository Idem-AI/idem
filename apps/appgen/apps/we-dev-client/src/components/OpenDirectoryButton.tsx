import React from "react";
import { Tooltip, message } from "antd";

import { updateFileSystemNow } from "./WeIde/services";
import { useFileStore } from "./WeIde/stores/fileStore";
import { ActionButton } from "./Header/ActionButton";
import { useTranslation } from "react-i18next";
import useTerminalStore from "@/stores/terminalSlice";

// Composant adapté pour le mode web
export const OpenDirectoryButton: React.FC = () => {
  const { setEmptyFiles, setIsFirstSend, setIsUpdateSend } = useFileStore();
  const { resetTerminals } = useTerminalStore();
  const { t } = useTranslation();
  
  // En mode web, l'accès au système de fichiers local est limité
  // Cette fonction pourrait éventuellement être adaptée pour utiliser l'API File System Access
  // si le navigateur la prend en charge (Chrome notamment)
  const handleOpenDirectory = async () => {
    try {
      // Version web: afficher un message informatif au lieu d'ouvrir un sélecteur de fichiers
      message.info(t("header.web_mode_info") || "Cette fonctionnalité n'est pas disponible en mode web");
      
      // Pour une future implémentation web native:
      // Ici, on pourrait utiliser l'API File System Access si disponible
      // https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API
      // Exemple:
      // if ('showDirectoryPicker' in window) {
      //   try {
      //     const dirHandle = await window.showDirectoryPicker();
      //     // Traitement des fichiers via l'API FileSystemDirectoryHandle
      //   } catch (e) {
      //     console.error("L'utilisateur a annulé ou le navigateur ne prend pas en charge cette fonctionnalité");
      //   }
      // }
    } catch (error) {
      console.error("Erreur:", error);
      message.error(t("header.error.open_directory"));
    }
  };

  return (
    <Tooltip
      title={
        <div className="text-xs">
          <div className="font-medium mb-1 text-[#333] dark:text-white">
            {t("header.open_directory")}
          </div>
          <div className="text-[#666] dark:text-gray-300">
            {t("header.open_directory_tips")}
          </div>
        </div>
      }
      overlayClassName="bg-white dark:bg-[#1a1a1c] border border-[#e5e5e5] dark:border-[#454545] shadow-lg"
      overlayInnerStyle={{
        padding: "8px 12px",
        borderRadius: "6px",
      }}
      placement="bottom"
    >
      <div className="relative">
        <ActionButton
          onClick={handleOpenDirectory}
          icon={"open"}
          label={t("header.open_directory")}
          className="text-[#424242] dark:text-gray-300 hover:text-[#000] dark:hover:text-white
            bg-white dark:bg-[#333333] hover:bg-[#f5f5f5] dark:hover:bg-[#404040]
            border border-[#e5e5e5] dark:border-[#252525]
            shadow-sm hover:shadow transition-all"
        />
      </div>
    </Tooltip>
  );
};
