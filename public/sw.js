// მინიმალური service worker — საჭიროა აპად დაყენების შეთავაზებისთვის; ქეშირება არ ხდება
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
