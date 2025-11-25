import { useFileStore } from "../WeIde/stores/fileStore";
import JSZip from "jszip";
import { useTranslation } from "react-i18next";
import useChatModeStore from "@/stores/chatModeSlice";
import { ChatMode } from "@/types/chat";
import useTerminalStore from "@/stores/terminalSlice";
import { getWebContainerInstance } from "../WeIde/services/webcontainer";
import { useState } from "react";
import { toast } from "react-toastify";
import { Modal } from "antd";
import { sendToGitHub } from "@/api/persistence/db";
import { HelpButton } from "./HelpButton";

// Add a helper function to recursively get all files
const getAllFiles = async (
  webcontainer: any,
  dirPath: string,
  zip: JSZip,
  baseDir: string = ""
) => {
  try {
    const entries = await webcontainer.fs.readdir(dirPath, {
      withFileTypes: true,
    });

    for (const entry of entries) {
      const fullPath = `${dirPath}/${entry.name}`;
      try {
        if (entry.isDirectory()) {
          // If it's a directory, recursively process it
          await getAllFiles(
            webcontainer,
            fullPath,
            zip,
            `${baseDir}${entry.name}/`
          );
        } else {
          // If it's a file, read its content and add it to the zip
          const content = await webcontainer.fs.readFile(fullPath);
          const relativePath = `${baseDir}${entry.name}`;
          console.log("Adding file:", relativePath);
          zip.file(relativePath, content);
        }
      } catch (error) {
        console.error(`Failed to process file ${entry.name}:`, error);
      }
    }
  } catch (error) {
    console.error(`Failed to read directory ${dirPath}:`, error);

    // If it doesn't support withFileTypes, try the regular readdir
    const files = await webcontainer.fs.readdir(dirPath);

    for (const file of files) {
      const fullPath = `${dirPath}/${file}`;
      try {
        // Try to read the file content
        const content = await webcontainer.fs.readFile(fullPath);
        const relativePath = `${baseDir}${file}`;
        console.log("Adding file:", relativePath);
        zip.file(relativePath, content);
      } catch (error) {
        // If reading fails, it might be a directory, try recursively
        try {
          await getAllFiles(webcontainer, fullPath, zip, `${baseDir}${file}/`);
        } catch (dirError) {
          console.error(`Failed to process file/directory ${file}:`, dirError);
        }
      }
    }
  }
};

export function HeaderActions() {
  const { files } = useFileStore();
  const { t } = useTranslation();
  const { getTerminal, newTerminal, getEndTerminal } = useTerminalStore();
  const { mode } = useChatModeStore();
  const [showModal, setShowModal] = useState(false);
  const [showDeployChoiceModal, setShowDeployChoiceModal] = useState(false);
  const [deployUrl, setDeployUrl] = useState("");
  const [isDeploying, setIsDeploying] = useState(false);
  const [isSendingToGitHub, setIsSendingToGitHub] = useState(false);

  const handleDownload = async () => {
    try {
      const zip = new JSZip();
      Object.entries(files).forEach(([path, content]) => {
        // Pack the dist directory
        zip.file(path, content as string);
      });
      const blob = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "project.zip";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Failed to download:", error);
    }
  };

  const handleDeployClick = () => {
    setShowDeployChoiceModal(true);
  };

  const handleDeployChoice = (choice: "netlify" | "idem") => {
    setShowDeployChoiceModal(false);

    if (choice === "idem") {
      const idemUrl = process.env.REACT_APP_IDEM_MAIN_APP_URL;
      if (idemUrl) {
        window.open(`${idemUrl}/console/deployments`, "_blank");
      } else {
        toast.error("REACT_APP_IDEM_MAIN_APP_URL not configured");
      }
    } else {
      publishToNetlify();
    }
  };

  const publishToNetlify = async () => {
    setIsDeploying(true);
    const API_BASE = process.env.REACT_REACT_APP_BASE_URL;

    try {
      const webcontainer = await getWebContainerInstance();

      newTerminal(async () => {
        const res = await getEndTerminal().executeCommand("npm run build");
        if (res.exitCode === 127) {
          await getEndTerminal().executeCommand("npm install");
          await getEndTerminal().executeCommand("npm run build");
        }

        try {
          const zip = new JSZip();

          // Use new recursive function to get all files
          await getAllFiles(webcontainer, "dist", zip);

          // Generate and download zip file
          const blob = await zip.generateAsync({ type: "blob" });
          const formData = new FormData();
          formData.append(
            "file",
            new File([blob], "dist.zip", { type: "application/zip" })
          );

          // Send request
          const response = await fetch(`${API_BASE}/api/deploy`, {
            method: "POST",
            body: formData,
          });
          const data = await response.json();

          if (data.success) {
            setDeployUrl(data.url);
            setShowModal(true);
            toast.success(t("header.deploySuccess"));
          }
        } catch (error) {
          console.error("Failed to read dist directory:", error);
          toast.error(t("header.error.deploy_failed"));
        } finally {
          setIsDeploying(false);
        }
      });
    } catch (error) {
      console.error("Failed to deploy:", error);
      toast.error(t("header.error.deploy_failed"));
      setIsDeploying(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(deployUrl);
      toast.success("Link copied to clipboard!");
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleSendToGitHub = async () => {
    setIsSendingToGitHub(true);

    try {
      // Get project ID from URL params
      const urlParams = new URLSearchParams(window.location.search);
      const projectId = urlParams.get("projectId");

      if (!projectId) {
        toast.error("Project ID not found");
        return;
      }

      // Prepare GitHub data with project files
      const githubData = {
        files: files,
        projectName: `project-${projectId}`,
        description: "Project generated from we-dev-client",
        timestamp: new Date().toISOString(),
      };
      console.log("Sending to GitHub:", githubData);

      // await sendToGitHub(projectId, githubData);
      toast.success("Project sent to GitHub successfully!");
    } catch (error) {
      console.error("Failed to send to GitHub:", error);
      toast.error("Failed to send to GitHub. Please try again.");
    } finally {
      setIsSendingToGitHub(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <HelpButton />
      {mode === ChatMode.Builder && (
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="outer-button flex items-center gap-1.5 text-sm"
          >
            <svg
              className="w-4 h-4"
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
            <span>{t("header.download")}</span>
          </button>
          <button
            onClick={handleDeployClick}
            disabled={isDeploying}
            className={`flex items-center gap-1.5 text-sm ${
              isDeploying
                ? "outer-button opacity-75 cursor-not-allowed"
                : "inner-button"
            }`}
          >
            {isDeploying ? (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            ) : (
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            )}
            <span>
              {isDeploying ? t("header.deploying") : t("header.deploy")}
            </span>
          </button>
          <button
            onClick={handleSendToGitHub}
            disabled={isSendingToGitHub}
            className={`flex items-center gap-1.5 text-sm ${
              isSendingToGitHub
                ? "outer-button opacity-75 cursor-not-allowed"
                : "outer-button"
            }`}
          >
            {isSendingToGitHub ? (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path
                  fillRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            <span>{isSendingToGitHub ? "Sending..." : "Send to GitHub"}</span>
          </button>

          {/* Directory opening option disabled in web mode */}
        </div>
      )}
      {showModal && (
        <Modal
          open={showModal}
          onCancel={() => setShowModal(false)}
          footer={null}
          centered
          styles={{
            content: { backgroundColor: "var(--color-bg-light)" },
            header: { backgroundColor: "var(--color-bg-light)" },
          }}
        >
          <div className="text-center mb-6">
            <div className="text-5xl mb-4">🚀</div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              {t("header.deploySuccess")}
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mt-2">
              {t("header.deployToCloud")}
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
              {t("header.accessLink")}
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={deployUrl}
                readOnly
                className="flex-1 p-2 text-sm border rounded-lg bg-white dark:bg-gray-600 text-gray-900 dark:text-white"
              />
              <button
                onClick={copyToClipboard}
                className="px-3 py-2 bg-white dark:bg-gray-500 text-gray-700 dark:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-400 transition-colors flex items-center gap-1"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                  />
                </svg>
                {t("header.copy")}
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowModal(false)}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
            >
              {t("header.close")}
            </button>
            <button
              onClick={() => window.open(deployUrl, "_blank")}
              className="px-4 py-2 bg-purple-600 dark:bg-purple-500 text-white rounded-lg hover:bg-purple-700 dark:hover:bg-purple-600 transition-colors flex items-center gap-2"
            >
              <span>{t("header.visitSite")}</span>
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="white"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </button>
          </div>
        </Modal>
      )}

      {/* Deploy Loading Modal */}
      {isDeploying && (
        <Modal
          open={isDeploying}
          footer={null}
          closable={false}
          centered
          width={400}
          className="deploy-loading-modal"
          styles={{
            content: { backgroundColor: "var(--color-bg-light)" },

            body: {
              padding: "2rem",
            },
            header: {
              display: "none",
            },
          }}
        >
          <div className="text-center">
            <h3 className="text-lg font-semibold text-white mb-4">
              Deploying Your Project
            </h3>
            <div className="flex justify-center items-center h-32">
              <div className="relative">
                <div className="animate-spin rounded-full h-16 w-16 border-2 border-blue-500/30 border-t-blue-500"></div>
                <div className="absolute inset-0 rounded-full animate-pulse bg-blue-500/10 backdrop-blur-sm"></div>
              </div>
            </div>
            <p className="text-sm text-gray-400 mt-4">
              Please wait while we deploy your application...
            </p>
          </div>
        </Modal>
      )}

      {/* Deploy Choice Modal */}
      {showDeployChoiceModal && (
        <Modal
          open={showDeployChoiceModal}
          onCancel={() => setShowDeployChoiceModal(false)}
          footer={null}
          width={600}
          className=" bg-black"
          styles={{
            content: { backgroundColor: "var(--color-bg-light)" },
            body: {
              padding: 0,
            },
            header: {
              display: "none",
            },
          }}
        >
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-primary to-primary/80 rounded-2xl flex items-center justify-center">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 12l2 2 4-4"
                />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">
              Deploy Your Project
            </h3>
            <p className="text-gray-300 text-sm">
              Choose how you want to deploy your application
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Idem Option - Custom Deployment */}
            <button
              onClick={() => handleDeployChoice("idem")}
              className="group relative overflow-hidden rounded-2xl  bg-gradient-to-br from-gray-800 via-gray-750 to-gray-700 p-6 text-left transition-all duration-300 hover:border-blue-300 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
            >
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                    <img src="public/assets/icons/idem.png" alt="Netlify" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg text-white group-hover:text-blue-400 transition-colors">
                      Idem
                    </h4>
                    <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">
                      Custom Deployment
                    </p>
                  </div>
                </div>

                <p className="text-sm text-gray-300 mb-4 leading-relaxed">
                  Deploy to any cloud provider, your own server, or
                  infrastructure of choice
                </p>

                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2 py-1 text-xs bg-blue-900/50 text-blue-300 rounded-md font-medium">
                    AWS
                  </span>
                  <span className="px-2 py-1 text-xs bg-indigo-900/50 text-indigo-300 rounded-md font-medium">
                    Docker
                  </span>
                  <span className="px-2 py-1 text-xs bg-purple-900/50 text-purple-300 rounded-md font-medium">
                    K8s
                  </span>
                  <span className="px-2 py-1 text-xs bg-blue-900/50 text-blue-300 rounded-md font-medium">
                    Terraform
                  </span>
                </div>
              </div>

              {/* Hover effect overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </button>

            {/* Netlify Option - Quick Deployment */}
            <button
              onClick={() => handleDeployChoice("netlify")}
              className="group relative overflow-hidden rounded-2xl  bg-gradient-to-br from-gray-800 via-gray-750 to-gray-700 p-6 text-left transition-all duration-300 hover:border-teal-300 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
            >
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center flex-shrink-0">
                    <img src="public/assets/icons/netlify.svg" alt="Netlify" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg text-white group-hover:text-teal-400 transition-colors">
                      Netlify
                    </h4>
                    <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">
                      Quick Deploy
                    </p>
                  </div>
                </div>

                <p className="text-sm text-gray-300 mb-4 leading-relaxed">
                  Instant deployment with global CDN and automatic builds
                </p>

                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2 py-1 text-xs bg-teal-900/50 text-teal-300 rounded-md font-medium">
                    One-click
                  </span>
                  <span className="px-2 py-1 text-xs bg-cyan-900/50 text-cyan-300 rounded-md font-medium">
                    Global CDN
                  </span>
                  <span className="px-2 py-1 text-xs bg-emerald-900/50 text-emerald-300 rounded-md font-medium">
                    Auto SSL
                  </span>
                </div>
              </div>

              {/* Hover effect overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </button>
          </div>

          <div className="flex justify-center">
            <button
              onClick={() => setShowDeployChoiceModal(false)}
              className="px-6 py-2 text-gray-400 hover:text-gray-200 transition-colors font-medium"
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
