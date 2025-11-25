import React, { useState, useEffect } from "react";
import { useUrlData } from "../../hooks/useUrlData";
import { getProjectById, getProjectGeneration } from "../../api/persistence/db";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { LandingPageConfig } from "../../api/persistence/models/development.model";

export enum ChatType {
  APPLICATION = "APPLICATION",
  LANDING_PAGE = "LANDING_PAGE",
}

interface ProjectSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onChatSelect: (chatType: ChatType) => void;
  activeChatType: ChatType;
}

export function ProjectSidebar({
  isOpen,
  onClose,
  onMouseEnter,
  onMouseLeave,
  onChatSelect,
  activeChatType,
}: ProjectSidebarProps) {
  const { t } = useTranslation();
  const { projectId } = useUrlData({ append: () => {} });
  const [projectData, setProjectData] = useState<any>(null);
  const [hasAppGeneration, setHasAppGeneration] = useState(false);
  const [hasLandingGeneration, setHasLandingGeneration] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [landingPageConfig, setLandingPageConfig] = useState<LandingPageConfig>(
    LandingPageConfig.NONE
  );

  useEffect(() => {
    const loadProjectData = async () => {
      if (!projectId) return;

      try {
        setIsLoading(true);

        // Load project data
        const project = await getProjectById(projectId);
        if (project) {
          setProjectData(project);

          // Get landing page config from project analysis
          const config =
            project.analysisResultModel?.development?.configs
              ?.landingPageConfig || LandingPageConfig.NONE;
          setLandingPageConfig(config);

          // Check if generations exist for different chat types
          const appGeneration = await getProjectGeneration(`${projectId}_app`);
          const landingGeneration = await getProjectGeneration(
            `${projectId}_landing`
          );

          setHasAppGeneration(!!appGeneration);
          setHasLandingGeneration(!!landingGeneration);
        }
      } catch (error) {
        console.error("Error loading project data:", error);
        toast.error("Erreur lors du chargement du projet");
      } finally {
        setIsLoading(false);
      }
    };

    loadProjectData();
  }, [projectId]);

  if (!isOpen) return null;

  const getChatConfiguration = () => {
    switch (landingPageConfig) {
      case LandingPageConfig.SEPARATE:
        return {
          showLandingChat: true,
          showAppChat: true,
          description: "Two separate chats: Landing Page and Application",
        };
      case LandingPageConfig.INTEGRATED:
        return {
          showLandingChat: false,
          showAppChat: true,
          description: "Single chat for application (with integrated landing page)",
        };
      case LandingPageConfig.ONLY_LANDING:
        return {
          showLandingChat: true,
          showAppChat: false,
          description: "Single chat for landing page only",
        };
      case LandingPageConfig.NONE:
      default:
        return {
          showLandingChat: false,
          showAppChat: true,
          description: "Single chat for application only",
        };
    }
  };

  const chatConfig = getChatConfiguration();

  return (
    <div
      className="fixed inset-0 z-50 bg-red-400 w-[280px] h-screen"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black "
        onClick={onClose}
      />

      {/* Sidebar */}
      <div className="absolute left-0 top-0 h-full w-96 bg-white dark:bg-gray-900 shadow-xl border-r border-gray-200 dark:border-gray-700">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Project Chats
              </h2>
              <button
                onClick={onClose}
                className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Project Info */}
          <div className="p-4 flex-1 ">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : projectData ? (
              <div className="space-y-4">
                {/* Project Name */}
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                    {projectData.name}
                  </h3>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    {projectData.description || "No description"}
                  </p>
                </div>

                {/* Landing Page Configuration */}
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-purple-900 dark:text-purple-100">
                      Configuration
                    </h4>
                    <div className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
                      {landingPageConfig}
                    </div>
                  </div>
                  <p className="text-sm text-purple-700 dark:text-purple-300">
                    {chatConfig.description}
                  </p>
                </div>

                {/* Chat Sections */}
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    Available Chats
                  </h4>

                  {/* Application Chat */}
                  {chatConfig.showAppChat && (
                    <div
                      className={`rounded-lg p-4 cursor-pointer transition-all duration-200 border-2 ${
                        activeChatType === ChatType.APPLICATION
                          ? "bg-blue-100 dark:bg-blue-900/30 border-blue-500 dark:border-blue-400"
                          : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
                      }`}
                      onClick={() => onChatSelect(ChatType.APPLICATION)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                            <svg
                              className="w-4 h-4 text-blue-600 dark:text-blue-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                              />
                            </svg>
                          </div>
                          <div>
                            <h5 className="font-medium text-gray-900 dark:text-white">
                              Application
                            </h5>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              {landingPageConfig ===
                              LandingPageConfig.INTEGRATED
                                ? "App + Landing Page"
                                : "Application only"}
                            </p>
                          </div>
                        </div>
                        <div
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            hasAppGeneration
                              ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                              : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400"
                          }`}
                        >
                          {hasAppGeneration ? "Ready" : "To generate"}
                        </div>
                      </div>
                      {activeChatType === ChatType.APPLICATION && (
                        <div className="text-xs text-blue-600 dark:text-blue-400 flex items-center space-x-1">
                          <svg
                            className="w-3 h-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                            />
                          </svg>
                          <span>Chat actif</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Landing Page Chat */}
                  {chatConfig.showLandingChat && (
                    <div
                      className={`rounded-lg p-4 cursor-pointer transition-all duration-200 border-2 ${
                        activeChatType === ChatType.LANDING_PAGE
                          ? "bg-green-100 dark:bg-green-900/30 border-green-500 dark:border-green-400"
                          : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
                      }`}
                      onClick={() => onChatSelect(ChatType.LANDING_PAGE)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                            <svg
                              className="w-4 h-4 text-green-600 dark:text-green-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                              />
                            </svg>
                          </div>
                          <div>
                            <h5 className="font-medium text-gray-900 dark:text-white">
                              Landing Page
                            </h5>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              Separate landing page
                            </p>
                          </div>
                        </div>
                        <div
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            hasLandingGeneration
                              ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                              : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400"
                          }`}
                        >
                          {hasLandingGeneration ? "Ready" : "To generate"}
                        </div>
                      </div>
                      {activeChatType === ChatType.LANDING_PAGE && (
                        <div className="text-xs text-green-600 dark:text-green-400 flex items-center space-x-1">
                          <svg
                            className="w-3 h-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                            />
                          </svg>
                          <span>Chat actif</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-gray-500 dark:text-gray-400">
                  <svg
                    className="w-12 h-12 mx-auto mb-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <p>Project not found</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
