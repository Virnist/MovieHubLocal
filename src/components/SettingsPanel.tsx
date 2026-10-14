import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES, type AppLanguage } from "../i18n";
import type { AppSettings } from "../services/library";

interface SettingsPanelProps {
  settings: AppSettings;
  unmatchedFiles: string[];
  isFirstRun?: boolean;
  isRescanning?: boolean;
  onBrowseFolder: (files: File[]) => Promise<string>;
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
  const rescanAfterFolderSelect = useRef(false);

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
    setLanguage(nextLanguage);
    await onLanguageChange(nextLanguage);
  }

  function openFolderPicker(rescan = false) {
    rescanAfterFolderSelect.current = rescan;
    folderInput.current?.click();
  }

  async function handleFolderSelection(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.currentTarget.files ?? [])];
    event.currentTarget.value = "";
    if (!files?.length) return;
    setIsBrowsing(true);
    setMessage("");
    try {
      const selectedPath = await onBrowseFolder(files);
      setLibraryPath(selectedPath);
      if (rescanAfterFolderSelect.current) await onRescan();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not read the selected folder.");
    } finally {
      rescanAfterFolderSelect.current = false;
      setIsBrowsing(false);
    }
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
            onClick={() => openFolderPicker(true)}
            className="min-h-11 rounded-lg border border-zinc-700 px-4 font-semibold text-zinc-200 outline-none hover:bg-zinc-800 focus-visible:ring-4 focus-visible:ring-red-500 disabled:opacity-60"
          >
            {isRescanning ? t("scanning") : t("scan")}
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 sm:p-7">
        {isFirstRun && (
          <p className="text-zinc-300">{t("welcomeDescription")}</p>
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
          </div>
          <p className="mt-2 text-sm text-zinc-400">{t("storageHint")}</p>
        </div>
        <div>
          <label htmlFor="app-language" className="mb-2 block font-semibold">
            {t("language")}
          </label>
          <select
            id="app-language"
            value={language}
            onChange={(event) => {
              const option = SUPPORTED_LANGUAGES.find(
                (candidate) => candidate.code === event.target.value,
              );
              if (option) void handleLanguageChange(option.code);
            }}
            className="min-h-12 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 text-white outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            {SUPPORTED_LANGUAGES.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
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
