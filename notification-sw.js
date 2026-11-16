/* HelloEarth Web Push: no offline caches, no access to student or calendar data. */
self.addEventListener("install", event => event.waitUntil(self.skipWaiting()));
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
self.addEventListener("push", event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch {}
  const title = typeof payload.title === "string" ? payload.title.slice(0, 70) : "HelloEarth";
  const body = typeof payload.body === "string" ? payload.body.slice(0, 180) : "You have a new reminder.";
  const tag = typeof payload.tag === "string" ? payload.tag.slice(0, 80) : "helloearth";
  event.waitUntil(self.registration.showNotification(title, {
    body, tag, icon: "/helloearth-logo.png", data: { url: "/dashboard.html#calendar" }
  }));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil((async () => {
    const target = new URL("/dashboard.html#calendar", self.location.origin).href;
    const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of clientsList) {
      if (new URL(client.url).origin === self.location.origin) {
        if ("navigate" in client) await client.navigate(target);
        if ("focus" in client) return client.focus();
      }
    }
    return self.clients.openWindow(target);
  })());
});
