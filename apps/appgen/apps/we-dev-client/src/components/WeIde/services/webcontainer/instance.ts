import { WebContainer } from "@webcontainer/api";
import { useFileStore } from "../../stores/fileStore";

// Use global scope to persist instance across HMR/re-renders
const globalAny: any = globalThis;
if (!globalAny._webcontainerInstance) {
  globalAny._webcontainerInstance = null;
}

let webcontainerInstance: WebContainer | null = globalAny._webcontainerInstance;
let bootPromise: Promise<WebContainer> | null = null;
let isBooting = false;
let bootAttempts = 0;
const MAX_BOOT_ATTEMPTS = 5; // Increased from 3 to 5
let lastBootAttemptTime = 0;
const MIN_RETRY_INTERVAL = 5000; // 5 seconds minimum between retries

export async function getWebContainerInstance(): Promise<WebContainer | null> {
  // Return existing instance if available (check global first)
  if (globalAny._webcontainerInstance) {
    webcontainerInstance = globalAny._webcontainerInstance;
    return globalAny._webcontainerInstance;
  }

  if (webcontainerInstance) {
    globalAny._webcontainerInstance = webcontainerInstance;
    return webcontainerInstance;
  }

  // If already booting, wait for the existing boot promise
  if (bootPromise) {
    try {
      return await bootPromise;
    } catch (error) {
      console.error("Boot promise failed:", error);
      bootPromise = null;
      return null;
    }
  }

  // Prevent multiple simultaneous boot attempts
  if (isBooting) {
    console.warn("WebContainer is already booting, waiting...");
    // Wait a bit and try again
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return getWebContainerInstance();
  }

  // Check boot attempts limit and retry interval
  const now = Date.now();
  if (bootAttempts >= MAX_BOOT_ATTEMPTS) {
    console.error(
      `Max boot attempts (${MAX_BOOT_ATTEMPTS}) reached. Please refresh the page.`,
    );
    return null;
  }

  // Enforce minimum retry interval
  if (
    lastBootAttemptTime > 0 &&
    now - lastBootAttemptTime < MIN_RETRY_INTERVAL
  ) {
    const waitTime = MIN_RETRY_INTERVAL - (now - lastBootAttemptTime);
    console.log(`Waiting ${waitTime}ms before next boot attempt...`);
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }

  try {
    isBooting = true;
    bootAttempts++;
    lastBootAttemptTime = now;

    console.log(
      `Attempting to boot WebContainer (attempt ${bootAttempts}/${MAX_BOOT_ATTEMPTS})`,
    );

    bootPromise = WebContainer.boot();
    webcontainerInstance = await bootPromise;

    if (webcontainerInstance) {
      // Save to global scope immediately to prevent losing reference
      globalAny._webcontainerInstance = webcontainerInstance;

      console.log("WebContainer booted successfully");

      // Initialize the root directory
      await webcontainerInstance.fs.mkdir("/", { recursive: true });

      // ... (rest of the mounting logic)
    }

    // Reset boot attempts on success
    bootAttempts = 0;

    return webcontainerInstance;
  } catch (error: any) {
    // specific handling for "Unable to create more instances"
    if (String(error).includes("Unable to create more instances")) {
      console.error(
        "WebContainer already running but reference lost. Please refresh.",
      );
      // We cannot recover from this automatically in this session
      bootAttempts = MAX_BOOT_ATTEMPTS; // Stop further retries
      isBooting = false;
      return null;
    }

    console.error(
      `Failed to boot WebContainer (attempt ${bootAttempts}):`,
      error,
    );
    webcontainerInstance = null;

    // If this was the last attempt, don't retry
    if (bootAttempts >= MAX_BOOT_ATTEMPTS) {
      console.error("All boot attempts failed. WebContainer unavailable.");
    }

    return null;
  } finally {
    bootPromise = null;
    isBooting = false;
  }
}

// Function to reset the WebContainer instance (useful for debugging)
export function resetWebContainerInstance(): void {
  console.log("Resetting WebContainer instance");
  webcontainerInstance = null;
  bootPromise = null;
  isBooting = false;
  bootAttempts = 0;
  lastBootAttemptTime = 0;
}

// Function to check if WebContainer is available
export function isWebContainerAvailable(): boolean {
  return webcontainerInstance !== null;
}
