// Minimal service worker. Its only job is to exist, because Android Chrome
// forbids `new Notification()` and requires registration.showNotification().
//
// Deliberately NO fetch handler: this worker caches nothing, so it can never
// serve a stale bundle after a deploy. Offline support would need a real
// caching strategy and cache-busting, which is not worth the risk here.

self.addEventListener('install', () => self.skipWaiting())

// Arrives from the server while the app is closed. This is the only path that
// can notify you without a tab open — everything else needs the page running.
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    // A malformed payload should still produce something useful.
  }

  const title = data.title || 'Consistency'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || 'Time to log a habit.',
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      // Per slot, so several missed reminders stack instead of replacing.
      tag: data.tag || 'consistency',
      data: { habitId: data.habitId ?? null },
      actions: [{ action: 'skip', title: 'Skip' }],
    }),
  )
})

self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

// Tapping a reminder should land you in the app, focusing an existing tab
// rather than piling up new ones.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  // "Skip" dismisses just this one. The slot is already recorded as announced,
  // so it will not fire again today — while every other notification on screen
  // stays exactly where it is.
  if (event.action === 'skip') return

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
