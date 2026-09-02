"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { DownloadCloud, X, Smartphone, Sparkles, Check } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

interface PWAContextType {
  isInstallable: boolean;
  isInstalled: boolean;
  promptInstall: () => Promise<void>;
}

const PWAContext = createContext<PWAContextType>({
  isInstallable: false,
  isInstalled: false,
  promptInstall: async () => {},
});

export const usePWA = () => useContext(PWAContext);

export default function PWAProvider({ children }: { children: React.ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [installedSuccess, setInstalledSuccess] = useState(false);

  useEffect(() => {
    // 1. Check if already installed / standalone mode
    if (typeof window !== "undefined") {
      const isStandalone = 
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
        document.referrer.includes("android-app://");
      
      setIsInstalled(Boolean(isStandalone));

      // 2. Register Service Worker
      if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
        window.addEventListener("load", () => {
          navigator.serviceWorker
            .register("/sw.js")
            .then((reg) => {
              console.log("PWA: Service Worker registered", reg.scope);
            })
            .catch((err) => {
              console.warn("PWA: Service Worker registration failed", err);
            });
        });
      }

      // 3. Listen for Chrome / Android beforeinstallprompt
      const handleBeforeInstall = (e: Event) => {
        e.preventDefault();
        const installEvent = e as BeforeInstallPromptEvent;
        setDeferredPrompt(installEvent);

        // Only show banner if user hasn't dismissed recently
        const dismissed = localStorage.getItem("nexa_pwa_dismissed");
        if (!dismissed) {
          setShowBanner(true);
        }
      };

      const handleAppInstalled = () => {
        setIsInstalled(true);
        setDeferredPrompt(null);
        setShowBanner(false);
        setInstalledSuccess(true);
        setTimeout(() => setInstalledSuccess(false), 4000);
      };

      window.addEventListener("beforeinstallprompt", handleBeforeInstall);
      window.addEventListener("appinstalled", handleAppInstalled);

      return () => {
        window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
        window.removeEventListener("appinstalled", handleAppInstalled);
      };
    }
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) {
      // Fallback instruction for browsers like iOS Safari
      alert("To install Nexa Ai on your home screen:\n\n• On Chrome / Android: Tap the menu (⋮) -> 'Install App' or 'Add to Home screen'\n• On iOS Safari: Tap Share (⬆) -> 'Add to Home Screen'");
      return;
    }

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setIsInstalled(true);
        setShowBanner(false);
      }
      setDeferredPrompt(null);
    } catch (err) {
      console.error("PWA install error:", err);
    }
  }, [deferredPrompt]);

  const dismissBanner = () => {
    setShowBanner(false);
    localStorage.setItem("nexa_pwa_dismissed", "true");
  };

  return (
    <PWAContext.Provider value={{ isInstallable: Boolean(deferredPrompt), isInstalled, promptInstall }}>
      {children}

      {/* Floating PWA Install Banner */}
      <AnimatePresence>
        {showBanner && !isInstalled && (
          <motion.div
            id="pwa-install-banner"
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="fixed bottom-5 right-5 z-50 max-w-sm w-[calc(100vw-2.5rem)] rounded-2xl border border-amber-500/30 bg-slate-950/90 text-white p-4 shadow-2xl backdrop-blur-md font-sans"
          >
            <div className="flex items-start gap-3.5">
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-bold shadow-lg shadow-amber-500/20">
                <Smartphone className="h-5 w-5" />
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-slate-900 border border-amber-400">
                  <Sparkles className="h-2 w-2 text-amber-400" />
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-white tracking-tight">Install Nexa Ai App</h4>
                  <button
                    id="dismiss-pwa-banner"
                    onClick={dismissBanner}
                    className="text-slate-400 hover:text-slate-200 transition-colors p-0.5 rounded"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Install on your device for fast fullscreen access without an APK.
                </p>

                <div className="flex items-center gap-2 mt-3">
                  <button
                    id="install-pwa-button"
                    onClick={promptInstall}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-semibold text-xs transition-colors shadow-sm cursor-pointer"
                  >
                    <DownloadCloud className="h-3.5 w-3.5" />
                    <span>Install App</span>
                  </button>
                  <button
                    onClick={dismissBanner}
                    className="py-1.5 px-2.5 rounded-lg border border-slate-800 hover:bg-slate-800/60 text-slate-400 hover:text-slate-200 text-xs transition-colors cursor-pointer"
                  >
                    Later
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Installed Success Toast */}
        {installedSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 rounded-xl border border-emerald-500/40 bg-slate-900/95 text-emerald-300 px-4 py-2.5 shadow-2xl backdrop-blur-md text-xs font-medium"
          >
            <Check className="h-4 w-4 text-emerald-400" />
            <span>Nexa Ai successfully installed to Home Screen!</span>
          </motion.div>
        )}
      </AnimatePresence>
    </PWAContext.Provider>
  );
}
