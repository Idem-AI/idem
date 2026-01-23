import React from "react";
import { createRoot } from "react-dom/client";

interface DiffButtonsProps {
  onAccept: () => void;
  onCancel: () => void;
}

const DiffButtons: React.FC<DiffButtonsProps> = ({ onAccept, onCancel }) => {
  return (
    <div className="flex gap-2 items-center">
      <button
        className="inner-button text-sm"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onAccept();
        }}
      >
        Accept Changes
      </button>
      <button
        className="outer-button bg-danger hover:bg-red-600 text-white text-sm"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onCancel();
        }}
      >
        Cancel
      </button>
    </div>
  );
};

export const createDiffButtons = (
  onAccept: () => void,
  onCancel: () => void
) => {
  const container = document.createElement("div");
  const root = createRoot(container);
  root.render(<DiffButtons onAccept={onAccept} onCancel={onCancel} />);
  return container;
};
