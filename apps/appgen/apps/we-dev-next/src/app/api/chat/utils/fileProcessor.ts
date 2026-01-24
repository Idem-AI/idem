import { Messages } from "../action";
import { parseMessage } from "../messagepParseJson";
export const excludeFiles = [
  "components/weicon/base64.js",
  "components/weicon/icon.css",
  "components/weicon/index.js",
  "components/weicon/index.json",
  "components/weicon/index.wxml",
  "components/weicon/icondata.js",
  "components/weicon/index.css",
  "/miniprogram/components/weicon/base64.js",
  "/miniprogram/components/weicon/icon.css",
  "/miniprogram/components/weicon/index.js",
  "/miniprogram/components/weicon/index.json",
  "/miniprogram/components/weicon/index.wxml",
  "/miniprogram/components/weicon/icondata.js",
  "/miniprogram/components/weicon/index.css",
]

export function processFiles(messages: Messages, cleatText: boolean = false) {
  const files: { [key: string]: string } = {};
  let allContent = "";

  messages.forEach((message) => {
    allContent += message.content;
    const { files: messageFiles, content } = parseMessage(message.content);
    if (cleatText) {
      message.content = content;
    }
    if (typeof messageFiles === "object") {
      excludeFiles.forEach(file => delete messageFiles[file]);
    }
    Object.assign(files, messageFiles);
  });
  return { files, allContent };
} 