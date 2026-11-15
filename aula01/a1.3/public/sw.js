// public/sw.js
// Service worker do Festeja Aki: recebe e exibe notificações.
// Não faz cache de páginas, para o painel nunca mostrar dados antigos.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let dados = {};

  try {
    dados = event.data ? event.data.json() : {};
  } catch {
    dados = {};
  }

  event.waitUntil(
    self.registration.showNotification(dados.title || "Festeja Aki", {
      body: dados.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: dados.url || "/admin/reservas" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = (event.notification.data && event.notification.data.url) || "/admin/reservas";

  event.waitUntil(
    (async () => {
      const janelas = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const janela of janelas) {
        if ("focus" in janela) {
          if ("navigate" in janela) await janela.navigate(url).catch(() => {});
          return janela.focus();
        }
      }

      return self.clients.openWindow(url);
    })()
  );
});