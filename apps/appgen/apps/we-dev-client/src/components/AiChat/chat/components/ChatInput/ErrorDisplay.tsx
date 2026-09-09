import React, { useState } from "react";
import { AlertTriangle } from "lucide-react";
import classNames from "classnames";
import type { ErrorDisplayProps } from "./types";

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  errors,
  onAttemptFix,
  onRemoveError,
}) => {
  const [expandedErrors, setExpandedErrors] = useState<Set<number>>(new Set());
  const [showProblems, setShowProblems] = useState<Set<number>>(new Set());

  const toggleErrorExpanded = (index: number) => {
    setExpandedErrors(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const toggleProblemVisible = (index: number) => {
    setShowProblems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  return (
    <div className="max-h-[50vh] overflow-y-auto">
      {errors.map((error, index) => (
        <div
          key={index}
          className={classNames(
            "mb-4 bg-gray-100 dark:bg-surface-1 rounded-lg border transition-all duration-300 ease-in-out cursor-pointer",
            error.severity === "error" ? "border-red-500/30" : "border-yellow-500/30",
            expandedErrors.has(index) ? "p-3" : "p-1.5"
          )}
        >
          <div
            className="flex items-center justify-between"
            onClick={() => toggleErrorExpanded(index)}
          >
            <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span className="font-medium text-xs">{error.message}</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleErrorExpanded(index);
              }}
              className="text-gray-500 hover:text-text-secondary dark:hover:text-gray-200 p-0.5"
            >
              <svg
                className={classNames(
                  "w-3.5 h-3.5 transition-transform duration-300",
                  expandedErrors.has(index) ? "transform rotate-180" : ""
                )}
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
              >
                <path
                  d="M6 8l4 4 4-4"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>

          <div
            className={classNames(
              "overflow-hidden transition-all duration-300 ease-in-out",
              expandedErrors.has(index)
                ? "max-h-[500px] opacity-100 mt-2"
                : "max-h-0 opacity-0"
            )}
          >
            <div className="transform transition-transform duration-300 ease-in-out">
              {expandedErrors.has(index) && (
                <>
                  <button
                    className="w-full text-left p-1.5 bg-gray-200 dark:bg-surface-2 rounded-md flex items-center justify-between text-xs"
                    onClick={() => toggleProblemVisible(index)}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="flex items-center justify-center w-4 h-4 rounded-full bg-gray-300 text-gray-900 dark:bg-surface-3 dark:text-white text-[10px]">
                        {error.number || 1}
                      </span>
                      <span className="text-text-primary">Show problem</span>
                    </div>
                    <svg
                      className={classNames(
                        "w-3.5 h-3.5 text-gray-400 transition-transform duration-300",
                        showProblems.has(index)
                          ? "transform rotate-180"
                          : ""
                      )}
                      viewBox="0 0 20 20"
                      fill="none"
                      stroke="currentColor"
                    >
                      <path
                        d="M6 8l4 4 4-4"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>

                  <div
                    className={classNames(
                      "overflow-hidden transition-all duration-300 ease-in-out",
                      showProblems.has(index)
                        ? "max-h-[500px] opacity-100 mt-1.5"
                        : "max-h-0 opacity-0"
                    )}
                  >
                    {showProblems.has(index) && (
                      <div className="mt-1.5 p-2 bg-surface-2 rounded border border-[var(--glass-border)]/50 text-xs">
                        <div className="flex items-start gap-2">
                          <div className="text-red-600 dark:text-red-400 mt-0.5">
                            <AlertTriangle className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex-1">
                            <p className="text-text-secondary mb-1">
                              Error code: {error.code}
                            </p>
                            <pre className="font-mono bg-gray-100 dark:bg-surface-1 p-1.5 rounded text-text-secondary whitespace-pre-wrap break-words">
                              <code>{error.message}</code>
                            </pre>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-2">
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => onAttemptFix(error, index)}
                        className="px-2 py-1 bg-gray-200 text-gray-900 hover:bg-gray-300 dark:bg-surface-3 dark:text-white dark:hover:bg-surface-3 rounded transition-colors text-xs"
                      >
                        Attempt fix
                      </button>
                      <button
                        onClick={() => onRemoveError(index)}
                        className="px-2 py-1 bg-gray-200 text-gray-900 hover:bg-gray-300 dark:bg-surface-3 dark:text-white dark:hover:bg-surface-3 rounded transition-colors text-xs"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}; 