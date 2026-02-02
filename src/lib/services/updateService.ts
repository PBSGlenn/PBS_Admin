// PBS Admin - Update Service
// Checks GitHub releases for available updates

import { invoke } from "@tauri-apps/api/core";

// Import version from package.json at build time
// Note: Vite handles this import specially
const APP_VERSION = __APP_VERSION__;

// GitHub repository for update checks
const GITHUB_OWNER = "PBSGlenn";
const GITHUB_REPO = "PBS_Admin";

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  releaseUrl: string | null;
  releaseNotes: string | null;
  installerUrl: string | null;
  installerName: string | null;
  error: string | null;
}

/**
 * Get the current app version
 */
export function getAppVersion(): string {
  return APP_VERSION;
}

/**
 * Check GitHub releases for the latest version
 */
export async function checkForUpdates(): Promise<UpdateInfo> {
  const currentVersion = getAppVersion();

  try {
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
      {
        headers: {
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    if (!response.ok) {
      // 404 means no releases yet, which is fine
      if (response.status === 404) {
        return {
          currentVersion,
          latestVersion: null,
          updateAvailable: false,
          releaseUrl: null,
          releaseNotes: null,
          installerUrl: null,
          installerName: null,
          error: null,
        };
      }
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const release = await response.json();
    const latestVersion = release.tag_name?.replace(/^v/, "") || null;
    const updateAvailable = latestVersion
      ? compareVersions(latestVersion, currentVersion) > 0
      : false;

    // Find the Windows installer asset (NSIS .exe)
    let installerUrl: string | null = null;
    let installerName: string | null = null;
    if (release.assets && Array.isArray(release.assets)) {
      const installerAsset = release.assets.find(
        (asset: { name: string }) =>
          asset.name.endsWith("-setup.exe") || asset.name.endsWith("_x64-setup.exe")
      );
      if (installerAsset) {
        installerUrl = installerAsset.browser_download_url || null;
        installerName = installerAsset.name || null;
      }
    }

    return {
      currentVersion,
      latestVersion,
      updateAvailable,
      releaseUrl: release.html_url || null,
      releaseNotes: release.body || null,
      installerUrl,
      installerName,
      error: null,
    };
  } catch (error) {
    console.error("Failed to check for updates:", error);
    return {
      currentVersion,
      latestVersion: null,
      updateAvailable: false,
      releaseUrl: null,
      releaseNotes: null,
      installerUrl: null,
      installerName: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Download and run the installer update
 */
export async function downloadAndInstallUpdate(
  installerUrl: string,
  installerName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await invoke("download_and_run_update", {
      url: installerUrl,
      filename: installerName,
    });
    return { success: true };
  } catch (error) {
    console.error("Failed to download/install update:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Compare two semantic versions
 * Returns: 1 if a > b, -1 if a < b, 0 if equal
 */
function compareVersions(a: string, b: string): number {
  const partsA = a.split(".").map((n) => parseInt(n, 10) || 0);
  const partsB = b.split(".").map((n) => parseInt(n, 10) || 0);

  // Pad shorter array with zeros
  const maxLength = Math.max(partsA.length, partsB.length);
  while (partsA.length < maxLength) partsA.push(0);
  while (partsB.length < maxLength) partsB.push(0);

  for (let i = 0; i < maxLength; i++) {
    if (partsA[i] > partsB[i]) return 1;
    if (partsA[i] < partsB[i]) return -1;
  }

  return 0;
}
