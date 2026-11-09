self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || "Chrise", {
      body: data.body || "",
      icon: new URL("pwa-192.png", self.registration.scope).href,
      badge: new URL("pwa-192.png", self.registration.scope).href,
      data: { url: data.url || "" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "", self.registration.scope).href;
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const current = windows.find((window) => "focus" in window);
      return current ? current.focus().then(() => current.navigate(target)) : clients.openWindow(target);
    }),
  );
});
