// Retires the old cache-first service worker on devices that already installed it.
// Keep this file: browsers only replace the old worker if this URL returns a changed script.
// The current index.html registers no worker, so this only runs on devices still on the old one.
// Keeps localStorage (saved searches) and caches of other mendescotta.github.io pages.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    await self.clients.claim();
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n.startsWith('repo-finder-')).map((n) => caches.delete(n)));
    await self.registration.unregister();
    const windows = await self.clients.matchAll({ type: 'window' });
    await Promise.all(windows.map((c) => c.navigate(c.url).catch(() => {})));
  })());
});
