"use client";

import { useEffect, useState } from "react";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function runningAsApp() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    ("standalone" in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

export default function PwaInstallButton() {
  const [promptEvent, setPromptEvent] = useState<InstallPrompt | null>(null);
  const [open, setOpen] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (runningAsApp()) return;

    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPrompt);
      setOpen(true);
    };
    const onInstalled = () => {
      setPromptEvent(null);
      setOpen(false);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!open || !promptEvent) return null;

  const install = async () => {
    setInstalling(true);
    try {
      await promptEvent.prompt();
      await promptEvent.userChoice;
      setPromptEvent(null);
      setOpen(false);
    } catch {
      setInstalling(false);
    }
  };

  return (
    <div className="admin-pwa-modal" role="dialog" aria-modal="true" aria-labelledby="admin-pwa-title">
      <div className="admin-pwa-card">
        <img src="/icon-192.png" alt="" width={64} height={64} />
        <h2 id="admin-pwa-title">Install FinderB Admin</h2>
        <div className="admin-pwa-actions">
          <button type="button" className="admin-pwa-later" onClick={() => setOpen(false)}>
            Later
          </button>
          <button type="button" className="admin-pwa-go" onClick={() => void install()} disabled={installing}>
            {installing ? "Installing…" : "Install"}
          </button>
        </div>
      </div>
    </div>
  );
}
