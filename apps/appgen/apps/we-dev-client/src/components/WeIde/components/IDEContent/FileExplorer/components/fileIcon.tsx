import React from "react";
import { Folder, FileCode } from "lucide-react";
import MarkdownIcon from "../assets/md.svg";

interface FileIconProps {
  fileName: string | undefined;
}

const FileIcon: React.FC<FileIconProps> = ({ fileName = "" }) => {
  if (typeof fileName !== "string") {
    console.error("fileName is not a string:", fileName);
    return null;
  }

  const fileTypeList = fileName.split(".");

  if (fileTypeList.length === 1) {
    return <Folder className="w-4 h-4 mr-1.5 text-text-tertiary" />;
  }
  const fileType = fileTypeList.pop();

  if (fileType === "md") {
    return (
      <img
        alt="md"
        src={MarkdownIcon}
        className="w-3 h-3 mr-1.5 text-text-tertiary"
      />
    );
  }
  if (fileType === "json") {
    return (
      <span className="icon-[lets-icons--json] text-text-tertiary w-3 h-3 mr-1.5" />
    );
  }
  if (fileType === "html") {
    return (
      <span className="icon-[flowbite--html-solid] w-3 h-3 mr-1.5 text-text-tertiary" />
    );
  }

  if (fileType === "jsx") {
    return (
      <span className="icon-[file-icons--jsx-alt] w-3 h-3 mr-1.5 text-text-tertiary" />
    );
  }
  if (fileType === "tsx") {
    return (
      <span className="icon-[file-icons--tsx-alt] w-3 h-3 mr-1.5 text-text-tertiary" />
    );
  }

  if (fileType === "css") {
    return (
      <span className="icon-[simple-icons--css] w-3 h-3 mr-1.5 text-text-tertiary" />
    );
  }

  if (fileType === "ts") {
    return (
      <span className="icon-[devicon--typescript] w-3 h-3 mr-1.5 text-text-tertiary" />
    );
  }

  return <span className="icon-[mdi--file] w-3 h-3 mr-1.5 text-text-tertiary" />;
};

export default FileIcon;
