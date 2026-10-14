import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function InstallAppButton() {
  const { t } = useTranslation();
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)");
    setIsInstalled(media.matches);
    const handleInstalled = () => setIsInstalled(true);
    const handlePrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handlePrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handlePrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  if (isInstalled) return null;

  async function handleInstall() {
    if (!installPrompt) {
      setShowInstructions((shown) => !shown);
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setInstallPrompt(null);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => void handleInstall()}
        className="min-h-11 rounded-lg border border-zinc-700 px-4 font-semibold text-zinc-200 outline-none hover:bg-zinc-800 focus-visible:ring-4 focus-visible:ring-red-500"
      >
        {t("installApp")}
      </button>
      {showInstructions && (
        <p
          role="status"
          className="absolute right-0 top-full z-30 mt-2 w-72 rounded-xl border border-zinc-700 bg-zinc-900 p-4 text-sm leading-relaxed text-zinc-200 shadow-xl"
        >
          {t("installAppInstructions")}
        </p>
      )}
    </div>
  );
}
