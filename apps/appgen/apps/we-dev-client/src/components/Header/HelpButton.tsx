import React, { useState } from "react";
import { ProjectTutorial } from "../Onboarding/ProjectTutorial";
import { useUrlData } from "../../hooks/useUrlData";
import { getProjectById } from "../../api/persistence/db";
import { Modal } from "antd";
import { ProjectModel } from "@/api/persistence/models/project.model";

export function HelpButton() {
  const [showTutorial, setShowTutorial] = useState(false);
  const [projectData, setProjectData] = useState<ProjectModel | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { projectId } = useUrlData({ append: () => {} });

  const handleHelpClick = async () => {
    if (projectId) {
      setIsLoading(true);
      try {
        const project = await getProjectById(projectId);
        setProjectData(project);
        setShowTutorial(true);
      } catch (error) {
        console.error("Error loading project for tutorial:", error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleCloseTutorial = () => {
    setShowTutorial(false);
    setProjectData(null);
  };

  return (
    <>
      <button
        onClick={handleHelpClick}
        disabled={isLoading}
        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Show Tutorial"
      >
        {isLoading ? (
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
      </button>

      <Modal
        open={showTutorial}
        onCancel={handleCloseTutorial}
        footer={null}
        width={800}
        centered
        className="tutorial-modal"
        styles={{
          content: { 
            backgroundColor: "var(--color-bg-light)",
            padding: 0
          },
          header: { 
            display: "none" 
          },
        }}
        destroyOnClose
      >
        {projectData && (
          <ProjectTutorial
            projectData={projectData}
            onClose={handleCloseTutorial}
          />
        )}
      </Modal>
    </>
  );
}
