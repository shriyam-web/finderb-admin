"use client";

import { useEffect, useState } from "react";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

export default function PwaInstallButton() {
  const [mobile, setMobile] = useState(false);
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [iosHelp, setIosHelp] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const sync = () => setMobile(media.matches);
    sync();
    setInstalled(isStandalone());
    media.addEventListener("change", sync);

    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
      setIosHelp(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      media.removeEventListener("change", sync);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!mobile || installed) return null;

  const install = async () => {
    if (prompt) {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setPrompt(null);
      return;
    }
    setIosHelp(true);
  };

  return (
    <>
      <button type="button" className="admin-pwa-install" onClick={() => void install()}>
        Install
      </button>
      {iosHelp ? (
        <div className="admin-pwa-sheet" role="dialog" aria-label="Install FinderB Admin">
          <p className="text-sm font-semibold">Install FinderB Admin</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            Open the browser menu and choose Install app, or on iPhone tap Share and then Add to Home Screen.
          </p>
          <button type="button" className="admin-btn-secondary mt-3 !text-xs" onClick={() => setIosHelp(false)}>
            Close
          </button>
        </div>
      ) : null}
    </>
  );
}
