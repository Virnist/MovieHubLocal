export interface AndroidVideoFile {
  name: string;
  relativePath: string;
  size: number;
  uri: string;
}

export interface AndroidFolderSelection {
  folderName: string;
  files: AndroidVideoFile[];
}

interface AndroidTvBridge {
  requestFolderSelection(requestId: string): void;
}

declare global {
  interface Window {
    MovieHubAndroid?: AndroidTvBridge;
    onMovieHubFolderSelected?: (requestId: string, result: string) => void;
  }
}

let nextRequestId = 0;
const pendingRequests = new Map<
  string,
  { resolve: (selection: AndroidFolderSelection | null) => void; reject: (error: Error) => void }
>();

export function isAndroidTvApp(): boolean {
  return typeof window.MovieHubAndroid?.requestFolderSelection === "function";
}

export function requestAndroidFolder(): Promise<AndroidFolderSelection | null> {
  const bridge = window.MovieHubAndroid;
  if (!bridge) {
    return Promise.reject(new Error("Android TV folder access is unavailable."));
  }

  const requestId = `folder-${Date.now()}-${nextRequestId++}`;
  window.onMovieHubFolderSelected = (responseId, result) => {
    const pending = pendingRequests.get(responseId);
    if (!pending) return;
    pendingRequests.delete(responseId);
    try {
      const selection = JSON.parse(result) as (AndroidFolderSelection & { error?: string }) | null;
      if (selection && "error" in selection) {
        pending.reject(new Error(selection.error || "Could not access the selected USB folder."));
        return;
      }
      pending.resolve(selection);
    } catch (error) {
      pending.reject(error instanceof Error ? error : new Error("Could not read the selected USB folder."));
    }
  };

  return new Promise((resolve, reject) => {
    pendingRequests.set(requestId, { resolve, reject });
    try {
      bridge.requestFolderSelection(requestId);
    } catch (error) {
      pendingRequests.delete(requestId);
      reject(error instanceof Error ? error : new Error("Could not open the Android folder picker."));
    }
  });
}
