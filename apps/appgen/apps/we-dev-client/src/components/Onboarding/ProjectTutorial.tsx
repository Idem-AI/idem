import React, { useState, useEffect, useMemo } from "react";
import { useUrlData } from "../../hooks/useUrlData";
import { ProjectModel } from "@/api/persistence/models/project.model";

interface ProjectTutorialProps {
  projectData: ProjectModel;
  onClose: () => void;
}

export function ProjectTutorial({
  projectData,
  onClose,
}: ProjectTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const { projectId } = useUrlData({ append: () => {} });

  // Extract project colors for theming
  const projectColors = useMemo(() => {
    const colors = projectData?.analysisResultModel?.branding?.colors?.colors;
    if (colors) {
      return {
        primary: colors.primary || "#3B82F6",
        secondary: colors.secondary || "#8B5CF6",
        accent: colors.accent || "#10B981",
        background: colors.background || "#F3F4F6",
        text: colors.text || "#1F2937",
      };
    }
    // Fallback colors
    return {
      primary: "#3B82F6",
      secondary: "#8B5CF6",
      accent: "#10B981",
      background: "#F3F4F6",
      text: "#1F2937",
    };
  }, [projectData]);

  // Generate CSS custom properties for dynamic styling
  const customStyles = {
    "--tutorial-primary": projectColors.primary,
    "--tutorial-secondary": projectColors.secondary,
    "--tutorial-accent": projectColors.accent,
    "--tutorial-background": projectColors.background,
    "--tutorial-text": projectColors.text,
  } as React.CSSProperties;

  const steps = [
    {
      title: "Welcome to Your Project Generation Workspace",
      content: (
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-300">
            This is your dedicated workspace for generating code for{" "}
            <strong>{projectData?.name}</strong>.
          </p>
          <div
            className="p-4 rounded-lg"
            style={{
              backgroundColor: `${projectColors.primary}15`,
              border: `1px solid ${projectColors.primary}30`,
            }}
          >
            <h4
              className="font-medium mb-2"
              style={{ color: projectColors.primary }}
            >
              Project Details:
            </h4>
            <p
              className="text-sm"
              style={{ color: `${projectColors.primary}CC` }}
            >
              {projectData?.description || "No description available"}
            </p>
          </div>
        </div>
      ),
      icon: (
        <svg
          className="w-6 h-6"
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
      ),
    },
    {
      title: "How to Generate Your Application",
      content: (
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-300">
            Click the <strong>"Generate Now"</strong> button to start creating
            your application based on your project specifications.
          </p>
          <div
            className="p-4 rounded-lg"
            style={{
              backgroundColor: `${projectColors.accent}15`,
              border: `1px solid ${projectColors.accent}30`,
            }}
          >
            <h4
              className="font-medium mb-2"
              style={{ color: projectColors.accent }}
            >
              What happens next:
            </h4>
            <ul
              className="text-sm space-y-1"
              style={{ color: `${projectColors.accent}CC` }}
            >
              <li>• AI analyzes your project requirements</li>
              <li>• Generates complete application code</li>
              <li>• Creates all necessary files and structure</li>
              <li>• Provides export options when complete</li>
            </ul>
          </div>
        </div>
      ),
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
      ),
    },
    {
      title: "Export Your Generated Code",
      content: (
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-300">
            Once generation is complete, you'll have options to export your
            code:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              className="p-4 rounded-lg"
              style={{
                backgroundColor: `${projectColors.primary}15`,
                border: `1px solid ${projectColors.primary}30`,
              }}
            >
              <div className="flex items-center space-x-2 mb-2">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke={projectColors.primary}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
                  />
                </svg>
                <h4
                  className="font-medium"
                  style={{ color: projectColors.primary }}
                >
                  ZIP Export
                </h4>
              </div>
              <p
                className="text-sm"
                style={{ color: `${projectColors.primary}CC` }}
              >
                Download all files as a ZIP archive
              </p>
            </div>
            <div
              className="p-4 rounded-lg"
              style={{
                backgroundColor: `${projectColors.secondary}15`,
                border: `1px solid ${projectColors.secondary}30`,
              }}
            >
              <div className="flex items-center space-x-2 mb-2">
                <svg
                  className="w-4 h-4"
                  fill={projectColors.secondary}
                  viewBox="0 0 24 24"
                >
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                <h4
                  className="font-medium"
                  style={{ color: projectColors.secondary }}
                >
                  GitHub
                </h4>
              </div>
              <p
                className="text-sm"
                style={{ color: `${projectColors.secondary}CC` }}
              >
                Push directly to a GitHub repository
              </p>
            </div>
          </div>
        </div>
      ),
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
      ),
    },
  ];

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Mark tutorial as completed for this project
      localStorage.setItem(`tutorial_completed_${projectId}`, "true");
      onClose();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const skipTutorial = () => {
    localStorage.setItem(`tutorial_completed_${projectId}`, "true");
    onClose();
  };

  return (
    <div className="tutorial-container" style={customStyles}>
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div
          className="text-white p-6"
          style={{
            background: `linear-gradient(135deg, ${projectColors.primary} 0%, ${projectColors.secondary} 100%)`,
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "rgba(255, 255, 255, 0.2)" }}
              >
                {React.cloneElement(steps[currentStep].icon, {
                  style: { color: "white" },
                })}
              </div>
              <div>
                <h2 className="text-xl font-bold">
                  {steps[currentStep].title}
                </h2>
                <p style={{ color: "rgba(255, 255, 255, 0.8)" }}>
                  Step {currentStep + 1} of {steps.length}
                </p>
              </div>
            </div>
            <button
              onClick={skipTutorial}
              className="text-white hover:opacity-80 transition-opacity"
            >
              <svg
                className="w-6 h-6"
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

        {/* Progress Bar */}
        <div className="bg-gray-200 dark:bg-gray-700 h-1">
          <div
            className="h-1 transition-all duration-300"
            style={{
              width: `${((currentStep + 1) / steps.length) * 100}%`,
              background: `linear-gradient(90deg, ${projectColors.primary} 0%, ${projectColors.secondary} 100%)`,
            }}
          />
        </div>

        {/* Content */}
        <div className="p-6">{steps[currentStep].content}</div>

        {/* Footer */}
        <div className="bg-gray-50 dark:bg-gray-800 px-6 py-4 flex items-center justify-between">
          <button
            onClick={skipTutorial}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            Skip Tutorial
          </button>

          <div className="flex items-center space-x-3">
            {currentStep > 0 && (
              <button
                onClick={prevStep}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              >
                Previous
              </button>
            )}
            <button
              onClick={nextStep}
              className="px-6 py-2 text-white rounded-lg transition-all duration-200 font-medium hover:opacity-90"
              style={{
                background: `linear-gradient(135deg, ${projectColors.primary} 0%, ${projectColors.secondary} 100%)`,
              }}
            >
              {currentStep === steps.length - 1 ? "Get Started" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
