import { useCallback, useEffect, useMemo, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  platforms: string[];
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt: () => Promise<void>;
}

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

function isStandaloneDisplay() {
  return window.matchMedia("(display-mode: standalone)").matches
    || Boolean((window.navigator as NavigatorWithStandalone).standalone);
}

export function useInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    setIsInstalled(isStandaloneDisplay());

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setIsInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!installPrompt) {
      return false;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);
    setIsInstalled(choice.outcome === "accepted");
    return choice.outcome === "accepted";
  }, [installPrompt]);

  return useMemo(() => ({
    canInstall: Boolean(installPrompt) && !isInstalled,
    install,
    isInstalled,
  }), [install, installPrompt, isInstalled]);
}
