import { useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { InstallAppButton } from "./InstallAppButton";
import { isAndroidTvApp } from "../services/androidTv";
import { SUPPORTED_LANGUAGES, type AppLanguage } from "../i18n";
import type { AppSettings } from "../services/library";

interface SettingsPanelProps {
  settings: AppSettings;
  unmatchedFiles: string[];
  isFirstRun?: boolean;
  isRescanning?: boolean;
  onBrowseFolder: (files: File[], selection: "folder" | "files") => Promise<string>;
  onBrowseAndroidFolder: () => Promise<string | null>;
  onSave: (libraryPath: string, language: AppLanguage, credential: string) => Promise<void>;
  onLanguageChange: (language: AppLanguage) => Promise<void>;
  onRescan: () => Promise<void>;
  onRemoveCredential: () => Promise<void>;
  onClose: () => void;
}

export function SettingsPanel({
  settings,
  unmatchedFiles,
  isFirstRun = false,
  isRescanning = false,
  onBrowseFolder,
  onBrowseAndroidFolder,
  onSave,
  onLanguageChange,
  onRescan,
  onRemoveCredential,
  onClose,
}: SettingsPanelProps) {
  const { t, i18n } = useTranslation();
  const [libraryPath, setLibraryPath] = useState(settings.libraryPath);
  const [language, setLanguage] = useState<AppLanguage>(settings.language);
  const [credential, setCredential] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isBrowsing, setIsBrowsing] = useState(false);
  const [message, setMessage] = useState("");
  const folderInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const languageOptionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [isLanguageListOpen, setIsLanguageListOpen] = useState(false);
  const [focusedLanguageIndex, setFocusedLanguageIndex] = useState(
    SUPPORTED_LANGUAGES.findIndex((option) => option.code === settings.language),
  );
  const rescanAfterFolderSelect = useRef(false);
  const folderSelectionType = useRef<"folder" | "files">("folder");
  const isNativeAndroidTv = isAndroidTvApp();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage("");
    try {
      await onSave(libraryPath.trim(), language, credential.trim());
      setCredential("");
      if (!isFirstRun) setMessage(i18n.t("settingsSaved"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save settings.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRemoveCredential() {
    setIsSaving(true);
    setMessage("");
    try {
      await onRemoveCredential();
      setCredential("");
      setMessage(i18n.t("credentialRemoved"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not remove credential.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleLanguageChange(nextLanguage: AppLanguage) {
    setMessage("");
    try {
      await onLanguageChange(nextLanguage);
      setLanguage(nextLanguage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save the selected language.");
    }
  }

  function openFolderPicker(rescan = false, selection: "folder" | "files" = "folder") {
    rescanAfterFolderSelect.current = rescan;
    folderSelectionType.current = selection;
    const input = (selection === "folder" ? folderInput : videoInput).current;
    if (!input) return;

    if (typeof input.showPicker === "function") {
      try {
        input.showPicker();
        return;
      } catch {
        input.click();
        return;
      }
    }
    input.click();
  }

  async function handleFolderSelection(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.currentTarget.files ?? [])];
    event.currentTarget.value = "";
    if (!files?.length) return;
    setIsBrowsing(true);
    setMessage("");
    try {
      const selection =
        folderSelectionType.current === "folder" &&
        !files.some((file) => file.webkitRelativePath)
          ? "files"
          : folderSelectionType.current;
      const selectedPath = await onBrowseFolder(files, selection);
      setLibraryPath(selectedPath);
      if (rescanAfterFolderSelect.current) await onRescan();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not read the selected folder.");
    } finally {
      rescanAfterFolderSelect.current = false;
      setIsBrowsing(false);
    }
  }

  async function handleAndroidFolderSelection(rescan = false) {
    setIsBrowsing(true);
    setMessage("");
    try {
      const selectedPath = await onBrowseAndroidFolder();
      if (!selectedPath) return;
      setLibraryPath(selectedPath);
      if (rescan) await onRescan();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not open the USB folder.");
    } finally {
      setIsBrowsing(false);
    }
  }

  function handleLanguageListKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const nextIndex = Math.min(
        SUPPORTED_LANGUAGES.length - 1,
        Math.max(0, focusedLanguageIndex + direction),
      );
      setFocusedLanguageIndex(nextIndex);
      languageOptionRefs.current[nextIndex]?.focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setIsLanguageListOpen(false);
      document.getElementById("app-language")?.focus();
    }
  }

  function openLanguageList() {
    const selectedIndex = SUPPORTED_LANGUAGES.findIndex(
      (option) => option.code === language,
    );
    const nextIndex = selectedIndex >= 0 ? selectedIndex : 0;
    setFocusedLanguageIndex(nextIndex);
    setIsLanguageListOpen(true);
    window.setTimeout(() => languageOptionRefs.current[nextIndex]?.focus(), 0);
  }

  return (
    <section aria-labelledby="settings-heading" className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 id="settings-heading" className="text-2xl font-bold">
          {isFirstRun ? t("welcomeTitle") : t("settingsTitle")}
        </h2>
        {!isFirstRun && (
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-lg px-4 text-zinc-200 outline-none hover:bg-zinc-800 focus-visible:ring-4 focus-visible:ring-red-500"
          >
            {t("close")}
          </button>
        )}
        {!isFirstRun && (
          <button
            type="button"
            disabled={isRescanning}
            onClick={() => isNativeAndroidTv
              ? void handleAndroidFolderSelection(true)
              : openFolderPicker(true)}
            className="min-h-11 rounded-lg border border-zinc-700 px-4 font-semibold text-zinc-200 outline-none hover:bg-zinc-800 focus-visible:ring-4 focus-visible:ring-red-500 disabled:opacity-60"
          >
            {isRescanning ? t("scanning") : t("scan")}
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 sm:p-7">
        {isFirstRun && !isNativeAndroidTv && (
          <div className="space-y-4">
            <p className="text-zinc-300">{t("welcomeDescription")}</p>
            <div className="rounded-xl border border-zinc-700 bg-zinc-950/70 p-4">
              <p className="mb-3 text-sm text-zinc-300">{t("installOnFirstVisit")}</p>
              <InstallAppButton />
            </div>
          </div>
        )}
        <input
          ref={folderInput}
          type="file"
          accept="video/*,.mkv,.mp4,.avi,.mov"
          multiple
          hidden
          {...{ webkitdirectory: "" }}
          onChange={(event) => void handleFolderSelection(event)}
        />
        <input
          ref={videoInput}
          type="file"
          accept="video/*,.mkv,.mp4,.avi,.mov"
          multiple
          hidden
          onChange={(event) => void handleFolderSelection(event)}
        />
        <div>
          <label htmlFor="setup-library-path" className="mb-2 block font-semibold">
            {t("folderLabel")}
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="setup-library-path"
              required
              readOnly
              value={libraryPath}
              autoCapitalize="off"
              spellCheck={false}
              className="min-h-12 min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-4 text-white outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              placeholder={t("chooseFolder")}
            />
            <button
              type="button"
              onClick={() => openFolderPicker()}
              disabled={isSaving || isBrowsing}
              className="min-h-12 rounded-lg border border-zinc-700 px-4 font-semibold text-zinc-200 outline-none hover:bg-zinc-800 focus-visible:ring-4 focus-visible:ring-red-500 disabled:opacity-60"
            >
              {isBrowsing ? t("openingFolderPicker") : t("browseFolder")}
            </button>
            <button
              type="button"
              onClick={() => openFolderPicker(false, "files")}
              disabled={isSaving || isBrowsing}
              className="min-h-12 rounded-lg border border-zinc-700 px-4 font-semibold text-zinc-200 outline-none hover:bg-zinc-800 focus-visible:ring-4 focus-visible:ring-red-500 disabled:opacity-60"
            >
              {t("chooseVideoFiles")}
            </button>
          </div>
          {isNativeAndroidTv && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => void handleAndroidFolderSelection()}
                disabled={isSaving || isBrowsing}
                className="min-h-12 w-full rounded-lg bg-red-600 px-4 font-bold text-white outline-none hover:bg-red-500 focus-visible:ring-4 focus-visible:ring-red-400 disabled:opacity-60"
              >
                {isBrowsing ? t("openingFolderPicker") : t("chooseUsbFolder")}
              </button>
              <p className="mt-2 text-sm text-zinc-400">{t("androidFolderHint")}</p>
            </div>
          )}
          {!isNativeAndroidTv && (
            <p className="mt-2 text-sm text-zinc-400">{t("videoFilesHint")}</p>
          )}
          <p className="mt-2 text-sm text-zinc-400">{t("storageHint")}</p>
        </div>
        <div>
          <label htmlFor="app-language" className="mb-2 block font-semibold">
            {t("language")}
          </label>
          <button
            id="app-language"
            type="button"
            aria-haspopup="listbox"
            aria-controls="language-options"
            aria-expanded={isLanguageListOpen}
            onClick={() => isLanguageListOpen
              ? setIsLanguageListOpen(false)
              : openLanguageList()}
            className="flex min-h-12 w-full items-center justify-between rounded-lg border border-zinc-700 bg-zinc-950 px-4 text-left text-white outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            <span>{SUPPORTED_LANGUAGES.find((option) => option.code === language)?.label ?? language}</span>
            <span aria-hidden="true">▾</span>
          </button>
          {isLanguageListOpen && (
            <div
              id="language-options"
              role="listbox"
              aria-label={t("language")}
              onKeyDown={handleLanguageListKeyDown}
              className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-950 p-1"
            >
              {SUPPORTED_LANGUAGES.map((option, index) => (
                <button
                  key={option.code}
                  ref={(element) => { languageOptionRefs.current[index] = element; }}
                  type="button"
                  role="option"
                  aria-selected={language === option.code}
                  onFocus={() => setFocusedLanguageIndex(index)}
                  onClick={() => {
                    setIsLanguageListOpen(false);
                    void handleLanguageChange(option.code);
                    document.getElementById("app-language")?.focus();
                  }}
                  className={`min-h-11 w-full rounded-md px-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${
                    language === option.code
                      ? "bg-red-600 font-semibold text-white"
                      : "text-zinc-200 hover:bg-zinc-800"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
          <p className="mt-2 text-sm text-zinc-400">{t("languageHint")}</p>
        </div>

        <div>
          <label htmlFor="tmdb-credential" className="mb-2 block font-semibold">
            {t("tmdbCredential")}
          </label>
          <input
            id="tmdb-credential"
            type="password"
            value={credential}
            onChange={(event) => setCredential(event.target.value)}
            autoComplete="new-password"
            autoCapitalize="off"
            spellCheck={false}
            maxLength={4096}
            placeholder={t("credentialPlaceholder")}
            className="min-h-12 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 text-white outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          />
          <p className="mt-2 text-sm text-zinc-400">{t("tmdbCredentialHint")}</p>
          <p className="mt-2 text-sm text-zinc-400">
            {t("tmdbRegistrationHint")}{" "}
            <a
              href="https://www.themoviedb.org/signup"
              target="_blank"
              rel="noreferrer"
              className="text-red-300 underline underline-offset-4 hover:text-red-200"
            >
              {t("tmdbSignUp")}
            </a>
            {" · "}
            <a
              href="https://www.themoviedb.org/settings/api"
              target="_blank"
              rel="noreferrer"
              className="text-red-300 underline underline-offset-4 hover:text-red-200"
            >
              {t("tmdbRequestKey")}
            </a>
          </p>
          <p className="mt-2 text-sm text-zinc-400">{t("fallbackCredentialHint")}</p>
          <p className="mt-2 text-sm text-zinc-300" role="status">
            {settings.apiKeyConfigured ? t("credentialConfigured") : t("credentialMissing")}
          </p>
        </div>

        {message && (
          <p role="status" className="break-words rounded-lg bg-zinc-800 px-4 py-3 text-sm">
            {message}
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="submit"
            disabled={isSaving || !libraryPath.trim()}
            className="min-h-12 rounded-lg bg-red-600 px-6 font-bold text-white outline-none hover:bg-red-500 focus-visible:ring-4 focus-visible:ring-red-400 disabled:opacity-60"
          >
            {isSaving ? t("saving") : isFirstRun ? t("startMovieHub") : t("saveSettings")}
          </button>
          {!isFirstRun && settings.apiKeyConfigured && (
            <button
              type="button"
              onClick={() => void handleRemoveCredential()}
              disabled={isSaving}
              className="min-h-12 rounded-lg border border-zinc-700 px-6 font-semibold text-zinc-200 outline-none hover:bg-zinc-800 focus-visible:ring-4 focus-visible:ring-red-500 disabled:opacity-60"
            >
              {t("removeCredential")}
            </button>
          )}
        </div>
      </form>
      {!isFirstRun && (
        <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 sm:p-7">
          <h3 className="text-xl font-bold">{t("unmatchedFilesTitle")}</h3>
          <p className="mt-2 text-sm text-zinc-400">{t("unmatchedFilesHint")}</p>
          {unmatchedFiles.length > 0 ? (
            <ul className="mt-4 list-inside list-disc space-y-2 break-all text-sm text-amber-200">
              {unmatchedFiles.map((file) => <li key={file}>{file}</li>)}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-zinc-300">{t("noUnmatchedFiles")}</p>
          )}
        </section>
      )}
    </section>
  );
}
