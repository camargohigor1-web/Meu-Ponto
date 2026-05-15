// MeuPonto Service Worker — push + resumo semanal
const CACHE_NAME = "meuponto-v2";

self.addEventListener("install", event => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(clients.claim());
});

// ── Push recebido do servidor ──
self.addEventListener("push", event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data ? event.data.text() : "" }; }
  const title = data.title || "MeuPonto";
  const options = {
    body: data.body || "Você tem um novo lembrete.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: data.url || "/" },
    tag: data.tag || "meuponto",
    vibrate: [200, 100, 200],
    actions: data.actions || [],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Clique na notificação ──
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  if (event.action === "bater") {
    event.waitUntil(clients.openWindow("/?tela=ponto"));
  } else {
    event.waitUntil(clients.openWindow(url));
  }
});

// ── Mensagem da página → SW (resumo semanal agendado localmente) ──
self.addEventListener("message", event => {
  if (event.data?.type === "RESUMO_SEMANAL") {
    const { saldo, extras, faltas, nome } = event.data;
    const saldoStr = saldo >= 0 ? `+${formatMin(saldo)}` : formatMin(saldo);
    const body = [
      `Olá${nome ? " " + nome.split(" ")[0] : ""}! Resumo da semana:`,
      `⏱ Saldo: ${saldoStr}`,
      extras > 0 ? `✅ Horas extras: ${formatMin(extras)}` : null,
      faltas > 0 ? `⚠️ Faltas: ${faltas} dia(s)` : null,
    ].filter(Boolean).join("\n");
    self.registration.showNotification("📊 Resumo Semanal — MeuPonto", {
      body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: "resumo-semanal",
      vibrate: [200, 100, 200],
      data: { url: "/" },
    });
  }
});

function formatMin(min) {
  const abs = Math.abs(min);
  const h = Math.floor(abs / 60).toString().padStart(2, "0");
  const m = (abs % 60).toString().padStart(2, "0");
  return `${min < 0 ? "-" : ""}${h}h${m}`;
}
