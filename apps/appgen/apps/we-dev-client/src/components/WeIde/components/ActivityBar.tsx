import { Files, Settings, Search, Terminal, Github } from "lucide-react";

import { Tooltip } from "./Tooltip";
import { cn } from "@/utils/cn";

interface ActivityBarProps {
  activeView: "files" | "search";
  showTerminal: boolean;
  onViewChange: (view: "files" | "search") => void;
  onToggleTerminal: () => void;
}

export function ActivityBar({
  activeView,
  onViewChange,
  onToggleTerminal,
  showTerminal,
}: ActivityBarProps) {
  // GitHub 仓库链接
  const handleGithubClick = () => {
    window.open("https://idem.africa", "_blank");
  };

  return (
    <div className="w-12 bg-surface-1 flex flex-col items-center py-2 border-r border-[var(--glass-border)]">
      <Tooltip content="File Explorer" side="right">
        <button
          aria-label="File Explorer"
          className={cn(
            "p-1.5 rounded-md mb-2 transition-all duration-200 relative group",
            activeView === "files"
              ? "bg-surface-3 text-text-secondary dark:text-white"
              : "text-text-tertiary hover:text-text-secondary hover:bg-surface-3 dark:hover:text-white dark:hover:bg-surface-3",
            activeView === "files" &&
              "before:absolute before:left-0 before:top-[20%] before:h-[60%] before:w-[2px] before:bg-surface-3 dark:before:bg-white before:-ml-2"
          )}
          onClick={() => onViewChange("files")}
        >
          <Files className="w-5 h-5" />
        </button>
      </Tooltip>

      <Tooltip content="Search" side="right">
        <button
          aria-label="Search"
          className={cn(
            "p-1.5 rounded-md mb-2 transition-all duration-200 relative group",
            activeView === "search"
              ? "bg-surface-3 text-text-secondary dark:text-white"
              : "text-text-tertiary hover:text-text-secondary hover:bg-surface-3 dark:hover:text-white dark:hover:bg-surface-3",
            activeView === "search" &&
              "before:absolute before:left-0 before:top-[20%] before:h-[60%] before:w-[2px] before:bg-surface-3 dark:before:bg-white before:-ml-2"
          )}
          onClick={() => onViewChange("search")}
        >
          <Search className="w-5 h-5" />
        </button>
      </Tooltip>

      <div className="flex-grow" />

      <Tooltip content="Terminal" side="right">
        <button
          aria-label="Terminal"
          className={cn(
            "p-1.5 opacity-70 rounded-md mb-2 transition-all duration-200 relative group ",
            showTerminal
              ? "bg-surface-3 text-text-secondary dark:text-white"
              : "text-text-tertiary hover:text-text-secondary hover:bg-surface-3 dark:hover:text-white dark:hover:bg-surface-3",
            showTerminal &&
              "before:absolute before:left-0 before:top-[20%] before:h-[60%] before:w-[2px] before:bg-surface-3 dark:before:bg-white before:-ml-2"
          )}
          onClick={onToggleTerminal}
        >
          <Terminal className="w-5 h-5" />
        </button>
      </Tooltip>

      <Tooltip content="GitHub" side="right">
        <button
          aria-label="GitHub"
          onClick={handleGithubClick}
          className="p-1.5 rounded-md mb-2 transition-all duration-200 text-text-tertiary hover:text-text-secondary hover:bg-surface-3 dark:hover:text-white dark:hover:bg-surface-3"
        >
          <Github className="w-5 h-5" />
        </button>
      </Tooltip>
    </div>
  );
}
