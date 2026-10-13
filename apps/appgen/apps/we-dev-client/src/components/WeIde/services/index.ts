import { WebContainer } from '@webcontainer/api';
import * as webContainer from './webcontainer';

export type Container = WebContainer;

// Basic exports
export const {
  useTerminalState,
  syncFileSystem,
  updateFileSystemNow,
  startDevServer,
} = webContainer;

// Container instance exports
export const getContainerInstance = webContainer.getWebContainerInstance;
export const onServerReady = webContainer.onServerReady;
export const onServersChange = webContainer.onServersChange;
export const getLastServerUrl = webContainer.getLastServerUrl;
export const resetWebContainer = webContainer.resetWebContainer;
export const resetFileHashes = webContainer.resetFileHashes;

// Export types and constants
export type { CommandResult } from './webcontainer/types';
export { WebContainer } from '@webcontainer/api';
