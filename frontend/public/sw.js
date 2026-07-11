// frontend/public/sw.js
// Service worker do Empório — recebe as notificações push (Web Push/VAPID)
// e abre o app do entregador ao tocar na notificação.
// Não faz cache de páginas: só cuida das notificações.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Chegou um push do servidor: mostra a notificação.
self.addEventListener('push', (event) => {
  let dados = {};
  try {
    dados = event.data ? event.data.json() : {};
  } catch (e) {
    dados = { titulo: 'Empório · Entregas', corpo: event.data ? event.data.text() : '' };
  }
  const titulo = dados.titulo || 'Empório · Entregas';
  const opcoes = {
    body: dados.corpo || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: dados.tag || 'emporio-entrega',
    renotify: true,
    vibrate: [200, 100, 200],
    data: { url: dados.url || '/entregador' },
  };
  event.waitUntil(self.registration.showNotification(titulo, opcoes));
});

// Toque na notificação: foca o app se já estiver aberto; senão, abre.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/entregador';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
      for (const cliente of lista) {
        if (cliente.url.includes('/entregador') && 'focus' in cliente) return cliente.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
