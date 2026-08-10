// Minimal service worker. Its only job is to exist, because Android Chrome
// forbids `new Notification()` and requires registration.showNotification().
//
// Deliberately NO fetch handler: this worker caches nothing, so it can never
// serve a stale bundle after a deploy. Offline support would need a real
// caching strategy and cache-busting, which is not worth the risk here.

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

// Tapping a reminder should land you in the app, focusing an existing tab
// rather than piling up new ones.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ('focus' in client) return client.focus()
        }
        return self.clients.openWindow ? self.clients.openWindow('/') : undefined
      }),
  )
})
