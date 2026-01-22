import { Messages, generateObjectFn } from "../action";
import { v4 as uuidv4 } from "uuid";

export async function handleTokenLimit(
  messages: Messages,
  files: { [key: string]: string },
  filesPath: string[]
): Promise<{ [key: string]: string }> {
  const fileMessage = JSON.parse(JSON.stringify(messages));
  const nowFiles: { [key: string]: string } = {};

  fileMessage.push({
    id: uuidv4(),
    role: "user",
    content: `当前文件目录树:\n${filesPath.join("\n")}\n\n。假如用户需求需要修改文件，请按照文件目录树的格式输出文件路径。比如['src/index.js','src/components/index.js','package.json']这样的形式，按需求的相关度提取文件路径。不需要全部路径输出，只输出用户需求相关的文件路径。`,
  });

  const objectResult = await generateObjectFn(fileMessage);
  const nowPathFiles = objectResult.object.files;
  filesPath.forEach((path) => {
    if (nowPathFiles.includes(path)) {
      nowFiles[path] = files[path];
    }
  });

  return Object.keys(nowFiles).length > 0 ? nowFiles : files;
} 