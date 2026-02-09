import { PostHog } from "posthog-js";
import {MCPServer, MCPTool} from "@/types/mcp";
import {HookAPI} from "antd/es/modal/useModal";

declare global {
  interface Window {
    isLoading: boolean;
    getCurrentDir: () => string;
    Posthog: PostHog
    fileHashMap: Map<string, string>;
    modal: HookAPI
    myAPI: {
      dialog: {
        showOpenDialog: (options: { properties: string[] }) => Promise<{ canceled: boolean; filePaths: string[] }>;
      };
      mcp: {
        // servers
        listServers: () => Promise<MCPServer[]>
        addServer: (server: MCPServer) => Promise<void>
        updateServer: (server: MCPServer) => Promise<void>
        deleteServer: (serverName: string) => Promise<void>
        setServerActive: (name: string, isActive: boolean) => Promise<void>
        setServers: (servers: MCPServer[]) => void
        // tools
        listTools: () => Promise<MCPTool[]>
        callTool: ({ client, name, args }: { client: string; name: string; args: any }) => Promise<any>
        // status
        cleanup: () => Promise<void>
      };
      isBinaryExist: (name: string) => Promise<boolean>
      getBinaryPath: (name: string) => Promise<string>
      installUVBinary: () => Promise<void>
      installBunBinary: () => Promise<void>
    };
  }

  // IPC channel name types
  type IpcChannel = 
    | 'mcp:list-servers'
    | 'mcp:add-server'
    | 'mcp:update-server'
    | 'mcp:delete-server'
    | 'mcp:set-server-active'
    | 'mcp:list-tools'
    | 'mcp:call-tool'
    | 'mcp:cleanup'
    | 'mcp:servers-from-renderer'
    | 'app:is-binary-exist'
    | 'app:get-binary-path'
    | 'app:install-uv-binary'
    | 'app:install-bun-binary';

  // File system related types
  interface FileStats {
    isDirectory: boolean;
    isFile: boolean;
    size: number;
    mtime: Date;
  }

  // Process related types
  interface SpawnOptions {
    cwd?: string;
    processId?: string;
  }

  interface TerminalOptions {
    cols?: number;
    rows?: number;
    processId?: string;
  }

  interface ProcessResult {
    processId: string;
  }

  // Parent path return type
  interface ParentPaths {
    parentPath: string;
    grandParentPath: string;
    lastGrandParentPath: string;
  }

  // PTY process type
  interface PtyProcess {
    write(data: string): void;
    resize(cols: number, rows: number): void;
    kill(): void;
    onData(callback: (data: string) => void): void;
  }
}

export {};

