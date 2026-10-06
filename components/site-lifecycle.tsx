"use client";
import { useEffect } from "react";
export function SiteLifecycle() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // Update existing installations only; new visitors do not register offline caching.
    void navigator.serviceWorker.getRegistrations().then(async registrations => {
      for (const registration of registrations) {
        const script = registration.active?.scriptURL ?? registration.waiting?.scriptURL;
        if (script && new URL(script).origin === location.origin && new URL(script).pathname === "/sw.js") await registration.update();
      }
    }).catch(() => {});
  }, []);
  return null;
}
