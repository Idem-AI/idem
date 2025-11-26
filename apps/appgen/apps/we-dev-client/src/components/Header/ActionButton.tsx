import React from "react";
import { IconDownload } from "./icons/IconDownload";
import { IconDeploy } from "./icons/IconDeploy";
import { FolderOpen } from 'lucide-react';
import { cn } from "@/utils/cn";


const icons = {
  download: IconDownload,
  deploy: IconDeploy,
  open: FolderOpen,
};

interface ActionButtonProps {
  icon: keyof typeof icons;
  label: string;
  variant?: "default" | "primary";
  onClick?: () => void;
  className?: string;
}

export function ActionButton({
  icon,
  label,
  variant = "default",
  onClick,
  className,
}: ActionButtonProps) {
  const Icon = icons[icon];

  const variantClasses = {
    default: "outer-button",
    primary: "inner-button",
  };

  return (
    <button
      className={cn(
        "flex items-center gap-2 text-sm font-medium",
        variantClasses[variant],
        className
      )}
      onClick={onClick}
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );
}
