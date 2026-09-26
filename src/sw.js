import {
  cleanupOutdatedCaches,
  precacheAndRoute,
  createHandlerBoundToURL,
} from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
// Ship app fixes without making existing PWA tabs wait for a manual close.
self.addEventListener("install", () => self.skipWaiting());
registerRoute(
  new NavigationRoute(createHandlerBoundToURL("index.html"), {
    denylist: [/^\/api\//, /^\/health/],
  }),
);
// Never cache GPS requests or API responses.
self.addEventListener("activate", (event) =>
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((k) => k.startsWith("tueng-yang-"))
              .map((k) => caches.delete(k)),
          ),
        ),
    ]),
  ),
);
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if (new URL(client.url).origin === self.location.origin)
            return client.focus();
        }
        return self.clients.openWindow("/");
      }),
  );
});
