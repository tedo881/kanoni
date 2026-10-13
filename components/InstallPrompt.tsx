"use client";
import { useEffect, useState } from "react";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
const KEY = "kanoni:install-dismissed";

/** მთავარ გვერდზე სთავაზობს აპლიკაციად დაყენებას, თუ ბრაუზერი უჭერს მხარს (PWA) */
export default function InstallPrompt() {
  const [ev, setEv] = useState<BIPEvent | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    let dismissed = 0;
    try { dismissed = +(localStorage.getItem(KEY) || 0); } catch {}
    if (Date.now() - dismissed < 7 * 864e5) return;
    const onBip = (e: Event) => { e.preventDefault(); setEv(e as BIPEvent); };
    const onInstalled = () => setEv(null);
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!ev) return null;
  const close = () => {
    try { localStorage.setItem(KEY, String(Date.now())); } catch {}
    setEv(null);
  };
  const install = async () => {
    await ev.prompt();
    await ev.userChoice.catch(() => {});
    close();
  };
  return (
    <div className="install-bar" role="dialog" aria-label="აპლიკაციის დაყენება">
      <span>დააყენე აპლიკაციად ტელეფონზე</span>
      <button className="go" onClick={install}>დაყენება</button>
      <button className="x" onClick={close} aria-label="დახურვა">✕</button>
    </div>
  );
}
