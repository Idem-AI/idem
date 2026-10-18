import React, { useState, useRef, useEffect } from "react";
import classNames from "classnames";
import { App, Tooltip, Modal, Input } from "antd";
import { Image, ChevronDown, Figma } from "lucide-react";
import type { UploadButtonsProps } from "./types";

import { useTranslation } from "react-i18next";
import { IModelOption } from "../..";
import useChatStore from "@/stores/chatSlice";
import { aiProvierIcon } from "./config";
import MCPToolsButton from "./MCPToolsButton";

export const UploadButtons: React.FC<UploadButtonsProps> = ({
  isLoading,
  isUploading,
  append,
  onImageClick,
  baseModal,
  messages,
  handleSubmitWithFiles,
  setMessages,
  setBaseModal,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useTranslation();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { modelOptions, clearImages } = useChatStore();
  const [isFigmaModalOpen, setIsFigmaModalOpen] = useState(false);
  const [figmaUrl, setFigmaUrl] = useState(
    () => localStorage.getItem("figmaUrl") || ""
  );
  const [figmaToken, setFigmaToken] = useState(
    () => localStorage.getItem("figmaToken") || ""
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleModelSelect = (model: IModelOption) => {
    setBaseModal(model);
    setIsOpen(false);
    console.log("Selected model:", model.value);
  };

  const handleFigmaSubmit = () => {
    localStorage.setItem("figmaUrl", figmaUrl);
    localStorage.setItem("figmaToken", figmaToken);
    setIsFigmaModalOpen(false);
  };

  // 定义一个可复用的按钮样式组件
  const ToolbarButton = React.forwardRef<HTMLButtonElement, any>(
    (props, ref) => (
      <button
        ref={ref}
        {...props}
        className={classNames(
          "outer-button p-2 flex",
          props.disabled && "opacity-50 cursor-not-allowed",
          props.className
        )}
      >
        {props.children}
      </button>
    )
  );
  const canUseMCP = false;

  return (
    <div className="flex items-center">
      <div className="flex items-center gap-2">
        {/* MCP Tools Button - Désactivé en mode web */}
        {false && (
          <Tooltip
            title={
              <div className="text-xs">
                <div className="font-medium mb-1">
                  {!canUseMCP
                    ? t("chat.buttons.mcp_disabled")
                    : t("chat.buttons.mcp_tools")}
                </div>
                <div className="text-gray-300">
                  {!canUseMCP
                    ? t("chat.buttons.not_support_mcp")
                    : t("chat.buttons.click_to_use_mcp")}
                </div>
              </div>
            }
            placement="bottom"
          >
            <span className={!canUseMCP ? "cursor-not-allowed" : ""}>
              <MCPToolsButton
                ToolbarButton={ToolbarButton}
                disabled={!canUseMCP}
              />
            </span>
          </Tooltip>
        )}

        {/* figma todo */}
        {/* <Tooltip
          title={
            <div className="text-xs">
              <div className="font-medium mb-1">
                {t("chat.buttons.figma_integration")}
              </div>
            </div>
          }
          placement="bottom"
        >
          <button
            type="button"
            onClick={() => setIsFigmaModalOpen(true)}
            className="outer-button p-2 flex"
          >
            <Figma className="w-4 h-4" />
          </button>
        </Tooltip> */}

        <Tooltip
          title={
            <div className="text-xs">
              <div className="font-medium mb-1">
                {isLoading || isUploading || !baseModal.useImage
                  ? t("chat.buttons.upload_disabled")
                  : t("chat.buttons.upload_image")}
              </div>
              <div className="text-gray-300">
                {isLoading || isUploading
                  ? t("chat.buttons.waiting")
                  : !baseModal.useImage
                    ? t("chat.buttons.not_support_image")
                    : t("chat.buttons.click_to_upload")}
              </div>
            </div>
          }
          placement="bottom"
        >
          <ToolbarButton
            type="button"
            onClick={onImageClick}
            disabled={isLoading || isUploading || !baseModal.useImage}
            // className={classNames(
            //   "p-2 text-text-tertiary flex hover:text-text-primary hover:bg-surface-2/20 rounded-lg transition-all duration-200",
            //   (isLoading || isUploading || !baseModal.useImage) &&
            //   "opacity-50 cursor-not-allowed"
            // )}
          >
            <Image className="w-4 h-4" />
          </ToolbarButton>
        </Tooltip>
      </div>

      {/* Plus de choix de modèle : le niveau de créativité se choisit sur le bouton d'envoi (SendButton). */}
    </div>
  );
};
